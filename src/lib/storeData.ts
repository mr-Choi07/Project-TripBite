import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { authReady, db } from './firebase'
import { SUNRISE_BOWL } from '../data/place'
import { MENU as SEED_MENU } from '../data/menu'
import type { MenuItem, StorePlace } from '../types'

function storeRef(storeId: string) {
  return doc(db, 'stores', storeId)
}

function menuCollectionRef(storeId: string) {
  return collection(db, 'stores', storeId, 'menu')
}

/** Reads a store's profile from Firestore. The bundled demo store
 * (`sunrise-bowl`) falls back to its seed data if no one has registered it
 * in Firestore yet — or if Firestore itself can't be reached (e.g. rules not
 * deployed yet) — so the existing demo keeps working without a manual data
 * migration or a live backend. */
export async function getStore(storeId: string): Promise<StorePlace | null> {
  await authReady
  try {
    const snap = await getDoc(storeRef(storeId))
    if (snap.exists()) return snap.data() as StorePlace
  } catch (err) {
    console.error('[storeData] getStore failed', err)
  }
  return storeId === SUNRISE_BOWL.storeId ? SUNRISE_BOWL : null
}

/** Reads a store's menu from Firestore, falling back to the bundled seed
 * menu for the demo store when nothing has been registered yet or Firestore
 * can't be reached. */
export async function getMenu(storeId: string): Promise<MenuItem[]> {
  await authReady
  try {
    const snap = await getDocs(menuCollectionRef(storeId))
    if (!snap.empty) return snap.docs.map((d) => d.data() as MenuItem)
  } catch (err) {
    console.error('[storeData] getMenu failed', err)
  }
  return storeId === SUNRISE_BOWL.storeId ? SEED_MENU : []
}

/** Looks up the store owned by the given (non-anonymous) uid, if any —
 * used to route an owner straight to "manage my store" instead of
 * "register a new store" once they've already registered one. */
export async function findStoreByOwner(uid: string): Promise<StorePlace | null> {
  await authReady
  try {
    const q = query(collection(db, 'stores'), where('ownerUid', '==', uid), limit(1))
    const snap = await getDocs(q)
    if (!snap.empty) return snap.docs[0].data() as StorePlace
  } catch (err) {
    console.error('[storeData] findStoreByOwner failed', err)
  }
  return null
}

/** Every registered store except `excludeStoreId` (the visitor's current
 * store) — used to fold other TripBite owners' storefronts into the course
 * recommendation pool as course stops, alongside TourAPI spots. */
export async function getAllStores(excludeStoreId?: string): Promise<StorePlace[]> {
  await authReady
  try {
    const snap = await getDocs(collection(db, 'stores'))
    return snap.docs.map((d) => d.data() as StorePlace).filter((s) => s.storeId !== excludeStoreId)
  } catch (err) {
    console.error('[storeData] getAllStores failed', err)
    return []
  }
}

export async function storeIdExists(storeId: string): Promise<boolean> {
  await authReady
  const snap = await getDoc(storeRef(storeId))
  return snap.exists()
}

export async function createStore(store: StorePlace): Promise<void> {
  await authReady
  await setDoc(storeRef(store.storeId), store)
}

export async function saveStore(store: StorePlace): Promise<void> {
  await authReady
  await setDoc(storeRef(store.storeId), store, { merge: true })
}

export async function saveMenuItem(storeId: string, item: MenuItem): Promise<void> {
  await authReady
  await setDoc(doc(menuCollectionRef(storeId), item.id), item)
}

export async function deleteMenuItem(storeId: string, itemId: string): Promise<void> {
  await authReady
  await deleteDoc(doc(menuCollectionRef(storeId), itemId))
}
