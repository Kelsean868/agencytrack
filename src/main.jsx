import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import KioskRoute from './components/kiosk/KioskRoute.jsx';
import { initClarity } from './lib/clarityInit.js';

// Privacy-gated Microsoft Clarity — no-op unless PROD build + VITE_CLARITY_PROJECT_ID.
initClarity();

const isKioskPath = window.location.pathname.startsWith('/kiosk/');

if (isKioskPath) {
  // Kiosk always renders as dark — ignore user preference
  document.documentElement.classList.add('dark');
} else {
  if (localStorage.getItem('agencytrack-dark') === '1') {
    document.documentElement.classList.add('dark');
  }
  if (localStorage.getItem('agencytrack-sidebar-collapsed') === '1') {
    document.documentElement.classList.add('sidebar-collapsed');
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isKioskPath ? (
      <KioskRoute />
    ) : (
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    )}
  </StrictMode>,
);
