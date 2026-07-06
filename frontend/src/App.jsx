import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useBusiness } from './contexts/BusinessContext'
import PrivateRoute from './components/auth/PrivateRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AcceptInvitationPage from './pages/AcceptInvitationPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import LocationsPage from './pages/LocationsPage'
import CollectSettingsPage from './pages/CollectSettingsPage'
import QRCodePage from './pages/QRCodePage'
import CustomersPage from './pages/CustomersPage'
import InvitationsPage from './pages/InvitationsPage'
import ReviewsPage from './pages/ReviewsPage'
import CreditsPage from './pages/CreditsPage'
import PricingPage from './pages/PricingPage'
import WidgetsPage from './pages/WidgetsPage'
import WidgetBuilderPage from './pages/WidgetBuilderPage'
import AdminPlansPage from './pages/AdminPlansPage'
import AdminAccountsPage from './pages/AdminAccountsPage'
import AdminModulesPage from './pages/AdminModulesPage'
const OnboardingPage    = lazy(() => import('./pages/OnboardingPage'))
const CollectPage       = lazy(() => import('./pages/CollectPage'))
const GeogridConfigPage      = lazy(() => import('./pages/GeogridConfigPage'))
const GeogridSuiviPage       = lazy(() => import('./pages/GeogridSuiviPage'))
const GeogridConcurrentsPage = lazy(() => import('./pages/GeogridConcurrentsPage'))
const ReviewsConcurrentsPage = lazy(() => import('./pages/ReviewsConcurrentsPage'))

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
      <Route path="/invitation"      element={<AcceptInvitationPage />} />
      <Route path="/onboarding"      element={<PrivateRoute><Suspense fallback={null}><OnboardingPage /></Suspense></PrivateRoute>} />
      <Route path="/dashboard"       element={<PrivateRoute><RequireBusiness><DashboardPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/locations"       element={<PrivateRoute><RequireBusiness><LocationsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/settings"                   element={<PrivateRoute><RequireBusiness><SettingsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/parametres-page-collecte"  element={<PrivateRoute><RequireBusiness><CollectSettingsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/qrcode"                   element={<PrivateRoute><RequireBusiness><QRCodePage /></RequireBusiness></PrivateRoute>} />
      <Route path="/customers"               element={<PrivateRoute><RequireBusiness><CustomersPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/invitations"             element={<PrivateRoute><RequireBusiness><InvitationsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/reviews"                 element={<PrivateRoute><RequireBusiness><ReviewsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/reviews/concurrents"     element={<PrivateRoute><RequireBusiness><Suspense fallback={null}><ReviewsConcurrentsPage /></Suspense></RequireBusiness></PrivateRoute>} />
      <Route path="/widgets"                 element={<PrivateRoute><RequireBusiness><WidgetsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/widgets/new"             element={<PrivateRoute><RequireBusiness><WidgetBuilderPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/widgets/:id"             element={<PrivateRoute><RequireBusiness><WidgetBuilderPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/positionnement/configuration" element={<PrivateRoute><RequireBusiness><Suspense fallback={null}><GeogridConfigPage /></Suspense></RequireBusiness></PrivateRoute>} />
      <Route path="/positionnement/suivi"          element={<PrivateRoute><RequireBusiness><Suspense fallback={null}><GeogridSuiviPage /></Suspense></RequireBusiness></PrivateRoute>} />
      <Route path="/positionnement/concurrents"    element={<PrivateRoute><RequireBusiness><Suspense fallback={null}><GeogridConcurrentsPage /></Suspense></RequireBusiness></PrivateRoute>} />
      <Route path="/positionnement"                element={<Navigate to="/positionnement/configuration" replace />} />
      <Route path="/credits"                 element={<PrivateRoute><RequireBusiness><CreditsPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/pricing"                 element={<PrivateRoute><RequireBusiness><PricingPage /></RequireBusiness></PrivateRoute>} />
      <Route path="/admin/plans"             element={<PrivateRoute requireRole="superadmin"><AdminPlansPage /></PrivateRoute>} />
      <Route path="/admin/accounts"          element={<PrivateRoute requireRole="superadmin"><AdminAccountsPage /></PrivateRoute>} />
      <Route path="/admin/modules"           element={<PrivateRoute requireRole="superadmin"><AdminModulesPage /></PrivateRoute>} />
      <Route path="/"                element={<Navigate to="/dashboard" replace />} />
      <Route path="*"                element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
