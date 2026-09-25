import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuth } from './context/AuthContext';
import { signOut } from './services/authService';
import LoginScreen from './components/auth/LoginScreen';
import ResetPasswordHandler from './components/auth/ResetPasswordHandler';
import EmailVerificationHandler from './components/auth/EmailVerificationHandler';
import ToastProvider from './components/ui/ToastProvider';
import ReloadPrompt from './components/ui/ReloadPrompt';
import ChunkLoadErrorBoundary from './components/ui/ChunkLoadErrorBoundary';
import { ConfigProvider } from './context/ConfigProvider';
import { repairFirestoreCache } from './lib/firestoreRecovery';

// SEC-10 — if the loading screen is still up after this long, the local
// Firestore cache may be corrupted (the same failure family the
// FirestoreCorruptionBoundary and authService.signOut() guard against).
// Offer the same repair escape hatch rather than leaving the user stuck on
// a spinner forever.
const LOADING_REPAIR_TIMEOUT_MS = 20000;

// EFF-002 code-splitting — the three role dashboards are the heaviest single-mount
// surfaces in the app and were all eager-imported into the entry chunk, so every
// agent downloaded the entire manager + tenant-admin tree before first paint.
// lazy() splits each into its own chunk, loaded only for the matching role behind
// the single <Suspense> in AppRoot (themed LoadingScreen fallback). An agent
// session never fetches the ManagerDashboard / TenantAdminDashboard chunks — the
// core goal of EFF-002. The PDF engine was already split in EFF-011 (#802).
const AgentDashboard = lazy(() => import('./components/dashboard/AgentDashboard'));
const ManagerDashboard = lazy(() => import('./components/dashboard/ManagerDashboard'));
const TenantAdminDashboard = lazy(() => import('./components/dashboard/TenantAdminDashboard'));
// Tier-3 3.1 — CRO (Customer Relationship Officer / back-office) gets its own
// dedicated dashboard (Delivery Register), split like TenantAdmin. It is NOT a
// manager role, so it is intentionally absent from MANAGER_ROLES below.
const CRODashboard = lazy(() => import('./components/dashboard/CRODashboard'));

// Tenant Admin gets a dedicated dashboard surface from B5 forward — the
// company config write path lives there. The remaining manager-tier roles
// still share ManagerDashboard until per-role differentiation lands in P9.
const MANAGER_ROLES = new Set(['unit_manager', 'branch_manager', 'sales_manager', 'platform_admin']);

// Track J System Screens v2 — state screens lifted onto the v2 card grammar.
// Visual only; AppRoot routing (below) is untouched.
// SEC-10: after LOADING_REPAIR_TIMEOUT_MS, offer the Repair app data escape
// hatch (see module comment above) in addition to the spinner.
const LoadingScreen = () => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), LOADING_REPAIR_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-surface px-6"
      data-testid="state-loading"
    >
      <div className="card text-center max-w-sm w-full flex flex-col items-center gap-4 py-10">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-ink-muted">Loading AgencyTrack…</p>
        {timedOut && (
          <>
            <p className="text-xs text-ink-muted leading-relaxed">
              Still loading? The app&apos;s saved data may be damaged.
            </p>
            <button
              type="button"
              onClick={() => repairFirestoreCache()}
              className="btn-secondary w-full h-11"
              data-testid="loading-repair-button"
            >
              Repair app data
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const PlatformAdminStubScreen = () => (
  <div
    className="min-h-screen flex items-center justify-center bg-surface px-6"
    data-testid="state-platform-admin-stub"
  >
    <div className="card max-w-sm w-full text-center flex flex-col items-center gap-6 py-10">
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
        onClick={() => signOut()}
        className="btn-primary w-full h-11"
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
  <div
    className="min-h-screen flex items-center justify-center bg-surface px-6"
    data-testid="state-provisioning"
  >
    <div className="card max-w-sm w-full text-center flex flex-col items-center gap-6 py-10">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <div>
        <h1 className="text-xl font-display font-bold text-ink mb-2">Setting up your account</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          Your account is still being provisioned. Please wait a moment, then sign out and sign back in.
        </p>
      </div>
      <button
        onClick={() => signOut()}
        className="btn-primary w-full h-11"
      >
        Sign Out &amp; Try Again
      </button>
    </div>
  </div>
);

function AppRoot() {
  const { role, loading, isAuthenticated, userProfile, tenantId } = useAuth();

  // Firebase auth action links (password reset) land here with ?mode=resetPassword&oobCode=…
  // Intercept before auth/role logic so the handler renders for unauthenticated users.
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  if (mode === 'resetPassword' && oobCode) {
    return <ResetPasswordHandler oobCode={oobCode} />;
  }
  if (mode === 'verifyEmail' && oobCode) {
    return <EmailVerificationHandler oobCode={oobCode} />;
  }

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;
  if (role === 'platform_admin') return <PlatformAdminStubScreen />;

  // Resolve the role's lazy dashboard, then render it behind a single <Suspense>
  // so the chunk fetch shows the themed LoadingScreen fallback (the same treatment
  // as the auth-loading state above). The eager pre-dashboard screens return
  // earlier and never enter Suspense. Routing logic is unchanged from the eager
  // version — only the render target is wrapped.
  let dashboard;
  if (role === 'tenant_admin') {
    dashboard = <TenantAdminDashboard />;
  } else if (role === 'cro') {
    dashboard = <CRODashboard />;
  } else if (MANAGER_ROLES.has(role)) {
    dashboard = <ManagerDashboard />;
  } else if (role === 'agent') {
    // Guard: userProfile null after loading means provisioning delay — show spinner
    if (!userProfile) return <ProvisioningScreen />;
    dashboard = <AgentDashboard />;
  } else {
    // Authenticated but role not resolved — claims propagation delay on first login.
    return <ProvisioningScreen />;
  }

  // ChunkLoadErrorBoundary (OUTSIDE Suspense) catches a rejected lazy import()
  // — e.g. a stale cached index.html requesting a chunk hash a redeploy deleted —
  // and shows a themed reload fallback instead of white-screening. Suspense
  // catches loading; the boundary catches load failure.
  // ConfigProvider hydrates tenant config here — the single seam where tenantId
  // is resolved and an authenticated dashboard is about to mount. Forward-only:
  // it makes config available to the new Company Config surface without touching
  // any existing consumer's read path.
  return (
    <ConfigProvider tenantId={tenantId}>
      <ChunkLoadErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>{dashboard}</Suspense>
      </ChunkLoadErrorBoundary>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppRoot />
      <ReloadPrompt />
      <Analytics />
      <SpeedInsights />
    </ToastProvider>
  );
}
