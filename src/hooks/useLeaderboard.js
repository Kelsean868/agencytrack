/**
 * useLeaderboard — read hook for the P1b leaderboard-aggregate doc.
 *
 * Reads `tenants/{tenantId}/leaderboards/{branchId}` (one doc holds all four
 * periods). The P1b CF refreshes hourly + on-demand. SEC-4 doc-read rules
 * enforce branch scope server-side — this hook just relays the doc.
 *
 * Chip-switching the period re-renders from the same doc — no refetch.
 *
 * Returns:
 *   { loading, error, doc, byPeriod }
 *   • loading   — true until the initial getDoc resolves
 *   • error     — null or { code, message } (truncated)
 *   • doc       — raw Firestore doc data (or null) including `computedAt`
 *                 and `skippedNoBranch` metadata for downstream surfaces
 *   • byPeriod  — convenience accessor: { week, mtd, qtd, ytd } each an array
 *                 (always present as arrays even when missing in the doc, so
 *                 consumers can `.length` without guards)
 */

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const EMPTY_BY_PERIOD = Object.freeze({ week: [], mtd: [], qtd: [], ytd: [] });

export default function useLeaderboard() {
  const { tenantId, userProfile } = useAuth();
  const branchId = userProfile?.branchId ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [docData, setDocData] = useState(null);

  useEffect(() => {
    if (!tenantId || !branchId) {
      // Still resolving auth/profile — keep loading=true; downstream surface
      // shows a loading state and switches to empty if branchId never lands.
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
  }, [tenantId, branchId]);

  const byPeriod = docData
    ? {
        week: Array.isArray(docData.week) ? docData.week : [],
        mtd:  Array.isArray(docData.mtd)  ? docData.mtd  : [],
        qtd:  Array.isArray(docData.qtd)  ? docData.qtd  : [],
        ytd:  Array.isArray(docData.ytd)  ? docData.ytd  : [],
      }
    : EMPTY_BY_PERIOD;

  return { loading, error, doc: docData, byPeriod, branchId };
}
