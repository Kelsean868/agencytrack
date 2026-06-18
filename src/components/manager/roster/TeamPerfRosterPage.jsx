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

  // useTeamRoster returns persistency and pctOfAnnualGoal already on the 0–100
  // scale the RosterRow UI contract expects (the ×100 lives in assembleRosterRow,
  // the single scale boundary). memberId is the hook's identifier; the UI table
  // uses row.id for React keys and data-testid attributes.
  const mappedRows = useMemo(
    () => rows.map((r) => ({ ...r, id: r.memberId })),
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
