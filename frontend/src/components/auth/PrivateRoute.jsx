import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-page">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}
