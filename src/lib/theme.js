// ─────────────────────────────────────────────────────────────────────────────
// theme — single source of truth for light / dark / system appearance
// (Fable Tier 2 · 2.4 — Settings v2 My Preferences → Appearance → Theme).
//
// Before 2.4 the ONLY appearance control was the topbar's binary dark toggle,
// which flipped the `dark` class on <html> and wrote `localStorage.agencytrack-dark`
// ('1' | '0'). Settings v2 adds a three-way Light / Dark / System control, so the
// toggle logic is extracted here and BOTH surfaces (topbar toggle + Settings
// segmented control) drive the same module — a single source of truth.
//
// Storage is device-local (localStorage), exactly like the pre-2.4 dark toggle —
// theme is NOT synced to Firestore. Rationale: the render path needs a value
// synchronously at first paint (no-FOUC restore in main.jsx runs before React
// mounts and before any network read), and the prior behavior was already
// device-local. The Firestore `prefs/app.settings` map carries the view-defaults
// (master-sheet preset, default period) that have no other persistence — theme
// keeps its dedicated localStorage key.
//
// Keys:
//   • agencytrack-theme  — 'light' | 'dark' | 'system' (the canonical mode).
//   • agencytrack-dark   — legacy '1' | '0' mirror, kept in sync with the RESOLVED
//     dark/light so any code still reading it (and older restores) stays correct.
//
// System mode resolves via `matchMedia('(prefers-color-scheme: dark)')` and tracks
// OS changes live while the app is open (see useTheme).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';

export const THEME_KEY = 'agencytrack-theme';
export const LEGACY_DARK_KEY = 'agencytrack-dark';
export const THEME_EVENT = 'agencytrack-theme-change';
export const THEME_MODES = ['light', 'dark', 'system'];
// Default preserves the pre-2.4 behavior exactly: absent any stored preference,
// the app renders light (a dark-OS user who never toggled is unchanged). System
// is opt-in via Settings.
const DEFAULT_MODE = 'light';

function prefersDark() {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Read the stored theme mode, with a legacy `agencytrack-dark` fallback. */
export function readThemeMode() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    const legacy = localStorage.getItem(LEGACY_DARK_KEY);
    if (legacy === '1') return 'dark';
    if (legacy === '0') return 'light';
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return DEFAULT_MODE;
}

/** Resolve a mode to a concrete boolean (system → OS preference). */
export function resolveDark(mode) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return prefersDark(); // 'system' (or any unexpected value)
}

/**
 * Apply a mode to the document + persist it. Sets/removes the `dark` class on
 * <html>, writes the canonical `agencytrack-theme`, and keeps the legacy
 * `agencytrack-dark` mirror in sync with the RESOLVED value. Pure DOM/storage —
 * no React. Safe to call from main.jsx (pre-mount) and from event handlers.
 */
export function applyTheme(mode) {
  const dark = resolveDark(mode);
  try {
    document.documentElement.classList.toggle('dark', dark);
  } catch {
    /* no document (non-DOM env) — nothing to apply */
  }
  try {
    localStorage.setItem(THEME_KEY, mode);
    localStorage.setItem(LEGACY_DARK_KEY, dark ? '1' : '0');
  } catch {
    /* localStorage may be unavailable; the class toggle still holds for the session */
  }
  return dark;
}

/**
 * Set the theme mode and notify every mounted `useTheme` in this tab (the native
 * `storage` event only fires across tabs, so we dispatch an in-tab event too).
 * This is what makes the topbar toggle and the Settings control a single source
 * of truth — either one calls this, both re-read.
 */
export function setThemeMode(mode) {
  if (!THEME_MODES.includes(mode)) return;
  applyTheme(mode);
  try {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }));
  } catch {
    /* CustomEvent unsupported — same-surface state still updates via its own setter */
  }
}

/**
 * useTheme — subscribe to the shared theme mode.
 *
 * Returns `{ mode, isDark, setMode }`. `setMode` drives `setThemeMode` (DOM +
 * storage + broadcast). The hook re-reads on the in-tab THEME_EVENT, the cross-tab
 * `storage` event, and — while in `system` mode — live OS `prefers-color-scheme`
 * changes.
 */
export function useTheme() {
  const [mode, setModeState] = useState(() => readThemeMode());

  useEffect(() => {
    const sync = () => setModeState(readThemeMode());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync);

    let mq;
    const onSystemChange = () => {
      // Only System mode tracks the OS; re-apply so the resolved class follows.
      if (readThemeMode() === 'system') {
        applyTheme('system');
        setModeState('system');
      }
    };
    try {
      if (typeof window.matchMedia === 'function') {
        mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener?.('change', onSystemChange);
      }
    } catch {
      /* matchMedia unavailable — system-tracking simply inert */
    }

    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
      mq?.removeEventListener?.('change', onSystemChange);
    };
  }, []);

  const setMode = useCallback((next) => setThemeMode(next), []);

  return { mode, isDark: resolveDark(mode), setMode };
}
