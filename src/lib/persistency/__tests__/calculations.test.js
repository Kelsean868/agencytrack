import { describe, it, expect } from 'vitest';
import {
  calculateGrossSettled,
  calculateNetSettled,
  calculatePersistency,
  deriveAll,
  aggregatePersistency,
  projectPersistency,
  calculateShortfall,
  computeBarStats,
  PERS_FLOOR,
  PERS_GATE,
  PERS_FLOOR_PCT,
  PERS_GATE_PCT,
} from '../calculations';

// Real data from Tatil's February 2026 monthly persistency report,
// Mikel Granderson branch — Ricardo Duke row.
const RICARDO = {
  businessPlaced: 357468.84,
  notTakens: 0,
  incPPPs: 48000,
  lumpsums100: 8666.90,
  lapses: 133600.08,
  reinstatements: 27662.28,
};

const RICARDO_EXPECTED = {
  grossSettled: 406335.53, // 357468.84 + 48000 + 866.69
  netSettled:   300397.73, // 406335.53 - 133600.08 + 27662.28
  persistency:  0.7393,    // 300397.73 / 406335.53 ≈ 0.7393
};

// Branch sub-total from the same Feb 2026 report — Mikel Granderson branch
// aggregated across all agents.
const MIKEL_BRANCH_AGGREGATED = {
  grossSettled: 1126479.43,
  netSettled:    733177.39,
  persistency:        0.6509, // 733177.39 / 1126479.43 ≈ 0.6509
};

describe('calculateGrossSettled', () => {
  it('matches Ricardo Duke Feb 2026 figure (Tatil report validation)', () => {
    expect(calculateGrossSettled(RICARDO)).toBeCloseTo(RICARDO_EXPECTED.grossSettled, 2);
  });

  it('applies the 10% factor only to lumpsums', () => {
    const result = calculateGrossSettled({
      businessPlaced: 100000,
      notTakens: 0,
      incPPPs: 0,
      lumpsums100: 50000,
    });
    // 100000 + 0 + 5000
    expect(result).toBe(105000);
  });

  it('subtracts notTakens from businessPlaced', () => {
    const result = calculateGrossSettled({
      businessPlaced: 100000,
      notTakens: 25000,
      incPPPs: 0,
      lumpsums100: 0,
    });
    expect(result).toBe(75000);
  });

  it('treats missing/null/empty inputs as zero', () => {
    const result = calculateGrossSettled({
      businessPlaced: 100000,
      notTakens: null,
      incPPPs: undefined,
      lumpsums100: '',
    });
    expect(result).toBe(100000);
  });
});

describe('calculateNetSettled', () => {
  it('matches Ricardo Duke Feb 2026 figure', () => {
    expect(calculateNetSettled({
      grossSettled: RICARDO_EXPECTED.grossSettled,
      lapses: RICARDO.lapses,
      reinstatements: RICARDO.reinstatements,
    })).toBeCloseTo(RICARDO_EXPECTED.netSettled, 2);
  });

  it('reinstatements add back to net', () => {
    const result = calculateNetSettled({ grossSettled: 100000, lapses: 30000, reinstatements: 5000 });
    expect(result).toBe(75000);
  });
});

describe('calculatePersistency', () => {
  it('matches Ricardo Duke decimal (0.7393, not 73.93)', () => {
    const p = calculatePersistency({
      netSettled: RICARDO_EXPECTED.netSettled,
      grossSettled: RICARDO_EXPECTED.grossSettled,
    });
    expect(p).toBeCloseTo(0.7393, 4);
    expect(p).toBeLessThan(1); // hard guard against accidentally returning percentage
  });

  it('returns 0 (not NaN) when grossSettled is zero', () => {
    expect(calculatePersistency({ netSettled: 0, grossSettled: 0 })).toBe(0);
    expect(calculatePersistency({ netSettled: 100, grossSettled: 0 })).toBe(0);
  });

  it('can return > 1 when reinstatements outpace lapses (rare but valid)', () => {
    // Net (with big reinstatements) can legitimately exceed Gross
    const p = calculatePersistency({ netSettled: 1100, grossSettled: 1000 });
    expect(p).toBe(1.1);
  });
});

describe('deriveAll', () => {
  it('produces Ricardo Duke full output from raw inputs', () => {
    const out = deriveAll(RICARDO);
    expect(out.grossSettled).toBeCloseTo(RICARDO_EXPECTED.grossSettled, 2);
    expect(out.netSettled).toBeCloseTo(RICARDO_EXPECTED.netSettled, 2);
    expect(out.persistency).toBeCloseTo(RICARDO_EXPECTED.persistency, 4);
  });
});

describe('aggregatePersistency', () => {
  it('sums underlying values then divides — matches Mikel Granderson branch sub-total', () => {
    // Construct two synthetic agents whose sums equal the Mikel branch totals.
    // Ricardo + a synthetic agent = branch total. Persistency on the synthetic
    // agent comes out to (432779.66 / 720143.90) ≈ 0.6010 ≈ 60.1% — different
    // from Ricardo's 73.93%, which is what makes this a useful aggregation
    // test (both agents have non-trivial gross weights).
    const otherAgentGross = MIKEL_BRANCH_AGGREGATED.grossSettled - RICARDO_EXPECTED.grossSettled;
    const otherAgentNet   = MIKEL_BRANCH_AGGREGATED.netSettled   - RICARDO_EXPECTED.netSettled;

    const records = [
      {
        grossSettled: RICARDO_EXPECTED.grossSettled,
        netSettled:   RICARDO_EXPECTED.netSettled,
        lapses:        RICARDO.lapses,
        reinstatements: RICARDO.reinstatements,
        persistency:   RICARDO_EXPECTED.persistency,
      },
      {
        grossSettled: otherAgentGross,
        netSettled:   otherAgentNet,
        lapses:        100000,
        reinstatements: 5000,
        persistency:   otherAgentNet / otherAgentGross,
      },
    ];
    const agg = aggregatePersistency(records);
    expect(agg.sumGrossSettled).toBeCloseTo(MIKEL_BRANCH_AGGREGATED.grossSettled, 2);
    expect(agg.sumNetSettled).toBeCloseTo(MIKEL_BRANCH_AGGREGATED.netSettled, 2);
    expect(agg.aggregatedPersistency).toBeCloseTo(MIKEL_BRANCH_AGGREGATED.persistency, 4);
  });

  it('single-agent aggregation equals that agent\'s persistency', () => {
    const records = [{
      grossSettled: 1000, netSettled: 700, lapses: 300, reinstatements: 0, persistency: 0.7,
    }];
    expect(aggregatePersistency(records).aggregatedPersistency).toBeCloseTo(0.7, 4);
  });

  it('all-zero records aggregate to 0 (not NaN)', () => {
    const records = [{ grossSettled: 0, netSettled: 0, lapses: 0, reinstatements: 0 }];
    const agg = aggregatePersistency(records);
    expect(agg.aggregatedPersistency).toBe(0);
    expect(Number.isNaN(agg.aggregatedPersistency)).toBe(false);
  });

  it('empty array aggregates to all zeros, no NaN', () => {
    const agg = aggregatePersistency([]);
    expect(agg.sumGrossSettled).toBe(0);
    expect(agg.aggregatedPersistency).toBe(0);
  });

  // CRITICAL anti-test (per E3 brief): the average-of-percentages approach
  // produces a different (wrong) number when agents have different gross
  // weights. This test exists to lock in the difference and ensure no future
  // refactor "simplifies" the aggregation by averaging percentages.
  it('produces a DIFFERENT result than the (wrong) average-of-percentages approach', () => {
    const records = [
      { grossSettled: 100,  netSettled: 90,  lapses: 10, reinstatements: 0, persistency: 0.90 },
      { grossSettled: 1000, netSettled: 500, lapses: 500, reinstatements: 0, persistency: 0.50 },
    ];

    const correct = aggregatePersistency(records).aggregatedPersistency;
    // Sum-then-divide: (90 + 500) / (100 + 1000) = 590/1100 ≈ 0.5364
    expect(correct).toBeCloseTo(0.5364, 3);

    const wrongAverage = records.reduce((s, r) => s + r.persistency, 0) / records.length;
    // Average-of-percentages: (0.90 + 0.50) / 2 = 0.70
    expect(wrongAverage).toBeCloseTo(0.70, 3);

    // The two MUST produce a meaningfully different number, otherwise this
    // test isn't actually catching the wrong approach.
    expect(Math.abs(correct - wrongAverage)).toBeGreaterThan(0.10);
  });
});

describe('PERS_FLOOR / PERS_GATE constants', () => {
  it('PERS_FLOOR is 0.80', () => expect(PERS_FLOOR).toBe(0.80));
  it('PERS_GATE is 0.90',  () => expect(PERS_GATE).toBe(0.90));
  it('PERS_FLOOR < PERS_GATE', () => expect(PERS_FLOOR).toBeLessThan(PERS_GATE));
});

// The percent-scale companions exist so that no consumer hand-rolls `* 100` or
// hardcodes 80 / 90. These tests pin BOTH the values and the derivation — a
// literal `80` typed into calculations.js would satisfy the value assertions
// but fail the derivation ones, which is the drift this module guards against.
describe('PERS_*_PCT percent companions', () => {
  it('PERS_FLOOR_PCT is 80', () => expect(PERS_FLOOR_PCT).toBe(80));
  it('PERS_GATE_PCT is 90',  () => expect(PERS_GATE_PCT).toBe(90));

  it('each _PCT is exactly 100x its decimal source (derived, not re-typed)', () => {
    expect(PERS_FLOOR_PCT).toBe(PERS_FLOOR * 100);
    expect(PERS_GATE_PCT).toBe(PERS_GATE * 100);
  });

  it('preserves the floor < gate ordering on the percent scale', () => {
    expect(PERS_FLOOR_PCT).toBeLessThan(PERS_GATE_PCT);
  });

  // ── Anti-collapse guard ──
  // The floor and the gate are TWO DISTINCT money thresholds: the floor drives
  // an at-risk warning band, the gate drives award eligibility. A well-meaning
  // "consolidate the duplicated persistency constant" refactor that unifies
  // them would change agent-facing outcomes in both directions (raising the
  // at-risk flag 80→90, or dropping the award gate 90→80). This test exists to
  // fail loudly if anyone tries.
  it('floor and gate are NOT the same threshold — do not consolidate them', () => {
    expect(PERS_FLOOR).not.toBe(PERS_GATE);
    expect(PERS_FLOOR_PCT).not.toBe(PERS_GATE_PCT);
    expect(PERS_GATE - PERS_FLOOR).toBeCloseTo(0.10, 10);
  });

  // The decimal thresholds must classify a realistic stored value correctly —
  // this is the assertion that fails if either constant is ever retyped on the
  // wrong scale (e.g. PERS_GATE = 90).
  //
  // A previous version of this test also asserted `0.94 < PERS_FLOOR_PCT` and
  // `0.94 < PERS_GATE_PCT` to "prove" the scales are not interchangeable. Those
  // are arithmetic tautologies (0.94 < 80 is true for every possible value of
  // the code under test) — they document the defect rather than guarding
  // against it, and would keep passing after any regression. Removed.
  it('the decimal thresholds classify a realistic stored decimal correctly', () => {
    const decimalPersistency = 0.94; // 94% — comfortably award-eligible
    expect(decimalPersistency >= PERS_GATE).toBe(true);
    expect(decimalPersistency < PERS_FLOOR).toBe(false);
  });
});

describe('computeBarStats', () => {
  const makeRec = (persistency, lapses = 0) => ({
    persistency,
    lapses,
    grossSettled: 1000,
    netSettled:   persistency * 1000,
  });

  it('counts below-floor (< 0.80) and award-eligible (>= 0.90) correctly', () => {
    const records = [
      makeRec(0.72), // below floor
      makeRec(0.80), // exactly at floor — NOT below
      makeRec(0.85), // watch band
      makeRec(0.90), // exactly at gate — eligible
      makeRec(0.95), // eligible
    ];
    const stats = computeBarStats(records);
    expect(stats.belowFloor).toBe(1);
    expect(stats.awardEligible).toBe(2);
    expect(stats.resolvedCount).toBe(5);
  });

  it('excludes partial-resolution records (non-finite persistency) from all counts', () => {
    const records = [
      makeRec(0.70),        // below floor, resolved
      { persistency: null, lapses: 9999, grossSettled: 0, netSettled: 0 }, // no-data
      { persistency: NaN,  lapses: 9999, grossSettled: 0, netSettled: 0 }, // failed read
      makeRec(0.95),        // eligible, resolved
    ];
    const stats = computeBarStats(records);
    expect(stats.resolvedCount).toBe(2);
    expect(stats.belowFloor).toBe(1);
    expect(stats.awardEligible).toBe(1);
    // lapsed TTD must not include the no-data rows' lapses
    expect(stats.sumLapses).toBe(0);
  });

  it('sums lapses only from resolved records', () => {
    const records = [
      makeRec(0.72, 10000),
      makeRec(0.90, 5000),
      { persistency: null, lapses: 99999 }, // excluded
    ];
    expect(computeBarStats(records).sumLapses).toBe(15000);
  });

  it('returns all zeros for empty array (no NaN)', () => {
    const stats = computeBarStats([]);
    expect(stats.resolvedCount).toBe(0);
    expect(stats.belowFloor).toBe(0);
    expect(stats.awardEligible).toBe(0);
    expect(stats.sumLapses).toBe(0);
  });

  it('returns all zeros for null/undefined input (no crash)', () => {
    expect(() => computeBarStats(null)).not.toThrow();
    expect(computeBarStats(undefined).resolvedCount).toBe(0);
  });

  it('all above floor — belowFloor is 0 (celebration arm)', () => {
    const records = [makeRec(0.85), makeRec(0.92), makeRec(0.88)];
    expect(computeBarStats(records).belowFloor).toBe(0);
  });
});

describe('projectPersistency', () => {
  it('new business adds to gross settled', () => {
    const out = projectPersistency({
      currentGrossSettled: 1000,
      currentLapses: 0,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
      newBusinessPlanned: 500,
      newReinstatementsPlanned: 0,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
    });
    expect(out.projectedGrossSettled).toBe(1500);
    expect(out.projectedNetSettled).toBe(1500);
    expect(out.projectedPersistency).toBe(1);
  });

  it('orphans add to gross settled identically to new business', () => {
    const args = {
      currentGrossSettled: 1000,
      currentLapses: 100,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
      newReinstatementsPlanned: 0,
      newLapsesAnticipated: 0,
    };
    const viaNB = projectPersistency({ ...args, newBusinessPlanned: 500, newOrphansAdopted: 0 });
    const viaNO = projectPersistency({ ...args, newBusinessPlanned: 0, newOrphansAdopted: 500 });
    expect(viaNB.projectedPersistency).toBeCloseTo(viaNO.projectedPersistency, 6);
    expect(viaNB.projectedGrossSettled).toBe(viaNO.projectedGrossSettled);
  });

  it('reinstatements add to net only, not gross', () => {
    const out = projectPersistency({
      currentGrossSettled: 1000,
      currentLapses: 200,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
      newBusinessPlanned: 0,
      newReinstatementsPlanned: 100,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
    });
    expect(out.projectedGrossSettled).toBe(1000);
    expect(out.projectedNetSettled).toBe(900); // 1000 - 200 + 100
    expect(out.projectedPersistency).toBe(0.9);
  });

  it('goodBusinessFallingOff reduces gross settled', () => {
    const out = projectPersistency({
      currentGrossSettled: 1000,
      currentLapses: 0,
      currentReinstatements: 0,
      goodBusinessFallingOff: 200,
      newBusinessPlanned: 0,
      newReinstatementsPlanned: 0,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
    });
    expect(out.projectedGrossSettled).toBe(800);
  });

  it('returns 0 persistency (not NaN) if projected gross is zero', () => {
    const out = projectPersistency({
      currentGrossSettled: 100,
      currentLapses: 0,
      currentReinstatements: 0,
      goodBusinessFallingOff: 100,
      newBusinessPlanned: 0,
      newReinstatementsPlanned: 0,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
    });
    expect(out.projectedGrossSettled).toBe(0);
    expect(out.projectedPersistency).toBe(0);
  });
});

describe('calculateShortfall', () => {
  it('returns 0 for all levers when current already meets target', () => {
    const out = calculateShortfall({
      targetPersistency: 0.50,
      currentGrossSettled: 1000,
      currentLapses: 100,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
    });
    // current = (1000 - 100) / 1000 = 0.90 already >> 0.50
    expect(out.nbNeeded).toBe(0);
    expect(out.nrNeeded).toBe(0);
    expect(out.noNeeded).toBe(0);
  });

  it('NB needed satisfies projection back to target', () => {
    const args = {
      targetPersistency: 0.92,
      currentGrossSettled: 1000,
      currentLapses: 200,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
    };
    const { nbNeeded } = calculateShortfall(args);

    // Plug back into projectPersistency to verify it lands at target.
    const projection = projectPersistency({
      currentGrossSettled: args.currentGrossSettled,
      currentLapses: args.currentLapses,
      currentReinstatements: args.currentReinstatements,
      goodBusinessFallingOff: args.goodBusinessFallingOff,
      newBusinessPlanned: nbNeeded,
      newReinstatementsPlanned: 0,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
    });
    expect(projection.projectedPersistency).toBeCloseTo(args.targetPersistency, 4);
  });

  // P4 — extends the zero-case test directly above with a non-zero
  // decreasesAnticipated, and targets PERS_GATE specifically (the Playground's
  // real target) rather than an arbitrary 0.92. Same cross-check shape: solve
  // for nbNeeded via calculateShortfall, then feed it back into
  // projectPersistency and confirm it lands on the gate.
  it('NB needed still satisfies projection back to PERS_GATE with a non-zero decreasesAnticipated', () => {
    const args = {
      targetPersistency: PERS_GATE,
      currentGrossSettled: 1000,
      currentLapses: 200,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
      decreasesAnticipated: 50,
    };
    const { nbNeeded } = calculateShortfall(args);

    const projection = projectPersistency({
      currentGrossSettled: args.currentGrossSettled,
      currentLapses: args.currentLapses,
      currentReinstatements: args.currentReinstatements,
      goodBusinessFallingOff: args.goodBusinessFallingOff,
      decreasesAnticipated: args.decreasesAnticipated,
      newBusinessPlanned: nbNeeded,
      newReinstatementsPlanned: 0,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
    });
    expect(projection.projectedPersistency).toBeCloseTo(PERS_GATE, 4);
  });

  it('NR needed satisfies projection back to target', () => {
    const args = {
      targetPersistency: 0.92,
      currentGrossSettled: 1000,
      currentLapses: 200,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
    };
    const { nrNeeded } = calculateShortfall(args);

    const projection = projectPersistency({
      currentGrossSettled: args.currentGrossSettled,
      currentLapses: args.currentLapses,
      currentReinstatements: args.currentReinstatements,
      goodBusinessFallingOff: args.goodBusinessFallingOff,
      newBusinessPlanned: 0,
      newReinstatementsPlanned: nrNeeded,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
    });
    expect(projection.projectedPersistency).toBeCloseTo(args.targetPersistency, 4);
  });

  it('noNeeded equals nbNeeded (orphans behave identically)', () => {
    const out = calculateShortfall({
      targetPersistency: 0.85,
      currentGrossSettled: 5000,
      currentLapses: 1500,
      currentReinstatements: 200,
      goodBusinessFallingOff: 100,
    });
    expect(out.noNeeded).toBe(out.nbNeeded);
  });

  it('returns Infinity for nbNeeded when target is 1.0 (impossible via NB alone)', () => {
    const out = calculateShortfall({
      targetPersistency: 1.0,
      currentGrossSettled: 1000,
      currentLapses: 100,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
    });
    expect(out.nbNeeded).toBe(Infinity);
    expect(out.noNeeded).toBe(Infinity);
    // NR is the only path to exactly 100% — confirm a finite answer
    expect(Number.isFinite(out.nrNeeded)).toBe(true);
  });

  it('all zero when baseline is non-positive', () => {
    const out = calculateShortfall({
      targetPersistency: 0.92,
      currentGrossSettled: 100,
      currentLapses: 0,
      currentReinstatements: 0,
      goodBusinessFallingOff: 200,
    });
    expect(out.nbNeeded).toBe(0);
    expect(out.nrNeeded).toBe(0);
    expect(out.noNeeded).toBe(0);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Tatil 24-month model — the `decreases` term (memo of 29 Aug 2026)
// ─────────────────────────────────────────────────────────────────────────────

describe('decreases (24-month model term)', () => {
  // THE REGRESSION PIN. `decreases` is effective-dated: it is required only on
  // report months >= '2026-09' and is never back-filled. Every pre-September
  // document and every legacy call site therefore passes the six inputs with no
  // `decreases` key at all, and MUST derive exactly the number it derived before
  // the term existed. If this test ever moves, a historical figure has changed.
  it('is absent from the six-input fixture and leaves every derived figure identical', () => {
    expect('decreases' in RICARDO).toBe(false);

    expect(calculateGrossSettled(RICARDO)).toBeCloseTo(RICARDO_EXPECTED.grossSettled, 2);

    const derived = deriveAll(RICARDO);
    expect(derived.grossSettled).toBeCloseTo(RICARDO_EXPECTED.grossSettled, 2);
    expect(derived.netSettled).toBeCloseTo(RICARDO_EXPECTED.netSettled, 2);
    expect(derived.persistency).toBeCloseTo(RICARDO_EXPECTED.persistency, 4);
  });

  it('treats an explicit 0 exactly like an absent decreases', () => {
    expect(calculateGrossSettled({ ...RICARDO, decreases: 0 }))
      .toBe(calculateGrossSettled(RICARDO));
  });

  it('SUBTRACTS from the denominator (it is not another additive term)', () => {
    const withDecreases = calculateGrossSettled({ ...RICARDO, decreases: 10000 });
    expect(withDecreases).toBeCloseTo(RICARDO_EXPECTED.grossSettled - 10000, 2);
  });

  it('subtracts alongside notTakens rather than replacing it', () => {
    // Memo: Net Gross Settled = Gross Settled − Not Takens − Decreases
    //                           + Increases + 10% Lumpsums
    const result = calculateGrossSettled({
      businessPlaced: 100000,
      notTakens:       10000,
      decreases:        5000,
      incPPPs:          2000,
      lumpsums100:     50000,
    });
    // 100000 − 10000 − 5000 + 2000 + 5000
    expect(result).toBe(92000);
  });

  it('lowers persistency when decreases rise, all else equal', () => {
    // Decreases shrink the denominator while lapses/reinstatements are fixed,
    // so the ratio must fall — a sign error here would raise it.
    const before = deriveAll(RICARDO).persistency;
    const after  = deriveAll({ ...RICARDO, decreases: 50000 }).persistency;
    expect(after).toBeLessThan(before);
  });

  it('flows through deriveAll into netSettled, not only grossSettled', () => {
    const d = deriveAll({ ...RICARDO, decreases: 10000 });
    expect(d.grossSettled).toBeCloseTo(RICARDO_EXPECTED.grossSettled - 10000, 2);
    expect(d.netSettled).toBeCloseTo(RICARDO_EXPECTED.netSettled - 10000, 2);
  });

  it('coerces a numeric string, like every other input', () => {
    expect(calculateGrossSettled({ ...RICARDO, decreases: '10000' }))
      .toBeCloseTo(RICARDO_EXPECTED.grossSettled - 10000, 2);
  });

  it('treats null / empty string / garbage as 0 via num()', () => {
    const base = calculateGrossSettled(RICARDO);
    for (const v of [null, undefined, '', 'abc', NaN]) {
      expect(calculateGrossSettled({ ...RICARDO, decreases: v })).toBeCloseTo(base, 2);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 — `decreasesAnticipated` on projectPersistency / calculateShortfall
// (the Playground's forward-looking lever, distinct from the stored
// `decreases` input above). Same effective-dating contract: defaults to 0,
// so every existing call site that omits it must derive exactly what it
// derived before this parameter existed.
// ─────────────────────────────────────────────────────────────────────────────

describe('decreasesAnticipated (Playground what-if lever, P4)', () => {
  const NB_ARGS = {
    currentGrossSettled: 1000,
    currentLapses: 200,
    currentReinstatements: 0,
    goodBusinessFallingOff: 0,
    newBusinessPlanned: 500,
    newReinstatementsPlanned: 0,
    newOrphansAdopted: 0,
    newLapsesAnticipated: 0,
  };

  // THE REGRESSION PIN for projectPersistency — omitting decreasesAnticipated
  // must reproduce the pre-P4 output bit for bit.
  it('projectPersistency: absent decreasesAnticipated reproduces the pre-P4 output exactly', () => {
    const before = projectPersistency(NB_ARGS);
    const after = projectPersistency({ ...NB_ARGS, decreasesAnticipated: 0 });
    expect(after).toEqual(before);
  });

  it('projectPersistency: decreasesAnticipated reduces projected gross settled, same shape as goodBusinessFallingOff', () => {
    const viaGBF = projectPersistency({ ...NB_ARGS, newBusinessPlanned: 0, goodBusinessFallingOff: 200 });
    const viaDA = projectPersistency({ ...NB_ARGS, newBusinessPlanned: 0, decreasesAnticipated: 200 });
    expect(viaDA.projectedGrossSettled).toBe(800);
    expect(viaDA.projectedGrossSettled).toBe(viaGBF.projectedGrossSettled);
    expect(viaDA.projectedPersistency).toBeCloseTo(viaGBF.projectedPersistency, 6);
  });

  it('projectPersistency: a bigger decreasesAnticipated lowers projected persistency, all else equal', () => {
    const small = projectPersistency({ ...NB_ARGS, decreasesAnticipated: 50 });
    const big = projectPersistency({ ...NB_ARGS, decreasesAnticipated: 300 });
    expect(big.projectedPersistency).toBeLessThan(small.projectedPersistency);
  });

  // THE REGRESSION PIN for calculateShortfall — same contract as above.
  it('calculateShortfall: absent decreasesAnticipated reproduces the pre-P4 output exactly', () => {
    const args = {
      targetPersistency: 0.92,
      currentGrossSettled: 1000,
      currentLapses: 200,
      currentReinstatements: 0,
      goodBusinessFallingOff: 0,
    };
    const before = calculateShortfall(args);
    const after = calculateShortfall({ ...args, decreasesAnticipated: 0 });
    expect(after).toEqual(before);
  });

  it('calculateShortfall: decreasesAnticipated shrinks the baseline, same shape as goodBusinessFallingOff', () => {
    const withGBF = calculateShortfall({
      targetPersistency: 0.85,
      currentGrossSettled: 5000,
      currentLapses: 1500,
      currentReinstatements: 200,
      goodBusinessFallingOff: 300,
    });
    const withDA = calculateShortfall({
      targetPersistency: 0.85,
      currentGrossSettled: 5000,
      currentLapses: 1500,
      currentReinstatements: 200,
      goodBusinessFallingOff: 0,
      decreasesAnticipated: 300,
    });
    expect(withDA).toEqual(withGBF);
  });
});
