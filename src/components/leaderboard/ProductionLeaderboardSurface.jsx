/**
 * Track J P3 — Production Leaderboard surface.
 *
 * Branch-wide, period-scoped production ranking rendered as:
 *   • a top-3 podium in visual order [#2, #1, #3], #1 elevated, gold/silver/bronze
 *     MedalCoin + ring + glow, labels Champion / Runner-up / Third place
 *   • period chips WK / MTD / QTD / YTD (default YTD), single-select
 *   • a tail of ranks 4–8 (desktop) / 4–7 (mobile) with %-of-leader bars
 *
 * Reads the P1b `leaderboards/{viewerBranchId}` aggregate (all four period
 * arrays live in the doc — chip-switch re-renders in-place, no refetch).
 *
 * Per the kickoff brief (governs on any conflict with the mockup):
 *   • Fields shown: period API (TTD) + apps + unit code — NO persistency,
 *     NO career-level
 *   • Default period: YTD
 *   • Tail bar: % -of-leader (`periodApi / leaderApi`)
 *   • Ranking basis: period API (not gamification points)
 *
 * Reachable behind a TEMPORARY route only — no primary-nav swap (P6's job).
 */

import React, { useMemo, useState } from 'react';
import { formatCurrency } from '../../utils/formatters';
import MedalCoin from '../ui/MedalCoin';
import MovementChip from '../ui/MovementChip';
import useLeaderboard from '../../hooks/useLeaderboard';
import useWeeklyChampions from '../../hooks/useWeeklyChampions';
import WeeklyChampionsBanner from '../gamification/WeeklyChampionsBanner';
import { useAuth } from '../../context/AuthContext';
import {
  computeAroundMe,
  VISIBLE_MAX_DESKTOP,
  VISIBLE_MAX_MOBILE,
} from '../../lib/leaderboard/aroundMeLogic';
import { AroundMeClusterDesktop, AroundMeClusterMobile } from './AroundMeCluster';

// Inline 1.5px primary ring — used to highlight the viewer's row/card in place.
const ME_RING_STYLE = {
  boxShadow: 'inset 0 0 0 1.5px var(--color-primary)',
};

const PERIODS = [
  { k: 'WK',  field: 'week',    label: 'Week'    },
  { k: 'MTD', field: 'mtd',     label: 'Month'   },
  { k: 'QTD', field: 'qtd',     label: 'Quarter' },
  { k: 'YTD', field: 'ytd',     label: 'Year'    },
];

function initialsOf(name) {
  if (!name || typeof name !== 'string') return '?';
  const out = name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return out || '?';
}

// ─────────────────────────────────────────────────────────────────────────────
// Period chips
// ─────────────────────────────────────────────────────────────────────────────
function PeriodChips({ value, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Time period"
      className="inline-flex gap-1 p-1 rounded-xl bg-surface-muted border border-border"
    >
      {PERIODS.map((p) => {
        const active = p.k === value;
        return (
          <button
            key={p.k}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={p.label}
            onClick={() => onChange(p.k)}
            data-testid={`leaderboard-period-${p.k.toLowerCase()}`}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? 'bg-primary dark:bg-primary-dark text-white shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {p.k}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Podium card — top-3 hero treatment
// ─────────────────────────────────────────────────────────────────────────────
// Exported for component tests in __tests__/MovementChipIntegration.test.jsx.
// Render shape is identical when invoked internally vs externally.
export function PodiumCard({ entry, label, isChampion = false, isCenter = false, isViewer = false }) {
  const apiDisplay = formatCurrency(entry.periodApi ?? 0);
  return (
    <div
      className={`relative card flex flex-col items-center text-center overflow-hidden ${
        isCenter ? 'p-5 -translate-y-2' : 'p-4'
      } ${isChampion ? 'border-gold/50 shadow-lg' : ''}`}
      data-testid={`podium-card-rank-${entry.rank}`}
      data-viewer={isViewer ? 'true' : undefined}
      // Per brief: when the viewer is in the podium, ADD a teal inset ring on
      // this card — do NOT recolor the gold/silver/bronze treatment.
      style={isViewer ? ME_RING_STYLE : undefined}
    >
      {/* YOU pill (top-left) when viewer is in podium */}
      {isViewer && (
        <div
          data-testid="podium-you-pill"
          className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-primary dark:bg-primary-dark text-white text-[9px] font-bold font-mono uppercase tracking-widest shadow-sm"
        >
          You
        </div>
      )}
      {/* Track J movement chip — viewer-only, WEEK-only (null on non-week
          periods via the data path). Top-right counterweights the YOU pill. */}
      {isViewer && (
        <div className="absolute top-2 right-2 z-10">
          <MovementChip previousRank={entry.previousRank} rank={entry.rank} />
        </div>
      )}
      {/* Corner glow — wider on the center card */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top:    -50,
          right:  -50,
          width:  200,
          height: 200,
          background: `radial-gradient(circle, var(--color-medal-${entry.rank}-glow), transparent 65%)`,
          opacity: 0.8,
        }}
      />

      {/* Medal + label */}
      <div className="relative flex items-center gap-2">
        <MedalCoin rank={entry.rank} size={isCenter ? 32 : 26} />
        <span
          className={`text-[9.5px] font-bold font-mono uppercase tracking-widest ${
            isChampion ? 'text-gold' : 'text-ink-muted'
          }`}
        >
          {label}
        </span>
      </div>

      {/* Avatar (initials) — ringed in medal color */}
      <div className="relative mt-3.5">
        <div
          className="rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold font-display"
          style={{
            width:    isCenter ? 60 : 48,
            height:   isCenter ? 60 : 48,
            fontSize: isCenter ? 17 : 14,
            border:      `2px solid var(--color-medal-${entry.rank}-mid)`,
            boxShadow:   `0 0 ${isCenter ? 16 : 8}px var(--color-medal-${entry.rank}-glow)`,
          }}
        >
          {initialsOf(entry.name)}
        </div>
      </div>

      <div
        className={`mt-3 font-bold font-display text-ink relative ${isCenter ? 'text-lg' : 'text-base'}`}
        style={{ letterSpacing: '-0.012em' }}
      >
        {entry.name}
      </div>
      {entry.unitName && (
        <div className="text-[10.5px] text-ink-muted mt-0.5 font-mono tracking-wider">
          {entry.unitName}
        </div>
      )}

      <div
        className={`mt-3 font-bold font-display relative tabular-nums ${
          isChampion ? 'text-gold' : 'text-primary'
        } ${isCenter ? 'text-2xl' : 'text-xl'}`}
        style={{ letterSpacing: '-0.022em' }}
      >
        {apiDisplay}
      </div>
      <div className="text-[10.5px] text-ink-muted mt-1 font-mono uppercase tracking-widest">
        {entry.apps ?? 0} apps
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tail row — ranks 4-N with %-of-leader bar
// ─────────────────────────────────────────────────────────────────────────────
// Exported for component tests in __tests__/ProductionLeaderboardSurface.test.jsx.
// Render shape is identical when invoked internally vs externally.
export function TailRow({ entry, leaderApi, isLast, isViewer = false }) {
  const pctOfLeader = leaderApi > 0
    ? Math.min(100, Math.max(0, (entry.periodApi / leaderApi) * 100))
    : 0;
  return (
    <div
      data-testid={`tail-row-rank-${entry.rank}`}
      data-viewer={isViewer ? 'true' : undefined}
      className={`grid items-center px-4 py-2.5 ${isLast ? '' : 'border-b border-border'} ${
        isViewer ? 'bg-primary-tint' : ''
      }`}
      style={{
        gridTemplateColumns: '40px 1.5fr 0.7fr 1.4fr 0.6fr',
        ...(isViewer ? ME_RING_STYLE : {}),
      }}
    >
      <div
        className={`text-sm font-bold font-display text-center ${
          isViewer ? 'text-primary' : 'text-ink-muted'
        }`}
      >
        {entry.rank}
      </div>
      <div className="flex items-center gap-3 min-w-0">
        {isViewer ? (
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
              isViewer ? 'font-bold text-primary' : 'font-semibold text-ink'
            }`}
          >
            <span className="truncate">
              {isViewer ? `You · ${entry.name.split(' ')[0]}` : entry.name}
            </span>
            {/* Track J movement chip — viewer-only, WEEK-only (null elsewhere). */}
            {isViewer && (
              <MovementChip previousRank={entry.previousRank} rank={entry.rank} />
            )}
          </div>
          {entry.unitName && (
            <div className="text-[10.5px] text-ink-muted mt-0.5 font-mono tracking-wide">
              {entry.unitName}
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-ink-muted text-right font-mono tabular-nums">
        {entry.apps ?? 0} apps
      </div>
      <div className="px-3">
        <div className="h-1 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-primary-dark to-primary"
            style={{ width: `${pctOfLeader}%` }}
            aria-label={`${Math.round(pctOfLeader)}% of leader`}
          />
        </div>
      </div>
      <div className="text-sm font-bold text-primary text-right font-display tabular-nums">
        {formatCurrency(entry.periodApi ?? 0)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty / slow-period state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ periodLabel }) {
  return (
    <div className="card flex flex-col items-center text-center py-12">
      <MedalCoin rank={1} size={48} glow={false} />
      <p className="mt-4 text-base font-bold font-display text-ink">
        No production logged for {periodLabel.toLowerCase()} yet
      </p>
      <p className="mt-1.5 text-sm text-ink-muted max-w-md">
        Once weekly reports are submitted, the leaderboard will show every agent in
        your branch ranked by period API. Try a different period to see year-to-date totals.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main surface
// ─────────────────────────────────────────────────────────────────────────────
const PODIUM_LABELS = ['Champion', 'Runner-up', 'Third place'];

export default function ProductionLeaderboardSurface() {
  const [period, setPeriod] = useState('YTD');
  const { loading, error, byPeriod, doc } = useLeaderboard();
  const { champions, loading: championsLoading } = useWeeklyChampions();
  const { user, userProfile } = useAuth();
  const viewerUid = user?.uid ?? null;
  const viewerName = userProfile?.name ?? null;

  const activeField = useMemo(
    () => PERIODS.find((p) => p.k === period)?.field ?? 'ytd',
    [period]
  );
  const activeLabel = useMemo(
    () => PERIODS.find((p) => p.k === period)?.label ?? 'Year',
    [period]
  );

  // Memoize ranking so its identity is stable across re-renders that don't
  // change byPeriod / activeField — keeps the around-me useMemo deps stable.
  const ranking = useMemo(
    () => byPeriod[activeField] ?? [],
    [byPeriod, activeField]
  );
  const podium  = ranking.slice(0, 3);
  const tail    = ranking.slice(3, 8);
  const leaderApi = ranking[0]?.periodApi ?? 0;

  // P4 — compute around-me state for BOTH breakpoints (one is rendered via
  // sm:hidden, the other via hidden sm:block). Recomputes on period change
  // because `ranking` is a useMemo-derivative of `period`.
  const aroundMeDesktop = useMemo(
    () => computeAroundMe({ ranking, viewerUid, visibleMax: VISIBLE_MAX_DESKTOP }),
    [ranking, viewerUid]
  );
  const aroundMeMobile = useMemo(
    () => computeAroundMe({ ranking, viewerUid, visibleMax: VISIBLE_MAX_MOBILE }),
    [ranking, viewerUid]
  );

  // A "slow period" is one where the period array exists but every entry is
  // at 0 API (e.g. a fresh WK where no submissions have landed yet). We treat
  // that the same as empty — an honest "no production logged" state — rather
  // than showing a podium of all-zero champions.
  const isSlowOrEmpty =
    ranking.length === 0 ||
    (leaderApi === 0 && ranking.every((e) => (e.periodApi ?? 0) === 0));

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="production-leaderboard-loading">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-gold">
              ★ Top of the board · YTD
            </p>
            <h2 className="text-2xl font-bold font-display text-ink mt-1.5 tracking-tight">
              Loading rankings…
            </h2>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="card flex flex-col items-center text-center py-12" data-testid="production-leaderboard-error">
        <p className="text-base font-bold font-display text-ink">
          Couldn't load the leaderboard
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          {error.code === 'permission-denied'
            ? "You don't have access to this branch's rankings."
            : 'Try again in a moment — the leaderboard refreshes hourly.'}
        </p>
      </div>
    );
  }

  // ── Header (always rendered, even on empty, so chips remain reachable) ────
  const headerEyebrowLabel = `★ Top of the board · ${period}`;

  return (
    <div className="flex flex-col gap-5" data-testid="production-leaderboard-surface">
      {/* Track J banner re-home — last-week's tenant-wide champions.
          Period-independent (always last-week-completed), so it sits ABOVE
          the period chips. Reuses the unchanged WeeklyChampionsBanner;
          reads weeklyChampions/{prevWeekStarting} via the new hook (the
          doc-id matches the CF's priorWeekStartingString by construction).
          Empty payload → the banner's existing "No data yet" cards render
          honestly (no rules denial; the CF always writes the doc). */}
      <WeeklyChampionsBanner champions={champions} loading={championsLoading} />

      {/* Header — title block + period chips */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p
            data-testid="leaderboard-eyebrow"
            className="text-[9px] font-bold font-mono uppercase tracking-widest text-gold"
          >
            {headerEyebrowLabel}
          </p>
          <h2 className="text-2xl font-bold font-display text-ink mt-1.5 tracking-tight">
            {period === 'WK'  ? "Who's leading this week."
              : period === 'MTD' ? "Who's leading the month."
              : period === 'QTD' ? "Who's leading the quarter."
              : "Who's leading the year."}
          </h2>
        </div>
        <PeriodChips value={period} onChange={setPeriod} />
      </div>

      {/* Empty / slow-period — replaces podium + tail but keeps the chips above */}
      {isSlowOrEmpty ? (
        <EmptyState periodLabel={activeLabel} />
      ) : (
        <>
          {/* Podium — [#2, #1, #3] order on desktop; #1 hero on mobile */}
          <div data-testid="podium" className="flex flex-col gap-3">
            {/* Mobile: #1 hero (full-width) + #2/#3 side-by-side */}
            <div className="sm:hidden flex flex-col gap-3">
              {podium[0] && (
                <PodiumCard
                  entry={podium[0]}
                  label={PODIUM_LABELS[0]}
                  isChampion
                  isCenter
                  isViewer={podium[0].agentId === viewerUid}
                />
              )}
              {(podium[1] || podium[2]) && (
                <div className="grid grid-cols-2 gap-3">
                  {podium[1] && (
                    <PodiumCard
                      entry={podium[1]}
                      label={PODIUM_LABELS[1]}
                      isViewer={podium[1].agentId === viewerUid}
                    />
                  )}
                  {podium[2] && (
                    <PodiumCard
                      entry={podium[2]}
                      label={PODIUM_LABELS[2]}
                      isViewer={podium[2].agentId === viewerUid}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Desktop: 3-up in [#2, #1, #3] visual order, #1 elevated */}
            <div
              className="hidden sm:grid items-end gap-3.5"
              style={{ gridTemplateColumns: '1fr 1.15fr 1fr' }}
            >
              {podium[1] && (
                <PodiumCard
                  entry={podium[1]}
                  label={PODIUM_LABELS[1]}
                  isViewer={podium[1].agentId === viewerUid}
                />
              )}
              {podium[0] && (
                <PodiumCard
                  entry={podium[0]}
                  label={PODIUM_LABELS[0]}
                  isChampion
                  isCenter
                  isViewer={podium[0].agentId === viewerUid}
                />
              )}
              {podium[2] && (
                <PodiumCard
                  entry={podium[2]}
                  label={PODIUM_LABELS[2]}
                  isViewer={podium[2].agentId === viewerUid}
                />
              )}
            </div>
          </div>

          {/* Tail — ranks 4-8 desktop, 4-7 mobile (one fewer row to fit
              the narrower viewport per the mockup). The desktop sticky
              around-me footer is pinned inside this same tail card so
              the gap divider ("+N agents") reads as a continuation of
              the same scrolling field. */}
          {(tail.length > 0 ||
            aroundMeDesktop.state === 'CLUSTER_3' ||
            aroundMeDesktop.state === 'CLUSTER_2_LAST' ||
            aroundMeDesktop.state === 'CLUSTER_UNRANKED') && (
            <div
              data-testid="tail"
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {tail.length > 0 && (
                <div className="px-4 py-2.5 border-b border-border bg-surface-muted">
                  <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
                    Ranks 4 – {3 + Math.min(tail.length, 5)}
                  </p>
                </div>
              )}
              <div>
                {/* Mobile: 4 rows / Desktop: 5 rows */}
                <div className="sm:hidden">
                  {tail.slice(0, 4).map((entry, i, arr) => (
                    <TailRow
                      key={entry.agentId}
                      entry={entry}
                      leaderApi={leaderApi}
                      isLast={i === arr.length - 1}
                      isViewer={entry.agentId === viewerUid}
                    />
                  ))}
                </div>
                <div className="hidden sm:block">
                  {tail.slice(0, 5).map((entry, i, arr) => (
                    <TailRow
                      key={entry.agentId}
                      entry={entry}
                      leaderApi={leaderApi}
                      isLast={i === arr.length - 1}
                      isViewer={entry.agentId === viewerUid}
                    />
                  ))}
                </div>
              </div>

              {/* Desktop sticky around-me footer — rendered ONLY in the
                  desktop tail block (the cluster takes the visibleMax=8
                  desktop boundary). Mobile renders its own variant below
                  as a sticky bar above the bottom-nav. */}
              <div className="hidden sm:block">
                <AroundMeClusterDesktop
                  state={aroundMeDesktop.state}
                  rows={aroundMeDesktop.rows}
                  viewerEntry={aroundMeDesktop.viewerEntry}
                  missingCount={aroundMeDesktop.missingCount}
                  totalCount={aroundMeDesktop.totalCount}
                  leaderApi={leaderApi}
                  viewerName={viewerName}
                />
              </div>
            </div>
          )}

          {/* Mobile sticky around-me bar (fixed above the bottom-nav).
              Lives outside the tail card so it stays pinned to the
              viewport, not the scrolling content. */}
          <AroundMeClusterMobile
            state={aroundMeMobile.state}
            rows={aroundMeMobile.rows}
            viewerEntry={aroundMeMobile.viewerEntry}
            totalCount={aroundMeMobile.totalCount}
            gapToNext={aroundMeMobile.gapToNext}
            prevRank={aroundMeMobile.prevRank}
            viewerName={viewerName}
          />
        </>
      )}

      {/* Footer note — computed timestamp + skip metadata as a quiet caption */}
      {doc?.computedAt && (
        <p className="text-[10px] text-ink-muted font-mono text-center mt-2">
          Updated {formatComputedAt(doc.computedAt)}
          {doc?.skippedNoBranch?.count > 0 && (
            <span className="ml-2 text-ink-muted">
              · {doc.skippedNoBranch.count} submission
              {doc.skippedNoBranch.count === 1 ? '' : 's'} skipped (no branch)
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function formatComputedAt(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-TT', {
      month:  'short',
      day:    'numeric',
      hour:   'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
