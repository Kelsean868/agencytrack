import { extractFields, extractTotalProductionCredit } from './extractFields';

// Shared derivation — one submitted-status-filtered, per-agent metric row per
// week. Both computeWeeklyChampions (single-winner-per-category) and
// rankWeeklyChampions (ranked list) build on this SAME row shape so the two
// consumers never drift on what "this agent's week" means.
function deriveWeekAgents(submissions, weekStarting) {
  const weekSubs = (submissions ?? []).filter(
    (s) => s.weekStarting === weekStarting && s.status === 'submitted'
  );

  return weekSubs.map((s) => {
    const f = extractFields(s);
    return {
      agentId:   s.agentId ?? s.userId ?? '',
      agentName: s.agentName ?? s.displayName ?? 'Agent',
      api:      extractTotalProductionCredit(s),
      apps:     parseFloat(f.applicationsSold) || 0,
      activity: (parseFloat(f.ffiConducted)     || 0)
              + (parseFloat(f.ciConducted)       || 0)
              + (parseFloat(f.applicationsSold)  || 0),
    };
  });
}

/**
 * computeWeeklyChampions(submissions, weekStarting)
 *
 * submissions:   array of raw submission docs
 * weekStarting:  'YYYY-MM-DD' string — the Sunday to compute champions for
 *
 * Returns:
 * {
 *   topAPI:      { agentId, agentName, value } | null,
 *   topApps:     { agentId, agentName, value } | null,
 *   topActivity: { agentId, agentName, value } | null,
 *   weekStarting: string
 * }
 *
 * topActivity = ffiConducted + ciConducted + applicationsSold
 * Ties broken by agentName alphabetically.
 * Returns null for a category when no agent posted a value > 0 that week.
 */
export function computeWeeklyChampions(submissions, weekStarting) {
  const agents = deriveWeekAgents(submissions, weekStarting);

  if (agents.length === 0) {
    return { topAPI: null, topApps: null, topActivity: null, weekStarting };
  }

  const pickBest = (key) => {
    const sorted = [...agents].sort((a, b) =>
      b[key] !== a[key] ? b[key] - a[key] : a.agentName.localeCompare(b.agentName)
    );
    const winner = sorted[0];
    if (!winner || winner[key] <= 0) return null;
    return { agentId: winner.agentId, agentName: winner.agentName, value: winner[key] };
  };

  return {
    topAPI:      pickBest('api'),
    topApps:     pickBest('apps'),
    topActivity: pickBest('activity'),
    weekStarting,
  };
}

/**
 * rankWeeklyChampions(submissions, weekStarting, { topN })
 *
 * Ranked (not winner-take-all) view over the SAME per-agent derivation used by
 * computeWeeklyChampions — reused, not reinvented. Ranks by weekly API desc
 * (ties by agentName), matching the app's established production-ranking
 * convention (ProductionLeaderboardSurface). Agents with api <= 0 are dropped
 * (an honest "no champions yet" rather than a podium of zeros).
 *
 * submissions:  array of raw submission docs (already role/branch/unit-scoped
 *               by the caller — this function does no additional scoping)
 * weekStarting: 'YYYY-MM-DD' string — the Sunday to rank
 * topN:         max rows returned (default 3, matches the design mock)
 *
 * Returns: Array<{ rank, agentId, agentName, api, apps }> — empty when no
 * agent posted api > 0 that week.
 */
export function rankWeeklyChampions(submissions, weekStarting, { topN = 3 } = {}) {
  const agents = deriveWeekAgents(submissions, weekStarting);

  const ranked = agents
    .filter((a) => a.api > 0)
    .sort((a, b) => (b.api !== a.api ? b.api - a.api : a.agentName.localeCompare(b.agentName)))
    .slice(0, topN)
    .map((a, i) => ({
      rank: i + 1,
      agentId: a.agentId,
      agentName: a.agentName,
      api: a.api,
      apps: a.apps,
    }));

  return ranked;
}
