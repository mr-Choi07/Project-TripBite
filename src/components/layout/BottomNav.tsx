import { NavLink, useNavigate } from 'react-router-dom'
import { Store, UtensilsCrossed, Route as RouteIcon, Stamp, QrCode } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function BottomNav() {
  const { t } = useApp()
  const navigate = useNavigate()

  const leftItems = [
    { to: '/landing', label: t('navHome'), icon: Store },
    { to: '/menu', label: t('navMenu'), icon: UtensilsCrossed },
  ]
  const rightItems = [
    { to: '/course', label: t('navCourse'), icon: RouteIcon },
    { to: '/stamp', label: t('navStamp'), icon: Stamp },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-tb-line bg-tb-paper-raised/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto flex max-w-md items-stretch justify-between px-2">
        {leftItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-tb-teal-500' : 'text-tb-ink-soft'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Spacer holding the raised center button's footprint in the flex row */}
        <div className="w-16 shrink-0" />

        {rightItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-tb-teal-500' : 'text-tb-ink-soft'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => navigate('/scan')}
          aria-label={t('scanQr')}
          className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-tb-coral-500 text-white shadow-tb-float active:scale-95"
        >
          <QrCode size={24} />
        </button>
      </div>
    </nav>
  )
}
