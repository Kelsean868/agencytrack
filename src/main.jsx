import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';

if (localStorage.getItem('agencytrack-dark') === '1') {
  document.documentElement.classList.add('dark');
}
if (localStorage.getItem('agencytrack-sidebar-collapsed') === '1') {
  document.documentElement.classList.add('sidebar-collapsed');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AuthProvider>
  </StrictMode>,
);
