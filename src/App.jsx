import { useAuth } from './context/AuthContext';
import LoginScreen from './components/auth/LoginScreen';
import AgentDashboard from './components/dashboard/AgentDashboard';
import ManagerDashboard from './components/dashboard/ManagerDashboard';

const MANAGER_ROLES = new Set(['unit_manager', 'branch_manager', 'super_admin']);

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm font-medium text-ink-muted">Loading AgencyTrack…</p>
    </div>
  </div>
);

export default function App() {
  const { role, loading, isAuthenticated } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;
  if (MANAGER_ROLES.has(role)) return <ManagerDashboard />;
  return <AgentDashboard />;
}
