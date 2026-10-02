import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { kioskBoardRows } from '../../../lib/kiosk/kioskBoards';
import ActivityLeaderboard from './ActivityLeaderboard';

// Rows that fit the frame without a half-clipped last row (same depth as the
// ranked panel's podium + tail).
const MAX_ROWS = 8;

/**
 * WeeklyActivityPanel — this week's Activity board (FR Leaderboard L-3, D5/D13).
 *
 * Reads the branch's leaderboard aggregate (`leaderboards/{branchId}`) and ranks
 * the week by `points` through the shared ranker (ties: API, apps, points order
 * after the board metric, then name). One "Points" column, with the agent's
 * ledger apps beneath each total. A missing aggregate, or one with no points
 * yet, shows the empty state — never fake data.
 *
 * Props:
 *   leaderboardAggregate — the aggregate doc data, or null when it does not exist
 *   allUsers             — optional roster, used only for avatar photos
 */
export default function WeeklyActivityPanel({ leaderboardAggregate = null, allUsers = [] }) {
  const agents = useMemo(
    () => kioskBoardRows(leaderboardAggregate, 'week', 'activity')
      .slice(0, MAX_ROWS)
      .map((e) => {
        const user = allUsers.find((u) => u.id === e.agentId) ?? {};
        const apps = Number(e.apps) || 0;
        return {
          agentId: e.agentId,
          agentName: e.name || user.name || user.displayName || 'Agent',
          photoURL: user.photoURL ?? null,
          rank: e.rank,
          total: Math.round(Number(e.points) || 0).toLocaleString('en-TT'),
          breakdown: [{ label: apps === 1 ? 'app' : 'apps', value: apps }],
        };
      }),
    [leaderboardAggregate, allUsers],
  );

  return (
    <div className="w-full h-full flex flex-col p-10">
      <h1 className="text-5xl font-display font-bold text-ink mb-8 tracking-tight">
        Weekly Activity
      </h1>
      <div className="flex-1 w-full max-w-4xl mx-auto min-h-0">
        <ActivityLeaderboard
          title="Points"
          icon={<Activity size={28} />}
          subtitle="(Calls, meetings, fact finds and sales)"
          agents={agents}
          emptyMessage="No activity recorded this week"
        />
      </div>
    </div>
  );
}
