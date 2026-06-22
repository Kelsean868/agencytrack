import { useState, useEffect, useMemo, useCallback } from 'react';
import { getUserPrefs, setPinnedNav as persistPinnedNav } from '../services/userPrefsService';
import { getPinnedSeed } from '../components/shell/navConfig';

/**
 * usePinnedNav — ★ Pinned-zone state for the sidebar (Nav redesign PR-2).
 *
 * Persistence model (brief decision #1): localStorage-first, Firestore-reconcile.
 *   - Initial paint is synchronous from the `agencytrack-pinned-nav` mirror, else
 *     the per-role seeds — never a spinner, never blocked on the network.
 *   - A background `getUserPrefs` read reconciles: on success **Firestore wins**
 *     (state + mirror refreshed); on failure the mirror/seeds stand.
 *   - Writes are Firestore-primary then mirror; a failed write is a non-blocking
 *     console.warn (never thrown into render).
 *
 * Storage (decision #2, revised per dispatcher ruling 2026-06-22): doc
 * `tenants/{tenantId}/users/{uid}/prefs/app.pinnedNav` (merge-write), mirror key
 * **per-user** `agencytrack-pinned-nav:{uid}` (JSON string[]) — namespacing
 * prevents cross-user pin bleed on a shared browser.
 *
 * @param {{ tenantId?: string, uid?: string, configKey?: string, navItems?: Array }} params
 *   navItems = the role's resolved getNavConfig output (descriptor source).
 * @returns {{ pinnedIds: string[], pinnedItems: Array, isPinned: (id:string)=>boolean,
 *             pin: (id:string)=>void, unpin: (id:string)=>void }}
 */
export const PINNED_MIRROR_KEY = 'agencytrack-pinned-nav';
export const pinnedMirrorKey = (uid) => `${PINNED_MIRROR_KEY}:${uid}`;

function readMirror(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(pinnedMirrorKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : null;
  } catch { return null; }
}

function writeMirror(uid, ids) {
  if (!uid) return;
  try { localStorage.setItem(pinnedMirrorKey(uid), JSON.stringify(ids)); } catch { /* quota / disabled — ignore */ }
}

export default function usePinnedNav({ tenantId, uid, configKey, navItems = [] }) {
  // Synchronous initial paint: per-user mirror → seeds.
  const [pinnedIds, setPinnedIds] = useState(() => {
    const mirror = readMirror(uid);
    if (mirror) return mirror;
    return configKey ? getPinnedSeed(configKey) : [];
  });

  // Background reconcile — Firestore wins on success; failure keeps current paint.
  useEffect(() => {
    if (!tenantId || !uid) return undefined;
    let cancelled = false;
    getUserPrefs(tenantId, uid)
      .then((prefs) => {
        if (cancelled) return;
        // Only override when the doc carries an explicit pinnedNav array. A doc
        // with no pinnedNav (e.g. only menuLayout) or no doc at all leaves the
        // seed/mirror paint untouched — the first user pin is what persists it.
        if (prefs && Array.isArray(prefs.pinnedNav)) {
          setPinnedIds(prefs.pinnedNav);
          writeMirror(uid, prefs.pinnedNav);
        }
      })
      .catch(() => { /* offline / rules — keep mirror/seeds, never block render */ });
    return () => { cancelled = true; };
  }, [tenantId, uid]);

  const persistAll = useCallback((next) => {
    setPinnedIds(next);
    writeMirror(uid, next);
    if (tenantId && uid) {
      persistPinnedNav(tenantId, uid, next).catch((e) =>
        console.warn('[usePinnedNav] pinned-nav write failed (non-blocking):', e?.message ?? e));
    }
  }, [tenantId, uid]);

  const isPinned = useCallback((id) => pinnedIds.includes(id), [pinnedIds]);

  const pin = useCallback((id) => {
    if (!id || pinnedIds.includes(id)) return;
    persistAll([...pinnedIds, id]);
  }, [pinnedIds, persistAll]);

  const unpin = useCallback((id) => {
    if (!pinnedIds.includes(id)) return;
    persistAll(pinnedIds.filter((p) => p !== id));
  }, [pinnedIds, persistAll]);

  // Resolve pins → descriptors from the current role's nav, in pinned order.
  // Ids absent from this role's config (e.g. daily-log for a weekly-mode agent)
  // are skipped — a pin is an alias, not a standalone item (decision #4/#8).
  const pinnedItems = useMemo(() => {
    const byId = new Map(navItems.map((i) => [i.id, i]));
    return pinnedIds.map((id) => byId.get(id)).filter(Boolean);
  }, [pinnedIds, navItems]);

  return { pinnedIds, pinnedItems, isPinned, pin, unpin };
}
