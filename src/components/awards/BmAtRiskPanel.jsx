/**
 * Track J — BM At-Risk panel v2.
 *
 * Visual port to the #391 grammar:
 *   • Reality strip at the top: total agents · at-risk · achieved.
 *   • Filter pill cluster (All / At Risk) matching #391's category control.
 *   • Per-agent cards using token-driven status surfaces (danger/success/
 *     primary/ink-muted) instead of mixed-purpose Tailwind opacities.
 *   • At-risk award chips are gold-tint (recognition) for achieved, danger-tint
 *     for at-risk — same accent rules as the AwardCard state pills.
 *
 * `awardsEngine` calls (`computeAgentAwards`, `computeAtRiskStatus`,
 * `getPeriodCtx`) + per-agent settlement / submission filtering are PRESERVED.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { computeAgentAwards, computeAtRiskStatus, getPeriodCtx } from '../../utils/awardsEngine';

const FILTER_OPTIONS = [
  { id: 'all',     label: 'All agents' },
  { id: 'at_risk', label: 'At risk only' },
];

function statusAccent(status) {
  switch (status) {
    case 'achieved':  return { color: 'var(--color-success)',     bg: 'var(--color-success-tint)' };
    case 'on_track':  return { color: 'var(--color-primary)',     bg: 'var(--color-primary-tint)' };
    case 'at_risk':   return { color: 'var(--color-danger)',      bg: 'var(--color-danger-tint)'  };
    default:          return { color: 'var(--color-text-faint)',  bg: 'var(--color-surface-muted)' };
  }
}

function AgentRiskCard({ name, statusList }) {
  const counts = { achieved: 0, on_track: 0, at_risk: 0, far_off: 0 };
  statusList.forEach(({ status }) => { counts[status] = (counts[status] || 0) + 1; });

  const atRiskAwards = statusList.filter((a) => a.status === 'at_risk').map((a) => a.award.name);
  const hasAtRisk = counts.at_risk > 0;
  const totalTracked = statusList.length;

  return (
    <div
      className="card p-4 flex flex-col gap-3"
      data-testid="bm-at-risk-agent-card"
      data-at-risk={hasAtRisk ? 'true' : 'false'}
      style={{
        border: hasAtRisk ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
        boxShadow: hasAtRisk ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {/* Header row: name + total tracked */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasAtRisk && (
            <AlertTriangle size={14} className="text-danger-ink shrink-0" aria-hidden="true" />
          )}
          <span className="text-sm font-bold text-ink truncate">{name}</span>
        </div>
        <span className="text-[10px] text-ink font-mono tracking-wide shrink-0">
          {totalTracked} award{totalTracked === 1 ? '' : 's'} tracked
        </span>
      </div>

      {/* Status counts row — gold/teal/danger/grey state pills (no opacity hex) */}
      <div className="flex items-center gap-2 flex-wrap">
        {counts.achieved > 0 && (
          <span
            className="inline-flex items-center text-[10px] font-bold tracking-wide font-mono px-2 py-1 rounded-full"
            style={{ color: 'var(--color-gold)', background: 'var(--color-gold-tint)' }}
          >
            ✓ {counts.achieved} achieved
          </span>
        )}
        {counts.on_track > 0 && (
          <span
            className="inline-flex items-center text-[10px] font-bold tracking-wide font-mono px-2 py-1 rounded-full"
            style={{ color: 'var(--color-primary)', background: 'var(--color-primary-tint)' }}
          >
            ↗ {counts.on_track} on track
          </span>
        )}
        {counts.at_risk > 0 && (
          <span
            className="inline-flex items-center text-[10px] font-bold tracking-wide font-mono px-2 py-1 rounded-full"
            style={{ color: 'var(--color-danger)', background: 'var(--color-danger-tint)' }}
          >
            ⚠ {counts.at_risk} at risk
          </span>
        )}
        {counts.far_off > 0 && (
          <span
            className="inline-flex items-center text-[10px] font-bold tracking-wide font-mono px-2 py-1 rounded-full"
            style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-muted)' }}
          >
            ◯ {counts.far_off} far off
          </span>
        )}
      </div>

      {/* At-risk award chips — only when present */}
      {atRiskAwards.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border" aria-label="At-risk awards">
          {atRiskAwards.map((awardName) => {
            const a = statusAccent('at_risk');
            return (
              <span
                key={awardName}
                className="inline-flex items-center h-6 px-2 rounded-full text-[10px] font-semibold tracking-wide"
                style={{ color: a.color, background: a.bg }}
              >
                <ChevronRight size={10} aria-hidden="true" />
                <span className="ml-0.5">
                  {awardName.length > 32 ? `${awardName.slice(0, 30)}…` : awardName}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BmAtRiskPanel({
  agentProfiles, settlements, ytdSubs, agentIds, currentDate, ruleset,
}) {
  const [filter, setFilter] = useState('all');

  const agentRows = useMemo(() => {
    const now = currentDate instanceof Date ? currentDate : new Date();
    return agentIds
      .map((agentId) => {
        const profile = agentProfiles.find((u) => u.id === agentId) ?? {};
        const agentSetts = settlements.filter((s) => s.agentId === agentId);
        const agentSubs  = ytdSubs.filter((s) => (s.agentId ?? s.userId) === agentId);
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
  const achievedCount = agentRows.filter((r) => r.hasAchieved).length;

  return (
    <section
      aria-labelledby="at-risk-heading"
      className="flex flex-col gap-4 mt-2 pt-5 border-t border-border"
      data-testid="bm-at-risk-panel"
    >
      {/* Header eyebrow + reality strip */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <p
              id="at-risk-heading"
              className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase"
            >
              Agent Award Risk View
            </p>
            <span
              className="text-[10px] font-mono tracking-wide text-ink"
              data-testid="bm-at-risk-total"
            >
              {agentRows.length} agent{agentRows.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Filter pills — v2 control grammar */}
          <div
            role="tablist"
            aria-label="Filter by risk status"
            className="flex gap-1 p-1 rounded-xl bg-surface-muted border border-border"
          >
            {FILTER_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  filter === id
                    ? 'bg-card text-ink shadow-sm border border-border'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Reality strip — total + at risk + achieved counts */}
        <div
          className="flex items-center gap-3 flex-wrap"
          data-testid="bm-at-risk-reality"
        >
          {atRiskCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide font-mono px-2.5 py-1 rounded-full"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-tint)' }}
            >
              <AlertTriangle size={11} aria-hidden="true" />
              {atRiskCount} at risk
            </span>
          )}
          {achievedCount > 0 && (
            <span
              className="inline-flex items-center text-xs font-bold tracking-wide font-mono px-2.5 py-1 rounded-full"
              style={{ color: 'var(--color-gold)', background: 'var(--color-gold-tint)' }}
            >
              ✓ {achievedCount} qualified
            </span>
          )}
        </div>
      </div>

      {/* Agent cards grid */}
      {filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-ink-muted">
            {filter === 'at_risk'
              ? 'No agents are currently at risk on any award.'
              : 'No agents to display.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="bm-at-risk-rows">
          {filtered.map(({ agentId, name, statusList }) => (
            <AgentRiskCard key={agentId} name={name} statusList={statusList} />
          ))}
        </div>
      )}
    </section>
  );
}
