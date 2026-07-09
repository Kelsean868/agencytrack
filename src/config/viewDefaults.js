// ─────────────────────────────────────────────────────────────────────────────
// viewDefaults — canonical option lists for Settings v2 "View Defaults"
// (Fable Tier 2 · 2.4). Shared so the Settings control, the Master Sheet action
// bar, and the production-leaderboard surface agree on the same value set — a
// single source of truth prevents drift between where a default is SET and where
// it is READ.
// ─────────────────────────────────────────────────────────────────────────────

// Master Sheet column presets — value === label (matches MasterSheet.PRESET_ORDER).
// The column-set mapping itself stays in MasterSheet (PRESETS); this is only the
// order + validity list the Settings control offers.
export const MASTER_SHEET_PRESETS = ['All', 'Production', 'Recruiting', 'Compliance', 'Persistency'];
export const DEFAULT_MASTER_SHEET_PRESET = 'All';
export function isValidMasterSheetPreset(v) {
  return MASTER_SHEET_PRESETS.includes(v);
}

// Default time period — the STORED value is the lowercase semantic id; each
// surface maps it to its own period key (the leaderboard maps to WK/MTD/QTD/YTD).
export const PERIOD_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];
export const PERIOD_VALUES = PERIOD_OPTIONS.map((o) => o.value);
// The leaderboard's built-in default is YTD → 'year'. Absent a stored override the
// Settings control reflects this so the displayed value matches the real surface.
export const DEFAULT_PERIOD = 'year';
export function isValidPeriod(v) {
  return PERIOD_VALUES.includes(v);
}
