/**
 * useFeatureFlag(key) — read-only feature-flag hook (item 3.4).
 *
 * Load-once per tenant: a module-level `Map<tenantId, Promise<flags>>` caches
 * the single `getFeatureFlags` read so every consumer in the mount tree shares
 * one network round-trip. Flags are read at surface-mount, NOT live-subscribed
 * (operator flips in the console; a reload picks up the new value).
 *
 * Defaults to `false` until the read resolves, and stays `false` on any
 * failure — so a flag-gated surface is ABSENT until its flag is explicitly ON.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFeatureFlags, isFlagOn } from '../services/featureFlagsService';

// tenantId -> Promise<flagsObject>. Shared across all hook instances.
const flagsCache = new Map();

function loadFlags(tenantId) {
  if (!flagsCache.has(tenantId)) {
    flagsCache.set(tenantId, getFeatureFlags(tenantId));
  }
  return flagsCache.get(tenantId);
}

/** Test-only: clear the per-tenant cache between cases. */
export function __resetFeatureFlagCache() {
  flagsCache.clear();
}

export function useFeatureFlag(key) {
  const { tenantId } = useAuth();
  const [on, setOn] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!tenantId) {
      setOn(false);
      return undefined;
    }
    loadFlags(tenantId)
      .then((flags) => { if (alive) setOn(isFlagOn(flags, key)); })
      .catch(() => { if (alive) setOn(false); });
    return () => { alive = false; };
  }, [tenantId, key]);

  return on;
}
