import React from 'react';
import { ChevronRight } from 'lucide-react';
import { EYEBROW, FOCUS, TileGrid } from '../money/moneyParts';
import { ARENA_PERIODS, arenaTiles } from '../../../lib/fr/competeModel';

/**
 * FR headers above the existing Leaderboard (Arena) and Me (Profile) screens
 * (FR-5, FR-D5 wrap-don't-rewrite: the screens below render unchanged). PURE.
 */

/** Arena: your own standing on the branch board — year tiles + every period's rank. */
export function FrArenaHeaderView({ standing, loading = false, error = false }) {
  if (error) {
    return <p className="mb-5 text-[13px] text-ink-muted" data-testid="fr-arena-header">Your standing did not load — the board below has a Retry.</p>;
  }
  const tiles = standing ? arenaTiles(standing, 'ytd') : [
    { id: 'rank', label: 'Your rank · this year', value: null, unit: 'text' },
    { id: 'api', label: 'Your API · this year', value: null, unit: 'ttd' },
    { id: 'gap', label: 'To pass the next agent', value: null, unit: 'ttd' },
  ];
  return (
    <div className="mb-5 flex flex-col gap-3" data-testid="fr-arena-header">
      <TileGrid tiles={tiles} loading={loading} label="Your standing" />
      {standing ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted" data-testid="arena-periods">
          {ARENA_PERIODS.map((p) => (
            <span key={p.id} className="whitespace-nowrap">
              {p.label}: <span className="font-semibold tabular-nums text-ink">{standing[p.id]?.rank == null ? '—' : `#${standing[p.id].rank}`}</span>
            </span>
          ))}
        </p>
      ) : null}
      <p className="text-[12px] text-ink-muted">Ranked by settled API in your branch. The full board is below.</p>
    </div>
  );
}

/** Me: level, points, streak, trophies (the points engine's own doc) + a way into the Trophy room. */
export function FrMeHeaderView({ tiles, loading = false, error = false, onOpenTrophies }) {
  return (
    <div className="mb-5 flex flex-col gap-3" data-testid="fr-me-header">
      <div className="flex items-end justify-between gap-3">
        <p className={EYEBROW}>You · Me</p>
        {onOpenTrophies ? (
          <button type="button" onClick={onOpenTrophies} className={`${FOCUS} inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-[13px] font-bold text-primary`} data-testid="me-open-trophies">
            Trophy room
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-[13px] text-ink-muted">Your points did not load.</p>
      ) : (
        <TileGrid tiles={tiles} loading={loading} label="Your progress" />
      )}
    </div>
  );
}
