import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { computeAgentAwards, computeAtRiskStatus } from '../../utils/awardsEngine';

const STATUS_PILL_CLASS = {
  achieved:  'bg-success-tint text-success',
  on_track:  'bg-primary/10 text-primary',
  at_risk:   'bg-danger-tint text-danger',
  far_off:   'bg-surface-muted text-ink-muted',
};

const FILTER_OPTIONS = [
  { id: 'all',     label: 'All' },
  { id: 'at_risk', label: 'At Risk' },
];

function getPeriodCtx(category, now) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (category === 'monthly') {
    const daysInMonth = new Date(y, m, 0).getDate();
    return { weeksElapsed: Math.floor((now.getDate() - 1) / 7), periodWeeks: daysInMonth / 7 };
  }
  if (category === 'quarterly') {
    const qStartMonth = Math.floor((m - 1) / 3) * 3;
    const daysElapsed = Math.floor((now - new Date(y, qStartMonth, 1)) / 86400000);
    return { weeksElapsed: Math.floor(daysElapsed / 7), periodWeeks: 13 };
  }
  // annual (covers 'annual', 'club', and any future categories)
  const daysElapsed = Math.floor((now - new Date(y, 0, 1)) / 86400000);
  return { weeksElapsed: Math.max(1, Math.floor(daysElapsed / 7)), periodWeeks: 52 };
}

function AgentRiskRow({ name, statusList }) {
  const counts = { achieved: 0, on_track: 0, at_risk: 0, far_off: 0 };
  statusList.forEach(({ status }) => { counts[status] = (counts[status] || 0) + 1; });

  const atRiskAwards = statusList.filter((a) => a.status === 'at_risk').map((a) => a.award.name);
  const hasAtRisk = counts.at_risk > 0;

  return (
    <div
      className={`rounded-xl border p-3 ${
        hasAtRisk ? 'border-danger/30 bg-danger-tint/30' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-ink">{name}</span>
        <div className="flex items-center gap-2 text-xs shrink-0 flex-wrap">
          {counts.achieved > 0 && (
            <span className="font-medium text-success">{counts.achieved} Achieved</span>
          )}
          {counts.at_risk > 0 && (
            <span className="font-semibold text-danger">{counts.at_risk} At Risk</span>
          )}
          {counts.on_track > 0 && (
            <span className="font-medium text-primary">{counts.on_track} On Track</span>
          )}
          {counts.far_off > 0 && (
            <span className="text-ink-muted">{counts.far_off} Far Off</span>
          )}
        </div>
      </div>

      {atRiskAwards.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2" aria-label="At-risk awards">
          {atRiskAwards.map((awardName) => (
            <span
              key={awardName}
              className={`inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-semibold ${STATUS_PILL_CLASS.at_risk}`}
            >
              {awardName.length > 28 ? `${awardName.slice(0, 26)}…` : awardName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BmAtRiskPanel({ agentProfiles, settlements, ytdSubs, agentIds, currentDate, ruleset }) {
  const [filter, setFilter] = useState('all');

  const agentRows = useMemo(() => {
    const now = currentDate instanceof Date ? currentDate : new Date();
    // Terminated agents are not filtered here — deferred until the terminated-flag feature
    // lands. That feature is cross-cutting: getTenantUsers, leaderboard, awards, and this
    // panel all need to honour the flag once it exists.
    return agentIds
      .map((agentId) => {
        const profile = agentProfiles.find((u) => u.id === agentId) ?? {};
        const agentSetts = settlements.filter((s) => s.agentId === agentId);
        const agentSubs = ytdSubs.filter((s) => (s.agentId ?? s.userId) === agentId);
        const awards = computeAgentAwards(agentSetts, agentSubs, profile, now, ruleset);

        const statusList = Object.values(awards).map((award) => ({
          award,
          status: computeAtRiskStatus(award, getPeriodCtx(award.category, now)),
        }));

        const hasAtRisk = statusList.some((a) => a.status === 'at_risk');
        return {
          agentId,
          name: profile.name ?? profile.email ?? `Agent ${agentId.slice(-6)}`,
          statusList,
          hasAtRisk,
          hasAchieved: statusList.some((a) => a.status === 'achieved'),
        };
      })
      .sort((a, b) => {
        if (a.hasAtRisk !== b.hasAtRisk) return a.hasAtRisk ? -1 : 1;
        if (a.hasAchieved !== b.hasAchieved) return a.hasAchieved ? -1 : 1;
        return 0;
      });
  }, [agentIds, agentProfiles, settlements, ytdSubs, currentDate, ruleset]);

  const filtered = useMemo(
    () => (filter === 'at_risk' ? agentRows.filter((r) => r.hasAtRisk) : agentRows),
    [agentRows, filter],
  );

  if (agentIds.length === 0) return null;

  const atRiskCount = agentRows.filter((r) => r.hasAtRisk).length;

  return (
    <section aria-labelledby="at-risk-heading" className="mt-2 pt-4 border-t border-border">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-danger shrink-0" aria-hidden="true" />
          <h3 id="at-risk-heading" className="text-sm font-bold text-ink">
            Agent Award Risk View
          </h3>
          {atRiskCount > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-danger-tint text-danger">
              {atRiskCount} at risk
            </span>
          )}
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by risk status">
          {FILTER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`min-h-8 px-3 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                filter === id
                  ? 'bg-primary text-white'
                  : 'bg-surface-muted text-ink-muted hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-ink-muted">
            {filter === 'at_risk'
              ? 'No agents are currently at risk on any award.'
              : 'No agents to display.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="bm-at-risk-rows">
          {filtered.map(({ agentId, name, statusList }) => (
            <AgentRiskRow key={agentId} name={name} statusList={statusList} />
          ))}
        </div>
      )}
    </section>
  );
}
