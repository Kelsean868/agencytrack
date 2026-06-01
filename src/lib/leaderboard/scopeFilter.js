/**
 * scopeFilter — derive the displayed ranking for the leaderboard's scope toggle.
 *
 * Pure function. No React, no Firebase. Unit-tested as the primary
 * verification — the role-gated UI control + persistence are wired around
 * this resolver, and a wrong filter / re-rank / rescale here propagates
 * silently to every leaderboard surface (podium, tail, around-me).
 *
 * Inputs:
 *   - ranking: the branch-wide aggregate ranking (each entry carries
 *              { agentId, unitId, unitName, rank, rankWithinUnit, periodApi,
 *                apps, previousRank, ... } per the P5-prep CF).
 *   - scope:   'branch' | 'unit'
 *   - targetUnitId: when scope === 'unit', the unitId to filter on.
 *                   For a UM's My Unit this is the UM's OWN UID
 *                   (per P5-prep: agents under a UM carry unitId == UM uid).
 *                   For a BM's picker this is the picked unitId.
 *                   Ignored when scope === 'branch'.
 *
 * Output (consumers — podium/tail/around-me — read these unchanged):
 *   {
 *     displayedRanking: Array — when scope=='unit', filtered to that unitId
 *                              with `rank` REMAPPED to `rankWithinUnit` so
 *                              the podium shows unit-1/2/3 medals + the
 *                              tail's "rank N" reads as in-unit rank.
 *                              When scope=='branch', the input as-is.
 *     scopedLeaderApi: number — max periodApi WITHIN the scope (drives the
 *                              tail's %-of-leader bar). For My Branch this
 *                              equals the branch leader's API; for My Unit
 *                              the unit's leader, so the SAME agent's bar
 *                              is longer in My Unit (per Claude Design).
 *     count: number — number of agents in the scope (drives subtitle).
 *   }
 *
 * Edge cases the tests exhaustively pin:
 *   - scope='branch'                → entire ranking passthrough, branch leaderApi
 *   - scope='unit' empty match      → empty array, scopedLeaderApi=0, count=0
 *   - scope='unit' missing rankWithinUnit on entries (defensive — should not
 *     happen post-P5-prep but doc drift might) → 1-indexed fallback by order
 *   - scope='unit' targetUnitId null/empty → empty filter (no entries match)
 *   - input ranking null/undefined  → empty arrays + 0 leaderApi
 */

const EMPTY = Object.freeze({
  displayedRanking: [],
  scopedLeaderApi: 0,
  count: 0,
});

export function applyScope({ ranking, scope, targetUnitId }) {
  const safe = Array.isArray(ranking) ? ranking : [];

  if (scope === 'branch') {
    return {
      displayedRanking: safe,
      scopedLeaderApi: safe[0]?.periodApi ?? 0,
      count: safe.length,
    };
  }

  if (scope !== 'unit') {
    // Defensive: unknown scope value → treat as 'branch' (no surprise empties).
    return {
      displayedRanking: safe,
      scopedLeaderApi: safe[0]?.periodApi ?? 0,
      count: safe.length,
    };
  }

  // scope === 'unit'
  if (!targetUnitId) return EMPTY;

  const filtered = safe.filter((e) => e && e.unitId === targetUnitId);
  if (filtered.length === 0) return EMPTY;

  // Re-map `rank` → `rankWithinUnit` so podium/tail consumers (which read
  // entry.rank) get the in-unit rank without branching on scope. Fall back
  // to 1-indexed position by order if rankWithinUnit is missing (defensive
  // — the source ranking is sorted desc by API, so position-by-order is
  // semantically equivalent to rankWithinUnit within the unit).
  const displayedRanking = filtered.map((e, i) => ({
    ...e,
    rank: e.rankWithinUnit ?? i + 1,
  }));

  // scopedLeaderApi = max API within the filtered set. The first entry has
  // the highest API (ranking is sorted desc), so this is just entry[0].
  const scopedLeaderApi = displayedRanking[0].periodApi ?? 0;

  return {
    displayedRanking,
    scopedLeaderApi,
    count: displayedRanking.length,
  };
}

/**
 * unitOptionsFromRanking — extract the distinct (unitId, unitName) pairs
 * from a branch ranking, suitable for the BM unit-picker. Excludes entries
 * with null/undefined unitId. Sorts by unitName for stable display.
 *
 * No extra Firestore fetch — derives from the loaded branch entries.
 */
export function unitOptionsFromRanking(ranking) {
  const safe = Array.isArray(ranking) ? ranking : [];
  const seen = new Map();
  for (const e of safe) {
    if (!e || !e.unitId) continue;
    if (!seen.has(e.unitId)) {
      seen.set(e.unitId, e.unitName || 'Unnamed unit');
    }
  }
  return [...seen.entries()]
    .map(([unitId, unitName]) => ({ unitId, unitName }))
    .sort((a, b) => a.unitName.localeCompare(b.unitName));
}
