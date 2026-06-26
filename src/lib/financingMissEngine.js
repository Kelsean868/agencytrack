// Track K · K7 — termination-risk monitor (pure module).
//
// Pure computation: zero Firebase imports, zero import.meta.env, zero side
// effects, fully deterministic. Mirrors financingProration.js (K5) /
// financingReconciliation.js (K6) — the caller (FinancingRiskPanel) loads the
// agent's ledger via listFinancingMonths and passes the rows in; this module
// never fetches data and never writes Firestore.
//
// Contract authority: docs/track-k-financing-new-agent-design.md §7/§8 +
// docs/design/track-k-locked-decisions.md CD#3/#4/#5 + the K7 kickoff brief's
// owner-locked Decisions 1–8. It surfaces two contract obligations WITHOUT
// automating their consequences — it is FLAG ONLY:
//   • the 7.2c consecutive-miss termination CONDITION (flagged at the 3rd
//     confirmed miss, NEVER auto-executed — no status change, no LEGAL_TRANSITIONS
//     touch; the disposition stays with a human) — Decision 1/3
//   • the 5.3 >10% downward-adjustment NOTIFY duty (a flag the manager discharges
//     via the notify affordance) — Decision 5/6
//
// Two load-bearing semantics, both LOCKED:
//   • A monthly MISS = actualAPI < validatingAPI on a CONFIRMED basis
//     (basisSource ∈ {submitted-final, settled-confirmed}; NEVER
//     submitted-provisional). The validatingAPI read is the LEDGER MONTH's
//     stored value (the amount in effect that month — preserves a mid-term
//     downward Validation-Schedule adjustment), not the terms doc. K5 snapshots
//     validatingAPI per-month to the ledger (financingService.setFinancingProration).
//   • The consecutive counter is monthly + consecutive (CD#4). It RESETS on any
//     confirmed month meeting target (actualAPI >= validatingAPI). A PENDING
//     month (submitted-provisional basis, a missing/unconfirmed determination,
//     or — implicitly — a no-entry month not present in the ledger) neither
//     counts nor resets: it is a NO-OP and the counter HOLDS across it. A
//     provisional month is the current in-flight month at the tail; a no-entry
//     gap is a skipped middle month — both are transparent to the streak (so a
//     miss → pending → miss reads as 2 consecutive, the locked reading of
//     "neither counts nor resets"). FLAG ONLY: a human reads the per-month
//     verdicts and exercises judgment on the 7.2c disposition.

// Strict numeric parse: a non-finite OR malformed numeric must surface as PENDING,
// never be silently coerced into a value that reads as a meet/miss. Unlike
// parseFloat, this REJECTS trailing-garbage strings ("30000usd", "0.14%") — a
// corrupted ledger value must not become a real legal verdict. null / undefined /
// empty / whitespace → NaN (preserving parseFloat's null→NaN). Plain Number() is
// deliberately NOT used directly: Number(null) === 0 would turn a null actualAPI
// into a false 0-verdict. Confirmed ledger rows carry finite non-negative numerics
// (service-enforced); this is belt-and-suspenders for a corrupt/statement-only row.
const p = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN; // null / undefined / boolean / object → PENDING
  const t = v.trim();
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

// basisSource values that represent a CONFIRMED determination (Decision 1).
// submitted-provisional is a live projection — never a stored miss/meet verdict.
export const CONFIRMED_BASES = ['submitted-final', 'settled-confirmed'];

// >10% downward-adjustment threshold (clause 5.3 / CD#5). adjustmentPct is a
// ratio: (currentMonthlyFinancing − managerFinancing) / currentMonthlyFinancing.
// Positive = a cut below the amount in effect; strictly > 0.10 = past the 10%
// threshold. Denominator is currentMonthlyFinancing (CD#5), baked in at K5 write.
export const ADJUSTMENT_NOTIFY_THRESHOLD = 0.10;

// Severity boundaries for the consecutive-miss counter (Decision 1.3 / spec §8).
export const MISS_AMBER_AT = 2;     // amber at 2 consecutive misses
export const MISS_CRITICAL_AT = 3;  // critical at 3 — the 7.2c condition is met

// Per-month verdicts.
export const MISS = 'miss';
export const MEET = 'meet';
export const PENDING = 'pending';

// Ascending "YYYY_MM" lexical compare (zero-padded keys sort lexically).
function byMonthAsc(a, b) {
  const am = a?.month ?? '';
  const bm = b?.month ?? '';
  return am < bm ? -1 : am > bm ? 1 : 0;
}

// ──────────────────────────────────────────────────────
// computeMonthlyMiss — the confirmed-basis verdict for ONE ledger month.
//
// Returns PENDING for any month without a confirmed determination — a
// submitted-provisional basis, a missing/invalid basisSource, or a non-finite
// actualAPI/validatingAPI (a statement-only row that never carried a proration).
// On a confirmed basis: MISS when actualAPI < validatingAPI, else MEET
// (actualAPI >= validatingAPI, including the validatingAPI === 0 no-target case).
// ──────────────────────────────────────────────────────
export function computeMonthlyMiss(monthRow) {
  const row = monthRow ?? {};
  if (!CONFIRMED_BASES.includes(row.basisSource)) return PENDING;
  const actual = p(row.actualAPI);
  const validating = p(row.validatingAPI);
  if (!Number.isFinite(actual) || !Number.isFinite(validating)) return PENDING;
  return actual < validating ? MISS : MEET;
}

// ──────────────────────────────────────────────────────
// computeConsecutiveMisses — the streak counter over an ordered ledger (CD#4).
//
// rows: the agent's ledger months (any order — sorted ascending here, so the
// caller need not pre-sort). Walks chronologically: a confirmed MEET resets to
// 0, a confirmed MISS increments, a PENDING month is a no-op (neither counts nor
// resets — "the counter holds"). The returned count is the streak AS OF the
// latest month — the run of confirmed misses since the last confirmed meet,
// transparent to pending gaps.
//
// @returns {
//   count,                    // current consecutive-miss streak (number)
//   severity,                 // 'none' | 'amber' (>=2) | 'critical' (>=3)
//   terminationConditionMet,  // count >= 3 — the 7.2c condition is MET (FLAG ONLY)
//   verdicts,                 // [{ month, verdict }] ascending — panel dots/labels
// }
// ──────────────────────────────────────────────────────
export function computeConsecutiveMisses(rows) {
  const list = (Array.isArray(rows) ? rows.slice() : []).sort(byMonthAsc);

  let count = 0;
  const verdicts = [];
  for (const row of list) {
    const verdict = computeMonthlyMiss(row);
    verdicts.push({ month: row?.month ?? null, verdict });
    if (verdict === MEET) count = 0;
    else if (verdict === MISS) count += 1;
    // PENDING → no-op (hold).
  }

  return {
    count,
    severity: severityForCount(count),
    terminationConditionMet: count >= MISS_CRITICAL_AT,
    verdicts,
  };
}

// 'none' below amber, 'amber' at 2, 'critical' at 3+ (Decision 1.3).
export function severityForCount(count) {
  const n = Number.isFinite(count) ? count : 0;
  if (n >= MISS_CRITICAL_AT) return 'critical';
  if (n >= MISS_AMBER_AT) return 'amber';
  return 'none';
}

// ──────────────────────────────────────────────────────
// isAdjustmentNotifyFlag — the clause-5.3 >10% downward-adjustment predicate.
//
// adjustmentPct is stored on a ledger month ONLY once the manager confirms a
// figure (null/undefined until then — an unconfirmed cut never fires the duty).
// Returns true only for a CONFIRMED value strictly past the 10% threshold. A
// non-positive adjustmentPct (an increase above the amount in effect, or a flat
// confirm) is not a cut and never flags. Exactly 10% (=== threshold) is NOT past
// the threshold (CD#5 ">10% below") → no flag.
// ──────────────────────────────────────────────────────
export function isAdjustmentNotifyFlag(adjustmentPct) {
  if (adjustmentPct === null || adjustmentPct === undefined || adjustmentPct === '') return false;
  const pct = p(adjustmentPct);
  if (!Number.isFinite(pct)) return false;
  return pct > ADJUSTMENT_NOTIFY_THRESHOLD;
}

// ──────────────────────────────────────────────────────
// findAdjustmentFlags — the confirmed ledger months that raise the 5.3 duty.
//
// Returns the subset of rows whose stored adjustmentPct is past the >10%
// threshold, ascending by month. The panel renders the most recent as the active
// notify duty; older ones are historical context.
// ──────────────────────────────────────────────────────
export function findAdjustmentFlags(rows) {
  return (Array.isArray(rows) ? rows.slice() : [])
    .filter((row) => isAdjustmentNotifyFlag(row?.adjustmentPct))
    .sort(byMonthAsc);
}
