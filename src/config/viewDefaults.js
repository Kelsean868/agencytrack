// ─────────────────────────────────────────────────────────────────────────────
// viewDefaults — canonical option lists for Settings v2 "View Defaults"
// (Fable Tier 2 · 2.4). Shared so the Settings control, the Master Sheet action
// bar, and the production-leaderboard surface agree on the same value set — a
// single source of truth prevents drift between where a default is SET and where
// it is READ.
// ─────────────────────────────────────────────────────────────────────────────

// Master Sheet "Default RANK BY" (Fable Run4 polish Item 2 / DECISIONS-NEEDED #4
// option b — repurposed from the old 5-column-preset picker). The funnel Master
// Sheet rebuild (`MasterSheet.jsx`) replaced column presets with a RANK BY
// segmented control offering exactly these two values ('api' | 'newNames' —
// MasterSheet's own internal RANK BY state); this Settings row now sets which
// one the sheet opens with, consulted ONLY at mount (session RANK BY changes
// inside the sheet stay local/ephemeral, never written back here).
//
// Storage key is UNCHANGED (`settings.masterSheetPreset`, still written via
// `setAppSetting(tenantId, uid, 'masterSheetPreset', value)`) — this is a
// same-key repurpose, not a migration. Any legacy 5-preset string (All /
// Production / Recruiting / Compliance / Persistency) or an absent value both
// fail closed to the API default via `isValidMasterSheetPreset`.
export const MASTER_SHEET_PRESETS = ['api', 'newNames'];
export const MASTER_SHEET_PRESET_LABELS = { api: 'API', newNames: 'New Names' };
export const DEFAULT_MASTER_SHEET_PRESET = 'api';
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
