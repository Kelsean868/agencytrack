/**
 * ledgerPrefill.js — turns a policy ledger into a PREFILL for the persistency
 * form, and decides whether that form may be saved.
 *
 * PURE. No Firestore, no clock, no React.
 *
 * It sits between `deriveFromLedger` (which produces the numbers) and the form
 * (which renders them), because the decision "may this be saved yet?" is
 * business logic, not layout, and it is the one thing here that can put a wrong
 * figure on a screen that gates awards.
 *
 * THE RULE THAT MATTERS (dispatcher ruling 1, 16 Sep 2026):
 * three of the seven inputs are DERIVED from the ledger. The other four are not
 * in the export at all. Those four are left EMPTY — never prefilled with 0 — and
 * the form refuses to save until each has been explicitly entered. Zero is an
 * allowed answer; an unanswered field is not.
 *
 * WHY EMPTY AND NOT ZERO:
 * a 0 that was never entered is indistinguishable, on the saved document and on
 * every later report, from a 0 somebody checked and meant. `savePersistency`
 * already rejects a missing input for exactly this reason on 24-month months —
 * this module makes the form agree with the service instead of quietly handing
 * it four zeros that would pass.
 *
 * AN EXISTING MANUAL ENTRY ALWAYS WINS. If the month was already saved, those
 * values are the starting point and the ledger does not overwrite them: a human
 * who entered a figure outranks a derivation.
 */

import { deriveFromLedger, LEDGER_DERIVED_INPUTS, LEDGER_MANUAL_INPUTS } from './deriveFromLedger';

/** The blocking message the form shows while any manual input is unanswered. */
export const MANUAL_BLOCK_MESSAGE = 'Enter the 4 figures the export does not have.';

/**
 * Month abbreviations, fixed rather than produced by `toLocaleString`.
 *
 * WHY NOT A LOCALE: `toLocaleString('en-GB', { month: 'short' })` renders
 * September as **"Sept"** on this Node's ICU, not "Sep", and the exact spelling
 * varies by ICU version and runtime. That would make a user-visible label on a
 * money surface drift between the developer's machine, CI and production for no
 * reason anyone could see. The tab label is a fixed string, so the source of it
 * is a fixed table.
 */
const MONTH_ABBR = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

/** The provenance tag shown on the tab, e.g. "From portfolio import, 15 Sep 2026". */
export function importProvenanceLabel(exportDate) {
  if (!exportDate || !/^\d{4}-\d{2}-\d{2}$/.test(exportDate)) return null;
  const [y, m, d] = exportDate.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `From portfolio import, ${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

/**
 * Builds the form's starting state from the ledger plus whatever was already saved.
 *
 * @param {Array<Object>} ledgerDocs  the agent's policy docs (imported AND organic —
 *        persistency is the one reader that must NOT exclude imported docs)
 * @param {Object} options
 * @param {string} options.monthKey            `YYYY-MM`
 * @param {string} options.exportDate          `YYYY-MM-DD`, for the provenance tag
 * @param {string} [options.annuityMissedPremiumRule]
 * @param {number} [options.windowMonths]
 * @param {Object} [options.existingRecord]    a previously saved persistency doc
 * @returns {{
 *   values: Object, derivedFields: string[], manualFields: string[],
 *   unanswered: string[], canSave: boolean, blockMessage: ?string,
 *   provenance: ?string, ledger: Object, hasLedger: boolean
 * }}
 */
export function buildLedgerPrefill(ledgerDocs, options = {}) {
  const {
    monthKey, exportDate, annuityMissedPremiumRule, windowMonths, existingRecord = null,
  } = options;

  const ledger = deriveFromLedger(ledgerDocs, {
    monthKey,
    exportDate,
    ...(annuityMissedPremiumRule ? { annuityMissedPremiumRule } : {}),
    ...(windowMonths ? { windowMonths } : {}),
  });

  // A ledger only counts as present if it actually produced something. An agent
  // with no in-window policies gets the plain manual form rather than a screen
  // full of confident zeros.
  const hasLedger = ledger.counted > 0;

  const values = {};

  // Derived three: the ledger's figure, unless a human already saved one.
  for (const id of LEDGER_DERIVED_INPUTS) {
    const saved = existingRecord?.[id];
    values[id] = (saved === undefined || saved === null || saved === '')
      ? (hasLedger ? String(ledger.inputs[id]) : '')
      : String(saved);
  }

  // Manual four: an existing entry, or EMPTY. Never 0.
  for (const id of LEDGER_MANUAL_INPUTS) {
    const saved = existingRecord?.[id];
    values[id] = (saved === undefined || saved === null || saved === '') ? '' : String(saved);
  }

  const unanswered = LEDGER_MANUAL_INPUTS.filter((id) => values[id] === '');

  return {
    values,
    derivedFields: [...LEDGER_DERIVED_INPUTS],
    manualFields: [...LEDGER_MANUAL_INPUTS],
    unanswered,
    canSave: unanswered.length === 0,
    blockMessage: unanswered.length > 0 ? MANUAL_BLOCK_MESSAGE : null,
    provenance: hasLedger ? importProvenanceLabel(exportDate) : null,
    ledger,
    hasLedger,
  };
}

/**
 * Re-evaluates the save gate against the form's CURRENT values.
 *
 * Separate from `buildLedgerPrefill` because the gate has to be re-checked on
 * every keystroke, and re-deriving the whole ledger per keystroke would be both
 * wasteful and a way for the displayed figure to drift from the saved one.
 *
 * A typed `0` answers the field. A blank, or whitespace, does not.
 */
export function manualGate(values) {
  const unanswered = LEDGER_MANUAL_INPUTS.filter((id) => {
    const v = values?.[id];
    return v === undefined || v === null || String(v).trim() === '';
  });
  return {
    unanswered,
    canSave: unanswered.length === 0,
    blockMessage: unanswered.length > 0 ? MANUAL_BLOCK_MESSAGE : null,
  };
}

/**
 * The provenance fields written alongside the figures when a save goes through.
 *
 * `manualConfirmedAt` / `manualConfirmedBy` record that a human answered the
 * four the export cannot supply (dispatcher ruling 1). They are what lets a
 * later reader tell a checked 0 from an unchecked one — the whole point of the
 * save block.
 *
 * The caller supplies `now`; this module holds no clock.
 */
export function manualConfirmationFields({ uid, now }) {
  if (!uid) throw new Error('manualConfirmationFields: uid is required');
  if (!now) throw new Error('manualConfirmationFields: now is required');
  return { manualConfirmedBy: uid, manualConfirmedAt: now };
}
