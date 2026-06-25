// Track K · K4 — take-home breakdown for a financing bonus.
// Pure function: no Firebase imports, no side effects, fully deterministic.
//
// Tax-first sequence (locked §2.1 / addendum A.1 — "50% of NET bonuses"):
//   tax              = gross × taxRate
//   net              = gross − tax
//   financingPortion = isOwing ? net × financingPortionRate : 0
//   takeHome         = net − financingPortion
//
// "Owing" = on_financing OR post_financing_repayment (Addendum B.6 — the 6.2
// garnish keeps the 50%-of-net rule running until the balance clears).
// grossBonus is already floored at 0 by K3; this calc never produces a negative
// take-home.

import { DEFAULT_FINANCING_RULESET_2026 } from '../config/financingRuleset/2026';

const OWING_STATUSES = new Set(['on_financing', 'post_financing_repayment']);

/**
 * @param {number} grossBonus  — projected or actual gross bonus (≥ 0)
 * @param {string} financingStatus  — one of the 5 FINANCING_STATUSES
 * @param {object} [ruleset]  — defaults to DEFAULT_FINANCING_RULESET_2026
 * @returns {{ gross: number, tax: number, net: number, financingPortion: number, takeHome: number, isOwing: boolean }}
 */
export function computeTakeHome(grossBonus, financingStatus, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026;
  const taxRate = rs.taxRate ?? DEFAULT_FINANCING_RULESET_2026.taxRate;
  const financingPortionRate = rs.financingPortionRate ?? DEFAULT_FINANCING_RULESET_2026.financingPortionRate;
  const isOwing = OWING_STATUSES.has(financingStatus);
  const gross = Math.max(0, parseFloat(grossBonus) || 0);
  const tax = gross * taxRate;
  const net = gross - tax;
  const financingPortion = isOwing ? net * financingPortionRate : 0;
  const takeHome = net - financingPortion;
  return { gross, tax, net, financingPortion, takeHome, isOwing };
}
