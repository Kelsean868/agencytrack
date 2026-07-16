// ChampionsPanel — ranked weekly champions (Fable, Tier-1 #6 remainder).
//
// Design intent: docs/design-system/screens-v2/manager-v2-shared.jsx
// ChampionsPanel — "★ This week's champions", a ranked (not winner-take-all)
// top-N list by weekly API, rank + initials + name + value. Gold = recognition
// only (CLAUDE.md theme rule).
//
// Data: `champions` is the ranked array produced by rankWeeklyChampions()
// (src/utils/weeklyChampions.js) over useBranchOverview's already-loaded,
// already role/branch/unit-scoped submissions — this panel does no fetching
// of its own and adds zero new Firestore reads.
//
// Four states (§1): loading skeleton (PanelSkeleton) · the ranked list ·
// honest empty state when no agent posted API > 0 this week yet (very common
// early in the week, before Sunday reports land — see the panel's own
// consuming ManagerOverviewTab for the shared `loading`/`error` gate).
import React from 'react';
import { Trophy } from 'lucide-react';
import { formatCurrency, initials } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useCountUp';
import PanelSkeleton from '../ui/PanelSkeleton';
import MedalCoin from '../ui/MedalCoin';

function ChampionRow({ c }) {
  const animatedApi = useCountUp(c.api ?? 0, { duration: 800, decimals: 2 });
  return (
    <div
      data-testid={`champion-row-${c.agentId}`}
      className="flex items-center gap-3 py-2"
    >
      <MedalCoin rank={c.rank} size={28} glow={false} />
      <span className="h-8 w-8 shrink-0 rounded-full bg-gold/10 text-gold-ink flex items-center justify-center font-display font-bold text-[11px]">
        {initials(c.agentName)}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-ink truncate">{c.agentName}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold font-display text-gold-ink tabular-nums">
          {formatCurrency(animatedApi)}
        </span>
        <span className="block text-[10px] text-ink-muted font-mono tabular-nums">
          {c.apps ?? 0} apps
        </span>
      </span>
    </div>
  );
}

export default function ChampionsPanel({ champions = [], loading = false }) {
  if (loading) {
    return (
      <div className="card" data-testid="champions-panel-loading">
        <div className="h-3 w-40 rounded bg-border/30 animate-pulse mb-4" />
        <PanelSkeleton variant="list" count={3} label="Loading this week's champions…" />
      </div>
    );
  }

  return (
    <section aria-labelledby="champions-panel-heading" className="card" data-testid="champions-panel">
      <div className="flex items-baseline justify-between mb-1">
        <p
          id="champions-panel-heading"
          className="text-[10px] font-bold font-mono uppercase tracking-widest text-gold-ink flex items-center gap-1.5"
        >
          <Trophy size={11} aria-hidden="true" />
          This week&apos;s champions
        </p>
      </div>
      <p className="text-xs text-ink-muted mb-3">Ranked by API, this week</p>

      {champions.length === 0 ? (
        <p className="text-sm text-ink-muted py-4 text-center" data-testid="champions-panel-empty">
          No champions yet this week — check back once reports start coming in
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border" data-testid="champions-panel-list">
          {champions.map((c) => (
            <ChampionRow key={c.agentId} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}
