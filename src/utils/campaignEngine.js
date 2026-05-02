import { extractFields } from './extractFields';

const METRIC_LABELS = {
  apiSold:          'API',
  applicationsSold: 'Apps',
  ffiConducted:     'FFIs',
  ciConducted:      'CIs',
};

function getMetricValue(fields, metric) {
  return parseFloat(fields[metric]) || 0;
}

function getParticipantIds(campaign, submissions) {
  const { type, unitIds = [], agentIds = [] } = campaign.scope ?? {};
  if (type === 'branch') {
    return [...new Set(submissions.map((s) => s.agentId ?? s.userId ?? '').filter(Boolean))];
  }
  if (type === 'unit') {
    return [...new Set(
      submissions
        .filter((s) => unitIds.includes(s.unitId))
        .map((s) => s.agentId ?? s.userId ?? '')
        .filter(Boolean)
    )];
  }
  if (type === 'agent') {
    return agentIds.filter(Boolean);
  }
  return [];
}

export function computeCampaignProgress(campaign, submissions, agentId) {
  const targets = campaign.targets ?? [];
  const primaryMetric = targets[0]?.metric ?? null;

  // Build per-agent totals for ranking
  const participantIds = getParticipantIds(campaign, submissions);

  const totalsByAgent = {};
  for (const s of submissions) {
    const aid = s.agentId ?? s.userId ?? '';
    if (!aid) continue;
    if (!participantIds.includes(aid)) continue;
    if (!totalsByAgent[aid]) totalsByAgent[aid] = { agentName: s.agentName ?? s.displayName ?? 'Agent', totals: {} };
    const f = extractFields(s);
    for (const { metric } of targets) {
      totalsByAgent[aid].totals[metric] = (totalsByAgent[aid].totals[metric] ?? 0) + getMetricValue(f, metric);
    }
  }

  const totalParticipants = participantIds.length;

  // Rank by primary metric
  let rank = null;
  if (primaryMetric && participantIds.length > 0) {
    const sorted = Object.entries(totalsByAgent)
      .map(([aid, { agentName, totals }]) => ({ aid, agentName, primary: totals[primaryMetric] ?? 0 }))
      .sort((a, b) => b.primary !== a.primary ? b.primary - a.primary : a.agentName.localeCompare(b.agentName));

    const idx = sorted.findIndex((e) => e.aid === agentId);
    rank = idx >= 0 ? idx + 1 : null;
  }

  // Metrics for this agent
  const agentTotals = totalsByAgent[agentId]?.totals ?? {};
  const metrics = targets.map(({ metric, threshold }) => {
    const current = agentTotals[metric] ?? 0;
    const pct = threshold > 0 ? Math.min(100, Math.round((current / threshold) * 100)) : 0;
    return {
      metric,
      label: METRIC_LABELS[metric] ?? metric,
      threshold,
      current,
      pct,
      achieved: pct >= 100,
    };
  });

  const allAchieved = metrics.length > 0 && metrics.every((m) => m.achieved);

  return { metrics, allAchieved, rank, totalParticipants };
}

export function getDaysRemaining(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate + 'T12:00:00Z');
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
