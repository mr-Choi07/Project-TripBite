import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, Store as StoreIcon, Receipt, LogOut, ArrowLeft, UserCog } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { ownerSignOut } from '../../lib/ownerAuth'

const NAV_ITEMS = [
  { to: '/stats', label: '통계', icon: BarChart3 },
  { to: '/owner/manage', label: '매장·메뉴 관리', icon: StoreIcon },
  { to: '/owner/orders', label: '주문 관리', icon: Receipt },
  { to: '/owner/account', label: '계정', icon: UserCog },
]

interface Props {
  /** Shown as the mobile top-bar title and the desktop page heading. */
  title: string
  children: ReactNode
}

/** Layout for the owner-facing management screens (stats/store/orders) —
 * on mobile this reads just like the old single-column AppShell, but on a
 * desktop-width viewport it becomes an actual sidebar-navigated dashboard
 * instead of a shrunk-down phone screen. The tourist-facing QR menu screens
 * intentionally keep the phone-frame treatment instead (see App.tsx) since
 * real visitors only ever use those from a phone. */
export default function OwnerDashboardShell({ title, children }: Props) {
  const navigate = useNavigate()
  const { firebaseUser } = useApp()

  async function handleLogout() {
    await ownerSignOut()
    navigate('/owner/login')
  }

  return (
    <div className="min-h-dvh bg-tb-paper lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-tb-line bg-tb-paper-raised lg:flex lg:flex-col">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tb-coral-500 text-sm font-black text-white">
            T
          </div>
          <span className="text-base font-extrabold tracking-tight text-tb-teal-600">TripBite</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-tb-teal-50 text-tb-teal-700' : 'text-tb-ink-soft hover:bg-tb-sand-100'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-tb-line px-3 py-4">
          {firebaseUser?.email && (
            <p className="truncate px-3 pb-1 text-[11px] text-tb-ink-soft">{firebaseUser.email}</p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-tb-coral-600 hover:bg-tb-coral-50"
          >
            <LogOut size={17} />
            로그아웃
          </button>
        </div>
      </aside>

      <div className="flex items-center gap-2 border-b border-tb-line bg-tb-paper-raised px-4 py-3.5 lg:hidden">
        <button type="button" onClick={() => navigate(-1)} className="text-tb-ink-soft">
          <ArrowLeft size={18} />
        </button>
        <span className="text-base font-bold text-tb-ink">{title}</span>
      </div>

      <main className="flex-1 lg:h-dvh lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-4 pb-8 pt-3 lg:max-w-6xl lg:px-10 lg:py-9">
          <h1 className="hidden text-2xl font-black text-tb-ink lg:mb-7 lg:block">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
