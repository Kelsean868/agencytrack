/**
 * useLeaderboard — read hook for the P1b leaderboard-aggregate doc.
 *
 * Reads `tenants/{tenantId}/leaderboards/{branchId}` (one doc holds all four
 * periods). The P1b CF refreshes hourly + on-demand. SEC-4 doc-read rules
 * enforce branch scope server-side — this hook just relays the doc.
 *
 * Chip-switching the period re-renders from the same doc — no refetch.
 *
 * Track J P5b: accepts an optional `branchIdOverride` so SM (head of sales)
 * can read any tenant branch via the branch-picker. When omitted, the hook
 * falls back to `userProfile.branchId` exactly as before — every existing
 * call site stays unchanged.
 *
 * Returns:
 *   { loading, error, doc, byPeriod, branchId }
 *   • loading   — true until the initial getDoc resolves
 *   • error     — null or { code, message } (truncated)
 *   • doc       — raw Firestore doc data (or null) including `computedAt`
 *                 and `skippedNoBranch` metadata for downstream surfaces
 *   • byPeriod  — convenience accessor: { week, mtd, qtd, ytd } each an array
 *                 (always present as arrays even when missing in the doc, so
 *                 consumers can `.length` without guards)
 *   • branchId  — the resolved branch id used for the read (override or
 *                 viewer's own); useful for downstream labels.
 */

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const EMPTY_BY_PERIOD = Object.freeze({ week: [], mtd: [], qtd: [], ytd: [] });

export default function useLeaderboard(branchIdOverride) {
  const { tenantId, userProfile } = useAuth();
  const branchId = branchIdOverride ?? userProfile?.branchId ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [docData, setDocData] = useState(null);
  // Bumped by reload() to force the effect below to re-run on demand (§1
  // states contract — the error card's Retry button needs a real re-fetch,
  // not just a state reset).
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!tenantId || !branchId) {
      // branchId is null/undefined — resolve to empty rather than spin forever.
      setLoading(false);
      setDocData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const ref = doc(db, `tenants/${tenantId}/leaderboards/${branchId}`);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (!snap.exists()) {
          setDocData(null);     // surface decides whether to show empty or error
        } else {
          setDocData(snap.data());
        }
      } catch (err) {
        if (cancelled) return;
        setError({
          code:    err?.code    ?? 'unknown',
          message: err?.message ?? 'Failed to load leaderboard',
        });
        setDocData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId, branchId, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const byPeriod = docData
    ? {
        week: Array.isArray(docData.week) ? docData.week : [],
        mtd:  Array.isArray(docData.mtd)  ? docData.mtd  : [],
        qtd:  Array.isArray(docData.qtd)  ? docData.qtd  : [],
        ytd:  Array.isArray(docData.ytd)  ? docData.ytd  : [],
      }
    : EMPTY_BY_PERIOD;

  return { loading, error, doc: docData, byPeriod, branchId, reload };
}
