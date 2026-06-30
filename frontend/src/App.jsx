import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useBusiness } from './contexts/BusinessContext'
import PrivateRoute from './components/auth/PrivateRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import LocationsPage from './pages/LocationsPage'
import CollectSettingsPage from './pages/CollectSettingsPage'
import QRCodePage from './pages/QRCodePage'
import CustomersPage from './pages/CustomersPage'
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const CollectPage    = lazy(() => import('./pages/CollectPage'))

function RequireBusiness({ children }) {
  const { isLoading: authLoading } = useAuth()
  const { hasBusinesses, isLoading: bizLoading } = useBusiness()

  if (authLoading || bizLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-page">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return hasBusinesses ? children : <Navigate to="/onboarding" replace />
}


export default function App() {
  return (
    <Routes>
      {/* Page de collecte publique — sans authentification (scannée via QR) */}
      <Route path="/avis/:businessSlug/:locationSlug" element={<Suspense fallback={null}><CollectPage /></Suspense>} />

      <Route path="/login"           element={<LoginPage />} />
      <Route path="/register"        element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />
      <Route path="/onboarding"      element={<PrivateRoute><Suspense fallback={null}><OnboardingPage /></Suspense></PrivateRoute>} />
      <Route path="/dashboard"       element={<PrivateRoute><RequireBusiness><DashboardPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/locations"       element={<PrivateRoute><RequireBusiness><LocationsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/settings"                   element={<PrivateRoute><RequireBusiness><SettingsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/parametres-page-collecte"  element={<PrivateRoute><RequireBusiness><CollectSettingsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/qrcode"                   element={<PrivateRoute><RequireBusiness><QRCodePage /></RequireBusiness></PrivateRoute>} />
      <Route path="/customers"               element={<PrivateRoute><RequireBusiness><CustomersPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/"                element={<Navigate to="/dashboard" replace />} />
      <Route path="*"                element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
