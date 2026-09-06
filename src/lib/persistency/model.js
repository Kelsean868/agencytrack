// Persistency model selection — which model applies to a given report month.
//
// SOURCE OF TRUTH: Tatil Life inter-departmental memo "Introduction of the
// Updated 24-Month Persistency Model", signed by Amery Rauseo (Executive,
// Business Development), dated 29 August 2026, effective from September 2026
// persistency onwards. The memo retires 12-Month Persistency for AGENT
// reporting and replaces it with the 24-Month model; company reporting
// continues on 24-month, modified to the new model.
//
// WHY THE MODEL IS CHOSEN BY MONTH AND NOT BY A TENANT SWITCH:
// The model is not optional — Tatil dated it. A Company Config
// `persistency.calcModel` switch would let a tenant admin report August on the
// new model or October on the old one, and both are wrong.
// `persistencyModelFor(monthKey)` is the ONLY authority. Docs also carry a
// `modelId` for display provenance, but nothing branches on it.
//
// WHY THE STORED FIELD IDS DO NOT CHANGE:
// Renaming fields on money documents is a migration for a cosmetic gain. The
// stored ids stay legacy (`businessPlaced`, `incPPPs`, `grossSettled`, …); the
// memo's vocabulary lives in the LABELS layer below, which is what users read.
//
// Pure: no clock. The caller supplies the month.
//
// Precedent for effective-dated business rules: src/config/medicalLimits/ plus
// the pure selector in src/utils/medicalRequirements.js. This module is the
// selector half of that pattern; persistency has no dated payload files
// because the memo changes one formula term and one window length, not a table.

/** First report month reckoned on the 24-month model. A `YYYY-MM` monthKey. */
export const PERSISTENCY_MODEL_24M_EFFECTIVE_FROM = '2026-09';

const MEMO_SOURCE =
  'Tatil Life memo "Introduction of the Updated 24-Month Persistency Model", '
  + 'A. Rauseo (Executive, Business Development), 29 Aug 2026';

const LEGACY_SOURCE =
  'E3 formula validated against Tatil\'s Feb 2026 monthly persistency report '
  + '(Mikel Granderson branch, Ricardo Duke row)';

/** The six legacy inputs. Unchanged since E3. */
export const LEGACY_12M_INPUTS = Object.freeze([
  'businessPlaced',
  'notTakens',
  'incPPPs',
  'lumpsums100',
  'lapses',
  'reinstatements',
]);

/**
 * The seven 24-month-model inputs — the six above plus `decreases`, the one
 * term the memo adds. Ordered as the memo states the formula:
 *   Net Gross Settled = Gross Settled − Not Takens − Decreases
 *                       + Increases + 10% Lumpsums
 */
export const TATIL_24M_INPUTS = Object.freeze([
  'businessPlaced',
  'notTakens',
  'decreases',
  'incPPPs',
  'lumpsums100',
  'lapses',
  'reinstatements',
]);

/**
 * Pre-memo vocabulary, kept for legacy-model months so a manager reading an
 * August 2026 figure sees the words that were on the report they transcribed.
 */
export const LEGACY_12M_LABELS = Object.freeze({
  businessPlaced: 'Business Placed',
  notTakens:      'Not Takens',
  incPPPs:        'Inc PPPs',
  lumpsums100:    'Lumpsums (100%)',
  lapses:         'Lapses',
  reinstatements: 'Reinstatements',
  grossSettled:   'Gross Settled',
  netSettled:     'Net Settled',
});

/**
 * The memo's vocabulary. TWO TRAPS worth stating plainly, because the same two
 * words mean different things on either side of this change:
 *
 *   • the memo's "Gross Settled"     is the INPUT   `businessPlaced`
 *   • the memo's "Net Gross Settled" is the DERIVED `grossSettled`
 *   • the memo's "Increases"         is the INPUT   `incPPPs`
 *
 * So a surface that renders the derived denominator as "Gross Settled" after
 * September 2026 is naming it the way the memo names a different number.
 */
export const TATIL_24M_LABELS = Object.freeze({
  businessPlaced: 'Gross Settled',
  notTakens:      'Not Takens',
  decreases:      'Decreases',
  incPPPs:        'Increases',
  lumpsums100:    'Lumpsums (100%)',
  lapses:         'Lapses',
  reinstatements: 'Reinstatements',
  grossSettled:   'Net Gross Settled',
  netSettled:     'Net Settled',
});

/**
 * Default label map for surfaces that are NOT month-aware. The memo's words,
 * per the brief: a surface that cannot tell you which month it is showing must
 * use current vocabulary rather than retired vocabulary.
 */
export const LABELS = TATIL_24M_LABELS;

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

const LEGACY_12M_MODEL = Object.freeze({
  id:           'legacy12',
  windowMonths: 12,
  inputs:       LEGACY_12M_INPUTS,
  labels:       LEGACY_12M_LABELS,
  effectiveFrom: null,
  source:        LEGACY_SOURCE,
});

const TATIL_24M_MODEL = Object.freeze({
  id:           'tatil24',
  windowMonths: 24,
  inputs:       TATIL_24M_INPUTS,
  labels:       TATIL_24M_LABELS,
  effectiveFrom: PERSISTENCY_MODEL_24M_EFFECTIVE_FROM,
  source:        MEMO_SOURCE,
});

/**
 * Which persistency model applies to a report month.
 *
 * @param {string} monthKey `YYYY-MM`
 * @returns {{id: string, windowMonths: number, inputs: string[],
 *            labels: Object, effectiveFrom: ?string, source: string}}
 *
 * THROWS on a malformed monthKey rather than falling back to the legacy model.
 * A silent fallback here would report a month on the wrong model and render a
 * plausible wrong number on a surface that gates awards — the exact failure the
 * month-dating is meant to prevent. Every production caller already validates
 * the key first (`savePersistency` enforces the same regex, and every monthKey
 * reaching a UI surface was written through it), so this throw is unreachable
 * from a well-formed doc and loud from a bad one.
 *
 * Lexicographic `>=` is correct for zero-padded `YYYY-MM`.
 */
export function persistencyModelFor(monthKey) {
  if (typeof monthKey !== 'string' || !MONTH_KEY_RE.test(monthKey)) {
    throw new Error(
      `persistencyModelFor: monthKey must be "YYYY-MM" (got ${JSON.stringify(monthKey)})`,
    );
  }
  return monthKey >= PERSISTENCY_MODEL_24M_EFFECTIVE_FROM
    ? TATIL_24M_MODEL
    : LEGACY_12M_MODEL;
}

/** Convenience predicate. Same throw contract as persistencyModelFor. */
export function isTwentyFourMonthModel(monthKey) {
  return persistencyModelFor(monthKey).id === 'tatil24';
}
