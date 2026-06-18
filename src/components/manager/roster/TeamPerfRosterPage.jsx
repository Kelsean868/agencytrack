import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useTeamRoster } from '../../../hooks/useTeamRoster';
import { sortRows } from '../../../lib/teamRoster';
import PeriodFilter from './PeriodFilter';
import { defaultPeriodForGrain } from './periodUtils';
import TeamPerfRoster from './TeamPerfRoster';

export default function TeamPerfRosterPage() {
  const { tenantId } = useAuth();
  const [sort, setSort] = useState({ column: 'name', direction: 'asc' });
  const [period, setPeriod] = useState(() => defaultPeriodForGrain('year'));

  const { rows, loading, error } = useTeamRoster(tenantId, period);

  // useTeamRoster returns pctOfAnnualGoal as a 0–1 fraction (computePctOfGoal: ytdAPI / goal);
  // GoalHeatCell and MobileCard both expect 0–100. memberId is the hook's identifier;
  // the UI table uses row.id for React keys and data-testid attributes.
  const mappedRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        id: r.memberId,
        pctOfAnnualGoal: r.pctOfAnnualGoal !== null ? r.pctOfAnnualGoal * 100 : null,
      })),
    [rows]
  );

  function handleSort(colKey) {
    setSort((prev) =>
      prev.column === colKey
        ? { column: colKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column: colKey, direction: 'desc' }
    );
  }

  const sortedRows = useMemo(
    () => sortRows(mappedRows, sort.column, sort.direction),
    [mappedRows, sort.column, sort.direction]
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6" data-testid="team-perf-page">
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger-ink">
          Failed to load roster: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6" data-testid="team-perf-page">
      <div className="flex flex-col gap-1">
        <h2 className="font-display font-extrabold text-xl text-ink leading-tight">
          Team Performance Roster
        </h2>
        <p className="text-sm text-ink-muted">
          Sort any column · click header to toggle asc / desc
        </p>
      </div>
      <PeriodFilter period={period} onChangePeriod={setPeriod} />
      <TeamPerfRoster
        rows={sortedRows}
        sort={sort}
        onSort={handleSort}
        loading={loading}
      />
    </div>
  );
}
