import type { ReactNode } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

interface AppShellProps {
  children: ReactNode
  title?: string
  showBack?: boolean
  showNav?: boolean
}

export default function AppShell({ children, title, showBack, showNav = true }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-tb-paper">
      <TopBar title={title} showBack={showBack} />
      <main className={`tb-fade-up flex-1 ${showNav ? 'pb-24' : 'pb-6'}`}>{children}</main>
      {showNav && <BottomNav />}
    </div>
  )
}
