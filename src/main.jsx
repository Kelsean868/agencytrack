import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import KioskRoute from './components/kiosk/KioskRoute.jsx';
import FirestoreCorruptionBoundary from './components/ui/FirestoreCorruptionBoundary.jsx';
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
        </AuthProvider>
      )}
    </FirestoreCorruptionBoundary>
  </StrictMode>,
);
