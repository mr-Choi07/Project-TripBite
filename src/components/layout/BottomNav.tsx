import { NavLink } from 'react-router-dom'
import { Store, UtensilsCrossed, Route as RouteIcon, Stamp } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function BottomNav() {
  const { t } = useApp()

  const items = [
    { to: '/landing', label: t('navHome'), icon: Store },
    { to: '/menu', label: t('navMenu'), icon: UtensilsCrossed },
    { to: '/course', label: t('navCourse'), icon: RouteIcon },
    { to: '/stamp', label: t('navStamp'), icon: Stamp },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-tb-line bg-tb-paper-raised/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon }) => (
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
      </div>
    </nav>
  )
}
