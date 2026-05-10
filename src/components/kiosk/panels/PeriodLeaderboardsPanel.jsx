import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
  rankAgentsByApps,
} from '../../../lib/productionReport/computations';
import TVRankedLeaderboard from './TVRankedLeaderboard';

/**
 * PeriodLeaderboardsPanel — side-by-side API | Apps leaderboards for a given period.
 *
 * Props:
 *   period      — 'ytd' | 'quarter' | 'mtd' | 'week'
 *   periodLabel — display string, e.g. 'YTD'
 *   allSubmissions
 *   allUsers
 */
export default function PeriodLeaderboardsPanel({
  period,
  periodLabel,
  allSubmissions,
  allUsers,
}) {
  const { byApi, byApps } = useMemo(() => {
    const filtered = filterSubmissionsByPeriod(allSubmissions, period);

    const agentMap = {};
    for (const sub of filtered) {
      const aid = sub.agentId ?? sub.userId ?? '';
      if (!aid) continue;
      if (!agentMap[aid]) agentMap[aid] = [];
      agentMap[aid].push(sub);
    }

    const agentTotalsArray = Object.entries(agentMap).map(([agentId, subs]) => {
      const user = allUsers.find((u) => u.id === agentId) ?? {};
      return {
        agentId,
        agentName: user.name || user.displayName || 'Agent',
        photoURL: user.photoURL ?? null,
        unitId: user.unitId ?? '',
        totals: computeAgentTotals(subs),
      };
    });

    return {
      byApi: rankAgentsByApi(agentTotalsArray),
      byApps: rankAgentsByApps(agentTotalsArray),
    };
  }, [allSubmissions, allUsers, period]);

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-8 tracking-tight">
        {periodLabel} Leaderboards
      </h1>
      <div className="flex-1 grid grid-cols-2 gap-12 min-h-0">
        <TVRankedLeaderboard
          title="API"
          agents={byApi}
          isCurrency={true}
          valueKey="totalApi"
        />
        <TVRankedLeaderboard
          title="Apps"
          agents={byApps}
          isCurrency={false}
          valueKey="totalApps"
        />
      </div>
    </div>
  );
}
