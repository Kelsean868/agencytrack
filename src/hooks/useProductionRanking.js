/**
 * useProductionRanking({ scope, period }) — shared production-ranking hook.
 *
 * Keystone for: P3 (podium/tail), P4 (around-me row), P7 (AgentProductionView
 * around-me + rank-pill fix). Build the ranking once; consumers import this hook.
 *
 * Data path:
 *   getAllYTDSubmissions (calendar-year Firestore query, branch-scoped via tenantId path)
 *   + getTenantUsers
 *   → buildRankedAgents (period filter → computeAgentTotals → rankAgentsByApi)
 *
 * Scope:
 *   'branch' (P1 default) — all agents in the tenant (one-branch-per-tenant model).
 *   Role-based scope variants (UM unit↔branch picker) are deferred to P5.
 *
 * Period: 'week' | 'mtd' | 'quarter' | 'ytd'
 *   WK = Sunday-anchored WAR week. QTD = calendar quarter (Jan/Apr/Jul/Oct).
 *   Reuses getPeriodBoundaries + filterSubmissionsByPeriod from computations.js.
 *
 * Production source (D1): submissions pipeline only. NOT reconciled-ledger.
 * If reconciled-production is authorized, swap getAllYTDSubmissions at this call
 * site — all consumers inherit via this shared hook (no scatter).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllYTDSubmissions, getTenantUsers } from '../services/managerService';
import { buildRankedAgents } from '../lib/productionReport/rankForLeaderboard';

/**
 * @param {Object}  opts
 * @param {string}  [opts.scope='branch']  Scope variant. Only 'branch' is implemented in P1.
 * @param {string}  [opts.period='week']   Period key: 'week' | 'mtd' | 'quarter' | 'ytd'
 * @returns {{ loading: boolean, error: string|null, ranked: import('../lib/productionReport/rankForLeaderboard').RankedEntry[], totalCount: number }}
 */
export default function useProductionRanking({ scope: _scope = 'branch', period = 'week' } = {}) {
  const { tenantId } = useAuth();

  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [allUsers, setAllUsers]         = useState([]);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getAllYTDSubmissions(tenantId),
      getTenantUsers(tenantId),
    ])
      .then(([subs, users]) => {
        setAllSubmissions(subs ?? []);
        setAllUsers(users ?? []);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load ranking data');
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  // Re-derive ranked list when fetch results or period changes.
  // scope is accepted for API future-compatibility; 'branch' is the only P1 variant.
  const ranked = useMemo(
    () => buildRankedAgents(allSubmissions, allUsers, period),
    [allSubmissions, allUsers, period]
  );

  return {
    loading,
    error,
    ranked,
    totalCount: ranked.length,
  };
}
