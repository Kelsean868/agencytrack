/**
 * deriveFromLedger.js — works out the seven persistency inputs for a report
 * month from the agent's policy ledger, instead of the agent typing them.
 *
 * PURE. No Firestore, no clock. The caller supplies the docs, the report month
 * and the export date. Feeds `deriveAll()` in `./calculations.js`; it does NOT
 * reimplement the formula, and it does not change any stored field id.
 *
 * WHAT THIS MODULE IS AND IS NOT:
 * it produces the INPUTS. `calculations.js` owns the arithmetic that turns
 * inputs into a percentage, and `model.js` owns which model a month is on.
 * Three modules, three jobs — a second copy of the formula in here is how the
 * tab and the report start disagreeing.
 *
 * EVERY FIGURE CARRIES ITS POLICY NUMBERS.
 * `evidence` names the policies behind each derived input, and `evidence.excluded`
 * names every in-scope policy that did NOT count and why. A manager who is told
 * an agent is at 86.6% can ask "which policies?" and get an answer. It is also
 * the only way a wrong figure is debuggable after the fact: a bare total tells
 * you nothing about which rule mis-fired.
 *
 * TWO MONTH-KEY FORMATS EXIST IN THIS DOMAIN — a real trap:
 *   • `persistencyModelFor()` and this module take `YYYY-MM` (hyphen)
 *   • `monthsBetweenKeys()` / `enumerateMonthKeys()` take `YYYY_MM` (underscore),
 *     which is also the persistency doc-id form (`{uid}_{YYYY_MM}`)
 * The conversion is done in one place below (`toUnderscoreKey`) rather than
 * inline at each call, so a hyphen key can never reach a helper that would
 * throw on it — or worse, be silently mis-split.
 */

import { deriveAll } from './calculations';
import { monthsBetweenKeys, parseDateOnlyTT } from '../../utils/dateInputs';
import { OIPA_NEVER_PLACED_SUB_STATUSES } from '../portfolioImport/oipaImportConfig';
import { hasLiveDeclaration } from './reinstatementDeclaration';

/**
 * The 24-month window length. ONE constant.
 *
 * `windowMonths` counts the report month itself, so 24 on a 2026-09 report means
 * Oct 2024 through Sep 2026 inclusive. Whether Sep 2024 also belongs is an open
 * question with the CRO (brief open question 2); it is answered by passing 25,
 * not by editing this default.
 */
export const PERSISTENCY_LEDGER_WINDOW_MONTHS = 24;

/**
 * How stale `paidToDate` may be before a SETTLED annuity counts as a lapse under
 * the `lapse` rule. ONE constant. Measured back from the export date, because
 * that is the day the ledger's payment data was true.
 */
export const ANNUITY_PAID_TO_GRACE_DAYS = 60;

/**
 * The per-agent annuity setting: `persistency.annuityMissedPremiumRule`.
 *
 * Deliberately NOT named `legacy` / `tatil24`: `model.js` already uses `tatil24`
 * and `legacy12` for the persistency MODEL (which formula a month is reckoned
 * on), and that is a different axis entirely. Two meanings of `tatil24` on one
 * persistency doc would be read wrong by somebody. (Dispatcher ruling, 16 Sep 2026.)
 *
 *   `ignore` — the old system, and the DEFAULT. Annuities count in Gross Settled,
 *              but a missed premium never makes one a lapse. Only an annuity whose
 *              status is actually `lapsed` counts as a lapse.
 *   `lapse`  — the new system. Everything `ignore` does, PLUS a SETTLED annuity
 *              whose `paidToDate` is more than ANNUITY_PAID_TO_GRACE_DAYS before
 *              the export date counts as a lapse.
 *
 * Neither value ever touches a non-annuity policy.
 */
export const ANNUITY_MISSED_PREMIUM_RULES = Object.freeze(['ignore', 'lapse']);
export const DEFAULT_ANNUITY_MISSED_PREMIUM_RULE = 'ignore';

export const ANNUITY_MISSED_PREMIUM_RULE_LABELS = Object.freeze({
  ignore: 'Annuity missed premiums: ignored (old)',
  lapse:  'Annuity missed premiums: counted as lapse (new)',
});

/** Inputs this module derives from the ledger. */
export const LEDGER_DERIVED_INPUTS = Object.freeze(['businessPlaced', 'notTakens', 'lapses']);

/**
 * Inputs the export does NOT carry. Defaulted to 0 and surfaced as editable with
 * an explicit "not in export" note — never silently zero, because a zero that
 * looks derived is indistinguishable from a real zero on the screen that gates
 * awards. An existing manual entry always wins over the 0.
 */
export const LEDGER_MANUAL_INPUTS = Object.freeze(['decreases', 'incPPPs', 'lumpsums100', 'reinstatements']);

export const MANUAL_INPUT_NOTE = 'not in export — enter manually';

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;
const NEVER_PLACED = new Set(OIPA_NEVER_PLACED_SUB_STATUSES);
const MS_PER_DAY = 86400000;

/** `YYYY-MM` -> `YYYY_MM`, the form the shared month helpers take. */
function toUnderscoreKey(monthKey) {
  return `${monthKey.slice(0, 4)}_${monthKey.slice(5, 7)}`;
}

/** The `YYYY-MM` month a `YYYY-MM-DD` date falls in, or null. */
function monthOf(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null;
  return dateStr.slice(0, 7);
}

/** Shifts a `YYYY-MM` key by whole months. Pure integer math on the ordinal. */
function shiftMonth(monthKey, delta) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const ordinal = year * 12 + (month - 1) + delta;
  const y = Math.floor(ordinal / 12);
  const m = (ordinal % 12) + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** Rounds money to 2dp so repeated float addition cannot drift a reported total. */
const money2 = (n) => Math.round(n * 100) / 100;

/**
 * Was the policy ever PLACED — did it get issued and take money?
 *
 * Placed (brief derivation rule 3): settled, lapsed, NTU-after-issue, and
 * settled-plus-terminal. NOT placed: `denied`, a doc superseded via `replacedBy`,
 * an NTU that was never placed at all (Withdrawn / Insufficient Premium), and
 * anything still in the pipeline (`written`, `submitted`, `rated`, `postponed`).
 *
 * `replacedBy` is checked FIRST and independently of status: the replacement
 * carries the business, so counting both would double-count one sale.
 */
export function wasPlaced(doc) {
  if (doc?.replacedBy) return false;
  const status = doc?.status;
  if (status === 'settled' || status === 'lapsed') return true;
  if (status === 'ntu') return !NEVER_PLACED.has(doc?.oipaSubStatus);
  return false;
}

/**
 * Does this lapse still count against the agent?
 *
 * Brief derivation rule 5. A lapse drops out once the policy has paid 24 months
 * of premium, expressed as `totalPremiumPaid >= 2 × API` because API is one
 * year's premium.
 *
 * A MISSING `totalPremiumPaid` keeps the lapse IN. 98 of the 229 docs in the
 * 15 Sep export have no value, and treating absent as 0 would be the same
 * decision — but treating absent as "paid enough" would quietly forgive a third
 * of the book. The rule is written to fail toward counting the lapse.
 *
 * A `deceased` terminal reason is never a lapse, checked here as well as at the
 * status level so the rule holds even if a future import maps a death to lapsed.
 */
export function lapseStillCounts(doc) {
  if (doc?.terminalReason === 'deceased') return false;
  const paid = num(doc?.totalPremiumPaid);
  const api = num(doc?.proposedAPI);
  if (paid === null) return true;      // missing → stays in
  if (api === null || api <= 0) return true;
  return paid < 2 * api;
}

/**
 * Is this a SETTLED annuity that has stopped paying — the `lapse` rule's addition?
 *
 * Only ever true for `policyClass === 'annuity'`, and only when the rule is
 * `lapse`. A missing `paidToDate` is NOT treated as stale: with no payment date
 * there is no evidence the premium was missed, and inventing a lapse would
 * accuse an agent on absent data.
 */
export function isStaleAnnuity(doc, exportDate, graceDays = ANNUITY_PAID_TO_GRACE_DAYS) {
  if (doc?.policyClass !== 'annuity') return false;
  if (doc?.status !== 'settled') return false;
  if (!doc?.paidToDate || !exportDate) return false;
  const paidTo = parseDateOnlyTT(doc.paidToDate).getTime();
  const asAt = parseDateOnlyTT(exportDate).getTime();
  return (asAt - paidTo) > graceDays * MS_PER_DAY;
}

/**
 * @param {Array<Object>} docs   policy-ledger docs (the P0 parser's output shape)
 * @param {Object} options
 * @param {string} options.monthKey    report month, `YYYY-MM`
 * @param {string} options.exportDate  `YYYY-MM-DD` — the "as at" date of the ledger
 * @param {number} [options.windowMonths]
 * @param {string} [options.annuityMissedPremiumRule]  'ignore' (default) | 'lapse'
 * @param {Object} [options.manual]    existing manual entries; these WIN over 0
 */
export function deriveFromLedger(docs, options = {}) {
  const {
    monthKey,
    exportDate,
    windowMonths = PERSISTENCY_LEDGER_WINDOW_MONTHS,
    annuityMissedPremiumRule = DEFAULT_ANNUITY_MISSED_PREMIUM_RULE,
    manual = {},
  } = options;

  if (typeof monthKey !== 'string' || !MONTH_KEY_RE.test(monthKey)) {
    throw new Error(`deriveFromLedger: monthKey must be "YYYY-MM" (got ${JSON.stringify(monthKey)})`);
  }
  if (!ANNUITY_MISSED_PREMIUM_RULES.includes(annuityMissedPremiumRule)) {
    throw new Error(
      `deriveFromLedger: annuityMissedPremiumRule must be one of ${ANNUITY_MISSED_PREMIUM_RULES.join(' | ')} `
      + `(got ${JSON.stringify(annuityMissedPremiumRule)})`,
    );
  }
  if (!Number.isInteger(windowMonths) || windowMonths < 1) {
    throw new Error(`deriveFromLedger: windowMonths must be a positive integer (got ${windowMonths})`);
  }

  // The window ENDS on the report month and includes it, so a 24-month window
  // reaches back 23 months. Off-by-one here moves a whole month of business.
  const endMonth = monthKey;
  const startMonth = shiftMonth(monthKey, -(windowMonths - 1));
  const startKey = toUnderscoreKey(startMonth);
  const endKey = toUnderscoreKey(endMonth);

  const inWindow = (doc) => {
    const m = monthOf(doc?.dateIssued);
    if (!m) return false;
    const k = toUnderscoreKey(m);
    return monthsBetweenKeys(startKey, k) >= 0 && monthsBetweenKeys(k, endKey) >= 0;
  };

  const evidence = {
    businessPlaced: [],
    notTakens: [],
    lapses: [],
    excluded: {
      notWritingAgent: [],
      noIssueDate: [],
      outsideWindow: [],
      denied: [],
      replaced: [],
      neverPlaced: [],
      stillInPipeline: [],
      lapseClearedBy24mPremium: [],
      deceasedNotLapsed: [],
    },
  };

  let businessPlaced = 0;
  let notTakens = 0;
  let lapses = 0;

  // FR-6 (Option A): counted lapses the agent has DECLARED reinstated while head
  // office still shows them lapsed. Kept apart from every evidenced input —
  // they never enter `inputs` or `derived` (v3 non-negotiable 5).
  let declaredReinstatements = 0;
  const declaredPolicies = [];

  const atRiskAnnuities = [];
  const pendingDeathClaims = [];

  for (const doc of Array.isArray(docs) ? docs : []) {
    const policyNumber = doc?.policyNumber ?? null;

    // Brief derivation rule 1. Orphans and inherited policies stay out of the
    // denominator entirely — they are somebody else's business placed.
    if (doc?.isWritingAgent !== true) {
      evidence.excluded.notWritingAgent.push(policyNumber);
      continue;
    }
    if (!monthOf(doc?.dateIssued)) {
      evidence.excluded.noIssueDate.push(policyNumber);
      continue;
    }
    if (!inWindow(doc)) {
      evidence.excluded.outsideWindow.push(policyNumber);
      continue;
    }

    const api = num(doc.proposedAPI) ?? 0;

    // A pending death claim is surfaced whether or not it counts, so it is not
    // forgotten while a manager stares at the number (brief rule 9).
    if (doc.claimStatus === 'pending') {
      pendingDeathClaims.push({ policyNumber, api, terminalReason: doc.terminalReason ?? null });
    }

    if (!wasPlaced(doc)) {
      if (doc.replacedBy) evidence.excluded.replaced.push(policyNumber);
      else if (doc.status === 'denied') evidence.excluded.denied.push(policyNumber);
      else if (doc.status === 'ntu') evidence.excluded.neverPlaced.push(policyNumber);
      else evidence.excluded.stillInPipeline.push(policyNumber);
      continue;
    }

    // Placed: it enters the denominator.
    businessPlaced += api;
    evidence.businessPlaced.push(policyNumber);

    // Brief derivation rule 4 — Not Takens keys off the OIPA sub status, not the
    // mapped status, because `ntu` also covers Cancelled and the never-placed set.
    if (doc.oipaSubStatus === 'Not Taken') {
      notTakens += api;
      evidence.notTakens.push(policyNumber);
    }

    // Brief derivation rule 5.
    if (doc.status === 'lapsed') {
      if (lapseStillCounts(doc)) {
        lapses += api;
        evidence.lapses.push(policyNumber);
        // The declared amount is the same figure this lapse costs — the agent
        // never types money (recon § 3 Option A).
        if (hasLiveDeclaration(doc)) {
          declaredReinstatements += api;
          declaredPolicies.push(policyNumber);
        }
      } else if (doc.terminalReason === 'deceased') {
        evidence.excluded.deceasedNotLapsed.push(policyNumber);
      } else {
        evidence.excluded.lapseClearedBy24mPremium.push(policyNumber);
      }
      continue;
    }

    // Brief derivation rule 6 — the annuity addition. Recorded as at-risk on
    // EVERY rule setting so the tab can answer "what would the new rule cost?"
    // without re-deriving, then only counted when the rule is `lapse`.
    if (isStaleAnnuity(doc, exportDate)) {
      atRiskAnnuities.push({ policyNumber, api, paidToDate: doc.paidToDate });
      if (annuityMissedPremiumRule === 'lapse') {
        lapses += api;
        evidence.lapses.push(policyNumber);
      }
    }
  }

  // Manual inputs: an existing entry wins; otherwise 0, flagged as not derived.
  const manualValues = {};
  const manualPending = [];
  for (const key of LEDGER_MANUAL_INPUTS) {
    const supplied = num(manual[key]);
    if (supplied === null) {
      manualValues[key] = 0;
      manualPending.push(key);
    } else {
      manualValues[key] = supplied;
    }
  }

  const inputs = {
    businessPlaced: money2(businessPlaced),
    notTakens: money2(notTakens),
    lapses: money2(lapses),
    ...manualValues,
  };

  const derived = deriveAll(inputs);

  // What the OTHER rule setting would produce, so the tab can show the cost of
  // the switch without deriving twice. Computed from the at-risk total rather
  // than by re-running the loop, which is why the at-risk list is collected
  // unconditionally above.
  const atRiskTotal = money2(atRiskAnnuities.reduce((sum, a) => sum + a.api, 0));
  const lapsesUnderIgnore = annuityMissedPremiumRule === 'lapse'
    ? money2(inputs.lapses - atRiskTotal)
    : inputs.lapses;
  const lapsesUnderLapse = annuityMissedPremiumRule === 'lapse'
    ? inputs.lapses
    : money2(inputs.lapses + atRiskTotal);

  const persistencyUnder = (lapseTotal) => deriveAll({ ...inputs, lapses: lapseTotal }).persistency;

  // FR-6 — "with your declared reinstatements": the evidenced inputs plus the
  // declared amount added to Reinstatements. A SEPARATE figure; `inputs`,
  // `derived` and every money reader stay evidenced-only.
  const declaredTotal = money2(declaredReinstatements);
  const declared = {
    reinstatements: declaredTotal,
    policies: declaredPolicies,
    persistency: deriveAll({ ...inputs, reinstatements: money2(inputs.reinstatements + declaredTotal) }).persistency,
  };

  return {
    monthKey,
    exportDate: exportDate ?? null,
    window: { startMonth, endMonth, windowMonths },
    annuityMissedPremiumRule,
    annuityMissedPremiumRuleLabel: ANNUITY_MISSED_PREMIUM_RULE_LABELS[annuityMissedPremiumRule],

    inputs,
    derived,

    /**
     * `counted` is the NUMBER OF POLICIES IN THE DENOMINATOR — the count of docs
     * whose API was added to `businessPlaced`, not a count of lapses, not a count
     * of in-window docs, and not the size of the ledger. Confirmed against the
     * brief's table by dispatcher ruling 4 (16 Sep 2026): it matches
     * `evidence.businessPlaced.length` on all five expected rows (31 / 36 / 28).
     */
    counted: evidence.businessPlaced.length,
    evidence,

    /**
     * FR-6 — declared reinstatements, shown BESIDE the evidenced figure and
     * never inside it: `{ reinstatements, policies, persistency }`. Never feeds
     * money (awards, financing, commission).
     */
    declared,

    /** Which of the seven the export cannot supply, for the "enter manually" note. */
    derivedInputs: [...LEDGER_DERIVED_INPUTS],
    manualInputs: [...LEDGER_MANUAL_INPUTS],
    manualPending,
    manualNote: MANUAL_INPUT_NOTE,

    atRisk: {
      annuities: atRiskAnnuities,
      annuityApiTotal: atRiskTotal,
      pendingDeathClaims,
      lapsesUnderIgnore,
      lapsesUnderLapse,
      persistencyUnderIgnore: persistencyUnder(lapsesUnderIgnore),
      persistencyUnderLapse: persistencyUnder(lapsesUnderLapse),
    },
  };
}
