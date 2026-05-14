import { useAuth } from './context/AuthContext';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import LoginScreen from './components/auth/LoginScreen';
import AgentDashboard from './components/dashboard/AgentDashboard';
import ManagerDashboard from './components/dashboard/ManagerDashboard';
import TenantAdminDashboard from './components/dashboard/TenantAdminDashboard';
import ToastProvider from './components/ui/ToastProvider';

// Tenant Admin gets a dedicated dashboard surface from B5 forward — the
// company config write path lives there. The remaining manager-tier roles
// still share ManagerDashboard until per-role differentiation lands in P9.
const MANAGER_ROLES = new Set(['unit_manager', 'branch_manager', 'sales_manager', 'platform_admin']);

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm font-medium text-ink-muted">Loading AgencyTrack…</p>
    </div>
  </div>
);

const PlatformAdminStubScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface px-6">
    <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-display font-bold text-ink mb-2">Platform Admin</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          Cross-tenant platform admin features ship in SEC-9b. Sign in as your tenant admin account to continue.
        </p>
      </div>
      <button
        onClick={() => signOut(auth)}
        className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
      >
        Sign Out
      </button>
    </div>
  </div>
);

// Shown when a user is authenticated but role/tenantId haven't resolved yet.
// This can occur on a brand-new account's very first login if the Firebase
// Auth setCustomUserClaims() propagation delay exceeds the parallel doc-read
// window (no cached tenantId available yet). Signing out and back in after a
// few seconds will resolve once claims have propagated.
const ProvisioningScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface px-6">
    <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <div>
        <h1 className="text-xl font-display font-bold text-ink mb-2">Setting up your account</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          Your account is still being provisioned. Please wait a moment, then sign out and sign back in.
        </p>
      </div>
      <button
        onClick={() => signOut(auth)}
        className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
      >
        Sign Out &amp; Try Again
      </button>
    </div>
  </div>
);

function AppRoot() {
  const { role, loading, isAuthenticated } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;
  if (role === 'platform_admin') return <PlatformAdminStubScreen />;
  if (role === 'tenant_admin') return <TenantAdminDashboard />;
  if (MANAGER_ROLES.has(role)) return <ManagerDashboard />;
  if (role === 'agent') return <AgentDashboard />;
  // Authenticated but role not resolved — claims propagation delay on first login.
  return <ProvisioningScreen />;
}

export default function App() {
  return (
    <ToastProvider>
      <AppRoot />
    </ToastProvider>
  );
}
