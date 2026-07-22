import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Store as StoreIcon, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import OwnerDashboardShell from '../components/layout/OwnerDashboardShell'
import { findStoreByOwner } from '../lib/storeData'
import { subscribeOrders, updateOrderStatus } from '../lib/orders'
import { pickLocalized, LANG_FLAG_LABEL } from '../i18n'
import type { Order, OrderStatus, StorePlace } from '../types'

const ACTIVE_STATUSES: OrderStatus[] = ['placed', 'preparing', 'ready']

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: '신규 주문',
  preparing: '준비 중',
  ready: '준비 완료',
  completed: '수령 완료',
  cancelled: '취소됨',
}

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  placed: 'bg-tb-coral-50 text-tb-coral-600',
  preparing: 'bg-tb-sand-100 text-tb-ink-soft',
  ready: 'bg-tb-teal-50 text-tb-teal-600',
  completed: 'bg-tb-sand-100 text-tb-ink-soft/70',
  cancelled: 'bg-tb-sand-100 text-tb-ink-soft/50',
}

/** Status the "다음 단계" button advances an order to, or null once it's in
 * a terminal state (completed/cancelled — no further forward action). */
const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  placed: { next: 'preparing', label: '준비 시작' },
  preparing: { next: 'ready', label: '준비 완료' },
  ready: { next: 'completed', label: '수령 완료' },
}

function timeAgo(ms: number): string {
  const diffMin = Math.floor((Date.now() - ms) / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}시간 전`
  return `${Math.floor(diffHr / 24)}일 전`
}

function OrderCard({ order, storeId }: { order: Order; storeId: string }) {
  const [updating, setUpdating] = useState(false)
  const next = NEXT_STATUS[order.status]
  const isActive = ACTIVE_STATUSES.includes(order.status)

  async function handleAdvance() {
    if (!next) return
    setUpdating(true)
    try {
      await updateOrderStatus(storeId, order.id, next.next)
    } catch (err) {
      console.error('[OwnerOrdersScreen] status update failed', err)
    } finally {
      setUpdating(false)
    }
  }

  async function handleCancel() {
    setUpdating(true)
    try {
      await updateOrderStatus(storeId, order.id, 'cancelled')
    } catch (err) {
      console.error('[OwnerOrdersScreen] cancel failed', err)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${
        order.status === 'placed' ? 'border-tb-coral-200 bg-tb-coral-50/40' : 'border-tb-line bg-tb-paper-raised'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-black text-tb-ink">{order.orderNumber}번 고객님</span>
        <span className="flex items-center gap-1 text-[11px] text-tb-ink-soft">
          <Clock size={11} />
          {timeAgo(order.createdAtMs)}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_BADGE_CLASS[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
        <span className="rounded-full bg-tb-sand-100 px-2 py-0.5 text-[10px] font-bold text-tb-ink-soft">
          {LANG_FLAG_LABEL[order.lang]}
        </span>
      </div>

      <div className="mt-3 space-y-1">
        {order.lines.map((line, i) => (
          <div key={`${line.itemId}-${i}`} className="flex items-center justify-between text-sm">
            <span className="text-tb-ink">
              {pickLocalized(line.name, 'ko')} <span className="text-tb-ink-soft">× {line.qty}</span>
            </span>
            <span className="tabular-nums text-tb-ink-soft">₩{(line.price * line.qty).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-tb-line pt-2.5">
        <span className="text-xs font-medium text-tb-ink-soft">합계</span>
        <span className="text-base font-extrabold text-tb-ink">₩{order.total.toLocaleString()}</span>
      </div>

      {isActive && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={updating}
            className="flex items-center justify-center gap-1 rounded-xl border border-tb-line px-3 py-2.5 text-xs font-semibold text-tb-ink-soft disabled:opacity-50"
          >
            <X size={13} />
            취소
          </button>
          {next && (
            <button
              type="button"
              onClick={handleAdvance}
              disabled={updating}
              className="flex-1 rounded-xl bg-tb-teal-500 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {updating ? '처리 중...' : next.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function OrdersColumn({ label, orders, storeId, emptyText }: { label: string; orders: Order[]; storeId: string; emptyText: string }) {
  return (
    <div className="flex max-h-[70vh] flex-col rounded-2xl border border-tb-line bg-tb-paper-raised/60">
      <div className="flex items-center justify-between border-b border-tb-line px-4 py-3">
        <p className="text-sm font-bold text-tb-ink">{label}</p>
        <span className="rounded-full bg-tb-sand-100 px-2 py-0.5 text-[11px] font-bold text-tb-ink-soft">{orders.length}</span>
      </div>
      <div className="space-y-3 overflow-y-auto p-3">
        {orders.length === 0 && <p className="py-10 text-center text-xs text-tb-ink-soft">{emptyText}</p>}
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} storeId={storeId} />
        ))}
      </div>
    </div>
  )
}

export default function OwnerOrdersScreen() {
  const { uid } = useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [myStore, setMyStore] = useState<StorePlace | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [tab, setTab] = useState<'active' | 'history'>('active')

  useEffect(() => {
    if (!uid) return
    let active = true
    findStoreByOwner(uid).then((s) => {
      if (!active) return
      setMyStore(s)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [uid])

  useEffect(() => {
    if (!myStore) return
    const unsubscribe = subscribeOrders(myStore.storeId, setOrders)
    return unsubscribe
  }, [myStore])

  const placedOrders = orders.filter((o) => o.status === 'placed')
  const preparingOrders = orders.filter((o) => o.status === 'preparing')
  const readyOrders = orders.filter((o) => o.status === 'ready')
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const historyOrders = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status))
  const shownOrders = tab === 'active' ? activeOrders : historyOrders

  if (loading) {
    return (
      <OwnerDashboardShell title="주문 관리">
        <div className="flex flex-col items-center gap-2 py-24 text-tb-ink-soft">
          <p className="text-xs">불러오는 중...</p>
        </div>
      </OwnerDashboardShell>
    )
  }

  if (!myStore) {
    return (
      <OwnerDashboardShell title="주문 관리">
        <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
          <StoreIcon size={28} className="text-tb-ink-soft" />
          <p className="text-sm font-semibold text-tb-ink">아직 등록된 매장이 없습니다</p>
          <button
            type="button"
            onClick={() => navigate('/owner/manage')}
            className="mt-2 rounded-2xl bg-tb-ink px-5 py-3 text-sm font-bold text-white"
          >
            매장 등록하기
          </button>
        </div>
      </OwnerDashboardShell>
    )
  }

  return (
    <OwnerDashboardShell title="주문 관리">
      <div className="pt-3 pb-8 lg:pt-0">
        <button
          type="button"
          onClick={() => navigate('/stats')}
          className="flex items-center gap-1 text-xs font-semibold text-tb-ink-soft lg:hidden"
        >
          <ArrowLeft size={13} />
          통계로 돌아가기
        </button>

        {/* Mobile: tabbed single list */}
        <div className="lg:hidden">
          <div className="mt-4 flex rounded-full bg-tb-sand-100 p-1">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
                tab === 'active' ? 'bg-white text-tb-ink shadow-tb-card' : 'text-tb-ink-soft'
              }`}
            >
              진행 중 {activeOrders.length > 0 && `(${activeOrders.length})`}
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
                tab === 'history' ? 'bg-white text-tb-ink shadow-tb-card' : 'text-tb-ink-soft'
              }`}
            >
              지난 주문
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {shownOrders.length === 0 && (
              <p className="py-16 text-center text-xs text-tb-ink-soft">
                {tab === 'active' ? '진행 중인 주문이 없습니다' : '지난 주문이 없습니다'}
              </p>
            )}
            {shownOrders.map((order) => (
              <OrderCard key={order.id} order={order} storeId={myStore.storeId} />
            ))}
          </div>
        </div>

        {/* Desktop: kanban columns, always all visible side by side */}
        <div className="hidden lg:grid lg:grid-cols-4 lg:items-start lg:gap-4">
          <OrdersColumn label="신규 주문" orders={placedOrders} storeId={myStore.storeId} emptyText="새 주문이 없습니다" />
          <OrdersColumn label="준비 중" orders={preparingOrders} storeId={myStore.storeId} emptyText="준비 중인 주문이 없습니다" />
          <OrdersColumn label="준비 완료" orders={readyOrders} storeId={myStore.storeId} emptyText="준비 완료된 주문이 없습니다" />
          <OrdersColumn label="지난 주문" orders={historyOrders} storeId={myStore.storeId} emptyText="지난 주문이 없습니다" />
        </div>
      </div>
    </OwnerDashboardShell>
  )
}
