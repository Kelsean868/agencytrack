import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { getTenantUsers, getAllYTDSubmissions } from '../services/managerService';
import { getSettlementsForUnit } from '../services/settlementService';
import {
  getPersistencyForUnit,
  getPersistencyForBranch,
  getPersistencyForTenant,
} from '../services/persistencyService';
import { getGoals } from '../services/goalsService';
import { assembleRoster, DEFAULT_PERIOD, containingMonth } from '../lib/teamRoster';

export { DEFAULT_PERIOD };

/**
 * Fetches the manager's scoped team roster and assembles per-member rows with
 * the 8 v1 fields: name · contractDate · submittedAPI · submittedApps ·
 * issuedAPI · issuedApps · persistency · pctOfAnnualGoal.
 *
 * Member scope is derived from the caller's auth claims (UM → unit agents;
 * BM → branch agents + UMs; TA/SA/PA → full tenant). Period defaults to the
 * current year. Rows are unsorted — pass through sortRows() from teamRoster.js.
 *
 * NOTE: getAllYTDSubmissions is hard-coded to the current calendar year. The
 * hook produces correct results when period.value year matches the current year
 * (the default). Historical year selection is not yet supported.
 *
 * @param {string}  tenantId
 * @param {{ grain: 'year'|'month'|'week', value: string }} [period]
 * @returns {{ rows: Array, loading: boolean, error: Error|null }}
 */
export function useTeamRoster(tenantId, period = DEFAULT_PERIOD) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Destructure so the effect dependency array can list stable primitives
  // rather than the period object reference (avoids re-runs on reference churn).
  const { grain, value } = period;

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    const p = { grain, value };

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { claims } = await auth.currentUser.getIdTokenResult();
        const callerUid  = auth.currentUser.uid;

        const [members, allSubmissions] = await Promise.all([
          getTenantUsers(tenantId),
          getAllYTDSubmissions(tenantId),
        ]);

        const monthKey       = containingMonth(p);
        const settlementYear = parseInt(monthKey.split('-')[0], 10);
        const agentIds       = members.map((m) => m.id);

        // Settlements — all for the containing year; assembly matches to month
        const settlementList = (await getSettlementsForUnit(tenantId, agentIds, settlementYear)) ?? [];
        const settlementsByAgent = new Map();
        for (const s of settlementList) {
          if (!settlementsByAgent.has(s.agentId)) settlementsByAgent.set(s.agentId, []);
          settlementsByAgent.get(s.agentId).push(s);
        }

        // Persistency — scope-aware fetch for the containing month
        let persistencyList;
        if (claims.role === 'unit_manager') {
          persistencyList = await getPersistencyForUnit(tenantId, monthKey, callerUid);
        } else if (claims.role === 'branch_manager') {
          persistencyList = await getPersistencyForBranch(tenantId, monthKey, claims.branchId);
        } else {
          persistencyList = await getPersistencyForTenant(tenantId, monthKey);
        }
        const persistencyByAgent = new Map(
          (persistencyList ?? []).filter(Boolean).map((r) => [r.agentId, r])
        );

        // Goals — one doc-get per member, failures produce null (no goal set)
        const goalsList    = await Promise.all(agentIds.map((id) => getGoals(tenantId, id).catch(() => null)));
        const goalsByAgent = new Map(agentIds.map((id, i) => [id, goalsList[i]]));

        if (!cancelled) {
          setRows(assembleRoster({
            members,
            allSubmissions,
            period: p,
            settlementsByAgent,
            persistencyByAgent,
            goalsByAgent,
          }));
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId, grain, value]);

  return { rows, loading, error };
}
