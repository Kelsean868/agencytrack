// Master Sheet — FUNNEL filters. Pure, framework-free predicate + option model
// for the funnel sheet's filters panel (design scene 06:
// docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner).
// The component reads ONLY this module; tests import it directly.
//
// HONESTY NOTE — this is a READ-LIGHT, SINGLE-WEEK surface. It loads exactly one
// week of submissions + the tenant roster (no YTD, no companyMinimums, no
// persistency). So only predicates truthfully derivable from that data are built
// here. The mockup's STATUS chips (On track / Off pace / Gone quiet / Report
// late / Pers. ↓ / Below floor) and LEVEL chips (L1–L4) are DELIBERATELY OMITTED:
//   • STATUS is a YTD-performance taxonomy — it needs the pro-rata tenure floor
//     (companyMinimums.tenureApiFloors) + YTD API + persistency, none of which is
//     loaded on this surface. Building it would require a new heavy read path.
//     "Report late" collapses into WEEKLY REPORT + the shipped reality-bar
//     Exceptions count / Only-exceptions toggle.
//   • LEVEL has no backing field on the user doc (no level / levelTitle /
//     careerLevel is populated), so it can never be truthfully populated here.
// What IS honestly derivable per row on this surface:
//   • unit    — row.unitId (submission.unitId / user.unitId)
//   • report  — row.status ('submitted' | 'draft'); "Missing" (non-filer) is NOT
//               a row on this surface, so it is out of scope for a row filter.
//   • no-log  — !row.logged (the shipped "NO LOG" badge = daysWorked absent).

// Weekly-report options — ONLY the two states an existing table row can hold.
// (A non-filer has no row; "Missing" is surfaced by the reality bar, not here.)
export const FUNNEL_REPORT_OPTS = [
  ['submitted', 'Submitted'],
  ['draft', 'Draft'],
];

// Neutral default — no active condition.
export const DEFAULT_FUNNEL_FILTERS = { unit: 'all', reports: [], noLog: false };

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
    (filters.reports?.length || 0) +
    (filters.noLog ? 1 : 0)
  );
}

// Pure per-row predicate. A row matches when it clears EVERY active condition.
export function matchesFunnelFilters(row, filters = DEFAULT_FUNNEL_FILTERS) {
  if (filters.unit && filters.unit !== 'all' && row?.unitId !== filters.unit) return false;
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
