import React, { useState, useMemo } from 'react';
import { MOCK_ROWS } from './mockRosterData';
import PeriodFilter from './PeriodFilter';
import { defaultPeriodForGrain } from './periodUtils';
import TeamPerfRoster from './TeamPerfRoster';

// ─── Local sort (mirrors teamRoster.js sortRows contract) ─────────────────────
// Once the data-layer PR merges, this can be replaced with:
//   import { sortRows } from '../../../lib/teamRoster';
// For v1 the UI branch is build-and-hold independent of the data layer.
function sortRows(rows, col, dir) {
  if (!col) return rows;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'string') return sign * av.localeCompare(bv);
    return sign * (av - bv);
  });
}

export default function TeamPerfRosterPage() {
  const [sort, setSort] = useState({ column: 'name', direction: 'asc' });
  const [period, setPeriod] = useState(() => defaultPeriodForGrain('year'));

  function handleSort(colKey) {
    setSort((prev) =>
      prev.column === colKey
        ? { column: colKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column: colKey, direction: 'desc' }
    );
  }

  const sortedRows = useMemo(
    () => sortRows(MOCK_ROWS, sort.column, sort.direction),
    [sort.column, sort.direction]
  );

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
        loading={false}
      />
    </div>
  );
}
