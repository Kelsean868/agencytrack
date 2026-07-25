// Master Sheet — FUNNEL filters. Pure, framework-free predicate + option model
// for the funnel sheet's filters panel (design scene 06:
// docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner).
// The component reads ONLY this module; tests import it directly.
//
// HONESTY NOTE — only predicates truthfully derivable from the sheet's loaded
// data are built here.
//   • STATUS is a YTD-performance taxonomy needing the pro-rata tenure floor
//     (companyMinimums.tenureApiFloors) + YTD API + persistency. Those three
//     reads now land on this surface, so the six bands (On track / Off pace /
//     Gone quiet / Report late / Pers. ↓ / Below floor) ARE built — see
//     `utils/funnelStatus.js` for the derivation and its design authority. The
//     predicate here consumes a pre-derived `row.statusBand` only; it never
//     derives. When the YTD/floor reads fail, the component leaves `statusBand`
//     undefined and hides the chips rather than showing an unbacked "On track".
//   • LEVEL remains DELIBERATELY OMITTED — it has no backing field on the user
//     doc (no level / levelTitle / careerLevel is populated), so it can never be
//     truthfully populated here.
// What IS honestly derivable per row on this surface:
//   • unit    — row.unitId (submission.unitId / user.unitId)
//   • status  — row.statusBand (from funnelStatus.buildStatusMap)
//   • report  — row.status ('submitted' | 'draft'); "Missing" (non-filer) is NOT
//               a row on this surface, so it is out of scope for a row filter.
//   • no-log  — !row.logged (the shipped "NO LOG" badge = daysWorked absent).

import { FUNNEL_STATUS_OPTS } from './funnelStatus';

// Re-export so the component keeps a single filters-module import surface.
export { FUNNEL_STATUS_OPTS };

// Weekly-report options — ONLY the two states an existing table row can hold.
// (A non-filer has no row; "Missing" is surfaced by the reality bar, not here.)
export const FUNNEL_REPORT_OPTS = [
  ['submitted', 'Submitted'],
  ['draft', 'Draft'],
];

// Neutral default — no active condition.
export const DEFAULT_FUNNEL_FILTERS = { unit: 'all', statuses: [], reports: [], noLog: false };

// Human label for a unit id. Staging user docs carry no unit NAME, so we fall
// back to a stable synthetic label; the branch-direct sentinel gets a friendly
// name. A real unitName (when present on the row) always wins.
export function unitLabel(id, name = null) {
  if (name) return name;
  if (id === '__branch_direct__') return 'Branch direct';
  return `Unit ${String(id).slice(-4)}`;
}

// Distinct units present in a row set, as { id, label }, label-sorted. 'all' is
// the implicit option and is NOT included here.
export function deriveUnitOptions(rows = []) {
  const seen = new Map();
  for (const r of rows) {
    const id = r?.unitId;
    if (!id || seen.has(id)) continue;
    seen.set(id, unitLabel(id, r.unitName));
  }
  return [...seen.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Count of active conditions (drives the FILTERS badge). Each selected report
// chip counts, matching the mockup's additive count.
export function funnelFiltersCount(filters = DEFAULT_FUNNEL_FILTERS) {
  return (
    (filters.unit && filters.unit !== 'all' ? 1 : 0) +
    (filters.statuses?.length || 0) +
    (filters.reports?.length || 0) +
    (filters.noLog ? 1 : 0)
  );
}

// Pure per-row predicate. A row matches when it clears EVERY active condition.
//
// STATUS is strict: a row whose `statusBand` is missing (derivation unavailable
// — the YTD/floor read failed, or the row's agent is absent from the roster)
// NEVER satisfies an active STATUS condition. Filtering an unknown row in would
// assert a band the data cannot back.
export function matchesFunnelFilters(row, filters = DEFAULT_FUNNEL_FILTERS) {
  if (filters.unit && filters.unit !== 'all' && row?.unitId !== filters.unit) return false;
  if (filters.statuses?.length && !filters.statuses.includes(row?.statusBand)) return false;
  if (filters.reports?.length && !filters.reports.includes(row?.status)) return false;
  if (filters.noLog && row?.logged !== false) return false;
  return true;
}

// Apply the active filters to a row set (pure — returns a new array).
export function applyFunnelFilters(rows = [], filters = DEFAULT_FUNNEL_FILTERS) {
  return rows.filter((r) => matchesFunnelFilters(r, filters));
}

// Descriptors for the dismissible active-condition chips. Each carries the
// partial-filters `patch` the consumer merges to clear that one condition.
export function buildFilterChips(filters = DEFAULT_FUNNEL_FILTERS, unitOptions = []) {
  const chips = [];
  if (filters.unit && filters.unit !== 'all') {
    const opt = unitOptions.find((o) => o.id === filters.unit);
    chips.push({ key: 'unit', text: `UNIT · ${(opt?.label ?? filters.unit).toUpperCase()}`, patch: { unit: 'all' } });
  }
  if (filters.statuses?.length) {
    const labels = filters.statuses
      .map((k) => (FUNNEL_STATUS_OPTS.find(([x]) => x === k)?.[1] ?? k).toUpperCase())
      .join(' / ');
    chips.push({ key: 'status', text: `STATUS · ${labels}`, patch: { statuses: [] } });
  }
  if (filters.reports?.length) {
    const labels = filters.reports
      .map((k) => (FUNNEL_REPORT_OPTS.find(([x]) => x === k)?.[1] ?? k).toUpperCase())
      .join(' / ');
    chips.push({ key: 'report', text: `REPORT · ${labels}`, patch: { reports: [] } });
  }
  if (filters.noLog) {
    chips.push({ key: 'nolog', text: 'NO DAILY LOG', patch: { noLog: false } });
  }
  return chips;
}
