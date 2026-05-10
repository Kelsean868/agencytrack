import { describe, it, expect } from 'vitest';
import {
  calculateGrossSettled,
  calculateNetSettled,
  calculatePersistency,
  deriveAll,
  aggregatePersistency,
  projectPersistency,
  calculateShortfall,
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
