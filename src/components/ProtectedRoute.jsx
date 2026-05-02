import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function ProtectedRoute({ children, requireRole }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search,
          fromState: location.state,
        }}
      />
    )
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to="/" replace />
  }

  return children
}
