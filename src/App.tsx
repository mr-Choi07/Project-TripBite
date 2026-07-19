import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import EntryScreen from './screens/EntryScreen'
import PlaceLandingScreen from './screens/PlaceLandingScreen'
import MenuScreen from './screens/MenuScreen'
import AIRecommendScreen from './screens/AIRecommendScreen'
import CourseScreen from './screens/CourseScreen'
import StampScreen from './screens/StampScreen'
import StatsScreen from './screens/StatsScreen'
import OwnerLoginScreen from './screens/OwnerLoginScreen'
import ToastHost from './components/ui/ToastHost'

function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useApp()
  if (!session.entered) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireOwner({ children }: { children: ReactNode }) {
  const { authReady, isOwner } = useApp()
  if (!authReady) return null
  if (!isOwner) return <Navigate to="/owner/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EntryScreen />} />
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
      <Route path="/owner/login" element={<OwnerLoginScreen />} />
      <Route
        path="/stats"
        element={
          <RequireOwner>
            <StatsScreen />
          </RequireOwner>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastHost />
      </BrowserRouter>
    </AppProvider>
  )
}
