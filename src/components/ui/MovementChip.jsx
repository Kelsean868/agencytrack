/**
 * MovementChip — viewer's week-over-week rank movement (Track J).
 *
 * Direction (the easy-to-invert bit): `delta = previousRank − rank`.
 *   A rank IMPROVES by getting numerically smaller, so:
 *     previousRank 5 → rank 2 → delta +3 → ▲3 (climbed)
 *     previousRank 2 → rank 5 → delta −3 → ▼3 (dropped)
 *     previousRank 4 → rank 4 → delta  0 → –  (even)
 *     previousRank null/undefined → null (no chip)
 *     rank null/undefined         → null (defensive)
 *
 * Consumed by the four viewer-representations in the leaderboard surfaces:
 * AroundMeCluster YOU row (desktop + mobile), TailRow isViewer arm, PodiumCard
 * isViewer arm, and WhereYouRankPanel YOU row. Viewer-only by convention — the
 * caller decides which row gets the chip; this primitive does not gate on
 * isViewer itself.
 *
 * WEEK-only by data: `previousRank` is null on MTD/QTD/YTD aggregate entries
 * per the P5-prep CF, so the chip self-disables on non-week periods via the
 * same null code path. The caller does NOT need a separate period gate.
 *
 * Nexus tokens only; no raw hex.
 */

import React from 'react';

const PALETTE = {
  up:   'text-success   bg-success-tint',
  down: 'text-danger    bg-danger-tint',
  even: 'text-ink-muted bg-surface-muted',
};

function ariaLabel(delta) {
  if (delta > 0) return `Climbed ${delta} spot${delta === 1 ? '' : 's'} this week`;
  if (delta < 0) return `Dropped ${-delta} spot${-delta === 1 ? '' : 's'} this week`;
  return 'No change this week';
}

/**
 * @param {Object} props
 * @param {number|null|undefined} props.previousRank — prior-week rank (null → no chip)
 * @param {number|null|undefined} props.rank         — current rank
 * @param {string} [props.className]                 — opt-in passthrough
 */
export default function MovementChip({ previousRank, rank, className = '' }) {
  // Null path — covers MTD/QTD/YTD entries (CF writes previousRank=null on
  // non-week entries) AND ranked-absent agents (the genuinely-absent defensive
  // case from the P5-prep CF). Return nothing — caller renders empty space.
  if (previousRank == null || rank == null) return null;

  const delta = previousRank - rank;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'even';
  const glyph = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–';
  const magnitude = delta === 0 ? null : Math.abs(delta);

  return (
    <span
      data-testid="movement-chip"
      data-delta={delta}
      data-direction={direction}
      role="status"
      aria-label={ariaLabel(delta)}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono tabular-nums ${PALETTE[direction]} ${className}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {magnitude != null && <span>{magnitude}</span>}
    </span>
  );
}
