import { Sun, Moon, Search } from 'lucide-react';
import NotificationBell from '../ui/NotificationBell';
import SyncIndicator from '../ui/SyncIndicator';

/**
 * Topbar chrome (Design System v2 — B4).
 *
 * Owns: page title + crumb (left), placeholder search field (centre, no-op
 * per PRD Q7), per-page action slot, SyncIndicator + NotificationBell +
 * dark-mode toggle (right).
 *
 * Sign-out lives in the sidebar foot, NOT here (locked decision).
 *
 * At <768px the search and crumb collapse via @media in index.css.
 */
export default function TopBar({ title, crumb, actions }) {
  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('agencytrack-dark', isDark ? '1' : '0');
    } catch {
      /* localStorage may be unavailable; toggle still works for the session */
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-titles">
        {/* One semantic <h1> per screen (A11Y-001). `.topbar-title` sets explicit
            font/size/color, so the heading renders identically to the prior div
            under Tailwind preflight (which resets h1 margin/size). */}
        <h1 className="topbar-title">{title}</h1>
        {crumb && <div className="topbar-crumb">{crumb}</div>}
      </div>

      <div className="topbar-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search…"
          aria-label="Search"
        />
      </div>

      <div className="topbar-actions">
        {actions}
        <SyncIndicator />
        <NotificationBell />
        <button
          type="button"
          className="topbar-icon-btn"
          onClick={toggleDark}
          aria-label="Toggle dark mode"
        >
          <Sun size={16} className="dark:hidden" />
          <Moon size={16} className="hidden dark:block" />
        </button>
      </div>
    </header>
  );
}
