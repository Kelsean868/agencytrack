import { useState, useEffect, useMemo, useCallback } from 'react';
import { getUserPrefs, setNavOrder as persistNavOrder } from '../services/userPrefsService';

/**
 * useNavOrder — desktop-sidebar drag-reorder state (Fable Tier 1 · 1.4).
 *
 * Persistence model (mirrors usePinnedNav exactly, brief decision #3):
 * localStorage-first, Firestore-reconcile.
 *   - Initial paint is synchronous from the `agencytrack-nav-order:{uid}` mirror
 *     (the WHOLE per-config map) — never a spinner, never blocked on the network.
 *     Absent mirror → empty map → DEFAULT order (Sidebar renders byte-identical).
 *   - A background `getUserPrefs` read reconciles: on success **Firestore wins**
 *     (state + mirror refreshed); on failure the mirror stands.
 *   - Writes are state → mirror → Firestore; a failed write is a non-blocking
 *     console.warn (never thrown into render — nav must never block on a pref write).
 *
 * Storage: doc `tenants/{tenantId}/users/{uid}/prefs/app.navOrder` (deep-merge),
 * a map keyed by navConfig key (`agent` | `producingManager` | `manager` |
 * `tenantAdmin`) → ordered nav-item-id array. The per-config keying is required
 * because agent + manager nav ids overlap ('planner', 'goals'), so a flat array
 * would collide. Mirror key is **per-user** (`agencytrack-nav-order:{uid}`) to
 * prevent cross-user order bleed on a shared browser.
 *
 * The hook stores/returns only the raw id order for `configKey`; applying it to
 * the rendered nav (within-section reorder, section-label carry) is `applyNavOrder`
 * in navConfig.js — kept pure + directly testable.
 *
 * @param {{ tenantId?: string, uid?: string, configKey?: string }} params
 * @returns {{ orderIds: string[], reorder: (nextIds: string[]) => void }}
 */
export const NAV_ORDER_MIRROR_KEY = 'agencytrack-nav-order';
export const navOrderMirrorKey = (uid) => `${NAV_ORDER_MIRROR_KEY}:${uid}`;

function isPlainMap(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function readMirror(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(navOrderMirrorKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isPlainMap(parsed) ? parsed : null;
  } catch { return null; }
}

function writeMirror(uid, map) {
  if (!uid) return;
  try { localStorage.setItem(navOrderMirrorKey(uid), JSON.stringify(map)); } catch { /* quota / disabled — ignore */ }
}

export default function useNavOrder({ tenantId, uid, configKey }) {
  // Synchronous initial paint: per-user mirror map → {} (⇒ default order).
  const [orderMap, setOrderMap] = useState(() => readMirror(uid) ?? {});

  // Background reconcile — Firestore wins on success; failure keeps current paint.
  useEffect(() => {
    if (!tenantId || !uid) return undefined;
    let cancelled = false;
    getUserPrefs(tenantId, uid)
      .then((prefs) => {
        if (cancelled) return;
        // Only override when the doc carries an explicit navOrder map. A doc
        // without navOrder (e.g. only pinnedNav) or no doc at all leaves the
        // mirror/default paint untouched — the first user reorder persists it.
        if (prefs && isPlainMap(prefs.navOrder)) {
          setOrderMap(prefs.navOrder);
          writeMirror(uid, prefs.navOrder);
        }
      })
      .catch(() => { /* offline / rules — keep mirror/default, never block render */ });
    return () => { cancelled = true; };
  }, [tenantId, uid]);

  // The ordered id list for THIS config (string[], filtered defensively).
  const orderIds = useMemo(() => {
    const v = configKey ? orderMap[configKey] : null;
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  }, [orderMap, configKey]);

  const reorder = useCallback((nextIds) => {
    if (!configKey || !Array.isArray(nextIds)) return;
    setOrderMap((prev) => {
      const next = { ...prev, [configKey]: nextIds };
      writeMirror(uid, next);
      return next;
    });
    if (tenantId && uid) {
      persistNavOrder(tenantId, uid, configKey, nextIds).catch((e) =>
        console.warn('[useNavOrder] nav-order write failed (non-blocking):', e?.message ?? e));
    }
  }, [tenantId, uid, configKey]);

  return { orderIds, reorder };
}
