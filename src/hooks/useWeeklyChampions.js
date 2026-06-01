/**
 * useWeeklyChampions — read hook for the P5-prep weekly-champions doc.
 *
 * Reads `tenants/{tenantId}/weeklyChampions/{prevWeekStarting}` — the
 * most-recently-completed week, written by the leaderboard-aggregate CF.
 * Doc shape (from P5-prep):
 *   { weekStarting, topAPI|null, topApps|null, topActivity|null, computedAt }
 *
 * The hook returns `{ champions, loading, error }` shaped to match the
 * existing `WeeklyChampionsBanner` props (reused unchanged):
 *   - `champions`: the doc data (or null when missing / on error / pre-fetch)
 *   - `loading`:   true until the initial getDoc resolves
 *   - `error`:     null or { code, message }
 *
 * Doc-key match (the make-or-break detail):
 *   `prevWeekStarting()` mirrors the CF's `priorWeekStartingString` — same
 *   TT-aware computation, same ESM `getPeriodBoundaries` (cross-checked at
 *   85 tests against the CJS twin). Client and CF compute identical keys.
 *
 * SEC: agent-readable per the P5-prep `weeklyChampions/{weekStarting}` rule
 * (tenant-wide, signed-in member; CF-only write).
 */

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { prevWeekStarting } from '../lib/leaderboard/prevWeekStarting';

export default function useWeeklyChampions() {
  const { tenantId } = useAuth();

  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [champions, setChampions] = useState(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const weekStarting = prevWeekStarting();
        const ref  = doc(db, `tenants/${tenantId}/weeklyChampions/${weekStarting}`);
        const snap = await getDoc(ref);
        if (cancelled) return;
        // The CF always writes the doc (even when prior week is empty —
        // payload = { topAPI: null, topApps: null, topActivity: null } per
        // P5-prep). Doc-missing here = data-pipeline gap, not honest-empty;
        // surface as `champions: null` so the banner shows its existing
        // null guard (returns null → renders nothing — same as loading).
        setChampions(snap.exists() ? snap.data() : null);
      } catch (err) {
        if (cancelled) return;
        setError({
          code:    err?.code    ?? 'unknown',
          message: err?.message ?? 'Failed to load weekly champions',
        });
        setChampions(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId]);

  return { champions, loading, error };
}
