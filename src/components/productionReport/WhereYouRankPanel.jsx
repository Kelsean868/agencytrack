/**
 * WhereYouRankPanel — Track J P7 around-me panel for AgentProductionView.
 *
 * View-specific around-me presentation (3 rows: prev · You · next) for the
 * Production Report's agent view. Always-on (no visible-set gating, unlike
 * the Leaderboard's conditional below-set cluster) — consumes `aroundMeLogic`'s
 * neighbor math by passing `visibleMax: 0` so the resolver always returns the
 * cluster path.
 *
 * Why a view-specific component (not Leaderboard's `AroundMeCluster`):
 *   • Layout: static card vs sticky footer / sticky bar with tap-expand.
 *   • Shape: rank + initials + name + unit + API (no apps column, no
 *     %-of-leader bar) — matches the production-report mockup, not the
 *     leaderboard cluster's tail-row grid.
 *   • Always-on: shows the viewer's neighbors regardless of rank
 *     (Leaderboard hides the cluster when the viewer IS in the visible set).
 *
 * Nexus tokens only. No raw hex.
 *
 * Reads the SAME `leaderboards/{viewerBranchId}` aggregate that powers the
 * Leaderboard surface — single source of truth, fixes the always-#1 bug
 * from PR 397 (which used a self-only submissions ranking that Firestore
 * rules force to always-1).
 */

import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { computeAroundMe } from '../../lib/leaderboard/aroundMeLogic';
import MovementChip from '../ui/MovementChip';

const ME_RING_STYLE = {
  boxShadow: 'inset 0 0 0 1.5px var(--color-primary)',
};

function initialsOf(name) {
  if (!name || typeof name !== 'string') return '?';
  const out = name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return out || '?';
}

function firstNameOf(name) {
  if (!name || typeof name !== 'string') return 'You';
  return name.trim().split(/\s+/)[0] || 'You';
}

function ordinalSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  const last = n % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}

function RankRow({ entry, isViewer, viewerName }) {
  const isUnrankedRow = entry == null;
  const displayName = isUnrankedRow
    ? `You · ${firstNameOf(viewerName)}`
    : isViewer
      ? `You · ${firstNameOf(entry.name)}`
      : entry.name;
  const style = isViewer || isUnrankedRow ? ME_RING_STYLE : undefined;
  const rowClass = `flex items-center gap-3 px-3 py-2 rounded-lg ${
    isViewer || isUnrankedRow ? 'bg-primary-tint' : 'bg-transparent'
  }`;

  return (
    <div
      data-testid={
        isUnrankedRow
          ? 'where-you-rank-row-unranked'
          : `where-you-rank-row-rank-${entry.rank}`
      }
      data-viewer={isViewer || isUnrankedRow ? 'true' : undefined}
      className={rowClass}
      style={style}
    >
      {/* Rank number — teal for viewer / em-dash for unranked / gold for top-3 / faint for others */}
      <div
        className={`w-5 text-center text-sm font-bold font-display ${
          isUnrankedRow
            ? 'text-primary'
            : isViewer
              ? 'text-primary'
              : entry.rank <= 3
                ? 'text-gold-ink'
                : 'text-ink-muted'
        }`}
      >
        {isUnrankedRow ? '—' : entry.rank}
      </div>

      {/* Avatar — solid teal "YOU" coin or initials */}
      {isViewer || isUnrankedRow ? (
        <div
          aria-hidden="true"
          className="shrink-0 rounded-full bg-primary dark:bg-primary-dark text-white flex items-center justify-center font-bold font-display text-[10px] uppercase tracking-widest"
          style={{ width: 28, height: 28 }}
        >
          YOU
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold font-display"
          style={{ width: 28, height: 28, fontSize: 10 }}
        >
          {initialsOf(entry.name)}
        </div>
      )}

      {/* Name + unit */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm flex items-center gap-1.5 ${
            isViewer || isUnrankedRow ? 'font-bold text-primary' : 'font-semibold text-ink'
          }`}
        >
          <span className="truncate">{displayName}</span>
          {/* Track J movement chip — viewer-only, ranked-only (skipped on
              unranked YOU row — no current rank). WEEK-only via data: the
              aggregate's WEEK field carries previousRank; MTD/QTD/YTD have
              null → chip renders nothing. The panel's period is set by the
              parent (`AgentProductionView`) and naturally flows through. */}
          {isViewer && !isUnrankedRow && (
            <MovementChip previousRank={entry.previousRank} rank={entry.rank} />
          )}
        </div>
        {isUnrankedRow ? (
          <div className="text-[10px] text-ink-muted mt-0.5 font-mono">
            Log production to join the board.
          </div>
        ) : entry.unitName ? (
          <div className="text-[10px] text-ink-muted mt-0.5 font-mono">{entry.unitName}</div>
        ) : null}
      </div>

      {/* Period API (none for unranked) */}
      <div className="text-sm font-bold font-display tabular-nums text-ink">
        {isUnrankedRow ? '—' : formatCurrency(entry.periodApi ?? 0)}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Array}  props.ranking       — period-scoped ranking from the aggregate
 * @param {string} props.viewerUid     — logged-in agent's uid
 * @param {string} props.viewerName    — display name fallback (for unranked + viewer label)
 * @param {string} props.branchLabel   — e.g. "South Branch" or "the branch"; flows into the footer caption
 * @param {string} props.periodLabel   — e.g. "year", "week", "month", "quarter"
 */
export default function WhereYouRankPanel({
  ranking,
  viewerUid,
  viewerName,
  branchLabel,
  periodLabel,
}) {
  // visibleMax=0 → forces the cluster path always. The "below set" semantics
  // become "always show neighbors", which is exactly what this view wants.
  const aroundMe = useMemo(
    () => computeAroundMe({ ranking, viewerUid, visibleMax: 0 }),
    [ranking, viewerUid]
  );

  const { state, viewerEntry, rows, gapToNext, prevRank, totalCount } = aroundMe;
  const isUnranked = state === 'CLUSTER_UNRANKED';

  // Compose the footer caption: "You're 7th of 28 in South Branch this year.
  // TTD X behind the next spot."
  const footer = isUnranked
    ? `You're unranked of ${totalCount} in ${branchLabel || 'the branch'} this ${periodLabel || 'period'}.`
    : viewerEntry
      ? (() => {
          const rk = viewerEntry.rank;
          const ord = `${rk}${ordinalSuffix(rk)}`;
          const base = `You're ${ord} of ${totalCount} in ${branchLabel || 'the branch'} this ${periodLabel || 'period'}.`;
          if (gapToNext != null && gapToNext > 0 && prevRank != null) {
            return `${base} ${formatCurrency(gapToNext)} behind the next spot.`;
          }
          return base;
        })()
      : null;

  return (
    <div data-testid="where-you-rank-panel" className="card flex flex-col gap-3">
      {/* Eyebrow */}
      <div className="flex items-center gap-2">
        <Trophy size={15} className="text-gold" aria-hidden="true" />
        <p className="text-[10.5px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          Where you rank
        </p>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1.5">
        {isUnranked ? (
          <RankRow entry={null} isViewer viewerName={viewerName} />
        ) : (
          rows.map((entry) => (
            <RankRow
              key={entry.agentId}
              entry={entry}
              isViewer={viewerEntry && entry.agentId === viewerEntry.agentId}
              viewerName={viewerName}
            />
          ))
        )}
      </div>

      {/* Footer caption */}
      {footer && (
        <p className="text-xs text-ink-muted leading-relaxed pt-1 border-t border-border">
          {footer}
        </p>
      )}
    </div>
  );
}
