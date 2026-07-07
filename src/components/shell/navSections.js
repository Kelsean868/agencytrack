// ─────────────────────────────────────────────────────────────────────────────
// navSections — section-grouping helpers for the mobile "More" sheet (More sheet v2).
//
// The desktop sidebar's grouping (Sidebar.groupBySection) assumes only each
// section's LEAD item carries a `sectionLabel`; subsequent items inherit it by
// position. The More sheet renders a FILTERED subset of the role nav (bottom-nav
// destinations are removed), so a section's lead can be filtered out — which would
// orphan the rest of that section into the previous group.
//
// buildSectionMap resolves each item's section by filling the last-seen label
// forward across the FULL role nav; the drawer annotates its (filtered) items with
// that resolved label, then groupBySectionLabel groups by consecutive equal label.
// This keeps the More sheet's grouping faithful to the sidebar's even when leads
// are filtered out (redesign-addendum §3: "mirror the desktop sidebar's grouping").
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map each item id → its resolved section label (own label, else the nearest
 * preceding lead's label). Built from the FULL ordered role nav.
 *
 * @param {Array<{id?: string, sectionLabel?: string}>} items
 * @returns {Map<string, string|null>}
 */
export function buildSectionMap(items = []) {
  const map = new Map();
  let current = null;
  for (const item of items) {
    if (item?.sectionLabel) current = item.sectionLabel;
    if (item?.id != null) map.set(item.id, item.sectionLabel ?? current);
  }
  return map;
}

/**
 * Group consecutive items that share the same `sectionLabel` into
 * `{ label, items }` groups. Items are expected to already carry a resolved
 * label (via buildSectionMap); a null/absent label yields an unlabelled group
 * (rendered without a header).
 *
 * @param {Array<{sectionLabel?: string|null}>} items
 * @returns {Array<{label: string|null, items: Array}>}
 */
export function groupBySectionLabel(items = []) {
  const groups = [];
  for (const item of items) {
    const label = item?.sectionLabel ?? null;
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [item] });
    else last.items.push(item);
  }
  return groups;
}
