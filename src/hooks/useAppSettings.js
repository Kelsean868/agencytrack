import { useState, useEffect, useCallback } from 'react';
import { getUserPrefs, setAppSetting } from '../services/userPrefsService';

/**
 * useAppSettings — Settings v2 view-defaults map (Fable Tier 2 · 2.4).
 *
 * Persistence model (mirrors useMenuLayout / usePinnedNav exactly): localStorage-first
 * paint, Firestore-reconcile.
 *   - Initial paint is synchronous from the per-user mirror `agencytrack-settings:{uid}`
 *     (the WHOLE settings map) — never a spinner, never blocked on the network.
 *     Absent mirror → empty map → each consumer falls back to its own default.
 *   - A background `getUserPrefs` read reconciles: on success **Firestore wins**
 *     (state + mirror refreshed); on failure the mirror stands.
 *   - Writes are state → mirror → Firestore (`setAppSetting` merge-writes only the
 *     touched key); a failed write is a non-blocking console.warn.
 *
 * Storage: doc `tenants/{tenantId}/users/{uid}/prefs/app.settings` (deep-merge), a
 * flat map keyed by setting id (`masterSheetPreset`, `defaultPeriod`, …). Mirror
 * key is per-user to prevent cross-user bleed on a shared browser.
 *
 * Consumers that only READ a default (Master Sheet preset, leaderboard period)
 * seed their own local state from `settings.{key}` on reconcile while keeping any
 * in-session override — see `readSettingsMirror` for a synchronous first read.
 *
 * @param {{ tenantId?: string, uid?: string }} params
 * @returns {{ settings: Record<string, *>, setSetting: (key: string, value: *) => void }}
 */
export const SETTINGS_MIRROR_KEY = 'agencytrack-settings';
export const settingsMirrorKey = (uid) => `${SETTINGS_MIRROR_KEY}:${uid}`;

function isPlainMap(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Synchronous per-user mirror read — returns the map or `{}`. Exported so
 *  read-only consumers (Master Sheet, leaderboard) can seed initial state. */
export function readSettingsMirror(uid) {
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(settingsMirrorKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isPlainMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMirror(uid, map) {
  if (!uid) return;
  try { localStorage.setItem(settingsMirrorKey(uid), JSON.stringify(map)); } catch { /* quota / disabled — ignore */ }
}

export default function useAppSettings({ tenantId, uid }) {
  // Synchronous initial paint: per-user mirror map → {}.
  const [settings, setSettings] = useState(() => readSettingsMirror(uid));

  // Background reconcile — Firestore wins on success; failure keeps current paint.
  useEffect(() => {
    if (!tenantId || !uid) return undefined;
    let cancelled = false;
    getUserPrefs(tenantId, uid)
      .then((prefs) => {
        if (cancelled) return;
        // Only override when the doc carries an explicit settings map. A doc
        // without settings (e.g. only pinnedNav) or no doc leaves the mirror paint.
        if (prefs && isPlainMap(prefs.settings)) {
          setSettings(prefs.settings);
          writeMirror(uid, prefs.settings);
        }
      })
      .catch(() => { /* offline / rules — keep mirror, never block render */ });
    return () => { cancelled = true; };
  }, [tenantId, uid]);

  const setSetting = useCallback((key, value) => {
    if (!key) return;
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      writeMirror(uid, next);
      return next;
    });
    if (tenantId && uid) {
      setAppSetting(tenantId, uid, key, value).catch((e) =>
        console.warn('[useAppSettings] setting write failed (non-blocking):', e?.message ?? e));
    }
  }, [tenantId, uid]);

  return { settings, setSetting };
}
