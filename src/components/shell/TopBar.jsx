// Explicit React import — required for Vitest compatibility per banked rule
// (Vite applies the automatic JSX transform but Vitest does not always);
// surfaced when TopBar.test.jsx first mounted this directly (Tier 1 · 1.1).
import React from 'react';
import { Sun, Moon, Search } from 'lucide-react';
import NotificationBell from '../ui/NotificationBell';
import SyncIndicator from '../ui/SyncIndicator';
import { useTheme } from '../../lib/theme';

/**
 * Topbar chrome (Design System v2 — B4).
 *
 * Owns: page title + crumb (left), command-palette search trigger (centre),
 * per-page action slot, SyncIndicator + NotificationBell + dark-mode toggle
 * (right).
 *
 * The centre search field is a button that opens the Cmd-K command palette
 * (Fable Tier 1 · 1.1) — it was a no-op placeholder input before. Shell owns the
 * palette state and passes `onOpenSearch`.
 *
 * Sign-out lives in the sidebar foot, NOT here (locked decision).
 *
 * At <768px the search and crumb collapse via @media in index.css. Mobile has
 * no keyboard (no Cmd/Ctrl-K) and the desktop search pill is hidden there, so
 * `.topbar-mobile-search` is an icon-only trigger for the SAME palette —
 * visible only at mobile widths (inverse of `.topbar-search`'s hide rule,
 * same @media block in index.css). It opens via the same `onOpenSearch`
 * handler Shell already wires up; no second palette, no new state
 * (Fable Tier 1 · 1.1b).
 */
export default function TopBar({ title, crumb, actions, onOpenSearch }) {
  // Binary dark toggle, driven through the shared theme module so it stays a
  // single source of truth with the Settings v2 Light/Dark/System control (Tier 2
  // · 2.4). Toggling from here always resolves to an explicit light/dark mode;
  // System remains selectable from Settings. The Sun/Moon icons key off the
  // `dark` class (set by the module), so they stay correct in every mode.
  const { isDark, setMode } = useTheme();
  const toggleDark = () => setMode(isDark ? 'light' : 'dark');

  return (
    <header className="topbar">
      <div className="topbar-titles">
        {/* One semantic <h1> per screen (A11Y-001). `.topbar-title` sets explicit
            font/size/color, so the heading renders identically to the prior div
            under Tailwind preflight (which resets h1 margin/size). */}
        <h1 className="topbar-title">{title}</h1>
        {crumb && <div className="topbar-crumb">{crumb}</div>}
      </div>

      <button
        type="button"
        className="topbar-search"
        onClick={onOpenSearch}
        aria-label="Search screens and actions (Command palette)"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search size={14} aria-hidden="true" />
        <span className="topbar-search-placeholder">Search…</span>
        <kbd className="topbar-search-kbd" aria-hidden="true">⌘K</kbd>
      </button>

      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-icon-btn topbar-mobile-search"
          onClick={onOpenSearch}
          aria-label="Search — open command palette"
        >
          <Search size={18} aria-hidden="true" />
        </button>
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
