import { useState, useEffect, useCallback } from 'react';
import { getUserPrefs, setMenuLayout as persistMenuLayout } from '../services/userPrefsService';

/**
 * useMenuLayout — sidebar menu-layout preference (Nav redesign PR-4).
 *
 * Three layouts: `pinned` (default — PR-2 ★ Pinned zone + full nav), `workspace`
 * (My Work ⇄ My Team toggle), `both` (pinned zone above the toggle). Producing
 * managers (UM/BM) honor the stored value; **agents are clamped to `pinned`**
 * on read regardless of any stored value (defense-in-depth — a stale/forced
 * `workspace` pref can never surface a manager-only layout to an agent).
 *
 * Persistence model (mirrors usePinnedNav, brief decision #6): localStorage-first
 * paint from the per-user mirror `agencytrack-menu-layout:{uid}`, Firestore
 * reconcile in the background (Firestore wins on success; failure keeps the
 * mirror/default). Writes are local-state + mirror + Firestore (merge-write so
 * the coexisting `pinnedNav` is preserved); a failed write is a non-blocking warn.
 *
 * @param {{ role?: string, tenantId?: string, uid?: string }} params
 * @returns {{ menuLayout: 'pinned'|'workspace'|'both', setMenuLayout: (next:string)=>void }}
 */
export const MENU_LAYOUT_MIRROR_KEY = 'agencytrack-menu-layout';
export const menuLayoutMirrorKey = (uid) => `${MENU_LAYOUT_MIRROR_KEY}:${uid}`;
export const VALID_LAYOUTS = new Set(['pinned', 'workspace', 'both']);
const DEFAULT_LAYOUT = 'pinned';

function readMirror(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(menuLayoutMirrorKey(uid));
    return VALID_LAYOUTS.has(raw) ? raw : null;
  } catch { return null; }
}

function writeMirror(uid, value) {
  if (!uid) return;
  try { localStorage.setItem(menuLayoutMirrorKey(uid), value); } catch { /* quota / disabled — ignore */ }
}

export default function useMenuLayout({ role, tenantId, uid }) {
  // Synchronous initial paint: per-user mirror → default.
  const [stored, setStored] = useState(() => readMirror(uid) ?? DEFAULT_LAYOUT);

  // Background reconcile — Firestore wins on success; failure keeps current paint.
  useEffect(() => {
    if (!tenantId || !uid) return undefined;
    let cancelled = false;
    getUserPrefs(tenantId, uid)
      .then((prefs) => {
        if (cancelled) return;
        // Only override when the doc carries a valid menuLayout. A doc with no
        // menuLayout (e.g. only pinnedNav) or no doc leaves the mirror/default.
        if (prefs && VALID_LAYOUTS.has(prefs.menuLayout)) {
          setStored(prefs.menuLayout);
          writeMirror(uid, prefs.menuLayout);
        }
      })
      .catch(() => { /* offline / rules — keep mirror/default, never block render */ });
    return () => { cancelled = true; };
  }, [tenantId, uid]);

  const setMenuLayout = useCallback((next) => {
    if (!VALID_LAYOUTS.has(next)) return;
    setStored(next);
    writeMirror(uid, next);
    if (tenantId && uid) {
      persistMenuLayout(tenantId, uid, next).catch((e) =>
        console.warn('[useMenuLayout] menu-layout write failed (non-blocking):', e?.message ?? e));
    }
  }, [tenantId, uid]);

  // Agent clamp applied on the RETURNED value — independent of the stored value,
  // so a forced `workspace`/`both` in the mirror or doc can never render for an
  // agent (the load-bearing defense-in-depth assertion).
  const menuLayout = role === 'agent' ? DEFAULT_LAYOUT : (VALID_LAYOUTS.has(stored) ? stored : DEFAULT_LAYOUT);

  return { menuLayout, setMenuLayout };
}
