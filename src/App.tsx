import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import EntryScreen from './screens/EntryScreen'
import PlaceLandingScreen from './screens/PlaceLandingScreen'
import MenuScreen from './screens/MenuScreen'
import AIRecommendScreen from './screens/AIRecommendScreen'
import CourseScreen from './screens/CourseScreen'
import StampScreen from './screens/StampScreen'
import StatsScreen from './screens/StatsScreen'
import OwnerLoginScreen from './screens/OwnerLoginScreen'
import OwnerManageScreen from './screens/OwnerManageScreen'
import OwnerOrdersScreen from './screens/OwnerOrdersScreen'
import OwnerAccountScreen from './screens/OwnerAccountScreen'
import PhoneVerifyGate from './screens/PhoneVerifyGate'
import QrScanScreen from './screens/QrScanScreen'
import QrEnterScreen from './screens/QrEnterScreen'
import ToastHost from './components/ui/ToastHost'

function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useApp()
  if (!session.entered) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireOwner({ children }: { children: ReactNode }) {
  const { authReady, isOwner, isVerifiedOwner } = useApp()
  if (!authReady) return null
  if (!isOwner) return <Navigate to="/owner/login" replace />
  if (!isVerifiedOwner) return <PhoneVerifyGate />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EntryScreen />} />
      <Route path="/enter" element={<QrEnterScreen />} />
      <Route
        path="/landing"
        element={
          <RequireSession>
            <PlaceLandingScreen />
          </RequireSession>
        }
      />
      <Route
        path="/menu"
        element={
          <RequireSession>
            <MenuScreen />
          </RequireSession>
        }
      />
      <Route
        path="/menu/ai"
        element={
          <RequireSession>
            <AIRecommendScreen />
          </RequireSession>
        }
      />
      <Route
        path="/course"
        element={
          <RequireSession>
            <CourseScreen />
          </RequireSession>
        }
      />
      <Route
        path="/stamp"
        element={
          <RequireSession>
            <StampScreen />
          </RequireSession>
        }
      />
      <Route
        path="/scan"
        element={
          <RequireSession>
            <QrScanScreen />
          </RequireSession>
        }
      />
      <Route path="/owner/login" element={<OwnerLoginScreen />} />
      <Route
        path="/stats"
        element={
          <RequireOwner>
            <StatsScreen />
          </RequireOwner>
        }
      />
      <Route
        path="/owner/manage"
        element={
          <RequireOwner>
            <OwnerManageScreen />
          </RequireOwner>
        }
      />
      <Route
        path="/owner/orders"
        element={
          <RequireOwner>
            <OwnerOrdersScreen />
          </RequireOwner>
        }
      />
      <Route
        path="/owner/account"
        element={
          <RequireOwner>
            <OwnerAccountScreen />
          </RequireOwner>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Owner *management* screens (stats/store-menu/orders) get a real desktop
// dashboard layout instead of the phone-frame simulation — see
// OwnerDashboardShell. Login/verification screens are still plain forms, so
// they keep the phone frame; tourists only ever use the QR-menu screens from
// an actual phone, so those always keep it too.
const DASHBOARD_ROUTE_PREFIXES = ['/stats', '/owner/manage', '/owner/orders', '/owner/account']

function AppFrame() {
  const location = useLocation()
  const isDashboardRoute = DASHBOARD_ROUTE_PREFIXES.some((p) => location.pathname.startsWith(p))

  if (isDashboardRoute) {
    return (
      <div id="tb-app-frame" className="min-h-dvh w-full bg-tb-paper">
        <AppRoutes />
        <ToastHost />
      </div>
    )
  }

  return (
    // On a wide desktop viewport this keeps every screen's own full-bleed
    // background confined to a phone-width column instead of stretching
    // edge to edge. `id="tb-app-frame"` also doubles as the portal target
    // for fixed-position overlays (see CartSheet) so they stay inside the
    // frame rather than escaping to the real viewport.
    <div
      id="tb-app-frame"
      className="relative mx-auto min-h-dvh w-full max-w-[480px] overflow-hidden bg-tb-paper [transform:translateZ(0)] md:my-6 md:min-h-[calc(100dvh-3rem)] md:rounded-[32px] md:shadow-tb-float"
    >
      <AppRoutes />
      <ToastHost />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppFrame />
      </BrowserRouter>
    </AppProvider>
  )
}
