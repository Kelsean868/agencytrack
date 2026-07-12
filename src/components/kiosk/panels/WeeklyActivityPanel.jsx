import React, { useMemo } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { filterSubmissionsByPeriod } from '../../../lib/productionReport/computations';
import { extractFields } from '../../../utils/extractFields';
import { buildSubmissionNameMap } from '../../../lib/kiosk/utils';
import ActivityLeaderboard from './ActivityLeaderboard';

function buildActivityAgents(weekSubs, allUsers, computeTotal, breakdownDefs) {
  const nameByAgent = buildSubmissionNameMap(weekSubs);
  const agentMap = {};
  for (const sub of weekSubs) {
    const aid = sub.agentId ?? sub.userId ?? '';
    if (!aid) continue;
    if (!agentMap[aid]) agentMap[aid] = { subs: [] };
    agentMap[aid].subs.push(sub);
  }

  const rows = Object.entries(agentMap).map(([agentId, { subs }]) => {
    const user = allUsers.find((u) => u.id === agentId) ?? {};
    const fields = subs.reduce(
      (acc, sub) => {
        const f = extractFields(sub);
        for (const key of Object.keys(acc)) {
          acc[key] += f[key] ?? 0;
        }
        return acc;
      },
      Object.fromEntries(breakdownDefs.map((b) => [b.field, 0]))
    );

    const total = computeTotal(fields);
    const breakdown = breakdownDefs.map((b) => ({ label: b.label, value: fields[b.field] }));

    return {
      agentId,
      agentName: user.name || user.displayName || nameByAgent.get(agentId) || 'Agent',
      photoURL: user.photoURL ?? null,
      total,
      breakdown,
    };
  });

  return rows
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

const PROSPECTING_BREAKDOWN = [
  { label: 'names', field: 'totalNewNames' },
  { label: 'calls', field: 'totalTelAttempts' },
];

const CONVERSIONS_BREAKDOWN = [
  { label: 'FFIs', field: 'ffiConducted' },
  { label: 'CIs', field: 'ciConducted' },
];

export default function WeeklyActivityPanel({ allSubmissions, allUsers }) {
  const { prospecting, conversions } = useMemo(() => {
    const weekSubs = filterSubmissionsByPeriod(allSubmissions, 'week');

    const prosp = buildActivityAgents(
      weekSubs,
      allUsers,
      (f) => (f.totalNewNames ?? 0) + (f.totalTelAttempts ?? 0),
      PROSPECTING_BREAKDOWN
    );

    const conv = buildActivityAgents(
      weekSubs,
      allUsers,
      (f) => (f.ffiConducted ?? 0) + (f.ciConducted ?? 0),
      CONVERSIONS_BREAKDOWN
    );

    return { prospecting: prosp, conversions: conv };
  }, [allSubmissions, allUsers]);

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-8 tracking-tight">
        Weekly Activity
      </h1>
      <div className="flex-1 grid grid-cols-2 gap-12 min-h-0">
        <ActivityLeaderboard
          title="Prospecting"
          icon={<Activity size={28} />}
          subtitle="(Names + Calls)"
          agents={prospecting}
          emptyMessage="No prospecting recorded this week"
        />
        <ActivityLeaderboard
          title="Conversions"
          icon={<TrendingUp size={28} />}
          subtitle="(FFIs + CIs)"
          agents={conversions}
          emptyMessage="No conversions recorded this week"
        />
      </div>
    </div>
  );
}
