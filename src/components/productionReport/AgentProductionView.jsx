import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAgentSubmissions } from '../../services/submissionService';
import { getTenantUsers } from '../../services/managerService';
import { formatCurrency } from '../../utils/formatters';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
} from '../../lib/productionReport/computations';
import TimePeriodToggle from './TimePeriodToggle';
import DataSourceBadge from './DataSourceBadge';
import ProductionTable from './ProductionTable';

export default function AgentProductionView() {
  const { user, userProfile, tenantId } = useAuth();
  const [period, setPeriod] = useState('week');
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const unitId = userProfile?.unitId;
  const agentId = user?.uid;

  useEffect(() => {
    if (!agentId || !tenantId) return;
    setLoading(true);
    Promise.all([
      getAgentSubmissions(agentId).catch(() => []),
      getTenantUsers().catch(() => []),
    ]).then(([subs, users]) => {
      setAllSubmissions(subs);
      setAllUsers(users);
    }).catch(setError).finally(() => setLoading(false));
  }, [agentId, tenantId]);

  const periodSubs = useMemo(
    () => filterSubmissionsByPeriod(allSubmissions, period),
    [allSubmissions, period]
  );

  const myTotals = useMemo(() => computeAgentTotals(periodSubs), [periodSubs]);

  const { unitRank, unitSize, branchRank, branchSize } = useMemo(() => {
    if (allUsers.length === 0) return { unitRank: null, unitSize: 0, branchRank: null, branchSize: 0 };

    const agents = allUsers.filter((u) => u.role === 'agent' && u.provisioning !== true);
    const branchSize = agents.length;

    const agentTotals = agents.map((u) => {
      const subs = filterSubmissionsByPeriod(
        allSubmissions.filter((s) => (s.agentId ?? s.userId) === u.id),
        period
      );
      return { agentId: u.id, agentName: u.name ?? u.email ?? u.id, unitId: u.unitId, totals: computeAgentTotals(subs) };
    });

    const ranked = rankAgentsByApi(agentTotals);
    const me = ranked.find((r) => r.agentId === agentId);

    const unitAgents = agents.filter((u) => u.unitId === unitId);
    const unitSize = unitAgents.length;

    return {
      unitRank: me?.rankWithinUnit ?? null,
      unitSize,
      branchRank: me?.rank ?? null,
      branchSize,
    };
  }, [allUsers, allSubmissions, period, agentId, unitId]);

  const myRow = [{
    label: userProfile?.name ?? userProfile?.email ?? 'You',
    nb: myTotals.nb,
    ppp: { apiIncrease: myTotals.ppp.api, apps: myTotals.ppp.apps },
    lmps: myTotals.lmps,
    total: myTotals.totalApi,
    highlight: true,
  }];

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-ink-muted text-sm">Loading production data…</div>;
  }
  if (error) {
    return <div className="py-8 text-center text-danger text-sm">Failed to load production data.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-base font-semibold text-ink">Production Report</h2>
        <div className="flex items-center gap-2">
          <DataSourceBadge source="estimated" />
          <TimePeriodToggle selected={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">My Production</p>
        <ProductionTable rows={myRow} period={period} />
      </div>

      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-4">My Ranking</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">In your unit</span>
            <span className="text-sm font-semibold text-ink">
              {unitRank !== null ? `#${unitRank} of ${unitSize}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">In the branch</span>
            <span className="text-sm font-semibold text-ink">
              {branchRank !== null ? `#${branchRank} of ${branchSize}` : '—'}
            </span>
          </div>
          {branchRank && branchSize > 0 && (
            <div className="mt-1">
              <div className="w-full bg-surface rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(4, Math.round(((branchSize - branchRank + 1) / branchSize) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-ink-muted mt-1">
                Top {Math.round(((branchRank) / branchSize) * 100)}% of branch
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[120px]">
            <p className="text-xs text-ink-muted">Total API</p>
            <p className="text-xl font-bold text-primary tabular-nums">{formatCurrency(myTotals.totalApi)}</p>
          </div>
          <div className="flex-1 min-w-[100px]">
            <p className="text-xs text-ink-muted">Apps</p>
            <p className="text-xl font-bold text-ink tabular-nums">{myTotals.totalApps}</p>
          </div>
          {myTotals.ppp.api > 0 && (
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-ink-muted">PPP</p>
              <p className="text-xl font-bold text-ink tabular-nums">{formatCurrency(myTotals.ppp.api)}</p>
            </div>
          )}
          {myTotals.lmps.api > 0 && (
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-ink-muted">LMPS</p>
              <p className="text-xl font-bold text-ink tabular-nums">{formatCurrency(myTotals.lmps.api)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
