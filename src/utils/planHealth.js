// PR-B2 — plan-health checks (pure functions, no I/O).
//
// Exactly THREE checks per the Fork B2 locked design (recon @ 1e8e0d3e):
//   1. aboveFloor      — plan API (Σ yearPlan.lines.*.targetAPI) vs the agent's
//                        tenure-resolved annual Company Floor (tenureFloors.js).
//   2. lineMix         — per-line targetAPI/pct/enabled distribution from
//                        yearPlan.lines.{life,ah,general}. Red when the plan is
//                        single-line concentrated (or has no targets at all) —
//                        the minimal non-invented "mix" semantic; the per-line
//                        distribution itself is the substance of the check.
//   3. notOverCommitted — moneyNeeds.firstYearCommissionsRequired vs
//                        Σ yearPlan.lines.*.derivedCommission. Commission-to-
//                        commission, NEVER API-vs-income (different units).
//                        CONDITIONAL: computed only when the worksheet is shared
//                        (the caller already knows); otherwise OMITTED silently.
//   "Renewals realistic" is DROPPED — no baseline data source exists (the only
//   renewals figure is the agent's own estimate on the budget doc). Confirmed
//   against the Fork B mockup (renewalLines = renewal INCOME, not persistency).
//
// Every function returns { ok, ... } value objects; rendering stays in the
// drawer. Numbers are parseFloat-guarded — never trust doc fields as numbers.
import { LINE_KEYS } from '../services/yearPlanService';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Σ targetAPI across the plan's known lines (missing/disabled lines count 0). */
export function planTotalAPI(lines) {
  return LINE_KEYS.reduce((sum, k) => sum + num(lines?.[k]?.targetAPI), 0);
}

/** Σ derivedCommission across the plan's known lines. */
export function planTotalCommission(lines) {
  return LINE_KEYS.reduce((sum, k) => sum + num(lines?.[k]?.derivedCommission), 0);
}

/**
 * Check 1 — above the tenure-resolved Company Floor.
 * `annualFloor` comes from resolveAnnualAPIFloor (defaults-merged; flat
 * fallback when contractStartDate is unknown — the resolver's own semantics).
 */
export function checkAboveFloor(lines, annualFloor) {
  const planAPI = planTotalAPI(lines);
  const floor = num(annualFloor);
  return { ok: planAPI >= floor && planAPI > 0, planAPI, floor };
}

/**
 * Check 2 — line mix. Returns the per-line distribution plus a verdict:
 * red when zero targets, or when 100% of plan API sits in a single line.
 */
export function checkLineMix(lines) {
  const total = planTotalAPI(lines);
  const mix = LINE_KEYS.map((k) => ({
    key: k,
    targetAPI: num(lines?.[k]?.targetAPI),
    pct: num(lines?.[k]?.pct),
    enabled: lines?.[k]?.enabled !== false,
  }));
  const activeLines = mix.filter((l) => l.enabled && l.targetAPI > 0);
  if (total <= 0) return { ok: false, note: 'no targets', mix, total };
  if (activeLines.length < 2) return { ok: false, note: 'single line', mix, total };
  return { ok: true, mix, total };
}

/**
 * Check 3 — not over-committed (budget vs plan), commission-to-commission.
 * "Over-committed" = the agent's budget requires MORE first-year commission
 * than the plan produces (the household commitment exceeds the plan). ok when
 * plan-derived commission covers the requirement.
 * CONDITIONAL: call only when the worksheet is shared; callers omit the check
 * entirely (not an "unknown" alarm) when it is not.
 */
export function checkNotOverCommitted(lines, firstYearCommissionsRequired) {
  const planCommission = planTotalCommission(lines);
  const required = num(firstYearCommissionsRequired);
  return { ok: planCommission >= required, planCommission, required };
}
