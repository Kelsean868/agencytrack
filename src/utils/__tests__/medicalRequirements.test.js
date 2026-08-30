import { describe, it, expect } from 'vitest';
import {
  requirementsFor,
  headroomFor,
  bandFor,
  limitsInForceOn,
} from '../medicalRequirements';
import { MEDICAL_LIMITS_2026_04 } from '../../config/medicalLimits/2026-04';

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
    const band = bandFor(age);
    const last = [...band.tiers].reverse().find((t) => t.exam === exam);
    return last ? last.upTo : null;
  };

  it('every key figure matches what the table actually produces', () => {
    expect(topOf(30, 'Non-Medical')).toBe(KEY_FIGURES.nonMedicalLimit16to50);
    expect(topOf(50, 'Non-Medical')).toBe(KEY_FIGURES.nonMedicalLimit16to50);
    expect(topOf(10, 'Non-Medical')).toBe(KEY_FIGURES.nonMedicalLimitChildWithHivAps);
    expect(topOf(KEY_FIGURES.firstAgeWithNoNonMedicalBand, 'Non-Medical')).toBeNull();
    expect(bandFor(KEY_FIGURES.firstAgeRequiringMedicalFromFirstDollar).tiers[0].exam)
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
      expect(requirementsFor({ age, sumAssured: 500000 }).exam).toBe('Non-Medical');
      expect(requirementsFor({ age, sumAssured: 500001 }).exam).toBe('Paramedical');
    }
  });

  it('stretches to 750,000 for a child, with HIV and an APS', () => {
    const r = requirementsFor({ age: 10, sumAssured: 750000 });
    expect(r.exam).toBe('Non-Medical');
    expect(r.requirements).toEqual(expect.arrayContaining(['HIV', 'APS']));
  });

  it('DOES NOT EXIST from 51 — paramedical from the first dollar', () => {
    // The one that catches people out: a small policy for a 52-year-old is not
    // a quick policy.
    expect(requirementsFor({ age: 51, sumAssured: 1 }).exam).toBe('Paramedical');
    expect(requirementsFor({ age: 60, sumAssured: 100000 }).exam).toBe('Paramedical');
  });

  it('and over 60 it is a full Medical from the first dollar', () => {
    expect(requirementsFor({ age: 61, sumAssured: 1 }).exam).toBe('Medical');
    expect(requirementsFor({ age: 80, sumAssured: 50000 }).exam).toBe('Medical');
  });
});

describe('the Disability Income Rider override', () => {
  // "A MEDICAL IS REQUIRED FOR APPLICATIONS WITH DISIBILITY INCOME RIDER FOR
  // ALL SUMS ASSURED." A footnote on the page; a surprised client in the room.
  it('turns a Non-Medical case into a Medical one', () => {
    const without = requirementsFor({ age: 30, sumAssured: 100000 });
    const with_ = requirementsFor({ age: 30, sumAssured: 100000, hasDisabilityIncomeRider: true });
    expect(without.exam).toBe('Non-Medical');
    expect(with_.exam).toBe('Medical');
    expect(with_.requirements).toContain('Medical');
    expect(with_.requirements.join(' ')).toMatch(/Disability Income Rider/);
  });

  it('applies at every age and every sum assured', () => {
    for (const age of [0, 25, 45, 55, 70]) {
      for (const sumAssured of [1000, 500000, 2000000]) {
        expect(requirementsFor({ age, sumAssured, hasDisabilityIncomeRider: true }).exam)
          .toBe('Medical');
      }
    }
  });
});

describe('the universal rules ride on top of the tier', () => {
  it('1,500,000 pulls in a financial statement and an inspection report', () => {
    const under = requirementsFor({ age: 35, sumAssured: 1499999 });
    const over = requirementsFor({ age: 35, sumAssured: 1500000 });
    expect(under.requirements).not.toContain('Financial Statement');
    expect(over.requirements).toEqual(
      expect.arrayContaining(['Financial Statement', 'Inspection report']),
    );
  });

  it('3,000,000 adds a urine screen for 16 to 60, and not outside it', () => {
    expect(requirementsFor({ age: 35, sumAssured: 3000000 }).requirements)
      .toContain('Urine screen for marijuana and cocaine');
    expect(requirementsFor({ age: 65, sumAssured: 3000000 }).requirements)
      .not.toContain('Urine screen for marijuana and cocaine');
    expect(requirementsFor({ age: 10, sumAssured: 3000000 }).requirements)
      .not.toContain('Urine screen for marijuana and cocaine');
  });

  it('from 5,000,000 the table refuses to say, and so does this', () => {
    const r = requirementsFor({ age: 35, sumAssured: 5000000 });
    expect(r.determinedAtUnderwriting).toBe(true);
    expect(r.requirements.join(' ')).toMatch(/determined at the time of underwriting/);
  });
});

describe('headroom — the offer', () => {
  it('THE CASE THIS WAS BUILT FOR: 35, issued 600,000', () => {
    // The client did a paramedical and bloods for 600,000. That same evidence
    // runs to 1,000,000 — 400,000 of cover available for nothing further.
    const h = headroomFor({ age: 35, issuedCoverage: 600000 });
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
    const h = headroomFor({ age: 55, issuedCoverage: 750000 });
    expect(h.ceiling).toBe(750000);
    expect(h.headroom).toBe(0);
    expect(h.free).toBe(false);
    expect(h.nextStep.adds.join(' ')).toMatch(/Complete Blood Profile/);
  });

  it('...but one dollar into that tier, the headroom is real', () => {
    // Issued 800,000: the complete profile HAS been done, and it carries to
    // 2,000,000 — clamped to 1,499,999 by the financial-statement threshold.
    const h = headroomFor({ age: 55, issuedCoverage: 800000 });
    expect(h.ceiling).toBe(1499999);
    expect(h.headroom).toBe(699999);
    expect(h.free).toBe(true);
    expect(h.clampedBy).toBe('universal');
  });

  it('CLAMPS AT A UNIVERSAL THRESHOLD, not the tier ceiling', () => {
    // 35, issued 1,400,000: the tier runs to 2,000,000, so the naive answer is
    // 600,000 of headroom. Wrong — past 1,500,000 the client owes a financial
    // statement and an inspection report. The honest free number is 100,000.
    const h = headroomFor({ age: 35, issuedCoverage: 1400000 });
    expect(h.ceiling).toBe(1499999);
    expect(h.headroom).toBe(99999);
    expect(h.clampedBy).toBe('universal');
    expect(h.nextStep.adds).toEqual(
      expect.arrayContaining(['Financial Statement', 'Inspection report']),
    );
  });

  it('names what the next step would cost, so the offer can be honest about it', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 900000 });
    expect(h.ceiling).toBe(1000000);
    expect(h.nextStep.at).toBe(1000001);
    // Paramedical → Medical is a real ask, and the client must be told.
    expect(h.nextStep.adds).toContain('Medical');
  });

  it('is zero at the top of a tier rather than negative', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 1000000 });
    expect(h.headroom).toBe(0);
    expect(h.free).toBe(false);
  });

  it('asserts nothing at or above 5,000,000', () => {
    const h = headroomFor({ age: 35, issuedCoverage: 5000000 });
    expect(h.ok).toBe(true);
    expect(h.ceiling).toBeNull();
    expect(h.headroom).toBe(0);
    expect(h.free).toBe(false);
    expect(h.clampedBy).toBe('underwriting-ceiling');
  });

  it('never offers past 5,000,000 by way of the top tier', () => {
    // The top tier is open-ended, so an unclamped implementation would happily
    // report headroom into eight figures.
    const h = headroomFor({ age: 35, issuedCoverage: 4000000 });
    expect(h.ceiling).toBe(4999999);
    expect(h.clampedBy).toBe('underwriting-ceiling');
  });

  it('a child at 500,000 has no free headroom — the next tier adds HIV and an APS', () => {
    // Same boundary lesson as the 55-year-old. Non-Medical to 500,000; the
    // 500,001–750,000 tier is still "Non-Medical" as an exam level but asks for
    // an HIV test and an attending physician statement on top. Not free.
    const h = headroomFor({ age: 12, issuedCoverage: 500000 });
    expect(h.ceiling).toBe(500000);
    expect(h.headroom).toBe(0);
    expect(h.nextStep.adds).toEqual(expect.arrayContaining(['HIV', 'APS']));
  });

  it('a child at 600,000 runs to 750,000 on evidence already given', () => {
    const h = headroomFor({ age: 12, issuedCoverage: 600000 });
    expect(h.ceiling).toBe(750000);
    expect(h.headroom).toBe(150000);
    expect(h.free).toBe(true);
  });
});

describe('refusals', () => {
  it('refuses a nonsense age rather than picking a band', () => {
    expect(requirementsFor({ age: -1, sumAssured: 100000 }).ok).toBe(false);
    expect(requirementsFor({ age: NaN, sumAssured: 100000 }).ok).toBe(false);
    expect(bandFor(-1)).toBeNull();
  });

  it('refuses a non-positive sum assured', () => {
    for (const bad of [0, -5, NaN, Infinity, '500000', null, undefined]) {
      expect(requirementsFor({ age: 30, sumAssured: bad }).ok).toBe(false);
    }
  });
});

describe('effective dating', () => {
  // A case follows the rules in force when it was written and submitted — the
  // 25-Mar-2026 memo is explicit. Reading an old case against today's table
  // would quietly restate what was true at the time.
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
