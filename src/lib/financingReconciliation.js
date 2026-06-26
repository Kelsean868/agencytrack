// Track K · K6 — reconciliation event + 6.2 garnish projection + wind-down clocks
// (pure module).
//
// Pure computation: zero Firebase imports, zero import.meta.env, zero side
// effects, fully deterministic. Mirrors financingProration.js (K5) / financingTakeHome.js
// (K4) — the caller (FinancingReconciliationPanel + financingService.reconcileFinancing)
// normalises the agent's terms + ledger and passes primitives in; this module never
// fetches data and never writes Firestore.
//
// Contract authority: docs/track-k-financing-new-agent-design.md §5/§6 +
// docs/design/track-k-locked-decisions.md (CD#7 waiver, CD#8 incentives, CD#9 state
// machine) + the K6 kickoff brief's owner-locked Decisions 1–8. Where they differ the
// brief's owner locks govern:
//   • trigger = auto month-12 OR manual early-election (6.5b) — Decision 1 (triggeredBy)
//   • waiver is SERVICE-GATED (CD#7 / contract 6.6): the first 3 months' financing is
//     forgiven ONLY at 12 months' continuous service; an earlier exit makes them
//     repayable — Decision 2 (serviceMet = serviceMonths >= 12)
//   • closingBalance is AUTHORITATIVE — the K2 statement runningBalance at the
//     reconciliation month (positive = owes, negative = surplus) — Decision 3. We never
//     recompute it from offset components; totalOffsets is DERIVED so the worksheet
//     reconciles to the authoritative balance (totalOffsets = drawn − closingBalance).
//   • reconciledPosition = closingBalance − waiverApplied; outcome owing (> 0) drives
//     reconciling → post_financing_repayment, surplus (<= 0) drives reconciling → cleared
//     and pays surplusPaid = abs(reconciledPosition) — Decisions 3–4.
//   • garnish PROJECTION (display only) = garnishCommissionRate × netCommission + the
//     net-bonus offset, averaged over the entered ledger months; the incentives arm has
//     no ledger source and is OMITTED (Decision 6 / banked FU). The authoritative
//     wind-down to `cleared` uses the statement runningBalance, never this projection.

import { DEFAULT_FINANCING_RULESET_2026 } from '../config/financingRuleset/2026';
import { monthKeyFromDate, monthsBetweenKeys } from '../utils/dateInputs';

// parseFloat-or-zero (project rule: never trust string/undefined numerics).
const p = (v) => parseFloat(v) || 0;

// ── Contract structural constants (counts, not rates — rates live in the ruleset).
// Mirrors financingService.financingCeiling's hardcoded 6× (contract 2.4/6.3): these
// are agreement-term month counts written into the contract, not configurable rates.
export const WAIVER_WINDOW_MONTHS = 3;   // contract 6.6 — first 3 months' financing
export const WAIVER_SERVICE_MONTHS = 12; // contract 6.6 — 12 months' continuous service
export const AGREEMENT_TERM_MONTHS = 24; // contract — 24-month agreement term
const CEILING_MULTIPLE = 6;              // contract 2.4/6.3 — 6 × currentMonthlyFinancing

export const RECONCILIATION_OUTCOMES = ['owing', 'surplus'];
export const RECONCILIATION_TRIGGERS = ['auto_month12', 'manual_election'];

// 1-based ledger month number for a statement month relative to effectiveDate
// (effectiveDate's own calendar month is month 1). A pure mirror of
// financingService.financingMonthIndex — inlined here so this module stays
// Firebase-free (dateInputs is pure). Returns null on a malformed input.
export function reconMonthIndex(effectiveDate, statementMonth) {
  try {
    return monthsBetweenKeys(monthKeyFromDate(effectiveDate), statementMonth) + 1;
  } catch {
    return null;
  }
}

// Σ financingPaid across every entered ledger month (totalFinancingDrawn, the
// worksheet "drawn" line). Rows are the K2 ledger docs (raw shape).
export function sumFinancingPaid(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, r) => acc + p(r?.financingPaid), 0);
}

// Σ financingPaid over months 1–3 relative to effectiveDate (the waiver candidate —
// forgiven only when serviceMet). A row with a malformed month (null index) is skipped.
export function sumFirstWindowFinancingPaid(rows, effectiveDate) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, r) => {
    const idx = reconMonthIndex(effectiveDate, r?.month);
    if (idx !== null && idx >= 1 && idx <= WAIVER_WINDOW_MONTHS) return acc + p(r?.financingPaid);
    return acc;
  }, 0);
}

// The authoritative closing balance = the runningBalance of the chronologically
// latest entered ledger month (Decision 3). runningBalance is cumulative + authoritative
// (K2), so the latest month carries the position at the reconciliation event. Returns 0
// when no row carries a numeric runningBalance.
export function latestRunningBalance(rows) {
  const valid = (Array.isArray(rows) ? rows : []).filter(
    (r) => typeof r?.month === 'string' && r?.runningBalance != null && Number.isFinite(parseFloat(r.runningBalance)),
  );
  if (valid.length === 0) return 0;
  const latest = valid.reduce((a, b) => (a.month >= b.month ? a : b));
  return p(latest.runningBalance);
}

// ──────────────────────────────────────────────────────
// computeReconciliation — the full reconciliation record-shape calc (Decisions 1–3).
//
// @param {object} input
//   input.rows            the agent's K2 ledger rows (raw shape)
//   input.effectiveDate   financingTerms.effectiveDate ("YYYY-MM-DD") — anchors months 1–3
//   input.serviceMonths   whole months of continuous service at the event (drives serviceMet)
//   input.triggeredBy     'auto_month12' | 'manual_election'
//   input.closingBalance? authoritative balance override; defaults to latestRunningBalance(rows)
// @returns {{
//   totalFinancingDrawn, totalOffsets, closingBalance, waiverApplied, serviceMet,
//   serviceMonths, reconciledPosition, outcome, surplusPaid, garnishStarted,
//   triggeredBy, nextStatus
// }}
// ──────────────────────────────────────────────────────
export function computeReconciliation(input = {}) {
  const inp = input ?? {};
  const rows = Array.isArray(inp.rows) ? inp.rows : [];
  const serviceMonths = p(inp.serviceMonths);
  const triggeredBy = RECONCILIATION_TRIGGERS.includes(inp.triggeredBy) ? inp.triggeredBy : 'auto_month12';

  const totalFinancingDrawn = sumFinancingPaid(rows);
  const closingBalance = inp.closingBalance != null && Number.isFinite(parseFloat(inp.closingBalance))
    ? p(inp.closingBalance)
    : latestRunningBalance(rows);

  // Waiver is service-gated (CD#7): forgiven only at >= 12 months' continuous service.
  const serviceMet = serviceMonths >= WAIVER_SERVICE_MONTHS;
  const waiverCandidate = sumFirstWindowFinancingPaid(rows, inp.effectiveDate);
  const waiverApplied = serviceMet ? waiverCandidate : 0;

  // closingBalance positive = agent owes; the waiver forgives draws, reducing what's owed.
  const reconciledPosition = closingBalance - waiverApplied;
  // Zero closes at `cleared` with no payment (mockup "Even" state) — treat as surplus(0).
  const outcome = reconciledPosition > 0 ? 'owing' : 'surplus';
  const surplusPaid = outcome === 'surplus' ? Math.abs(reconciledPosition) : 0;
  const garnishStarted = outcome === 'owing';

  // Derived so the worksheet reconciles to the AUTHORITATIVE closingBalance (Decision 3):
  // drawn − offsets = closingBalance ⟹ offsets = drawn − closingBalance. Never recomputed
  // from offset components (which could drift from the authoritative statement balance).
  const totalOffsets = totalFinancingDrawn - closingBalance;

  const nextStatus = outcome === 'surplus' ? 'cleared' : 'post_financing_repayment';

  return {
    totalFinancingDrawn,
    totalOffsets,
    closingBalance,
    waiverApplied,
    serviceMet,
    serviceMonths,
    reconciledPosition,
    outcome,
    surplusPaid,
    garnishStarted,
    triggeredBy,
    nextStatus,
  };
}

// ──────────────────────────────────────────────────────
// computeGarnishProjection — the 6.2 post-financing garnish ESTIMATE (Decision 6).
//
// Display only. Per entered ledger month: garnishCommissionRate × netCommission +
// the net-bonus offset (bonusOffset already IS the 50%-of-net deduction). The incentives
// arm has no ledger source and is OMITTED (Decision 6 / banked FU). Averaged over the
// months carrying either component → a representative monthly garnish; monthsToCleared
// divides the owing position by it. The AUTHORITATIVE wind-down to `cleared` uses the
// statement runningBalance, so an incomplete projection never corrupts the actual close.
//
// @returns {{ monthlyGarnish, commissionComponent, bonusComponent, monthsToCleared, basisMonths }}
// ──────────────────────────────────────────────────────
export function computeGarnishProjection(input = {}, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const inp = input ?? {};
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026;
  const commissionRate = rs.garnishCommissionRate ?? DEFAULT_FINANCING_RULESET_2026.garnishCommissionRate;
  const rows = Array.isArray(inp.rows) ? inp.rows : [];
  const reconciledPosition = p(inp.reconciledPosition);

  // Months that carry a commission or bonus-offset figure form the projection basis.
  const basis = rows.filter((r) => p(r?.netCommission) > 0 || p(r?.bonusOffset) > 0);
  const basisMonths = basis.length;

  let commissionComponent = 0;
  let bonusComponent = 0;
  if (basisMonths > 0) {
    const totalCommission = basis.reduce((acc, r) => acc + commissionRate * p(r?.netCommission), 0);
    const totalBonus = basis.reduce((acc, r) => acc + p(r?.bonusOffset), 0);
    commissionComponent = totalCommission / basisMonths;
    bonusComponent = totalBonus / basisMonths;
  }
  const monthlyGarnish = commissionComponent + bonusComponent;

  const monthsToCleared = monthlyGarnish > 0 && reconciledPosition > 0
    ? Math.ceil(reconciledPosition / monthlyGarnish)
    : null;

  return { monthlyGarnish, commissionComponent, bonusComponent, monthsToCleared, basisMonths };
}

// ──────────────────────────────────────────────────────
// computeWindDownClocks — the deferred derived-terms clocks (Decision 7, display only).
//
// 24-month agreement term, 12-month service / waiver-earned status, first-3-months
// waiver window, and (for context) the 6× ceiling on currentMonthlyFinancing (contract
// 2.4/6.3 — consistent with the K2 ledger indicator, NOT agreed).
//
// @returns {{
//   agreementTermMonths, serviceMonths, termMonthsRemaining, serviceMet,
//   waiverServiceMonths, waiverWindowMonths, ceiling
// }}
// ──────────────────────────────────────────────────────
export function computeWindDownClocks(input = {}) {
  const inp = input ?? {};
  const serviceMonths = p(inp.serviceMonths);
  const cur = parseFloat(inp.currentMonthlyFinancing);
  return {
    agreementTermMonths: AGREEMENT_TERM_MONTHS,
    serviceMonths,
    termMonthsRemaining: Math.max(0, AGREEMENT_TERM_MONTHS - serviceMonths),
    serviceMet: serviceMonths >= WAIVER_SERVICE_MONTHS,
    waiverServiceMonths: WAIVER_SERVICE_MONTHS,
    waiverWindowMonths: WAIVER_WINDOW_MONTHS,
    ceiling: Number.isFinite(cur) ? CEILING_MULTIPLE * cur : null,
  };
}
