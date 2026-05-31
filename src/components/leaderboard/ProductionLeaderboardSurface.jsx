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
import useLeaderboard from '../../hooks/useLeaderboard';

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
                ? 'bg-primary-dark text-white shadow-sm'
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
function PodiumCard({ entry, label, isChampion = false, isCenter = false }) {
  const apiDisplay = formatCurrency(entry.periodApi ?? 0);
  return (
    <div
      className={`relative card flex flex-col items-center text-center overflow-hidden ${
        isCenter ? 'p-5 -translate-y-2' : 'p-4'
      } ${isChampion ? 'border-gold/50 shadow-lg' : ''}`}
      data-testid={`podium-card-rank-${entry.rank}`}
    >
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
function TailRow({ entry, leaderApi, isLast }) {
  const pctOfLeader = leaderApi > 0
    ? Math.min(100, Math.max(0, (entry.periodApi / leaderApi) * 100))
    : 0;
  return (
    <div
      data-testid={`tail-row-rank-${entry.rank}`}
      className={`grid items-center px-4 py-2.5 ${isLast ? '' : 'border-b border-border'}`}
      style={{ gridTemplateColumns: '40px 1.5fr 0.7fr 1.4fr 0.6fr' }}
    >
      <div className="text-sm font-bold text-ink-muted font-display text-center">
        {entry.rank}
      </div>
      <div className="flex items-center gap-3 min-w-0">
        <div
          aria-hidden="true"
          className="shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold font-display"
          style={{ width: 32, height: 32, fontSize: 11.5 }}
        >
          {initialsOf(entry.name)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{entry.name}</div>
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

  const activeField = useMemo(
    () => PERIODS.find((p) => p.k === period)?.field ?? 'ytd',
    [period]
  );
  const activeLabel = useMemo(
    () => PERIODS.find((p) => p.k === period)?.label ?? 'Year',
    [period]
  );

  const ranking = byPeriod[activeField] ?? [];
  const podium  = ranking.slice(0, 3);
  const tail    = ranking.slice(3, 8);
  const leaderApi = ranking[0]?.periodApi ?? 0;

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
                />
              )}
              {(podium[1] || podium[2]) && (
                <div className="grid grid-cols-2 gap-3">
                  {podium[1] && <PodiumCard entry={podium[1]} label={PODIUM_LABELS[1]} />}
                  {podium[2] && <PodiumCard entry={podium[2]} label={PODIUM_LABELS[2]} />}
                </div>
              )}
            </div>

            {/* Desktop: 3-up in [#2, #1, #3] visual order, #1 elevated */}
            <div
              className="hidden sm:grid items-end gap-3.5"
              style={{ gridTemplateColumns: '1fr 1.15fr 1fr' }}
            >
              {podium[1] && (
                <PodiumCard entry={podium[1]} label={PODIUM_LABELS[1]} />
              )}
              {podium[0] && (
                <PodiumCard
                  entry={podium[0]}
                  label={PODIUM_LABELS[0]}
                  isChampion
                  isCenter
                />
              )}
              {podium[2] && (
                <PodiumCard entry={podium[2]} label={PODIUM_LABELS[2]} />
              )}
            </div>
          </div>

          {/* Tail — ranks 4-8 desktop, 4-7 mobile (one fewer row to fit
              the narrower viewport per the mockup) */}
          {tail.length > 0 && (
            <div
              data-testid="tail"
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-border bg-surface-muted">
                <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
                  Ranks 4 – {3 + Math.min(tail.length, 5)}
                </p>
              </div>
              <div>
                {/* Mobile: 4 rows / Desktop: 5 rows */}
                <div className="sm:hidden">
                  {tail.slice(0, 4).map((entry, i, arr) => (
                    <TailRow
                      key={entry.agentId}
                      entry={entry}
                      leaderApi={leaderApi}
                      isLast={i === arr.length - 1}
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
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
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
