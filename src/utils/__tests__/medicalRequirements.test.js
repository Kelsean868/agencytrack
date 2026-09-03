import { describe, it, expect } from 'vitest';
import {
  requirementsFor,
  headroomFor,
  bandFor,
  limitsInForceOn,
  ageNextBirthday,
  CURRENT_MEDICAL_LIMITS,
} from '../medicalRequirements';
import {
  MEDICAL_LIMITS_2026_04,
  EXAM_LEVELS,
  EXAM_LEVEL_LABELS,
} from '../../config/medicalLimits/2026-04';
import { MEDICAL_LIMITS_2026_09 } from '../../config/medicalLimits/2026-09';

// ═══════════════════════════════════════════════════════════════════════════
// APRIL 2026 — the superseded table.
//
// Every call in this half passes `table: MEDICAL_LIMITS_2026_04` EXPLICITLY,
// and not one assertion below changed value when September landed. That is the
// proof the new file did not touch the old one: a case submitted on 31 August
// 2026 still reads exactly what it read on 30 August.
// ═══════════════════════════════════════════════════════════════════════════

describe('the table itself', () => {
  it('covers every age from 0 upward with exactly one band', () => {
    for (const age of [0, 15, 16, 40, 41, 50, 51, 60, 61, 75, 99]) {
      const hits = MEDICAL_LIMITS_2026_04.bands.filter(
        (b) => age >= b.minAge && (b.maxAge === null || age <= b.maxAge),
      );
      expect(hits, 'age ' + age).toHaveLength(1);
    }
  });

  it('has ascending tiers, each band ending in an open-ended one', () => {
    for (const band of MEDICAL_LIMITS_2026_04.bands) {
      const ups = band.tiers.map((t) => t.upTo);
      expect(ups[ups.length - 1]).toBeNull();
      const finite = ups.slice(0, -1);
      expect(finite).toEqual([...finite].sort((a, b) => a - b));
    }
  });

  it('carries its effective date and source, because these change', () => {
    expect(MEDICAL_LIMITS_2026_04.effective).toBe('2026-04-01');
    expect(MEDICAL_LIMITS_2026_04.source).toMatch(/April 1st, 2026/);
    // The memo extended the life requirements to critical illness.
    expect(MEDICAL_LIMITS_2026_04.appliesTo).toContain('criticalIllness');
  });

  it('records that the age-band mapping was checked against the printed table', () => {
    // It was reconstructed from PDF layout on 30 Aug 2026 and confirmed the
    // same day. If a future revision is transcribed and NOT confirmed, this
    // field is what says so.
    expect(MEDICAL_LIMITS_2026_04.bandMappingConfirmed).toBe('2026-08-30');
  });

  it('keeps the 750,000 breakpoint to the two bands that actually use it', () => {
    const with750 = MEDICAL_LIMITS_2026_04.bands
      .filter((b) => b.tiers.some((t) => t.upTo === 750000))
      .map((b) => b.minAge);
    expect(with750).toEqual([0, 51]);
  });

  it('bounds the urine screen to ages 16-60, not to everyone', () => {
    const urine = MEDICAL_LIMITS_2026_04.universal.find((u) => /urine/i.test(u.requirement));
    expect(urine).toBeDefined();
    expect(urine.from).toBe(3000000);
    expect(urine.minAge).toBe(16);
    expect(urine.maxAge).toBe(60);
  });
});

describe('what "Non-Medical" actually means', () => {
  // Confirmed by the operator, 30 Aug 2026: Non-Medical is a FORM the agent
  // fills out with the client - internally, life application part 2. It is not
  // the absence of a requirement, and a UI that shows the bare token invites
  // exactly that misreading in front of a client.
  it('explains every exam level the table uses', () => {
    const used = new Set(
      MEDICAL_LIMITS_2026_04.bands.flatMap((b) => b.tiers.map((t) => t.exam)),
    );
    for (const level of used) {
      expect(EXAM_LEVELS, level).toContain(level);
      expect(EXAM_LEVEL_LABELS[level], level).toBeDefined();
      expect(typeof EXAM_LEVEL_LABELS[level].label).toBe('string');
    }
  });

  it('names Non-Medical as the form it is, wherever it is displayed', () => {
    expect(EXAM_LEVEL_LABELS['Non-Medical'].label).toMatch(/application part 2/i);
    expect(EXAM_LEVEL_LABELS['Non-Medical'].label).not.toBe('Non-Medical');
  });
});

describe('the cross-repo contract with the Financial-Planning-App', () => {
  // The same table lives in Financial-Planning-App/parameters/tt-parameters.json
  // under life_underwriting, because that module is where the planning engine
  // gets its provenance and the recommendation side needs to know whether a
  // proposed cover trips a medical.
  //
  // ⚠ NO TEST INSIDE EITHER REPO CAN READ THE OTHER. This is a handshake, not
  // enforcement: both sides assert the SAME figures, so editing either one
  // fails there and names the number that moved. Saying that plainly is the
  // point — a comment claiming the twin is "checked automatically" would be a
  // lie that outlives whoever wrote it.
  const KEY_FIGURES = {
    nonMedicalLimit16to50: 500000,
    nonMedicalLimitChildWithHivAps: 750000,
    firstAgeWithNoNonMedicalBand: 51,
    firstAgeRequiringMedicalFromFirstDollar: 61,
    financialStatementAndInspectionFrom: 1500000,
    urineScreenFromAges16to60: 3000000,
    determinedAtUnderwritingFrom: 5000000,
    disabilityIncomeRiderRequiresMedical: true,
  };

  const topOf = (age, exam) => {
    const band = bandFor(age, MEDICAL_LIMITS_2026_04);
    const last = [...band.tiers].reverse().find((t) => t.exam === exam);
    return last ? last.upTo : null;
  };

  it('every key figure matches what the table actually produces', () => {
    expect(topOf(30, 'Non-Medical')).toBe(KEY_FIGURES.nonMedicalLimit16to50);
    expect(topOf(50, 'Non-Medical')).toBe(KEY_FIGURES.nonMedicalLimit16to50);
    expect(topOf(10, 'Non-Medical')).toBe(KEY_FIGURES.nonMedicalLimitChildWithHivAps);
    expect(topOf(KEY_FIGURES.firstAgeWithNoNonMedicalBand, 'Non-Medical')).toBeNull();
    expect(bandFor(KEY_FIGURES.firstAgeRequiringMedicalFromFirstDollar, MEDICAL_LIMITS_2026_04).tiers[0].exam)
      .toBe('Medical');

    const froms = MEDICAL_LIMITS_2026_04.universal.map((u) => u.from);
    expect(froms).toContain(KEY_FIGURES.financialStatementAndInspectionFrom);
    expect(froms).toContain(KEY_FIGURES.urineScreenFromAges16to60);
    expect(MEDICAL_LIMITS_2026_04.determinedAtUnderwritingFrom)
      .toBe(KEY_FIGURES.determinedAtUnderwritingFrom);
    expect(MEDICAL_LIMITS_2026_04.disabilityIncomeRiderRequiresMedical)
      .toBe(KEY_FIGURES.disabilityIncomeRiderRequiresMedical);
  });
});

describe('the non-medical limit — the number everybody asks for', () => {
  it('is 500,000 for ages 16 to 50', () => {
    for (const age of [16, 30, 40, 41, 50]) {
      expect(requirementsFor({ age, sumAssured: 500000, table: MEDICAL_LIMITS_2026_04 }).exam).toBe('Non-Medical');
      expect(requirementsFor({ age, sumAssured: 500001, table: MEDICAL_LIMITS_2026_04 }).exam).toBe('Paramedical');
    }
  });

  it('stretches to 750,000 for a child, with HIV and an APS', () => {
    const r = requirementsFor({ age: 10, sumAssured: 750000, table: MEDICAL_LIMITS_2026_04 });
    expect(r.exam).toBe('Non-Medical');
    expect(r.requirements).toEqual(expect.arrayContaining(['HIV', 'APS']));
  });

  it('DOES NOT EXIST from 51 — paramedical from the first dollar', () => {
    // The one that catches people out: a small policy for a 52-year-old is not
    // a quick policy.
    expect(requirementsFor({ age: 51, sumAssured: 1, table: MEDICAL_LIMITS_2026_04 }).exam).toBe('Paramedical');
    expect(requirementsFor({ age: 60, sumAssured: 100000, table: MEDICAL_LIMITS_2026_04 }).exam).toBe('Paramedical');
  });

  it('and over 60 it is a full Medical from the first dollar', () => {
    expect(requirementsFor({ age: 61, sumAssured: 1, table: MEDICAL_LIMITS_2026_04 }).exam).toBe('Medical');
    expect(requirementsFor({ age: 80, sumAssured: 50000, table: MEDICAL_LIMITS_2026_04 }).exam).toBe('Medical');
  });
});

describe('the Disability Income Rider override', () => {
  // "A MEDICAL IS REQUIRED FOR APPLICATIONS WITH DISIBILITY INCOME RIDER FOR
  // ALL SUMS ASSURED." A footnote on the page; a surprised client in the room.
  it('turns a Non-Medical case into a Medical one', () => {
    const without = requirementsFor({ age: 30, sumAssured: 100000, table: MEDICAL_LIMITS_2026_04 });
    const with_ = requirementsFor({
      age: 30, sumAssured: 100000, hasDisabilityIncomeRider: true, table: MEDICAL_LIMITS_2026_04,
    });
    expect(without.exam).toBe('Non-Medical');
    expect(with_.exam).toBe('Medical');
    expect(with_.requirements).toContain('Medical');
    expect(with_.requirements.join(' ')).toMatch(/Disability Income Rider/);
  });

  it('applies at every age and every sum assured', () => {
    for (const age of [0, 25, 45, 55, 70]) {
      for (const sumAssured of [1000, 500000, 2000000]) {
        expect(requirementsFor({
          age, sumAssured, hasDisabilityIncomeRider: true, table: MEDICAL_LIMITS_2026_04,
        }).exam).toBe('Medical');
      }
    }
  });
});

describe('the universal rules ride on top of the tier', () => {
  it('1,500,000 pulls in a financial statement and an inspection report', () => {
    const under = requirementsFor({ age: 35, sumAssured: 1499999, table: MEDICAL_LIMITS_2026_04 });
    const over = requirementsFor({ age: 35, sumAssured: 1500000, table: MEDICAL_LIMITS_2026_04 });
    expect(under.requirements).not.toContain('Financial Statement');
    expect(over.requirements).toEqual(
      expect.arrayContaining(['Financial Statement', 'Inspection report']),
    );
  });

  it('3,000,000 adds a urine screen for 16 to 60, and not outside it', () => {
    expect(requirementsFor({ age: 35, sumAssured: 3000000, table: MEDICAL_LIMITS_2026_04 }).requirements)
      .toContain('Urine screen for marijuana and cocaine');
    expect(requirementsFor({ age: 65, sumAssured: 3000000, table: MEDICAL_LIMITS_2026_04 }).requirements)
      .not.toContain('Urine screen for marijuana and cocaine');
    expect(requirementsFor({ age: 10, sumAssured: 3000000, table: MEDICAL_LIMITS_2026_04 }).requirements)
      .not.toContain('Urine screen for marijuana and cocaine');
  });

  it('from 5,000,000 the table refuses to say, and so does this', () => {
    const r = requirementsFor({ age: 35, sumAssured: 5000000, table: MEDICAL_LIMITS_2026_04 });
    expect(r.determinedAtUnderwriting).toBe(true);
    expect(r.requirements.join(' ')).toMatch(/determined at the time of underwriting/);
  });
});

describe('headroom — the offer', () => {
  it('THE CASE THIS WAS BUILT FOR: 35, issued 600,000', () => {
    // The client did a paramedical and bloods for 600,000. That same evidence
    // runs to 1,000,000 — 400,000 of cover available for nothing further.
    const h = headroomFor({ age: 35, issuedCoverage: 600000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(1000000);
    expect(h.headroom).toBe(400000);
    expect(h.free).toBe(true);
    expect(h.clampedBy).toBe('tier');
  });

  it('A TIER BOUNDARY IS NOT HEADROOM, however much it looks like one', () => {
    // 55, issued exactly 750,000. The tempting reading — and the one I wrote
    // into the brief before this test corrected it — is that the client has
    // done "Medical, ECG, PSA" and so runs to 2,000,000 on the same evidence.
    //
    // They do not. 500,001–750,000 asks for a FASTING LIPID profile;
    // 750,001–2,000,000 asks for a COMPLETE one. Same exam, more blood. Sitting
    // exactly at a tier ceiling means the evidence is spent, not spare.
    const h = headroomFor({ age: 55, issuedCoverage: 750000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(750000);
    expect(h.headroom).toBe(0);
    expect(h.free).toBe(false);
    expect(h.nextStep.adds.join(' ')).toMatch(/Complete Blood Profile/);
  });

  it('...but one dollar into that tier, the headroom is real', () => {
    // Issued 800,000: the complete profile HAS been done, and it carries to
    // 2,000,000 — clamped to 1,499,999 by the financial-statement threshold.
    const h = headroomFor({ age: 55, issuedCoverage: 800000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(1499999);
    expect(h.headroom).toBe(699999);
    expect(h.free).toBe(true);
    expect(h.clampedBy).toBe('universal');
  });

  it('CLAMPS AT A UNIVERSAL THRESHOLD, not the tier ceiling', () => {
    // 35, issued 1,400,000: the tier runs to 2,000,000, so the naive answer is
    // 600,000 of headroom. Wrong — past 1,500,000 the client owes a financial
    // statement and an inspection report. The honest free number is 100,000.
    const h = headroomFor({ age: 35, issuedCoverage: 1400000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(1499999);
    expect(h.headroom).toBe(99999);
    expect(h.clampedBy).toBe('universal');
    expect(h.nextStep.adds).toEqual(
      expect.arrayContaining(['Financial Statement', 'Inspection report']),
    );
  });

  it('names what the next step would cost, so the offer can be honest about it', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 900000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(1000000);
    expect(h.nextStep.at).toBe(1000001);
    // Paramedical → Medical is a real ask, and the client must be told.
    expect(h.nextStep.adds).toContain('Medical');
  });

  it('is zero at the top of a tier rather than negative', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 1000000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.headroom).toBe(0);
    expect(h.free).toBe(false);
  });

  it('asserts nothing at or above 5,000,000', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 5000000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ok).toBe(true);
    expect(h.ceiling).toBeNull();
    expect(h.headroom).toBe(0);
    expect(h.free).toBe(false);
    expect(h.clampedBy).toBe('underwriting-ceiling');
  });

  it('never offers past 5,000,000 by way of the top tier', () => {
    // The top tier is open-ended, so an unclamped implementation would happily
    // report headroom into eight figures.
    const h = headroomFor({ age: 35, issuedCoverage: 4000000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(4999999);
    expect(h.clampedBy).toBe('underwriting-ceiling');
  });

  it('a child at 500,000 has no free headroom — the next tier adds HIV and an APS', () => {
    // Same boundary lesson as the 55-year-old. Non-Medical to 500,000; the
    // 500,001–750,000 tier is still "Non-Medical" as an exam level but asks for
    // an HIV test and an attending physician statement on top. Not free.
    const h = headroomFor({ age: 12, issuedCoverage: 500000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(500000);
    expect(h.headroom).toBe(0);
    expect(h.nextStep.adds).toEqual(expect.arrayContaining(['HIV', 'APS']));
  });

  it('a child at 600,000 runs to 750,000 on evidence already given', () => {
    const h = headroomFor({ age: 12, issuedCoverage: 600000, table: MEDICAL_LIMITS_2026_04 });
    expect(h.ceiling).toBe(750000);
    expect(h.headroom).toBe(150000);
    expect(h.free).toBe(true);
  });
});

describe('refusals', () => {
  it('refuses a nonsense age rather than picking a band', () => {
    expect(requirementsFor({ age: -1, sumAssured: 100000, table: MEDICAL_LIMITS_2026_04 }).ok).toBe(false);
    expect(requirementsFor({ age: NaN, sumAssured: 100000, table: MEDICAL_LIMITS_2026_04 }).ok).toBe(false);
    expect(bandFor(-1, MEDICAL_LIMITS_2026_04)).toBeNull();
  });

  it('refuses a non-positive sum assured', () => {
    for (const bad of [0, -5, NaN, Infinity, '500000', null, undefined]) {
      expect(requirementsFor({ age: 30, sumAssured: bad, table: MEDICAL_LIMITS_2026_04 }).ok).toBe(false);
    }
  });
});

describe('effective dating', () => {
  // A case follows the rules in force when it was submitted — the 27-Aug-2026
  // memo is explicit ("submitted prior to"), and the 25-Mar-2026 one said
  // "received AND submitted". Reading an old case against today's table would
  // quietly restate what was true at the time.
  it('returns the April table for a case on or after 1 April 2026', () => {
    expect(limitsInForceOn('2026-04-01')).toBe(MEDICAL_LIMITS_2026_04);
    expect(limitsInForceOn('2026-08-30')).toBe(MEDICAL_LIMITS_2026_04);
  });

  it('returns NOTHING for a case before it, rather than the wrong table', () => {
    expect(limitsInForceOn('2026-03-31')).toBeNull();
    expect(limitsInForceOn('2025-12-01')).toBeNull();
    expect(limitsInForceOn(undefined)).toBeNull();
  });
});

describe('age next birthday - the basis Tatil actually underwrites on', () => {
  // Confirmed by the operator, 30 Aug 2026: Tatil reckons age next birthday for
  // premiums AND for these medical requirements. ANB is always attained age + 1
  // - a constant offset, not a mid-year switch.

  it('is attained age plus one, before and after the birthday', () => {
    // Born 1 July 1976. On 30 Jun 2026 they are 49 attained; on 1 Jul, 50.
    expect(ageNextBirthday('1976-07-01', '2026-06-30')).toBe(50);
    expect(ageNextBirthday('1976-07-01', '2026-07-01')).toBe(51);
    expect(ageNextBirthday('1976-07-01', '2026-07-02')).toBe(51);
  });

  it('steps ON the birthday, not the day after', () => {
    expect(ageNextBirthday('1990-03-15', '2026-03-14')).toBe(36);
    expect(ageNextBirthday('1990-03-15', '2026-03-15')).toBe(37);
  });

  it('gives a newborn 1, not 0', () => {
    expect(ageNextBirthday('2026-08-30', '2026-08-30')).toBe(1);
  });

  it('treats 1 March as the step for a leap-day birth in a common year', () => {
    // A documented choice, not a fact from the table: 2027 has no 29 February.
    expect(ageNextBirthday('2000-02-29', '2027-02-28')).toBe(27);
    expect(ageNextBirthday('2000-02-29', '2027-03-01')).toBe(28);
    // In a leap year the birthday exists and behaves normally.
    expect(ageNextBirthday('2000-02-29', '2028-02-29')).toBe(29);
  });

  it('refuses garbage rather than guessing', () => {
    expect(ageNextBirthday('30-08-2026', '2026-08-30')).toBeNull();
    expect(ageNextBirthday('2026-02-30', '2026-08-30')).toBeNull(); // not a real date
    expect(ageNextBirthday('2026-08-30', '2020-01-01')).toBeNull(); // asOf before birth
    expect(ageNextBirthday(null, '2026-08-30')).toBeNull();
  });
});

describe('the 50/51 boundary - the year that costs money', () => {
  // This is the whole reason the basis had to be settled. A client whose
  // ATTAINED age is 50 is underwritten at 51, and under the APRIL table at 51
  // there is no non-medical band at all. Quoting them off attained age promises
  // a non-medical case and delivers a paramedical.

  const DOB = '1976-01-10'; // turns 50 on 10 Jan 2026, so ANB is 51 from then

  it('sends a client who has just turned 50 to a paramedical at 500,000', () => {
    const r = requirementsFor({
      dateOfBirth: DOB, asOf: '2026-01-10', sumAssured: 500000, table: MEDICAL_LIMITS_2026_04,
    });
    expect(r.ok).toBe(true);
    expect(r.age).toBe(51);
    expect(r.exam).toBe('Paramedical');
  });

  it('...whereas the day BEFORE that birthday the same cover is non-medical', () => {
    const r = requirementsFor({
      dateOfBirth: DOB, asOf: '2026-01-09', sumAssured: 500000, table: MEDICAL_LIMITS_2026_04,
    });
    expect(r.age).toBe(50);
    expect(r.exam).toBe('Non-Medical');
  });

  it('would have been answered WRONG by attained age - the defect this prevents', () => {
    // 50 attained. Passing it raw lands in the 41-50 band and promises a
    // non-medical case; the ANB answer is a paramedical. One day of the
    // client's life apart, two different conversations.
    const byAttained = requirementsFor({ age: 50, sumAssured: 500000, table: MEDICAL_LIMITS_2026_04 });
    const byAnb = requirementsFor({
      dateOfBirth: DOB, asOf: '2026-01-10', sumAssured: 500000, table: MEDICAL_LIMITS_2026_04,
    });
    expect(byAttained.exam).toBe('Non-Medical');
    expect(byAnb.exam).toBe('Paramedical');
  });

  it('carries the same shift into headroom', () => {
    const h = headroomFor({
      dateOfBirth: DOB, asOf: '2026-01-10', issuedCoverage: 400000, table: MEDICAL_LIMITS_2026_04,
    });
    expect(h.ok).toBe(true);
    expect(h.age).toBe(51);
    expect(h.band).toEqual({ minAge: 51, maxAge: 60 });
  });
});

describe('resolving the age - one source of truth, or none', () => {
  it('refuses both an age and a date of birth', () => {
    const r = requirementsFor({
      age: 40, dateOfBirth: '1990-01-01', asOf: '2026-08-30', sumAssured: 100000, table: MEDICAL_LIMITS_2026_04,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not both/);
  });

  it('refuses a date of birth without an asOf, because this module has no clock', () => {
    const r = requirementsFor({ dateOfBirth: '1990-01-01', sumAssured: 100000, table: MEDICAL_LIMITS_2026_04 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/asOf/);
  });

  it('reports an unusable date of birth rather than defaulting to an age', () => {
    const r = requirementsFor({
      dateOfBirth: 'yesterday', asOf: '2026-08-30', sumAssured: 100000, table: MEDICAL_LIMITS_2026_04,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/YYYY-MM-DD/);
    const h = headroomFor({
      dateOfBirth: 'yesterday', asOf: '2026-08-30', issuedCoverage: 100000, table: MEDICAL_LIMITS_2026_04,
    });
    expect(h.ok).toBe(false);
  });

  it('still accepts a hand-computed ANB, and echoes back the age it used', () => {
    const r = requirementsFor({ age: 35, sumAssured: 600000, table: MEDICAL_LIMITS_2026_04 });
    expect(r.ok).toBe(true);
    expect(r.age).toBe(35);
  });
});

describe('the table records the basis it is read on', () => {
  it('says age next birthday, and when that was confirmed', () => {
    expect(MEDICAL_LIMITS_2026_04.ageBasis).toMatch(/next birthday/i);
    expect(MEDICAL_LIMITS_2026_04.ageBasisConfirmed).toBe('2026-08-30');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEPTEMBER 2026 — the table in force, and the default.
//
// Same shape as the April half above, new figures. Everything here reads the
// DEFAULT table, so if the default ever silently reverts these fail.
// ═══════════════════════════════════════════════════════════════════════════

describe('September 2026 — the table itself', () => {
  it('is the default table every function reads', () => {
    expect(CURRENT_MEDICAL_LIMITS).toBe(MEDICAL_LIMITS_2026_09);
    expect(bandFor(35)).toBe(MEDICAL_LIMITS_2026_09.bands.find((b) => b.minAge === 16));
  });

  it('covers every age from 0 upward with exactly one band', () => {
    for (const age of [0, 15, 16, 40, 41, 50, 51, 60, 61, 75, 99]) {
      const hits = MEDICAL_LIMITS_2026_09.bands.filter(
        (b) => age >= b.minAge && (b.maxAge === null || age <= b.maxAge),
      );
      expect(hits, 'age ' + age).toHaveLength(1);
    }
  });

  it('has ascending tiers, each band ending in an open-ended one', () => {
    for (const band of MEDICAL_LIMITS_2026_09.bands) {
      const ups = band.tiers.map((t) => t.upTo);
      expect(ups[ups.length - 1]).toBeNull();
      const finite = ups.slice(0, -1);
      expect(finite).toEqual([...finite].sort((a, b) => a - b));
    }
  });

  it('carries its effective date, what it supersedes, and its source', () => {
    expect(MEDICAL_LIMITS_2026_09.effective).toBe('2026-09-01');
    expect(MEDICAL_LIMITS_2026_09.supersedes).toBe('2026-04-01');
    expect(MEDICAL_LIMITS_2026_09.source).toMatch(/September 1st, 2026/);
    expect(MEDICAL_LIMITS_2026_09.appliesTo).toContain('criticalIllness');
  });

  it('says the effective-date test is the SUBMISSION date, in the memo\'s word', () => {
    // April's memo said "received AND submitted"; the 27-Aug-2026 memo says
    // the old schedule stands for applications "submitted prior to" 1 Sept.
    expect(MEDICAL_LIMITS_2026_09.effectiveOn).toBe('submitted');
  });

  it('admits the band mapping was read off the page, not operator-confirmed', () => {
    // ⚠ THE KNOWN GAP. April's mapping was checked against a printed copy by
    // the operator; September's was read from the rendered PDF by the brief
    // author. The field records the date; the note records the weaker
    // provenance. If this is ever confirmed properly, the note changes.
    expect(MEDICAL_LIMITS_2026_09.bandMappingConfirmed).toBe('2026-09-02');
    expect(MEDICAL_LIMITS_2026_09.bandMappingNote).toMatch(/NOT been checked/i);
    expect(MEDICAL_LIMITS_2026_09.bandMappingNote).toMatch(/rendered/i);
  });

  it('keeps the 750,000 breakpoint to the two bands that still use it', () => {
    const with750 = MEDICAL_LIMITS_2026_09.bands
      .filter((b) => b.tiers.some((t) => t.upTo === 750000))
      .map((b) => b.minAge);
    expect(with750).toEqual([0, 51]);
  });

  it('NO LONGER bounds the urine screen at 60 — it is ages 16 and up', () => {
    const urine = MEDICAL_LIMITS_2026_09.universal.find((u) => /urine/i.test(u.requirement));
    expect(urine).toBeDefined();
    expect(urine.from).toBe(3000000);
    expect(urine.minAge).toBe(16);
    expect(urine.maxAge).toBeNull();
  });

  it('makes 41-50 IDENTICAL to 16-40 — the chest X-ray is gone', () => {
    const b1640 = MEDICAL_LIMITS_2026_09.bands.find((b) => b.minAge === 16);
    const b4150 = MEDICAL_LIMITS_2026_09.bands.find((b) => b.minAge === 41);
    expect(b4150.tiers).toEqual(b1640.tiers);
    // ...and they are still two separate objects, not one aliased twice.
    expect(b4150.tiers).not.toBe(b1640.tiers);
  });

  it('leaves exactly one Paramedical tier on the whole schedule, in 0-15', () => {
    const paramedicalBands = MEDICAL_LIMITS_2026_09.bands
      .filter((b) => b.tiers.some((t) => t.exam === 'Paramedical'))
      .map((b) => b.minAge);
    expect(paramedicalBands).toEqual([0]);
    // Which is why 'Paramedical' stays in EXAM_LEVELS.
    expect(EXAM_LEVELS).toContain('Paramedical');
  });

  it('explains every exam level it uses', () => {
    const used = new Set(
      MEDICAL_LIMITS_2026_09.bands.flatMap((b) => b.tiers.map((t) => t.exam)),
    );
    for (const level of used) {
      expect(EXAM_LEVELS, level).toContain(level);
      expect(EXAM_LEVEL_LABELS[level], level).toBeDefined();
    }
  });

  it('carries the age basis forward unchanged', () => {
    expect(MEDICAL_LIMITS_2026_09.ageBasis).toMatch(/next birthday/i);
    expect(MEDICAL_LIMITS_2026_09.ageBasisConfirmed).toBe('2026-08-30');
  });
});

describe('September 2026 — the blood panels are named, not spelled out', () => {
  const { bloodPanels } = MEDICAL_LIMITS_2026_09;

  it('resolves every panel token any tier asks for', () => {
    const tokens = MEDICAL_LIMITS_2026_09.bands
      .flatMap((b) => b.tiers)
      .flatMap((t) => t.requirements)
      .filter((r) => /Blood Profile/.test(r));
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of new Set(tokens)) {
      expect(Object.keys(bloodPanels), token).toContain(token);
    }
  });

  it('drops VLDL from the lipid panel — it was in April\'s and is not in this one', () => {
    expect(bloodPanels['Lipid Blood Profile (Fasting)']).not.toContain('VLDL');
    expect(bloodPanels['Lipid Blood Profile (Fasting)']).toEqual(
      ['Cholesterol', 'Trigs', 'HDL', 'LDL', 'Fasting Blood Sugar'],
    );
  });

  it('keeps VLDL in the complete panel', () => {
    expect(bloodPanels['Complete Blood Profile (Fasting)']).toContain('VLDL');
    expect(bloodPanels['Complete Blood Profile (Fasting)']).toContain('Creatinine');
  });
});

describe('September 2026 — the cross-repo contract with the Financial-Planning-App', () => {
  // ⚠ Still a handshake, still not enforcement. The twin lives in
  // Financial-Planning-App/parameters/tt-parameters.json under
  // life_underwriting.medical_limits, with these same figures in snake_case.
  // No test in either repo can read the other; both assert the same numbers so
  // an edit on either side fails there and names what moved.
  const KEY_FIGURES_2026_09 = {
    nonMedicalLimit16to50: 1500000,
    nonMedicalLimit51to60: 500000,
    nonMedicalLimitChildWithAps: 750000,
    firstAgeWithNoNonMedicalBand: 61,
    firstAgeRequiringMedicalFromFirstDollar: 61,
    paramedicalUsedOnlyByBand: 0,
    financialStatementAndInspectionFrom: 3000000,
    urineScreenFromAges16Plus: 3000000,
    determinedAtUnderwritingFrom: 5000000,
    disabilityIncomeRiderRequiresMedical: true,
    lipidPanelExcludesVldl: true,
  };

  const topOf = (age, exam) => {
    const band = bandFor(age, MEDICAL_LIMITS_2026_09);
    const last = [...band.tiers].reverse().find((t) => t.exam === exam);
    return last ? last.upTo : null;
  };

  it('every key figure matches what the table actually produces', () => {
    expect(topOf(30, 'Non-Medical')).toBe(KEY_FIGURES_2026_09.nonMedicalLimit16to50);
    expect(topOf(50, 'Non-Medical')).toBe(KEY_FIGURES_2026_09.nonMedicalLimit16to50);
    expect(topOf(55, 'Non-Medical')).toBe(KEY_FIGURES_2026_09.nonMedicalLimit51to60);
    expect(topOf(10, 'Non-Medical')).toBe(KEY_FIGURES_2026_09.nonMedicalLimitChildWithAps);
    expect(topOf(KEY_FIGURES_2026_09.firstAgeWithNoNonMedicalBand, 'Non-Medical')).toBeNull();
    expect(bandFor(KEY_FIGURES_2026_09.firstAgeRequiringMedicalFromFirstDollar, MEDICAL_LIMITS_2026_09).tiers[0].exam)
      .toBe('Medical');

    const paramedicalBands = MEDICAL_LIMITS_2026_09.bands
      .filter((b) => b.tiers.some((t) => t.exam === 'Paramedical'))
      .map((b) => b.minAge);
    expect(paramedicalBands).toEqual([KEY_FIGURES_2026_09.paramedicalUsedOnlyByBand]);

    const froms = MEDICAL_LIMITS_2026_09.universal.map((u) => u.from);
    expect(froms).toContain(KEY_FIGURES_2026_09.financialStatementAndInspectionFrom);
    expect(froms).toContain(KEY_FIGURES_2026_09.urineScreenFromAges16Plus);
    expect(MEDICAL_LIMITS_2026_09.determinedAtUnderwritingFrom)
      .toBe(KEY_FIGURES_2026_09.determinedAtUnderwritingFrom);
    expect(MEDICAL_LIMITS_2026_09.disabilityIncomeRiderRequiresMedical)
      .toBe(KEY_FIGURES_2026_09.disabilityIncomeRiderRequiresMedical);
    expect(!MEDICAL_LIMITS_2026_09.bloodPanels['Lipid Blood Profile (Fasting)'].includes('VLDL'))
      .toBe(KEY_FIGURES_2026_09.lipidPanelExcludesVldl);
  });
});

describe('September 2026 — the non-medical limit, tripled for the working ages', () => {
  it('is 1,500,000 for ages 16 to 50 — it was 500,000 in April', () => {
    for (const age of [16, 30, 40, 41, 50]) {
      expect(requirementsFor({ age, sumAssured: 1500000 }).exam).toBe('Non-Medical');
      // And one dollar past it is a full Medical now, not a paramedical.
      expect(requirementsFor({ age, sumAssured: 1500001 }).exam).toBe('Medical');
    }
  });

  it('EXISTS from 51 now, to 500,000 — in April it did not exist at all', () => {
    expect(requirementsFor({ age: 51, sumAssured: 1 }).exam).toBe('Non-Medical');
    expect(requirementsFor({ age: 60, sumAssured: 500000 }).exam).toBe('Non-Medical');
    expect(requirementsFor({ age: 55, sumAssured: 500001 }).exam).toBe('Medical');
  });

  it('stretches to 750,000 for a child, with an APS — and NO HIV any more', () => {
    const r = requirementsFor({ age: 10, sumAssured: 750000 });
    expect(r.exam).toBe('Non-Medical');
    expect(r.requirements).toContain('APS');
    expect(r.requirements).not.toContain('HIV');
  });

  it('and over 60 it is still a full Medical from the first dollar', () => {
    expect(requirementsFor({ age: 61, sumAssured: 1 }).exam).toBe('Medical');
    expect(requirementsFor({ age: 80, sumAssured: 50000 }).exam).toBe('Medical');
  });
});

describe('September 2026 — the universal rules all moved to 3,000,000', () => {
  it('does NOT pull in a financial statement at 1,500,000 the way April did', () => {
    const r = requirementsFor({ age: 35, sumAssured: 1500000 });
    expect(r.requirements.join(' ')).not.toMatch(/Financial Statement/i);
    expect(r.requirements).not.toContain('Inspection report');
  });

  it('pulls in all three at 3,000,000, and none at 2,999,999', () => {
    const under = requirementsFor({ age: 35, sumAssured: 2999999 });
    const over = requirementsFor({ age: 35, sumAssured: 3000000 });
    expect(under.requirements).not.toContain('Inspection report');
    expect(over.requirements).toEqual(expect.arrayContaining([
      'Urine screen for marijuana and cocaine',
      'Confidential Financial Statement / Proof of Income for Self Employed',
      'Inspection report',
    ]));
  });

  it('NOW screens a 65-year-old too — April stopped the urine screen at 60', () => {
    expect(requirementsFor({ age: 65, sumAssured: 3000000 }).requirements)
      .toContain('Urine screen for marijuana and cocaine');
    // Still not a child, though: the rule is ages 16 and up.
    expect(requirementsFor({ age: 10, sumAssured: 3000000 }).requirements)
      .not.toContain('Urine screen for marijuana and cocaine');
  });

  it('from 5,000,000 the table refuses to say, and so does this', () => {
    const r = requirementsFor({ age: 35, sumAssured: 5000000 });
    expect(r.determinedAtUnderwriting).toBe(true);
    expect(r.requirements.join(' ')).toMatch(/determined at the time of underwriting/);
  });
});

describe('September 2026 — the Disability Income Rider override, unchanged', () => {
  it('turns a Non-Medical case into a Medical one', () => {
    const without = requirementsFor({ age: 30, sumAssured: 100000 });
    const with_ = requirementsFor({ age: 30, sumAssured: 100000, hasDisabilityIncomeRider: true });
    expect(without.exam).toBe('Non-Medical');
    expect(with_.exam).toBe('Medical');
    expect(with_.requirements.join(' ')).toMatch(/Disability Income Rider/);
  });
});

describe('aggregation — the tier is picked on the TOTAL risk amount', () => {
  // The schedule states it and the memo repeats it: requirements are ordered on
  // the new application PLUS everything issued or reinstated on the life in the
  // trailing 12 months. A client with 1,000,000 issued in March and 700,000 in
  // hand is assessed at 1,700,000, and the non-medical ceiling is behind them.

  it('reads the table at sumAssured + otherCoverLast12Months', () => {
    const r = requirementsFor({ age: 35, sumAssured: 700000, otherCoverLast12Months: 1000000 });
    expect(r.ok).toBe(true);
    expect(r.assessedAmount).toBe(1700000);
    expect(r.assumesNoOtherCover).toBe(false);
    expect(r.exam).toBe('Medical');
  });

  it('...where the same 700,000 alone would have been Non-Medical', () => {
    const r = requirementsFor({ age: 35, sumAssured: 700000 });
    expect(r.assessedAmount).toBe(700000);
    expect(r.assumesNoOtherCover).toBe(true);
    expect(r.exam).toBe('Non-Medical');
  });

  it('takes the headroom off the ASSESSED amount, not the issued cover', () => {
    // 700,000 issued + 1,000,000 elsewhere = 1,700,000 assessed, inside the
    // 1,500,001-2,000,000 tier. 300,000 of room, not 1,300,000.
    const h = headroomFor({ age: 35, issuedCoverage: 700000, otherCoverLast12Months: 1000000 });
    expect(h.ok).toBe(true);
    expect(h.assessedAmount).toBe(1700000);
    expect(h.assumesNoOtherCover).toBe(false);
    expect(h.headroom).toBe(300000);
    expect(h.ceiling).toBe(2000000);
    // The universal clamp at 3,000,000 no longer bites first.
    expect(h.clampedBy).toBe('tier');
  });

  it('...and says so honestly when nobody looked the other cover up', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 700000 });
    expect(h.assessedAmount).toBe(700000);
    expect(h.assumesNoOtherCover).toBe(true);
    expect(h.headroom).toBe(800000);
    expect(h.ceiling).toBe(1500000);
  });

  it('DISTINGUISHES an explicit zero from an omission', () => {
    // Omitted means nobody looked. Zero means somebody looked and there is
    // none. The number is the same; the claim the UI may make is not.
    const omitted = requirementsFor({ age: 35, sumAssured: 700000 });
    const explicitZero = requirementsFor({ age: 35, sumAssured: 700000, otherCoverLast12Months: 0 });
    expect(omitted.assessedAmount).toBe(explicitZero.assessedAmount);
    expect(omitted.assumesNoOtherCover).toBe(true);
    expect(explicitZero.assumesNoOtherCover).toBe(false);
  });

  it('refuses a negative or unusable aggregate rather than ignoring it', () => {
    for (const bad of [-1, NaN, Infinity, '1000000']) {
      const r = requirementsFor({ age: 35, sumAssured: 700000, otherCoverLast12Months: bad });
      expect(r.ok, String(bad)).toBe(false);
      expect(r.reason).toMatch(/otherCoverLast12Months/);
    }
  });

  it('can push a case over the 5,000,000 line on the aggregate alone', () => {
    const r = requirementsFor({ age: 35, sumAssured: 1000000, otherCoverLast12Months: 4000000 });
    expect(r.assessedAmount).toBe(5000000);
    expect(r.determinedAtUnderwriting).toBe(true);
  });
});

describe('September 2026 — headroom, the offer', () => {
  it('35, issued 600,000: the non-medical ceiling is 1,500,000 now', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 600000 });
    expect(h.ceiling).toBe(1500000);
    expect(h.headroom).toBe(900000);
    expect(h.free).toBe(true);
    expect(h.clampedBy).toBe('tier');
    // Beyond it: a full Medical and the lipid panel, not a paramedical.
    expect(h.nextStep.at).toBe(1500001);
    expect(h.nextStep.adds).toEqual(expect.arrayContaining([
      'Medical', 'Lipid Blood Profile (Fasting)',
    ]));
  });

  it('30, issued exactly 1,500,000: sitting on the ceiling is not headroom', () => {
    const h = headroomFor({ age: 30, issuedCoverage: 1500000 });
    expect(h.ceiling).toBe(1500000);
    expect(h.headroom).toBe(0);
    expect(h.free).toBe(false);
  });

  it('55, issued 300,000: 200,000 free, where April gave a 51-year-old none', () => {
    const h = headroomFor({ age: 55, issuedCoverage: 300000 });
    expect(h.ceiling).toBe(500000);
    expect(h.headroom).toBe(200000);
    expect(h.free).toBe(true);
    expect(h.clampedBy).toBe('tier');
  });

  it('35, issued 2,500,000: clamped by the universal rules at 2,999,999', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 2500000 });
    expect(h.ceiling).toBe(2999999);
    expect(h.clampedBy).toBe('universal');
    expect(h.nextStep.adds).toEqual(expect.arrayContaining([
      'Urine screen for marijuana and cocaine',
      'Confidential Financial Statement / Proof of Income for Self Employed',
      'Inspection report',
    ]));
  });

  it('asserts nothing at or above 5,000,000', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 5000000 });
    expect(h.ok).toBe(true);
    expect(h.ceiling).toBeNull();
    expect(h.clampedBy).toBe('underwriting-ceiling');
  });
});

describe('September 2026 — effective dating across the two tables', () => {
  it('reads a case submitted 31 August against APRIL', () => {
    expect(limitsInForceOn('2026-08-31')).toBe(MEDICAL_LIMITS_2026_04);
  });

  it('reads a case submitted 1 September against SEPTEMBER', () => {
    expect(limitsInForceOn('2026-09-01')).toBe(MEDICAL_LIMITS_2026_09);
    expect(limitsInForceOn('2027-06-15')).toBe(MEDICAL_LIMITS_2026_09);
  });

  it('still refuses a date before the first table, rather than guessing', () => {
    expect(limitsInForceOn('2026-03-31')).toBeNull();
  });
});

describe('September 2026 — the 50/51 boundary still costs a birthday', () => {
  // Same client, same cover, one day apart. The gap is bigger than April's in
  // absolute terms: 1,500,000 of non-medical ceiling becomes 500,000, and the
  // exam goes straight to a full Medical with bloods and a PSA.
  const DOB = '1976-09-03';

  it('at ANB 50 a 1,000,000 case is Non-Medical', () => {
    const r = requirementsFor({ dateOfBirth: DOB, asOf: '2026-09-02', sumAssured: 1000000 });
    expect(r.ok).toBe(true);
    expect(r.age).toBe(50);
    expect(r.exam).toBe('Non-Medical');
  });

  it('at ANB 51 the same case is a Medical with bloods and a PSA', () => {
    const r = requirementsFor({ dateOfBirth: DOB, asOf: '2026-09-03', sumAssured: 1000000 });
    expect(r.age).toBe(51);
    expect(r.exam).toBe('Medical');
    expect(r.requirements).toEqual(expect.arrayContaining([
      'Complete Blood Profile (Fasting)', 'PSA (males only)',
    ]));
  });

  it('would have been answered WRONG by attained age on BOTH days', () => {
    // Attained 49 and attained 50 both land in the 41-50 band, which is
    // non-medical to 1,500,000. The second answer is wrong by a whole exam.
    expect(requirementsFor({ age: 49, sumAssured: 1000000 }).exam).toBe('Non-Medical');
    expect(requirementsFor({ age: 50, sumAssured: 1000000 }).exam).toBe('Non-Medical');
  });
});
