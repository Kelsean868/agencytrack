/**
 * computeAroundMe — pure cluster-state resolver for the Track J P4 around-me row.
 *
 * Given the period-scoped ranking, the viewer's UID, and the visible-set bottom
 * rank (8 on desktop, 7 on mobile), decides whether to render the viewer's
 * existing row in-place (VISIBLE_*) or to materialize a pinned "around-me"
 * cluster (CLUSTER_*) — and which rows the cluster contains.
 *
 * Pure: no React, no Firebase, no DOM. Unit-tested as the primary verification
 * for the below-set cases (the live test branch has only 6 agents, so ranks
 * > 8 cannot be reached with live data).
 *
 * @param {Object}  params
 * @param {Array}   params.ranking      — ranked entries (rank 1 → rank N); each
 *                                        carries at least `{ agentId, rank, periodApi }`.
 * @param {string}  params.viewerUid    — the logged-in agent's UID.
 * @param {number}  params.visibleMax   — visible-set bottom rank: 8 on desktop
 *                                        (podium 1–3 + tail 4–8); 7 on mobile
 *                                        (hero 1 + #2/#3 + tail 4–7).
 *
 * @returns {{
 *   state:        'VISIBLE_PODIUM' | 'VISIBLE_TAIL' | 'CLUSTER_3' | 'CLUSTER_2_LAST' | 'CLUSTER_UNRANKED',
 *   viewerEntry:  Object | null,    // viewer's entry; null when CLUSTER_UNRANKED
 *   rows:         Array,            // 0 (visible), 1 (handled by surface for unranked), 2 (last), 3 (3-row)
 *   gapToNext:    number | null,    // periodApi gap to the chase row (prev); null when no prev
 *   prevRank:     number | null,    // chase row's rank (for "X behind #N" copy); null when no prev
 *   missingCount: number,           // ranks skipped between visibleMax and cluster top — for "+N agents" divider
 *   totalCount:   number,           // total entries in ranking
 * }}
 *
 * Boundary semantics (per brief):
 *   • rank ≤ 3        → VISIBLE_PODIUM (surface adds YOU pill + teal ring on card)
 *   • 4 ≤ rank ≤ max  → VISIBLE_TAIL (surface highlights tail row in-place)
 *   • rank > max,
 *     prev AND next   → CLUSTER_3 (exactly 3 rows: prev · You · next)
 *   • rank > max,
 *     otherwise       → CLUSTER_2_LAST (fewer than 3 rows: prev · You when
 *                        viewer is last; You · next in the rare rank-1-below-set
 *                        case reachable only at visibleMax 0; or a 1-row solo).
 *                        State is rows.length-derived so CLUSTER_3 never lies.
 *   • viewer not in
 *     ranking         → CLUSTER_UNRANKED (surface renders 1 empty-state row)
 *
 * Ties: rank order is already stable upstream in the aggregate. This fn does
 * not re-sort or break ties; it consumes ranking as given.
 */
export function computeAroundMe({ ranking, viewerUid, visibleMax }) {
  const safe = Array.isArray(ranking) ? ranking : [];
  const totalCount = safe.length;

  // No ranking at all (empty branch / no aggregate)
  if (totalCount === 0) {
    return {
      state: 'CLUSTER_UNRANKED',
      viewerEntry: null,
      rows: [],
      gapToNext: null,
      prevRank: null,
      missingCount: 0,
      totalCount: 0,
    };
  }

  const viewerIdx = safe.findIndex((e) => e && e.agentId === viewerUid);

  // Unranked — viewer is not in the period's ranking at all.
  if (viewerIdx === -1) {
    return {
      state: 'CLUSTER_UNRANKED',
      viewerEntry: null,
      rows: [],
      gapToNext: null,
      prevRank: null,
      // The divider count uses the ranking length as the "below-visible" jump
      // for the unranked case: ranks 1..visibleMax are shown; everyone else is
      // "below", and the viewer is below them all.
      missingCount: Math.max(0, totalCount - visibleMax),
      totalCount,
    };
  }

  const viewer = safe[viewerIdx];

  // Visible — podium (1–3) or tail (4..visibleMax). Surface highlights in place.
  if (viewer.rank <= visibleMax) {
    return {
      state: viewer.rank <= 3 ? 'VISIBLE_PODIUM' : 'VISIBLE_TAIL',
      viewerEntry: viewer,
      rows: [],
      gapToNext: null,
      prevRank: null,
      missingCount: 0,
      totalCount,
    };
  }

  // Below set — assemble cluster.
  const prev = viewerIdx > 0 ? safe[viewerIdx - 1] : null;
  const next = viewerIdx < totalCount - 1 ? safe[viewerIdx + 1] : null;

  const rows = [];
  if (prev) rows.push(prev);
  rows.push(viewer);
  if (next) rows.push(next);

  // missingCount = ranks skipped between visibleMax (last visible row) and the
  // cluster's top row. If prev exists, top = prev.rank; otherwise top = viewer.
  // Math.max(0, ...) keeps the count honest when prev sits at visibleMax + 1
  // (no rank skipped) or when boundary math underflows (defensive).
  const clusterTopRank = prev ? prev.rank : viewer.rank;
  const missingCount = Math.max(0, clusterTopRank - visibleMax - 1);

  // Gap-to-next is the API gap to chase the prev row. Clamp to non-negative
  // because rank order should give prev.periodApi >= viewer.periodApi, but
  // bad data (ties with shuffled tiebreaks) shouldn't yield a negative gap.
  const gapToNext = prev
    ? Math.max(0, (prev.periodApi ?? 0) - (viewer.periodApi ?? 0))
    : null;

  return {
    // State is derived from the ACTUAL row count, not from `next` alone.
    // CLUSTER_3 ⟺ exactly 3 rows (prev · You · next). Everything else with a
    // viewer present is CLUSTER_2_LAST: prev · You (viewer is last), OR the rare
    // rank-1-below-set case You · next (only reachable at visibleMax 0), OR a
    // 1-row solo cluster. Presentation is driven by `rows` (the surface maps the
    // array; the cluster component never branches on the 2-vs-3 label), so this
    // label is a consumer-detection tag — and it must not claim 3 rows when 2 are
    // present. (Track J item 19: fixes the CLUSTER_3 misapplication for rank-1.)
    state: rows.length === 3 ? 'CLUSTER_3' : 'CLUSTER_2_LAST',
    viewerEntry: viewer,
    rows,
    gapToNext,
    prevRank: prev ? prev.rank : null,
    missingCount,
    totalCount,
  };
}

/**
 * Visible-set bottom rank per breakpoint.
 * Imported by the surface so the trigger boundary lives in one place.
 */
export const VISIBLE_MAX_DESKTOP = 8;
export const VISIBLE_MAX_MOBILE  = 7;
