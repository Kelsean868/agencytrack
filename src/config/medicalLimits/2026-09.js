/**
 * Tatil Life underwriting requirements by age and sum assured.
 * Effective 1 September 2026. Supersedes 2026-04.js.
 *
 * SOURCE (both documents held by the operator, transcribed 2 Sep 2026):
 *   · "TATIL LIFE UNDERWRITING REQUIREMENTS SCHEDULE
 *      (Effective September 1st, 2026)"
 *   · Internal memo "Change in Underwriting Requirements Schedule",
 *     John Robinson, Executive, Insurance Operations, 27-AUG-2026 — which
 *     states the effective-date test in one word: the previous schedule
 *     "remains in place for all applications and reinstatements SUBMITTED
 *     prior to" 1 September 2026. April's memo said "received and submitted";
 *     this one says submitted. See `effectiveOn`.
 *
 * ⚠ THE MEMO'S SUMMARY TABLE IS NOT THE SCHEDULE. The memo lists three
 * changes (non-medical 16–50 to 1,500,000; non-medical 51–60 to 500,000;
 * inspection report from 3M). The schedule carries several more — the
 * paramedical tier disappearing between 16 and 60, the 41–50 chest X-ray
 * going, the 0–15 band rewritten, the financial statement ALSO moving to 3M,
 * the urine screen losing its upper age bound, and VLDL leaving the lipid
 * panel. THE SCHEDULE IS ENCODED HERE. Where the two disagree the schedule
 * wins, because the schedule is what underwriting orders from.
 *
 * ── AGE-BAND MAPPING: READ FROM THE RENDERED PAGE, NOT YET OPERATOR-CONFIRMED
 * See `bandMappingNote`. This is the one field on this file that is weaker
 * than its April twin, and it is stated rather than hidden.
 *
 * ── WHY THIS IS A NEW FILE AND NOT AN EDIT ─────────────────────────────────
 * A case submitted on 31 August 2026 is underwritten on the April schedule and
 * must still read the April numbers a year from now. So the effective date
 * travels with the data and each revision is a new file beside the last one.
 * 2026-04.js is NEVER edited.
 */

// The exam levels and their display labels are facts about the FORMS, not
// about any one schedule — "Non-Medical" is life application part 2 whichever
// table sent you there. They live in the April file because that is where they
// were first written; they are re-exported here so a consumer of the current
// table gets them without importing a superseded file by name.
export { EXAM_LEVELS, EXAM_LEVEL_LABELS } from './2026-04';

export const MEDICAL_LIMITS_2026_09 = Object.freeze({
  effective: '2026-09-01',
  retrieved: '2026-09-01',
  transcribed: '2026-09-02',
  status: 'VERIFIED_SINGLE_SOURCE',
  bandMappingConfirmed: '2026-09-02',
  bandMappingNote:
    'Read off the RENDERED page by the brief author on 2 September 2026 — the PDF text layer '
    + 'emits the five age headings AFTER their five requirement blocks, so the pairing cannot be '
    + 'taken from the text layer alone; unlike the April table this mapping has NOT been checked '
    + 'against a printed copy by the operator.',

  // Unchanged from April and carried forward: Tatil reckons AGE NEXT BIRTHDAY,
  // for premiums and for these medical requirements alike. ANB is always
  // attained age + 1. Derive it with ageNextBirthday() in
  // src/utils/medicalRequirements.js; never hand a raw attained age to
  // requirementsFor(). The boundary that costs money is still 50/51, and it
  // costs MORE now than it did in April — a million dollars of non-medical
  // ceiling instead of half a million.
  ageBasis: 'age next birthday (attained age + 1)',
  ageBasisConfirmed: '2026-08-30',

  appliesTo: Object.freeze(['life', 'criticalIllness']),

  /**
   * The effective-date test, in the memo's own word. April's memo said a case
   * follows the rules in force when it was "received AND submitted"; this one
   * says "submitted" alone. limitsInForceOn() is handed the SUBMISSION date.
   */
  effectiveOn: 'submitted',
  supersedes: '2026-04-01',

  source: 'TATIL LIFE UNDERWRITING REQUIREMENTS SCHEDULE (Effective September 1st, 2026); memo '
    + '"Change in Underwriting Requirements Schedule", J. Robinson (Executive, Insurance Operations), 27-AUG-2026',

  /**
   * The two blood panels the schedule names in its footnotes, keyed by the
   * token the tiers use. April had no footnote to point at and flattened the
   * composition into the tier list; September names them, and the LIPID
   * PANEL'S CONTENTS CHANGED between the two tables — VLDL was in April's
   * lipid profile and is not in September's. So the composition belongs beside
   * the date it was true, not in a shared constant.
   *
   * A tier's `requirements` carry the panel NAME, exactly as the page prints
   * it. A display layer that wants the composition looks it up here.
   */
  bloodPanels: Object.freeze({
    'Lipid Blood Profile (Fasting)': Object.freeze([
      'Cholesterol', 'Trigs', 'HDL', 'LDL', 'Fasting Blood Sugar',
    ]),
    'Complete Blood Profile (Fasting)': Object.freeze([
      'Cholesterol', 'Trigs', 'HDL', 'LDL', 'VLDL', 'Alkaline Phosphatase',
      'SGOT', 'SGPT', 'GGTP', 'Creatinine', 'Fasting Blood Sugar',
    ]),
  }),

  /**
   * The tier is picked on the TOTAL RISK AMOUNT, not on the new application
   * alone. Stated on the schedule and repeated in the memo. This is what
   * `otherCoverLast12Months` on requirementsFor() / headroomFor() is for.
   */
  aggregation: Object.freeze({
    basis: 'total risk / coverage amount',
    statement:
      'THE TOTAL RISK/ COVERAGE AMOUNT IS USED TO DETERMINE THE ROUTINE REQUIREMENTS TO BE ORDERED: '
      + 'Requirements are to be ordered based on all new Life and Critical Illness application(s), '
      + 'reinstatements, increases in sum assured, alterations, and existing insurance issued or '
      + 'reinstated within the last 12 months. Term Riders should be added to Whole Life sum assured.',
    // Deliberately NOT a second input to the derivation. One number in, one
    // assessed number out — a `termRiderAmount` field is how two callers fold
    // the same rider in twice.
    termRiders: 'Term riders on a whole-life base are the CALLER\'S job to fold into sumAssured '
      + 'before calling. The derivation takes one sum assured and one aggregate, nothing else.',
  }),

  /**
   * One entry per age band. `tiers` are ascending by `upTo`; the last tier in
   * each band carries `upTo: null`, meaning "and above".
   */
  bands: Object.freeze([
    Object.freeze({
      minAge: 0,
      maxAge: 15,
      tiers: Object.freeze([
        Object.freeze({ upTo: 500000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical']) }),
        // April asked for an HIV test here too. September does not — HIV on a
        // child now starts at 1,500,001.
        Object.freeze({ upTo: 750000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical', 'APS']) }),
        // The ONLY Paramedical tier left on the whole schedule. It is why
        // 'Paramedical' stays in EXAM_LEVELS.
        Object.freeze({ upTo: 1500000, exam: 'Paramedical', requirements: Object.freeze(['Paramedical', 'APS']) }),
        // April put an ECG at the top of this band. September does not.
        Object.freeze({ upTo: null, exam: 'Medical', requirements: Object.freeze(['Medical', 'HIV', 'APS']) }),
      ]),
    }),
    Object.freeze({
      minAge: 16,
      maxAge: 40,
      tiers: Object.freeze([
        Object.freeze({ upTo: 1500000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical']) }),
        Object.freeze({
          upTo: 2000000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'Micro', 'Nicotine', 'HIV', 'Lipid Blood Profile (Fasting)']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (Fasting)']),
        }),
      ]),
    }),
    // 41–50 is now IDENTICAL to 16–40 — the chest X-ray that used to sit at
    // the top of this band is gone. It is written out in full rather than
    // aliased to the band above: they are two rows on the page, a future
    // revision may split them again, and an alias would hide that.
    Object.freeze({
      minAge: 41,
      maxAge: 50,
      tiers: Object.freeze([
        Object.freeze({ upTo: 1500000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical']) }),
        Object.freeze({
          upTo: 2000000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'Micro', 'Nicotine', 'HIV', 'Lipid Blood Profile (Fasting)']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (Fasting)']),
        }),
      ]),
    }),
    Object.freeze({
      minAge: 51,
      maxAge: 60,
      tiers: Object.freeze([
        // NEW IN SEPTEMBER: there IS a non-medical band from 51 now. In April
        // a 51-year-old needed a paramedical from the first dollar.
        Object.freeze({ upTo: 500000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical']) }),
        Object.freeze({
          upTo: 750000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Lipid Blood Profile (Fasting)', 'PSA (males only)']),
        }),
        Object.freeze({
          upTo: 2000000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (Fasting)', 'PSA (males only)']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (Fasting)', 'PSA (males only)', 'Chest X-ray']),
        }),
      ]),
    }),
    Object.freeze({
      minAge: 61,
      maxAge: null,
      tiers: Object.freeze([
        // A Medical from the first dollar, at every sum assured. Unchanged.
        Object.freeze({
          upTo: 500000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'Micro', 'Lipid Blood Profile (Fasting)']),
        }),
        Object.freeze({
          upTo: 1500000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (Fasting)', 'PSA (males only)']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (Fasting)', 'PSA (males only)', 'Chest X-ray']),
        }),
      ]),
    }),
  ]),

  /**
   * Rules that cut ACROSS the bands. All three now bite at 3,000,000 — in
   * April the financial statement and the inspection report started at
   * 1,500,000, which is exactly where the 16–50 non-medical ceiling now sits.
   * The urine screen has lost its upper age bound: `maxAge: null` means a
   * 70-year-old at 3,000,000 gets one, where in April they did not.
   */
  universal: Object.freeze([
    Object.freeze({
      from: 3000000,
      minAge: 16,
      maxAge: null,
      requirement: 'Urine screen for marijuana and cocaine',
    }),
    Object.freeze({
      from: 3000000,
      minAge: 0,
      maxAge: null,
      requirement: 'Confidential Financial Statement / Proof of Income for Self Employed',
    }),
    Object.freeze({ from: 3000000, minAge: 0, maxAge: null, requirement: 'Inspection report' }),
  ]),

  /**
   * At and above this, the document declines to specify: "Requirements to be
   * determined at the time of underwriting". Headroom cannot be asserted past
   * it, and the derivation refuses to rather than extrapolating. Unchanged
   * from April.
   */
  determinedAtUnderwritingFrom: 5000000,

  /**
   * "A MEDICAL IS REQUIRED FOR APPLICATIONS WITH DISABILITY INCOME RIDER FOR
   * ALL SUMS ASSURED" — verbatim. (April's page spelled it "DISIBILITY"; the
   * September page spells it correctly. Same rule, corrected typo.)
   *
   * ⚠ The quiet one. A 100,000 case that is otherwise Non-Medical becomes a
   * Medical the moment a DIR is attached. It is a footnote on the page and a
   * surprised client in the room.
   */
  disabilityIncomeRiderRequiresMedical: true,
});

export default MEDICAL_LIMITS_2026_09;
