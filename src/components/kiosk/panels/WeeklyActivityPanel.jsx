import React, { useMemo } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { kioskPeriodEntries, kioskActivityCounts } from '../../../lib/kiosk/kioskBoards';
import ActivityLeaderboard from './ActivityLeaderboard';

// Rows that fit the frame without a half-clipped last row (same depth as the
// ranked panel's podium + tail).
const MAX_ROWS = 8;

const PROSPECTING_BREAKDOWN = [
  { label: 'names', field: 'names' },
  { label: 'calls', field: 'calls' },
];

const CONVERSIONS_BREAKDOWN = [
  { label: 'FFIs', field: 'ffi' },
  { label: 'CIs', field: 'ci' },
];

// One column: agents with a positive total, total desc then name asc (stable
// ties), capped at MAX_ROWS, then ranked 1..n.
function buildActivityAgents(entries, allUsers, totalField, breakdownDefs) {
  const rows = [];
  for (const e of entries) {
    const counts = kioskActivityCounts(e);
    // An entry without `activity` (written before the L-1b deploy) contributes nothing.
    if (!counts || !e.agentId) continue;
    const total = counts[totalField];
    if (!(total > 0)) continue;
    const user = allUsers.find((u) => u.id === e.agentId) ?? {};
    rows.push({
      agentId: e.agentId,
      agentName: e.name || user.name || user.displayName || 'Agent',
      photoURL: user.photoURL ?? null,
      total,
      breakdown: breakdownDefs.map((b) => ({ label: b.label, value: counts[b.field] })),
    });
  }
  return rows
    .sort((a, b) => b.total - a.total || String(a.agentName).localeCompare(String(b.agentName)))
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * WeeklyActivityPanel — this week's two-column Activity slide (canonical design:
 * `RefWeeklyActivity`, docs/design-system/screens-v2/kiosk-refined-b.jsx).
 *
 * Reads the `week` entries of the branch's leaderboard aggregate
 * (`leaderboards/{branchId}`), each carrying `activity: { names, calls, ffi, ci }`
 * (FR Leaderboard amendment A1, D4). Two columns:
 *   Prospecting — names + calls   |   Conversions — FFIs + CIs
 * Each column drops agents with a zero total, sorts by total desc then name asc,
 * and shows at most MAX_ROWS. A missing aggregate, or entries without `activity`
 * (written before the L-1b deploy), show the empty state — never fake zeros.
 *
 * Props:
 *   leaderboardAggregate — the aggregate doc data, or null when it does not exist
 *   allUsers             — optional roster, used only for avatar photos
 */
export default function WeeklyActivityPanel({ leaderboardAggregate = null, allUsers = [] }) {
  const { prospecting, conversions } = useMemo(() => {
    const entries = kioskPeriodEntries(leaderboardAggregate, 'week');
    return {
      prospecting: buildActivityAgents(entries, allUsers, 'prospecting', PROSPECTING_BREAKDOWN),
      conversions: buildActivityAgents(entries, allUsers, 'conversions', CONVERSIONS_BREAKDOWN),
    };
  }, [leaderboardAggregate, allUsers]);

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
