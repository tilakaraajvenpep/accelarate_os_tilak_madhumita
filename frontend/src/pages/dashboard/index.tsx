import { useAuth } from '@/context/auth-context'
import FounderDashboard from './founder'
import AdminDashboard from './admin'
import SuperAdminDashboard from './super-admin'

export default function DashboardPage() {
  const { user } = useAuth()

  if (user?.role === 'super_admin') return <SuperAdminDashboard />
  if (user?.role === 'admin') return <AdminDashboard />
  return <FounderDashboard />
}
