// Track K · K4 — thin K3 adapter.
//
// Assembles the selected agent's CURRENT QUARTER from live collections and
// returns the projected bonus breakdown + take-home waterfall. Per-agent,
// current-quarter, projected only — full multi-period / multi-agent assembly
// is K8.
//
// Sourcing notes (dispatcher-locked at Phase 1):
//   notTakenAPI         = 0  (no 'not_taken' policy status today; K8 sources this)
//   reinstatedUnder2yrAPI = 0  (no 'reinstated' policy status today; K8 sources this)
//   isStaff             = undefined  (A.4 inert; no ledger field today)
//   persistency         = 0-1 fraction from persistencyService (no /100 normalisation —
//                         PERS_GATE comparisons in calculations.js confirm fraction scale)

import { getFinancingTerms } from '../services/financingService';
import { getOwnPolicies } from '../services/policiesService';
import { getPersistencyForAgent } from '../services/persistencyService';
import { monthKeyFromDate, monthsBetweenKeys, getTodayTT } from '../utils/dateInputs';
import { computeFinancingBonus } from './financingBonusEngine';
import { computeTakeHome } from './financingTakeHome';
import { DEFAULT_FINANCING_RULESET_2026 } from '../config/financingRuleset/2026';

// Add n whole calendar months to a YYYY_MM key.
function addMonths(key, n) {
  const [y, m] = key.split('_').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}_${String((total % 12) + 1).padStart(2, '0')}`;
}

// Extract a YYYY_MM key from a Firestore Timestamp stored at TT-local midnight
// (04:00 UTC same day — see dateInputs.js parseDateOnlyTT convention).
function monthKeyFromTimestamp(ts) {
  const d = ts.toDate();
  return `${d.getUTCFullYear()}_${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compute projected gross bonus + take-home breakdown for one agent's current
 * agreement quarter.
 *
 * @param {string} tenantId
 * @param {string} agentId
 * @param {object} [ruleset]  — defaults to DEFAULT_FINANCING_RULESET_2026
 * @returns {Promise<null | {
 *   result: object,           // computeFinancingBonus output
 *   takeHome: object,         // computeTakeHome output
 *   financingStatus: string,
 *   yearInAgreement: number,
 *   quarter: number,
 *   effectiveDate: string,
 * }>}
 */
export async function getProjectedBonus(tenantId, agentId, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026;

  const terms = await getFinancingTerms(tenantId, agentId);
  if (!terms?.effectiveDate) return null;

  const { effectiveDate, financingStatus } = terms;

  // ── Agreement position ───────────────────────────────────────────────────
  const today = getTodayTT();
  const effectiveMonthKey = monthKeyFromDate(effectiveDate);
  const currentMonthKey   = monthKeyFromDate(today);
  const totalMonths       = Math.max(0, monthsBetweenKeys(effectiveMonthKey, currentMonthKey));

  const yearInAgreement = Math.min(2, Math.floor(totalMonths / 12) + 1);
  const monthWithinYear = totalMonths % 12;
  const quarter         = Math.floor(monthWithinYear / 3) + 1; // 1–4

  // ── Quarter date range (agreement-relative month keys) ───────────────────
  const qStartOffset = (yearInAgreement - 1) * 12 + (quarter - 1) * 3;
  const qStartKey    = addMonths(effectiveMonthKey, qStartOffset);
  const qEndKey      = addMonths(effectiveMonthKey, qStartOffset + 2);

  // ── Policies for this quarter ────────────────────────────────────────────
  // Q1 of any agreement year: submitted-basis (proposedAPI, any non-lapsed status).
  // Q2+: settled-basis (settledAPI, status === 'settled' only).
  const isQ1 = quarter === 1;

  const allPolicies = await getOwnPolicies(tenantId, agentId);

  const quarterPolicies = allPolicies.filter((pol) => {
    if (!pol.dateSubmitted?.toDate) return false;
    const mk = monthKeyFromTimestamp(pol.dateSubmitted);
    return (
      monthsBetweenKeys(qStartKey, mk) >= 0 &&
      monthsBetweenKeys(mk, qEndKey) >= 0
    );
  });

  const policyLines = quarterPolicies
    .filter((pol) => isQ1 || pol.status === 'settled')
    .map((pol) => ({
      newBusinessType: pol.newBusinessType,
      settledAPI: isQ1
        ? (parseFloat(pol.proposedAPI) || 0)
        : (parseFloat(pol.settledAPI) || 0),
      isSelfOrFamily: pol.isSelfOrFamily === true,
      // isStaff: undefined — A.4 inert, no ledger field today
    }));

  // Lapses within the quarter (surrendered/reinstated = 0; no ledger status today)
  const lapsedSurrenderedUnder2yrAPI = quarterPolicies
    .filter((pol) => pol.status === 'lapsed')
    .reduce((sum, pol) => sum + (parseFloat(pol.settledAPI) || 0), 0);

  // ── Persistency — 0-1 fraction (no normalisation; see sourcing note above) ──
  const persistencyDoc = await getPersistencyForAgent(tenantId, currentMonthKey, agentId);
  const persistency = persistencyDoc?.persistency;

  // ── Assemble K3 input and compute ───────────────────────────────────────
  const engineInput = {
    yearInAgreement,
    quarter,
    policies: policyLines,
    lapsedSurrenderedUnder2yrAPI,
    // notTakenAPI: omitted → engine p() → 0
    // reinstatedUnder2yrAPI: omitted → engine p() → 0
    ...(persistency !== undefined && persistency !== null ? { persistency } : {}),
  };

  const result    = computeFinancingBonus(engineInput, rs);
  const grossBonus = result.consistencyBonus + result.productionBonus;
  const takeHome  = computeTakeHome(grossBonus, financingStatus, rs);

  return { result, takeHome, financingStatus, yearInAgreement, quarter, effectiveDate };
}
