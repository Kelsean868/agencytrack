// Money Needs — expense composition derivation (item 2.11).
//
// Pure, Firebase-free helper for the mockup's `CompositionBar` (mn-merge.jsx):
// a 5-group segmented spine + "where the money goes" % chips. Derives from the
// worksheet's existing per-group `groupAnnualTotal` (the same field the budget
// total sums), so it can never diverge from the worksheet. No data-model change.

const num = (v) => parseFloat(v) || 0;

/**
 * compositionSegments — one segment per funded expense group, width = its share
 * of the total annual budget.
 *
 * @param {Record<string, { groupAnnualTotal?: number|string }>|null} expenseGroups
 * @param {Array<{ key:string, label:string, dot:string }>} groupMeta
 *   the panel's EXPENSE_GROUPS (key + label + decoration `dot` class), passed in
 *   so the bar reuses the exact per-group tone the checklist dots already use.
 * @returns {{ segments: Array<{key,label,dot,total,pct}>, total:number }}
 *   `segments` contains only groups with total > 0 (honest data — no zero
 *   segments); Σ segment.pct === 100 (within float epsilon) when total > 0.
 */
export function compositionSegments(expenseGroups, groupMeta = []) {
  const all = groupMeta.map(({ key, label, dot }) => ({
    key,
    label,
    dot,
    total: num(expenseGroups?.[key]?.groupAnnualTotal),
  }));
  const total = all.reduce((s, g) => s + g.total, 0);
  const segments = all
    .filter((g) => g.total > 0)
    .map((g) => ({ ...g, pct: total > 0 ? (g.total / total) * 100 : 0 }));
  return { segments, total };
}
