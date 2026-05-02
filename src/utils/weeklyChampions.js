import { extractFields } from './extractFields';

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
  const weekSubs = (submissions ?? []).filter(
    (s) => s.weekStarting === weekStarting && s.status === 'submitted'
  );

  if (weekSubs.length === 0) {
    return { topAPI: null, topApps: null, topActivity: null, weekStarting };
  }

  const agents = weekSubs.map((s) => {
    const f = extractFields(s);
    return {
      agentId:   s.agentId ?? s.userId ?? '',
      agentName: s.agentName ?? s.displayName ?? 'Agent',
      api:      parseFloat(f.apiSold)          || 0,
      apps:     parseFloat(f.applicationsSold) || 0,
      activity: (parseFloat(f.ffiConducted)     || 0)
              + (parseFloat(f.ciConducted)       || 0)
              + (parseFloat(f.applicationsSold)  || 0),
    };
  });

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
