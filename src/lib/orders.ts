import { collection, doc, getDocs, onSnapshot, orderBy, query, Timestamp, updateDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { authReady, db, firebaseApp } from './firebase'
import { pickLocalized } from '../i18n'
import type { CartLine, Lang, Order, OrderLine, OrderStatus } from '../types'

const functions = getFunctions(firebaseApp, 'asia-northeast3')

export class PlaceOrderError extends Error {}

function ordersRef(storeId: string) {
  return collection(db, 'stores', storeId, 'orders')
}

function cartToLines(cart: CartLine[]): OrderLine[] {
  return cart.map((line) => ({
    itemId: line.item.id,
    name: line.item.name,
    price: line.item.price,
    qty: line.qty,
  }))
}

/** Wraps the browser geolocation callback API in a promise — placing an
 * order requires this (see `placeOrder`) so the server can reject orders
 * from clearly outside the store, rather than trusting a client-supplied
 * "I'm here" claim with nothing behind it. */
function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new PlaceOrderError('이 브라우저에서는 위치 확인을 지원하지 않아요.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new PlaceOrderError('주문하려면 위치 권한을 허용해주세요.'))
        } else {
          reject(new PlaceOrderError('위치를 확인할 수 없어요. 잠시 후 다시 시도해주세요.'))
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}

/** Places an order from the visitor's current cart — called at checkout.
 * Line contents are snapshotted from the cart so a later menu edit doesn't
 * retroactively change what an already-placed order shows.
 *
 * Goes through the `submitOrder` Cloud Function rather than writing
 * Firestore directly, so it can be rate-limited (and location-checked)
 * server-side — an anonymous visitor session costs nothing to create, so a
 * direct client write here would let a scripted client flood a store's
 * order list for free from anywhere in the world. Returns the assigned
 * daily queue number (e.g. "3번 고객님") so the visitor can be shown it too. */
export async function placeOrder(storeId: string, cart: CartLine[], total: number, lang: Lang): Promise<number> {
  await authReady
  const { lat, lng } = await getCurrentPosition()

  const call = httpsCallable<
    { storeId: string; lines: OrderLine[]; total: number; lang: Lang; lat: number; lng: number },
    { orderId: string; orderNumber: number }
  >(functions, 'submitOrder')
  try {
    const res = await call({ storeId, lines: cartToLines(cart), total, lang, lat, lng })
    return res.data.orderNumber
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'functions/resource-exhausted') {
      throw new PlaceOrderError('너무 많은 주문을 시도했어요. 잠시 후 다시 시도해주세요.')
    }
    if (code === 'functions/failed-precondition') {
      throw new PlaceOrderError('매장 근처에서만 주문할 수 있어요.')
    }
    throw new PlaceOrderError('주문 접수에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }
}

interface OrderDoc {
  storeId: string
  orderNumber: number
  lines: OrderLine[]
  total: number
  status: OrderStatus
  lang: Lang
  createdAt: Timestamp | null
}

/** Real-time order list for the owner dashboard, newest first. Returns an
 * unsubscribe function — callers must call it on unmount to avoid leaking
 * the listener. */
export function subscribeOrders(storeId: string, onChange: (orders: Order[]) => void): () => void {
  const q = query(ordersRef(storeId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) => {
      const data = d.data() as OrderDoc
      return {
        id: d.id,
        storeId: data.storeId,
        orderNumber: data.orderNumber,
        lines: data.lines,
        total: data.total,
        status: data.status,
        lang: data.lang,
        // A just-written order's serverTimestamp() hasn't round-tripped from
        // the server yet on the writer's own optimistic local snapshot, so
        // `createdAt` briefly reads null — falls back to "now" rather than 0
        // so it doesn't sort to the very bottom for that first instant.
        createdAtMs: data.createdAt?.toMillis() ?? Date.now(),
      } satisfies Order
    })
    onChange(orders)
  })
}

export async function updateOrderStatus(storeId: string, orderId: string, status: OrderStatus): Promise<void> {
  await authReady
  await updateDoc(doc(ordersRef(storeId), orderId), { status })
}

export interface RevenueSummary {
  totalRevenue: number
  todayRevenue: number
  completedCount: number
  topItems: { name: string; qty: number }[]
}

/** One-time (non-realtime) read for the stats dashboard — revenue only
 * counts orders that actually reached 'completed' (a cancelled order was
 * never fulfilled, so it shouldn't count as sales). */
export async function getRevenueSummary(storeId: string): Promise<RevenueSummary> {
  const snap = await getDocs(ordersRef(storeId))
  const dayMs = 24 * 60 * 60 * 1000
  const todayStart = Math.floor(Date.now() / dayMs) * dayMs

  let totalRevenue = 0
  let todayRevenue = 0
  let completedCount = 0
  const itemQty = new Map<string, { name: string; qty: number }>()

  for (const d of snap.docs) {
    const data = d.data() as OrderDoc
    if (data.status !== 'completed') continue

    completedCount += 1
    totalRevenue += data.total
    const createdAtMs = data.createdAt?.toMillis() ?? 0
    if (createdAtMs >= todayStart) todayRevenue += data.total

    for (const line of data.lines) {
      const key = line.itemId
      const existing = itemQty.get(key)
      if (existing) {
        existing.qty += line.qty
      } else {
        itemQty.set(key, { name: pickLocalized(line.name, 'ko'), qty: line.qty })
      }
    }
  }

  const topItems = [...itemQty.values()].sort((a, b) => b.qty - a.qty).slice(0, 3)

  return { totalRevenue, todayRevenue, completedCount, topItems }
}
