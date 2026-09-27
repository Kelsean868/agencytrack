// Tenure-based Company Floor — Tatil head-of-sales slide (2026-05-19),
// confirmed by head-of-sales 2026-05-21. Numbers seeded into
// config/companyMinimums via scripts/seed/seed-tenure-api-floors.mjs
// and editable at that path.
//
// Boundaries (per kickoff brief):
//   m < 12          → 150,000
//   12 ≤ m ≤ 24     → 200,000
//   25 ≤ m ≤ 36     → 250,000
//   37 ≤ m ≤ 48     → 300,000
//   49 ≤ m ≤ 60     → 400,000
//   m > 60          → 500,000
//
// Fallback (missing/invalid contractStartDate): flat 200,000 — preserves
// the pre-tenure contract for agents whose user doc predates the rollout.
export const DEFAULT_TENURE_API_FLOORS = Object.freeze({
  // band threshold (inclusive lower) → annual floor (TTD)
  band0_lt12:    150000,  // 0–11
  band12_to_24:  200000,  // 12–24
  band25_to_36:  250000,  // 25–36
  band37_to_48:  300000,  // 37–48
  band49_to_60:  400000,  // 49–60
  band_gt60:     500000,  // > 60
});

export const FLAT_ANNUAL_API_FALLBACK = 200000;
export const FLAT_WEEKLY_API_FALLBACK = 4800;

// Whole months between two ISO YYYY-MM-DD dates. A month is "whole" only
// when the day-of-month of `now` has reached the day-of-month of `start`.
// Returns null when start is missing/invalid; clamps negative diffs to 0.
export function monthsOfService(contractStartDate, now = new Date()) {
  if (typeof contractStartDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(contractStartDate)) {
    return null;
  }
  const [sy, sm, sd] = contractStartDate.split('-').map((p) => parseInt(p, 10));
  if (!Number.isFinite(sy) || !Number.isFinite(sm) || !Number.isFinite(sd)) return null;
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  if (Number.isNaN(start.getTime())) return null;

  const ny = now.getUTCFullYear();
  const nm = now.getUTCMonth() + 1;
  const nd = now.getUTCDate();

  let months = (ny - sy) * 12 + (nm - sm);
  if (nd < sd) months -= 1;
  return months < 0 ? 0 : months;
}

// Pure: resolves an annual API floor from months-of-service against the
// tenure band table. Returns the fallback when contractStartDate is missing
// or invalid. The tenureApiFloors param is treated as a value table with
// the 6 keys above; any missing key falls through to the brief's defaults.
export function resolveAnnualAPIFloor({
  contractStartDate,
  tenureApiFloors,
  fallback = FLAT_ANNUAL_API_FALLBACK,
  now = new Date(),
} = {}) {
  const months = monthsOfService(contractStartDate, now);
  if (months === null) return fallback;
  const t = { ...DEFAULT_TENURE_API_FLOORS, ...(tenureApiFloors ?? {}) };
  if (months < 12)      return t.band0_lt12;
  if (months <= 24)     return t.band12_to_24;
  if (months <= 36)     return t.band25_to_36;
  if (months <= 48)     return t.band37_to_48;
  if (months <= 60)     return t.band49_to_60;
  return t.band_gt60;
}

// Weekly API floor = annual ÷ 10 (months in selling year) ÷ 4 (weeks per
// month). Returns flat 4800 fallback when contractStartDate is unknown.
export function resolveWeeklyAPIFloor({
  contractStartDate,
  tenureApiFloors,
  fallback = FLAT_WEEKLY_API_FALLBACK,
  now = new Date(),
} = {}) {
  if (monthsOfService(contractStartDate, now) === null) return fallback;
  const annual = resolveAnnualAPIFloor({ contractStartDate, tenureApiFloors, now });
  return annual / 10 / 4;
}

// Short, human tenure-band label for the annual Company Floor's real basis —
// so an agent-facing "Company minimum" figure never reads as a flat,
// unexplained number (PR #984). Mirrors the bands resolveAnnualAPIFloor uses;
// returns null when contractStartDate is missing/invalid (the caller then
// falls back to an unqualified "Company Floor" label — the flat fallback
// value doesn't correspond to any single band).
export function tenureBandLabel(contractStartDate, now = new Date()) {
  const months = monthsOfService(contractStartDate, now);
  if (months === null) return null;
  if (months < 12)  return '< 1 yr';
  if (months <= 24) return '1–2 yrs';
  if (months <= 36) return '2–3 yrs';
  if (months <= 48) return '3–4 yrs';
  if (months <= 60) return '4–5 yrs';
  return '5+ yrs';
}
