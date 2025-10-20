import Dashboard from '@/components/Dashboard'
import ProtectedRoute from '@/components/Auth/ProtectedRoute'

export default function Home() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}