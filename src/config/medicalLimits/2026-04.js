/**
 * Tatil Life underwriting requirements by age and sum assured.
 * Effective 1 April 2026.
 *
 * SOURCE (both documents held by the operator, transcribed 30 Aug 2026):
 *   · "TATIL LIFE REVISED MEDICAL LIMITS (Effective April 1st, 2026) —
 *      INDIVIDUAL LIFE INSURANCE"
 *   · Internal memo "REVISION OF RATES – LIFESPAN GOLD", Anthony Shaw,
 *     General Manager, 25-MAR-2026 — which states that the medical limits were
 *     updated at the same time and that **the same requirements that apply to
 *     Life products now apply to Critical Illness**.
 *
 * AGE-BAND MAPPING: CONFIRMED against the printed table by the operator on
 * 30 August 2026. The bands (0–15, 16–40, 41–50, 51–60, Over 60) and their
 * pairing to the requirement blocks are correct as written — including the
 * 16–40 / 41–50 pair, which differ only by the chest X-ray at the top tier,
 * the 750,000 breakpoint that only 51–60 uses, and the urine screen being
 * ages 16–60 only. The mapping was originally reconstructed because the PDF's
 * text layer emits its five age headings AFTER their five requirement blocks;
 * that reconstruction has now been checked and stands.
 *
 * ── WHY THIS IS DATA AND NOT A FUNCTION ────────────────────────────────────
 * These change. They changed on 1 April 2026, alongside the LifeSpan Gold
 * rates, and the memo is explicit that a case follows the rules in force when
 * it was received AND submitted. So the file is named for its effective date
 * and the effective date travels with the data — a future revision is a new
 * file beside this one, never an edit to this one. An edit would silently
 * rewrite what was true for cases already written.
 */

/**
 * Requirement tokens the derivation reasons about. Everything else in a tier's
 * list is carried verbatim from the document and is never parsed — it is what
 * gets shown to a human.
 *
 * ⚠ "Non-Medical" IS A FORM, NOT THE ABSENCE OF A REQUIREMENT. It is the
 * questionnaire the agent completes with the client — internally, life
 * application part 2. So the lowest tier is not "nothing to do"; it is "you
 * fill out part 2 yourself, no third party needed". Any UI that renders this
 * level must say so — "Non-Medical form (application part 2)" — because
 * "Non-Medical" on its own reads to an agent, and worse to a client, as
 * "no medical requirement", which is a different promise.
 * (Confirmed by the operator, 30 August 2026.)
 */
export const EXAM_LEVELS = Object.freeze(['Non-Medical', 'Paramedical', 'Medical']);

/**
 * What each exam level actually asks of the client, for display. Keyed by the
 * tokens in EXAM_LEVELS.
 */
export const EXAM_LEVEL_LABELS = Object.freeze({
  'Non-Medical': Object.freeze({
    label: 'Non-Medical form (life application part 2)',
    short: 'Non-Medical form',
    note: 'Completed by the agent with the client. No third-party examiner.',
  }),
  Paramedical: Object.freeze({
    label: 'Paramedical',
    short: 'Paramedical',
    note: 'Examiner visit — not a physician.',
  }),
  Medical: Object.freeze({
    label: 'Medical',
    short: 'Medical',
    note: 'Full medical examination.',
  }),
});

export const MEDICAL_LIMITS_2026_04 = Object.freeze({
  effective: '2026-04-01',
  retrieved: '2026-08-30',
  status: 'VERIFIED_SINGLE_SOURCE',
  bandMappingConfirmed: '2026-08-30',
  ageBasis: 'as stated on the document — confirm whether Tatil reckons this age '
    + 'next birthday before computing an age from a date of birth',
  appliesTo: Object.freeze(['life', 'criticalIllness']),
  source: 'TATIL LIFE REVISED MEDICAL LIMITS (Effective April 1st, 2026); memo '
    + '"Revision of Rates - LifeSpan Gold", A. Shaw (GM), 25-MAR-2026',

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
        Object.freeze({ upTo: 750000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical', 'HIV', 'APS']) }),
        Object.freeze({ upTo: 1000000, exam: 'Paramedical', requirements: Object.freeze(['Paramedical', 'HIV', 'APS']) }),
        Object.freeze({ upTo: null, exam: 'Medical', requirements: Object.freeze(['Medical', 'HIV', 'ECG', 'APS']) }),
      ]),
    }),
    Object.freeze({
      minAge: 16,
      maxAge: 40,
      tiers: Object.freeze([
        Object.freeze({ upTo: 500000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical']) }),
        Object.freeze({
          upTo: 1000000,
          exam: 'Paramedical',
          requirements: Object.freeze(['Paramedical', 'Micro', 'Nicotine', 'HIV', 'Cholesterol', 'HDL', 'Fasting Blood Sugar']),
        }),
        Object.freeze({
          upTo: 2000000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'Micro', 'Nicotine', 'HIV', 'Fasting Lipid Blood Profile (Cholesterol, Trigs, HDL, LDL, VLDL)', 'Fasting Blood Sugar']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (fasting): Alkaline Phosphatase, SGOT, SGPT, GGTP, Creatinine, Cholesterol, Trigs, HDL, LDL, VLDL, Fasting Blood Sugar']),
        }),
      ]),
    }),
    Object.freeze({
      minAge: 41,
      maxAge: 50,
      tiers: Object.freeze([
        Object.freeze({ upTo: 500000, exam: 'Non-Medical', requirements: Object.freeze(['Non-Medical']) }),
        Object.freeze({
          upTo: 1000000,
          exam: 'Paramedical',
          requirements: Object.freeze(['Paramedical', 'Micro', 'Nicotine', 'HIV', 'Cholesterol', 'HDL', 'Fasting Blood Sugar']),
        }),
        Object.freeze({
          upTo: 2000000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'Micro', 'Nicotine', 'HIV', 'Fasting Lipid Blood Profile (Cholesterol, Trigs, HDL, LDL, VLDL)', 'Fasting Blood Sugar']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          // The band's only difference from 16-40: the chest X-ray at the top tier.
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (fasting): Alkaline Phosphatase, SGOT, SGPT, GGTP, Creatinine, Cholesterol, Trigs, HDL, LDL, VLDL, Fasting Blood Sugar', 'Chest X-ray']),
        }),
      ]),
    }),
    Object.freeze({
      minAge: 51,
      maxAge: 60,
      tiers: Object.freeze([
        // NOTE: no Non-Medical band exists from 51. A paramedical is required
        // from the first dollar.
        Object.freeze({
          upTo: 500000,
          exam: 'Paramedical',
          requirements: Object.freeze(['Paramedical', 'Micro', 'Cholesterol', 'HDL', 'Fasting Blood Sugar']),
        }),
        Object.freeze({
          upTo: 750000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Fasting Lipid Blood Profile (Cholesterol, Trigs, HDL, LDL)', 'Fasting Blood Sugar', 'PSA (males only)']),
        }),
        Object.freeze({
          upTo: 2000000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (fasting): Alkaline Phosphatase, SGOT, SGPT, GGTP, Creatinine, Cholesterol, Trigs, HDL, LDL, VLDL, Fasting Blood Sugar', 'PSA (males only)']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (fasting): Alkaline Phosphatase, SGOT, SGPT, GGTP, Creatinine, Cholesterol, Trigs, HDL, LDL, VLDL, Fasting Blood Sugar', 'PSA (males only)', 'Chest X-ray']),
        }),
      ]),
    }),
    Object.freeze({
      minAge: 61,
      maxAge: null,
      tiers: Object.freeze([
        // A Medical from the first dollar, at every sum assured.
        Object.freeze({
          upTo: 500000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'Micro', 'Fasting Lipid Blood Profile (Cholesterol, Trigs, HDL, LDL)', 'Fasting Blood Sugar']),
        }),
        Object.freeze({
          upTo: 1500000,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (fasting): Alkaline Phosphatase, SGOT, SGPT, GGTP, Creatinine, Cholesterol, Trigs, HDL, LDL, VLDL, Fasting Blood Sugar', 'PSA (males only)']),
        }),
        Object.freeze({
          upTo: null,
          exam: 'Medical',
          requirements: Object.freeze(['Medical', 'ECG', 'Micro', 'Nicotine', 'HIV', 'Complete Blood Profile (fasting): Alkaline Phosphatase, SGOT, SGPT, GGTP, Creatinine, Cholesterol, Trigs, HDL, LDL, VLDL, Fasting Blood Sugar', 'PSA (males only)', 'Chest X-ray']),
        }),
      ]),
    }),
  ]),

  /**
   * Rules that cut ACROSS the bands. These are what make a naive "top of the
   * tier" headroom calculation wrong: a 35-year-old issued 1,400,000 sits in
   * the 1,000,001–2,000,000 tier, but going past 1,500,000 pulls in a financial
   * statement and an inspection report. The real no-new-requirements ceiling is
   * 1,500,000, not the tier's 2,000,000.
   */
  universal: Object.freeze([
    Object.freeze({
      from: 3000000,
      minAge: 16,
      maxAge: 60,
      requirement: 'Urine screen for marijuana and cocaine',
    }),
    Object.freeze({ from: 1500000, minAge: 0, maxAge: null, requirement: 'Financial Statement' }),
    Object.freeze({ from: 1500000, minAge: 0, maxAge: null, requirement: 'Inspection report' }),
  ]),

  /**
   * At and above this, the document declines to specify: "Requirements to be
   * determined at the time of underwriting". Headroom cannot be asserted past
   * it, and the derivation refuses to rather than extrapolating.
   */
  determinedAtUnderwritingFrom: 5000000,

  /**
   * "A MEDICAL IS REQUIRED FOR APPLICATIONS WITH DISIBILITY INCOME RIDER FOR
   * ALL SUMS ASSURED" — verbatim, typo included.
   *
   * ⚠ The quiet one. A 100,000 case that is otherwise Non-Medical becomes a
   * Medical the moment a DIR is attached. It is a footnote on the page and a
   * surprised client in the room.
   */
  disabilityIncomeRiderRequiresMedical: true,
});

export default MEDICAL_LIMITS_2026_04;
