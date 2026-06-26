// Track K · K5 — validation-schedule proration (pure module).
//
// Pure computation: zero Firebase imports, zero import.meta.env, zero side
// effects, fully deterministic. Mirrors financingBonusEngine.js (K3) — REUSES its
// credit filter rather than re-implementing it. The caller (FinancingProrationPanel)
// normalises the agent's monthly policy set and passes it in; this module never
// fetches data.
//
// Contract authority: docs/track-k-financing-new-agent-design.md §6, with
// docs/design/track-k-locked-decisions.md CD#3/CD#5 and the K5 kickoff brief's
// dispatcher locks (a)–(d) governing where they differ — most importantly:
//   • actualAPI = K3's credit-filtered monthly Gross (reuse computeApiChain) — Decision 1
//   • basis machine: M1–3 → submitted-final (proposedAPI); M4+ past → settled-confirmed
//     (settledAPI); M4+ current/in-flight → submitted-provisional (proposedAPI, DISPLAY
//     only, never a stored determination) — Decision 2 / lock (c)
//   • settled basis uses RAW settledAPI (NOT managerSettledAPI) so financing Gross
//     matches the K3 bonus Gross — lock (c) (LOW FU banked re managerSettledAPI)
//   • suggestedFinancing = agreed × min(1, actualAPI ÷ validatingAPI), capped 100% — Decision 3
//   • adjustmentPct = (currentMonthlyFinancing − managerFinancing) ÷ currentMonthlyFinancing,
//     on the CONFIRMED figure only — null until the manager confirms managerFinancing — lock (b)

import { computeApiChain } from './financingBonusEngine';
import { monthKeyFromDate, monthsBetweenKeys } from '../utils/dateInputs';

// parseFloat-or-zero (project rule: never trust string/undefined numerics).
const p = (v) => parseFloat(v) || 0;

// 1-based ledger month number for a statement month relative to effectiveDate
// (effectiveDate's own calendar month is month 1). A pure mirror of
// financingService.financingMonthIndex — inlined here so this module stays
// Firebase-free (the service drags the client SDK; dateInputs is pure). Returns
// null on a malformed effectiveDate/statementMonth.
function monthIndex(effectiveDate, statementMonth) {
  try {
    return monthsBetweenKeys(monthKeyFromDate(effectiveDate), statementMonth) + 1;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────
// tsToMonthKey — the "YYYY_MM" ledger month key for a policy date field.
//
// Policy dates are stored via Timestamp.fromDate(parseDateOnlyTT(...)) → the
// instant is 04:00 UTC on the calendar day = TT-local midnight (dateInputs.js).
// For such values the UTC calendar day equals the TT calendar day, so a UTC
// month extraction is correct AND matches policiesDerivation.js's convention.
// Accepts a Firestore Timestamp (.toDate()), a Date, or an ISO string. Returns
// null for missing/invalid input so callers can drop the line rather than crash.
// ──────────────────────────────────────────────────────
export function tsToMonthKey(ts) {
  if (!ts) return null;
  const d = typeof ts.toDate === 'function'
    ? ts.toDate()
    : ts instanceof Date
      ? ts
      : typeof ts === 'string'
        ? new Date(ts)
        : null;
  if (!d || isNaN(d.getTime())) return null;
  const iso = d.toISOString(); // YYYY-MM-DDTHH:MM:...
  return `${iso.slice(0, 4)}_${iso.slice(5, 7)}`;
}

// ──────────────────────────────────────────────────────
// resolveProrationBasis — the basis-source for a statement month (Decision 2 / lock c).
//
// Months 1–3 (relative to effectiveDate) → submitted-final. Month 4+: a PAST/closed
// month → settled-confirmed; the CURRENT or future in-flight month → submitted-provisional
// (a live projection, DISPLAY only — never a stored determination, Decision 4).
// `currentMonthKey` is passed in (not read from a clock) to keep this pure/testable.
// A malformed effectiveDate/statementMonth falls back to submitted-final (mirrors
// deriveBasisSource in financingService).
// ──────────────────────────────────────────────────────
export function resolveProrationBasis(effectiveDate, statementMonth, currentMonthKey) {
  const idx = monthIndex(effectiveDate, statementMonth);
  if (idx === null) return 'submitted-final';
  if (idx <= 3) return 'submitted-final';
  // Month 4+: past month is confirmed; current/future in-flight month is provisional.
  if (currentMonthKey && monthIsBefore(statementMonth, currentMonthKey)) return 'settled-confirmed';
  return 'submitted-provisional';
}

// Local "YYYY_MM" comparison — true when a precedes b (a is strictly earlier).
// Lexicographic compare is correct for zero-padded YYYY_MM keys.
function monthIsBefore(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a < b;
}

// True when the basis reads from the SUBMITTED side (proposedAPI), false when it
// reads from the SETTLED side (settledAPI).
function isSubmittedBasis(basisSource) {
  return basisSource === 'submitted-final' || basisSource === 'submitted-provisional';
}

// ──────────────────────────────────────────────────────
// monthlyGross — actualAPI for one month on the resolved basis (Decision 1).
//
// Filters the agent's policy set to the statement month, normalises each line's
// API to the basis field, and runs it through K3's computeApiChain (the credit
// filter — creditWeight). NO re-implementation of the credit map.
//   • submitted basis: lines whose dateSubmitted ∈ month; API = proposedAPI
//   • settled basis:   lines with status==='settled' AND dateIssued ∈ month; API = settledAPI
// Returns the credit-filtered Gross (Σ API × creditWeight). opts is {} — monthly
// proration uses the Gross arm only; not-taken/lapse adjustments are quarterly
// rollup inputs to the bonus engine, not part of the monthly proration basis.
// ──────────────────────────────────────────────────────
export function monthlyGross(policies, statementMonth, basisSource, ruleset) {
  const lines = Array.isArray(policies) ? policies : [];
  const useSubmitted = isSubmittedBasis(basisSource);
  const monthLines = lines
    .filter((pol) => {
      if (useSubmitted) return tsToMonthKey(pol?.dateSubmitted) === statementMonth;
      return pol?.status === 'settled' && tsToMonthKey(pol?.dateIssued) === statementMonth;
    })
    .map((pol) => ({
      newBusinessType: pol?.newBusinessType,
      isSelfOrFamily:  pol?.isSelfOrFamily,
      isStaff:         pol?.isStaff,
      // Normalise the basis API into the field computeApiChain reads (`settledAPI`).
      // Settled basis uses RAW settledAPI (lock c) — NOT managerSettledAPI — so this
      // Gross matches the K3 bonus Gross.
      settledAPI: useSubmitted ? p(pol?.proposedAPI) : p(pol?.settledAPI),
    }));
  // ruleset omitted → computeApiChain applies its default (DEFAULT_FINANCING_RULESET_2026).
  const { gross } = computeApiChain(monthLines, {}, ruleset);
  return gross;
}

// ──────────────────────────────────────────────────────
// computeSuggestedFinancing — the prorated draw the manager confirms (Decision 3).
//
// suggestedFinancing = agreedMonthlyFinancing × min(1, actualAPI ÷ validatingAPI).
// Capped at 100% (agreed is the ceiling). A non-positive validatingAPI (missing /
// mis-configured target) yields ratio 0 — never auto-suggest a draw off a bad
// denominator; the manager overrides up to agreed.
// Returns { prorationRatio, suggestedFinancing }.
// ──────────────────────────────────────────────────────
export function computeSuggestedFinancing(agreedMonthlyFinancing, actualAPI, validatingAPI) {
  const agreed     = p(agreedMonthlyFinancing);
  const actual     = p(actualAPI);
  const validating = p(validatingAPI);
  const prorationRatio = validating > 0 ? Math.min(1, actual / validating) : 0;
  return { prorationRatio, suggestedFinancing: agreed * prorationRatio };
}

// ──────────────────────────────────────────────────────
// computeAdjustmentPct — the month's confirmed distance below full (Decision 7 / lock b).
//
// adjustmentPct = (currentMonthlyFinancing − managerFinancing) ÷ currentMonthlyFinancing.
// Denominator is currentMonthlyFinancing (CD#5 — NOT agreed; overrides the mockup's
// "vs agreed"). Computed on the CONFIRMED figure managerFinancing only — returns null
// until the manager confirms it (a bare system suggestion never produces a stored
// adjustmentPct; the K7 >10% duty must key off the manager's actual cut). May be
// negative when managerFinancing exceeds the current amount in effect.
// ──────────────────────────────────────────────────────
export function computeAdjustmentPct(currentMonthlyFinancing, managerFinancing) {
  if (managerFinancing === null || managerFinancing === undefined || managerFinancing === '') return null;
  // Strict parse for the clause-5.3 gate arithmetic — the legal recompute must NOT
  // trust parseFloat (which accepts "5000abc" as 5000 and could trip the >10% gate
  // on corrupt ledger data). Reject trailing garbage; non-string/non-finite → NaN.
  const current = strictNum(currentMonthlyFinancing);
  const manager = strictNum(managerFinancing);
  // Domain guard: a negative managerFinancing is impossible — it would compute a
  // >100% "cut" and falsely trip the >10% gate. PENDING-equivalent → null.
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(manager) || manager < 0) return null;
  return (current - manager) / current;
}

// Strict numeric parse (mirrors financingMissEngine `p` + the financingMissPredicates
// CJS twin; kept in parity by financingMissPredicates.cross-check.test.js).
function strictNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const t = v.trim();
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// ──────────────────────────────────────────────────────
// computeProration — the full readout the override drawer renders + writes.
//
// Resolves the basis, computes actualAPI (monthly Gross), the suggestion, and —
// when managerFinancing is supplied — the adjustmentPct. validatingAPI defaults
// from the terms but the caller may pass a per-month override (Decision 6).
//
// @param {object} input
//   input.policies                 the agent's policy docs (raw ledger shape)
//   input.effectiveDate            financingTerms.effectiveDate ("YYYY-MM-DD")
//   input.statementMonth           the month being prorated ("YYYY_MM")
//   input.currentMonthKey          today's TT month ("YYYY_MM") — drives provisional vs confirmed
//   input.validatingAPI            the month's validating target (per-month override or terms default)
//   input.agreedMonthlyFinancing   the agreed draw (proration ceiling)
//   input.currentMonthlyFinancing  the amount in effect (adjustmentPct denominator)
//   input.managerFinancing?        the manager's confirmed figure (omit for a bare suggestion)
// @returns { basisSource, actualAPI, validatingAPI, prorationRatio, suggestedFinancing, adjustmentPct }
// ──────────────────────────────────────────────────────
export function computeProration(input = {}, ruleset) {
  const inp = input ?? {};
  const basisSource = resolveProrationBasis(inp.effectiveDate, inp.statementMonth, inp.currentMonthKey);
  const actualAPI = monthlyGross(inp.policies, inp.statementMonth, basisSource, ruleset);
  const validatingAPI = p(inp.validatingAPI);
  const { prorationRatio, suggestedFinancing } = computeSuggestedFinancing(
    inp.agreedMonthlyFinancing,
    actualAPI,
    validatingAPI,
  );
  const adjustmentPct = computeAdjustmentPct(inp.currentMonthlyFinancing, inp.managerFinancing);
  return { basisSource, actualAPI, validatingAPI, prorationRatio, suggestedFinancing, adjustmentPct };
}
