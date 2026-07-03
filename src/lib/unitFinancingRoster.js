// Track K · K10a — Unit Financing Roster (pure assembly module).
//
// Pure computation: zero Firebase imports, zero import.meta.env, zero side
// effects, fully deterministic. Mirrors financingMissEngine (K7) — the caller
// (UnitFinancingRoster) fans out per-agent GETs (getFinancingTerms +
// listFinancingMonths via the service layer, filtered to the UM's unit by
// getTenantUsers) and passes the fetched docs in; this module assembles the
// per-row view-model and the unit aggregates. It NEVER fetches and NEVER writes.
//
// Read-only surface: every figure it derives (confirmed draw, adjustmentPct,
// balance) already posted from the BM's confirm/override write
// (setFinancingProration). K10a renders them LOCKED — this module computes the
// read model only; no write path exists for the UM role.
//
// Load-bearing reuse (Rule 17 — mirror the shipped single-agent panel exactly):
//   • The miss counter is the SAME confirmed-basis monthly-consecutive streak the
//     FinancingRiskPanel renders (computeConsecutiveMisses) — provisional months
//     never count.
//   • The >10% downward-adjustment flag mirrors FinancingRiskPanel's activeFlag:
//     findAdjustmentFlags(...) filtered to CONFIRMED_BASES, latest wins. A
//     provisional cut past 10% is NOT a flag (never a stored determination).

import {
  computeConsecutiveMisses,
  findAdjustmentFlags,
  CONFIRMED_BASES,
  MISS_AMBER_AT,
} from './financingMissEngine';

// Roster membership: an actively-financed agent. Excludes not_on_financing
// (declined / straight commission — never appears) and cleared (repaid / done).
// Mirrors FinancingSelfView's "financed" test (terms exists AND status past
// not_on_financing) but additionally drops the terminal cleared state so the
// roster shows the CURRENT book, not a growing archive.
export const ACTIVE_FINANCING_STATUSES = ['on_financing', 'reconciling', 'post_financing_repayment'];

export function isActivelyFinanced(terms) {
  return !!terms && ACTIVE_FINANCING_STATUSES.includes(terms.financingStatus);
}

// Ascending "YYYY_MM" lexical compare (zero-padded keys sort lexically).
function byMonthAsc(a, b) {
  const am = a?.month ?? '';
  const bm = b?.month ?? '';
  return am < bm ? -1 : am > bm ? 1 : 0;
}

// The latest ledger row satisfying a predicate, by month ascending.
function latestBy(ledger, predicate) {
  const rows = (Array.isArray(ledger) ? ledger : []).filter(predicate).sort(byMonthAsc);
  return rows.length ? rows[rows.length - 1] : null;
}

// A finite number or null (never NaN / undefined leaking into a money figure).
function numOrNull(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Assemble one roster row from a unit agent's fetched financing docs.
 *
 * @param {object} args
 *   - agent: the user doc ({ id, name, email, unitId, ... }) from getTenantUsers.
 *   - terms: the financingTerms doc (getFinancingTerms) — assumed actively financed.
 *   - ledger: the agent's financing ledger rows (listFinancingMonths).
 *   - ceiling: financingCeiling(currentMonthlyFinancing) computed by the caller
 *     (kept out of this pure module so it never imports the firebase-coupled
 *     financingService — the SSOT financingCeiling stays in the service layer).
 * @returns the per-row view-model consumed by UnitFinancingRoster.
 */
export function assembleRosterRow({ agent, terms, ledger, ceiling }) {
  const rows = Array.isArray(ledger) ? ledger : [];

  const miss = computeConsecutiveMisses(rows);

  // >10% flag — confirmed basis ONLY, latest wins (mirrors FinancingRiskPanel).
  const adjFlags = findAdjustmentFlags(rows).filter((r) => CONFIRMED_BASES.includes(r?.basisSource));
  const activeAdj = adjFlags.length ? adjFlags[adjFlags.length - 1] : null;

  // Confirmed draw = the most recent month carrying a manager-confirmed figure.
  // adjustmentPct rides with it (both written together by setFinancingProration).
  const latestDraw = latestBy(rows, (r) => r?.managerFinancing != null);

  // Current standing = the most recent month with an authoritative running balance.
  const latestBal = latestBy(rows, (r) => r?.runningBalance != null);
  const runningBalance = latestBal ? numOrNull(latestBal.runningBalance) : null;
  const ceil = numOrNull(ceiling);
  const isSurplus = runningBalance != null && runningBalance < 0;
  const overCeiling = ceil != null && runningBalance != null && runningBalance > ceil;

  // Basis for the row's confirmed figures (the confirmed-draw month's stored basis,
  // else the latest balance month's) — so no figure renders without its basisSource.
  const basisSource = latestDraw?.basisSource ?? latestBal?.basisSource ?? null;

  return {
    agentId:   agent?.id ?? null,
    agentName: agent?.name ?? agent?.email ?? agent?.id ?? '—',
    agentUnitId: agent?.unitId ?? null,          // carried for the CoachNote agentUnitId denorm
    branchId: agent?.branchId ?? null,           // K10b: the BM-inbox read key (escalation denorm)
    status: terms?.financingStatus ?? null,
    effectiveDate: terms?.effectiveDate ?? null,
    agreedMonthlyFinancing: numOrNull(terms?.agreedMonthlyFinancing),
    currentMonthlyFinancing: numOrNull(terms?.currentMonthlyFinancing),

    missCount: miss.count,
    missSeverity: miss.severity,
    terminationConditionMet: miss.terminationConditionMet,

    confirmedDraw: latestDraw ? numOrNull(latestDraw.managerFinancing) : null,
    confirmedDrawMonth: latestDraw?.month ?? null,
    adjustmentPct: latestDraw ? numOrNull(latestDraw.adjustmentPct) : null,

    // >10% clause-5.3 flag — a STATUS on this surface, never a UM action.
    hasAdjFlag: !!activeAdj,
    adjFlagPct: activeAdj ? numOrNull(activeAdj.adjustmentPct) : null,
    adjFlagMonth: activeAdj?.month ?? null,

    runningBalance,
    ceiling: ceil,
    isSurplus,
    overCeiling,
    basisSource,

    // The full ledger + terms travel with the row so the read-only drawer needs no
    // second fetch (the fan-out already paid for this agent's reads).
    terms,
    ledger: rows,
  };
}

/**
 * Unit aggregates for the reality strip. Computed ONLY from the fully-resolved
 * row set — the caller MUST NOT pass a partial fan-out (Compliance-v2 pattern:
 * never imply a complete unit picture from a partial read).
 */
export function computeRosterAggregates(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const sum = (pick) => list.reduce((acc, r) => acc + (numOrNull(pick(r)) ?? 0), 0);

  return {
    onFinancing:        list.length,
    totalDrawn:         sum((r) => r.runningBalance),
    confirmedThisMonth: sum((r) => r.confirmedDraw),
    // At risk = an amber/critical miss streak (>=2) OR an open >10% adjustment flag.
    atRisk:             list.filter((r) => r.missSeverity !== 'none' || r.hasAdjFlag).length,
    twoPlusMisses:      list.filter((r) => r.missCount >= MISS_AMBER_AT).length,
    adjWithBm:          list.filter((r) => r.hasAdjFlag).length,
  };
}
