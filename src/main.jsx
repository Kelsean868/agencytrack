import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// FR look (docs/briefs/fr-agent-redesign-program.md): self-hosted fonts + the
// scoped token file. Both are inert unless <html data-look="fr"> is set.
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/onest';
import './styles/fr-look.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import KioskRoute from './components/kiosk/KioskRoute.jsx';
import FirestoreCorruptionBoundary from './components/ui/FirestoreCorruptionBoundary.jsx';
import SignOutConfirmHost from './components/ui/SignOutConfirmHost.jsx';
import { initClarity } from './lib/clarityInit.js';

// Privacy-gated Microsoft Clarity — no-op unless PROD build + VITE_CLARITY_PROJECT_ID.
initClarity();

const isKioskPath = window.location.pathname.startsWith('/kiosk/');

if (isKioskPath) {
  // Kiosk always renders as dark — ignore user preference
  document.documentElement.classList.add('dark');
} else {
  // No-FOUC theme restore (Tier 2 · 2.4). Reads the canonical `agencytrack-theme`
  // ('light' | 'dark' | 'system'), resolving System via matchMedia, and falls back
  // to the legacy `agencytrack-dark` ('1'|'0') for users who only ever used the
  // pre-2.4 binary toggle. Kept inline (no import) so it runs before React mounts.
  const themeMode = localStorage.getItem('agencytrack-theme');
  let dark;
  if (themeMode === 'dark') dark = true;
  else if (themeMode === 'light') dark = false;
  else if (themeMode === 'system') dark = !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  else dark = localStorage.getItem('agencytrack-dark') === '1'; // legacy fallback
  if (dark) {
    document.documentElement.classList.add('dark');
  }
  if (localStorage.getItem('agencytrack-sidebar-collapsed') === '1') {
    document.documentElement.classList.add('sidebar-collapsed');
  }
  // FR look no-flash restore (FR-D3): the per-user opt-in only. useLook() in
  // App.jsx is the authority once the role is known and removes it for
  // non-agents. Kept inline (no import) so it runs before React mounts.
  try {
    if (localStorage.getItem('agencytrack-look') === 'fr') {
      document.documentElement.setAttribute('data-look', 'fr');
    }
  } catch {
    /* storage unavailable — useLook() applies it after auth */
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FirestoreCorruptionBoundary>
      {isKioskPath ? (
        <KioskRoute />
      ) : (
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
          {/* SEC-10 in-PR extension — the "unsynced changes" sign-out confirm
              dialog. Mounted once here (not per-dashboard) so authService.signOut()
              can trigger it via signOutConfirmBridge.js without every call site
              needing its own dialog state. Kiosk route never signs out, so this
              is absent from that branch. */}
          <SignOutConfirmHost />
        </AuthProvider>
      )}
    </FirestoreCorruptionBoundary>
  </StrictMode>,
);
