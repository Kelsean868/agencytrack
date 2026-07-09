/**
 * AroundMeCluster — Track J P4 pinned around-me cluster.
 *
 * Two variants:
 *   • Desktop: sticky FOOTER pinned to the bottom of the tail card. The tail
 *     rows scroll above it (when they overflow); the cluster stays. A hairline
 *     rule + centered "+N agents" mono divider separates it from the visible
 *     tail so the rank-jump (8 → cluster-top) reads honestly.
 *   • Mobile: a sticky BAR fixed directly above the bottom-nav. Default is a
 *     compact 1-row summary (rank-of-total + period API + gap-to-next).
 *     Tap-to-expand opens the full 3-row sheet (sliding up). Tap again or
 *     scroll collapses.
 *
 * Both consume the result of computeAroundMe() from `src/lib/leaderboard/aroundMeLogic.js`.
 * No data fetching here — the cluster is a pure render of cluster state.
 *
 * Highlight tokens (Nexus, mapped in Phase 1):
 *   • Tint background:  bg-primary-tint
 *   • Inset 1.5px ring: inline `box-shadow: inset 0 0 0 1.5px var(--color-primary)`
 *   • Teal rank text:   text-primary
 *   • YOU coin:         bg-primary dark:bg-primary-dark text-white
 *
 * No raw hex anywhere in this file.
 *
 * Movement chip (▲/▼) is DEFERRED — needs `previousRank` (keystone CF change);
 * FU-banked. Gap-to-next ships now (derived from the neighbor row).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatCurrency } from '../../utils/formatters';
import MovementChip from '../ui/MovementChip';

function initialsOf(name) {
  if (!name || typeof name !== 'string') return '?';
  const out = name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return out || '?';
}

function firstNameOf(name) {
  if (!name || typeof name !== 'string') return 'You';
  return name.trim().split(/\s+/)[0] || 'You';
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared inline-style helpers
// ─────────────────────────────────────────────────────────────────────────────

const ME_RING_STYLE = {
  boxShadow: 'inset 0 0 0 1.5px var(--color-primary)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Desktop — sticky footer cluster pinned to the bottom of the tail card
// ─────────────────────────────────────────────────────────────────────────────

function DesktopClusterRow({ entry, isViewer, leaderApi, viewerName }) {
  const isUnrankedRow = entry == null;

  const periodApi = isUnrankedRow ? 0 : (entry.periodApi ?? 0);
  const pctOfLeader =
    !isUnrankedRow && leaderApi > 0
      ? Math.min(100, Math.max(0, (periodApi / leaderApi) * 100))
      : 0;

  // Display name: real entry name, or "You · {firstname}" for the unranked YOU row.
  const displayName = isUnrankedRow
    ? `You · ${firstNameOf(viewerName)}`
    : isViewer
      ? `You · ${firstNameOf(entry.name)}`
      : entry.name;

  const rowStyle = isViewer || isUnrankedRow ? ME_RING_STYLE : undefined;
  const rowClass = `grid items-center px-4 py-2.5 ${
    isViewer || isUnrankedRow ? 'bg-primary-tint' : ''
  }`;

  return (
    <div
      data-testid={
        isUnrankedRow
          ? 'around-me-row-unranked'
          : `around-me-row-rank-${entry.rank}`
      }
      className={rowClass}
      style={{ gridTemplateColumns: '40px 1.5fr 0.7fr 1.4fr 0.6fr', ...rowStyle }}
    >
      {/* Rank — teal for viewer / unranked, faint dash for unranked */}
      <div
        className={`text-sm font-bold font-display text-center ${
          isViewer || isUnrankedRow ? 'text-primary' : 'text-ink-muted'
        }`}
      >
        {isUnrankedRow ? '—' : entry.rank}
      </div>

      {/* Avatar + name/unit */}
      <div className="flex items-center gap-3 min-w-0">
        {isViewer || isUnrankedRow ? (
          <div
            aria-hidden="true"
            className="shrink-0 rounded-full bg-primary dark:bg-primary-dark text-white flex items-center justify-center font-bold font-display text-[10px] uppercase tracking-widest"
            style={{ width: 32, height: 32 }}
          >
            YOU
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold font-display"
            style={{ width: 32, height: 32, fontSize: 11.5 }}
          >
            {initialsOf(entry.name)}
          </div>
        )}
        <div className="min-w-0">
          <div
            className={`text-sm truncate flex items-center gap-1.5 ${
              isViewer || isUnrankedRow ? 'font-bold text-primary' : 'font-semibold text-ink'
            }`}
          >
            <span className="truncate">{displayName}</span>
            {/* Track J movement chip — viewer-only (skipped on unranked YOU
                row since there's no current rank). WEEK-only via the data
                path (previousRank=null on non-week entries). */}
            {isViewer && !isUnrankedRow && (
              <MovementChip previousRank={entry.previousRank} rank={entry.rank} />
            )}
          </div>
          {isUnrankedRow ? (
            <div className="text-[10.5px] text-ink-muted mt-0.5 font-mono tracking-wide">
              Log production to join the board.
            </div>
          ) : entry.unitName ? (
            <div className="text-[10.5px] text-ink-muted mt-0.5 font-mono tracking-wide">
              {entry.unitName}
            </div>
          ) : null}
        </div>
      </div>

      {/* Apps */}
      <div className="text-xs text-ink-muted text-right font-mono tabular-nums">
        {isUnrankedRow ? '—' : `${entry.apps ?? 0} apps`}
      </div>

      {/* %-of-leader bar (omitted for unranked row per brief) */}
      <div className="px-3">
        {isUnrankedRow ? (
          <div className="h-1" />
        ) : (
          <div className="h-1 rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-primary-dark to-primary"
              style={{ width: `${pctOfLeader}%` }}
              aria-label={`${Math.round(pctOfLeader)}% of leader`}
            />
          </div>
        )}
      </div>

      {/* Period API */}
      <div className="text-sm font-bold text-primary text-right font-display tabular-nums">
        {isUnrankedRow ? 'TTD 0' : formatCurrency(periodApi)}
      </div>
    </div>
  );
}

export function AroundMeClusterDesktop({
  state,
  rows,
  viewerEntry,
  missingCount,
  totalCount,
  leaderApi,
  viewerName,
}) {
  if (state === 'VISIBLE_PODIUM' || state === 'VISIBLE_TAIL') return null;

  const showDivider = missingCount > 0;
  const isUnranked = state === 'CLUSTER_UNRANKED';

  return (
    <div
      data-testid="around-me-desktop"
      data-cluster-state={state}
      className="border-t-2 border-border bg-surface-muted"
    >
      {/* "+N agents" gap divider — only when there's a rank jump to declare */}
      {showDivider && (
        <div
          data-testid="around-me-gap-divider"
          className="flex items-center justify-center py-1.5 text-[10px] font-mono uppercase tracking-widest text-ink-muted"
        >
          + {missingCount} agent{missingCount === 1 ? '' : 's'}
        </div>
      )}

      {/* Cluster rows */}
      <div>
        {isUnranked ? (
          <DesktopClusterRow entry={null} isViewer leaderApi={leaderApi} viewerName={viewerName} />
        ) : (
          rows.map((entry) => (
            <DesktopClusterRow
              key={entry.agentId}
              entry={entry}
              isViewer={viewerEntry && entry.agentId === viewerEntry.agentId}
              leaderApi={leaderApi}
              viewerName={viewerName}
            />
          ))
        )}
      </div>

      {/* Total-count footnote */}
      <div className="px-4 py-2 text-[10px] font-mono text-ink-muted text-right">
        {isUnranked
          ? `— of ${totalCount}`
          : `Rank ${viewerEntry.rank} of ${totalCount}`}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile — sticky bar fixed above the bottom-nav; tap-to-expand sheet
// ─────────────────────────────────────────────────────────────────────────────

function MobileExpandedRow({ entry, isViewer, viewerName }) {
  const isUnrankedRow = entry == null;
  const displayName = isUnrankedRow
    ? `You · ${firstNameOf(viewerName)}`
    : isViewer
      ? `You · ${firstNameOf(entry.name)}`
      : entry.name;
  const style = isViewer || isUnrankedRow ? ME_RING_STYLE : undefined;
  return (
    <div
      data-testid={
        isUnrankedRow
          ? 'around-me-mobile-row-unranked'
          : `around-me-mobile-row-rank-${entry.rank}`
      }
      className={`flex items-center gap-3 px-3 py-2.5 ${
        isViewer || isUnrankedRow ? 'bg-primary-tint rounded-lg' : ''
      }`}
      style={style}
    >
      <div
        className={`w-7 text-center text-sm font-bold font-display ${
          isViewer || isUnrankedRow ? 'text-primary' : 'text-ink-muted'
        }`}
      >
        {isUnrankedRow ? '—' : entry.rank}
      </div>
      {isViewer || isUnrankedRow ? (
        <div
          aria-hidden="true"
          className="shrink-0 rounded-full bg-primary dark:bg-primary-dark text-white flex items-center justify-center font-bold font-display text-[10px] uppercase tracking-widest"
          style={{ width: 30, height: 30 }}
        >
          YOU
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold font-display"
          style={{ width: 30, height: 30, fontSize: 11 }}
        >
          {initialsOf(entry?.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm truncate flex items-center gap-1.5 ${
            isViewer || isUnrankedRow ? 'font-bold text-primary' : 'font-semibold text-ink'
          }`}
        >
          <span className="truncate">{displayName}</span>
          {/* Track J movement chip — viewer-only, ranked-only, WEEK-only via data. */}
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
      <div className="text-sm font-bold text-primary font-display tabular-nums">
        {isUnrankedRow ? 'TTD 0' : formatCurrency(entry.periodApi ?? 0)}
      </div>
    </div>
  );
}

export function AroundMeClusterMobile({
  state,
  rows,
  viewerEntry,
  totalCount,
  gapToNext,
  prevRank,
  viewerName,
}) {
  const [expanded, setExpanded] = useState(false);
  const barRef = useRef(null);

  // Collapse on scroll-away (any meaningful scroll collapses the expanded sheet).
  // Capture phase so this fires for the real scroll region — the `.shell-content`
  // pane (redesign §5 scrolls the pane, not the window; scroll events don't bubble,
  // but a capturing window listener still sees a descendant scroller's events).
  useEffect(() => {
    if (!expanded) return undefined;
    const onScroll = () => setExpanded(false);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, [expanded]);

  // Collapse on outside-tap.
  useEffect(() => {
    if (!expanded) return undefined;
    const onClick = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setExpanded(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('touchstart', onClick, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('touchstart', onClick);
    };
  }, [expanded]);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  if (state === 'VISIBLE_PODIUM' || state === 'VISIBLE_TAIL') return null;

  const isUnranked = state === 'CLUSTER_UNRANKED';
  const viewerRankLabel = isUnranked ? '—' : (viewerEntry?.rank ?? '—');
  const viewerApi = isUnranked ? 0 : (viewerEntry?.periodApi ?? 0);
  const viewerDisplayName = isUnranked
    ? `You · ${firstNameOf(viewerName)}`
    : `You · ${firstNameOf(viewerEntry?.name)}`;

  return (
    <div
      ref={barRef}
      data-testid="around-me-mobile"
      data-cluster-state={state}
      data-expanded={expanded ? 'true' : 'false'}
      className="fixed left-0 right-0 z-[19] sm:hidden"
      style={{
        // Sit above the bottom-nav (.bottom-nav has z-index 20 and ~56-60px height
        // including safe-area-inset). 60px clears it on devices with a home
        // indicator.
        bottom: 'calc(env(safe-area-inset-bottom, 12px) + 60px)',
      }}
    >
      {/* Expanded sheet (slides up from the bar) */}
      {expanded && !isUnranked && rows.length > 1 && (
        <div
          data-testid="around-me-mobile-expanded"
          className="mx-2 mb-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
        >
          {rows.map((entry) => (
            <MobileExpandedRow
              key={entry.agentId}
              entry={entry}
              isViewer={viewerEntry && entry.agentId === viewerEntry.agentId}
              viewerName={viewerName}
            />
          ))}
        </div>
      )}

      {/* Collapsed bar (always visible; toggles the sheet) */}
      <button
        type="button"
        onClick={toggle}
        aria-label={
          isUnranked
            ? 'Your position — unranked'
            : `Your position — rank ${viewerRankLabel} of ${totalCount}`
        }
        aria-expanded={expanded}
        className="block w-full text-left mx-2 mb-2 rounded-xl bg-card border border-border shadow-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ width: 'calc(100% - 16px)', ...ME_RING_STYLE, background: 'var(--color-primary-tint)' }}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* YOU coin */}
          <div
            aria-hidden="true"
            className="shrink-0 rounded-full bg-primary dark:bg-primary-dark text-white flex items-center justify-center font-bold font-display text-[10px] uppercase tracking-widest"
            style={{ width: 32, height: 32 }}
          >
            YOU
          </div>

          {/* Name + rank-of-total */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold font-display text-primary flex items-center gap-1.5">
              <span className="truncate">{viewerDisplayName}</span>
              {/* Track J movement chip — viewer-only, ranked-only (no chip
                  on unranked YOU bar — no current rank to compare). WEEK-only
                  via data path. */}
              {!isUnranked && viewerEntry && (
                <MovementChip
                  previousRank={viewerEntry.previousRank}
                  rank={viewerEntry.rank}
                />
              )}
            </div>
            <div className="text-[10.5px] text-ink-muted mt-0.5 font-mono tracking-wide">
              {isUnranked
                ? `Log production to join the board.`
                : `Rank ${viewerRankLabel} of ${totalCount}`}
              {!isUnranked && gapToNext != null && gapToNext > 0 && (
                <>
                  {' · '}
                  <span className="text-ink">
                    {formatCurrency(gapToNext)} behind #{prevRank}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Period API */}
          <div className="text-sm font-bold font-display text-primary tabular-nums">
            {formatCurrency(viewerApi)}
          </div>

          {/* Expand chevron — rotates 180° on expand */}
          <div
            aria-hidden="true"
            className="text-ink-muted text-[18px] font-bold transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ⌃
          </div>
        </div>
      </button>
    </div>
  );
}
