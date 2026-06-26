'use strict';

// Track K · K7 — CJS twin of the financing miss/adjustment predicates.
//
// The notifyFinancingAdjustment Cloud Function RECOMPUTES the clause-5.3 >10%
// condition server-side from canonical ledger data — it must NOT trust the
// client-supplied adjustmentPct (a fabricable value would defeat the 5.3 audit
// trail). The CF bundle deploys standalone and cannot import the ESM engines in
// src/lib, so these predicates are duplicated here VERBATIM and kept in lock-step
// by a cross-check test (src/lib/__tests__/financingMissPredicates.cross-check.test.js),
// mirroring the functions/lib/computePoints.js CJS-twin pattern. DO NOT diverge
// this logic from the ESM originals — the cross-check turns any drift into a test
// failure:
//   • computeAdjustmentPct                                ← src/lib/financingProration.js
//   • isAdjustmentNotifyFlag / CONFIRMED_BASES
//     / ADJUSTMENT_NOTIFY_THRESHOLD                       ← src/lib/financingMissEngine.js

// Strict numeric parse — verbatim from financingMissEngine.js `p`: rejects malformed
// strings ("0.14%"); null / undefined / empty / whitespace / non-string → NaN. Plain
// Number() is NOT used directly (Number(null) === 0 would coerce a false value).
const p = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const t = v.trim();
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

// Verbatim from src/lib/financingMissEngine.js.
const CONFIRMED_BASES = ['submitted-final', 'settled-confirmed'];
const ADJUSTMENT_NOTIFY_THRESHOLD = 0.10;

// Verbatim from src/lib/financingProration.js — adjustmentPct =
// (currentMonthlyFinancing − managerFinancing) / currentMonthlyFinancing. Returns
// null until managerFinancing is confirmed (a bare suggestion never flags). Uses the
// strict `p` parse (matching the ESM's strictNum) so the legal-gate arithmetic never
// trusts parseFloat on corrupt ledger data ("5000abc" → null, not 5000).
function computeAdjustmentPct(currentMonthlyFinancing, managerFinancing) {
  if (managerFinancing === null || managerFinancing === undefined || managerFinancing === '') return null;
  const current = p(currentMonthlyFinancing);
  const manager = p(managerFinancing);
  // Domain guard (mirrors the ESM): negative managerFinancing → null (would compute
  // a >100% "cut" and falsely trip the >10% gate).
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(manager) || manager < 0) return null;
  return (current - manager) / current;
}

// Verbatim from src/lib/financingMissEngine.js — true only for a confirmed value
// strictly past the 10% threshold (a non-positive cut never flags).
function isAdjustmentNotifyFlag(adjustmentPct) {
  if (adjustmentPct === null || adjustmentPct === undefined || adjustmentPct === '') return false;
  const pct = p(adjustmentPct);
  if (!Number.isFinite(pct)) return false;
  return pct > ADJUSTMENT_NOTIFY_THRESHOLD;
}

module.exports = {
  computeAdjustmentPct,
  isAdjustmentNotifyFlag,
  CONFIRMED_BASES,
  ADJUSTMENT_NOTIFY_THRESHOLD,
};
