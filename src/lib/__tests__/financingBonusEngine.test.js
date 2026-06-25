import { describe, it, expect } from 'vitest';
import {
  creditWeight,
  computeApiChain,
  computeQuarterGate,
  resolveRateTier,
  computeFinancingBonus,
} from '../financingBonusEngine';
import { DEFAULT_FINANCING_RULESET_2026 } from '../../config/financingRuleset/2026';

const RS = DEFAULT_FINANCING_RULESET_2026;

// ──────────────────────────────────────────────────────
// creditWeight — the financing credit filter (addendum A.3)
// ──────────────────────────────────────────────────────
describe('creditWeight', () => {
  it('nb_ordinary → full credit (1.0)', () => {
    expect(creditWeight({ newBusinessType: 'nb_ordinary' })).toBe(1.0);
  });
  it('inc_ppp → 10%', () => {
    expect(creditWeight({ newBusinessType: 'inc_ppp' })).toBe(0.10);
  });
  it('lumpsum → 10%', () => {
    expect(creditWeight({ newBusinessType: 'lumpsum' })).toBe(0.10);
  });
  it('platinum_edge → excluded (0)', () => {
    expect(creditWeight({ newBusinessType: 'platinum_edge' })).toBe(0);
  });
  it('replacement → 0% (A.3 supersedes spec difference-only)', () => {
    expect(creditWeight({ newBusinessType: 'replacement' })).toBe(0);
  });
  it('spia → 0% (A.3 single-premium exclusion)', () => {
    expect(creditWeight({ newBusinessType: 'spia' })).toBe(0);
  });
  it('unknown type → 0 (safe default)', () => {
    expect(creditWeight({ newBusinessType: 'mystery_type' })).toBe(0);
    expect(creditWeight({})).toBe(0);
    expect(creditWeight(null)).toBe(0);
  });
  it('isSelfOrFamily === true → excluded, overriding the type weight', () => {
    expect(creditWeight({ newBusinessType: 'nb_ordinary', isSelfOrFamily: true })).toBe(0);
    expect(creditWeight({ newBusinessType: 'lumpsum', isSelfOrFamily: true })).toBe(0);
  });

  describe('staff treatment (A.4 — Decision 3)', () => {
    it("default 'count' → isStaff is ignored, weighted by its own type", () => {
      expect(RS.staffPolicyTreatment).toBe('count');
      expect(creditWeight({ newBusinessType: 'nb_ordinary', isStaff: true })).toBe(1.0);
    });
    it("'exclude' + isStaff true → 0 (declared option becomes active only with a flag)", () => {
      const rs = { ...RS, staffPolicyTreatment: 'exclude' };
      expect(creditWeight({ newBusinessType: 'nb_ordinary', isStaff: true }, rs)).toBe(0);
    });
    it("'exclude' is INERT without an isStaff flag — normal weighting (the K3 reality)", () => {
      const rs = { ...RS, staffPolicyTreatment: 'exclude' };
      expect(creditWeight({ newBusinessType: 'nb_ordinary' }, rs)).toBe(1.0);
      expect(creditWeight({ newBusinessType: 'nb_ordinary', isStaff: false }, rs)).toBe(1.0);
    });
  });
});

// ──────────────────────────────────────────────────────
// computeApiChain — Gross / Net-for-Persistency / Net-for-Production
// ──────────────────────────────────────────────────────
describe('computeApiChain', () => {
  it('sums credit-weighted Gross across mixed types and captures the LSD/inc-PPP credit', () => {
    const policies = [
      { newBusinessType: 'nb_ordinary', settledAPI: 40000 }, // 40000
      { newBusinessType: 'lumpsum', settledAPI: 10000 },     // 1000 (10%)
      { newBusinessType: 'inc_ppp', settledAPI: 5000 },      // 500 (10%)
      { newBusinessType: 'platinum_edge', settledAPI: 99999 }, // 0
      { newBusinessType: 'replacement', settledAPI: 99999 },   // 0
      { newBusinessType: 'spia', settledAPI: 99999 },          // 0
    ];
    const r = computeApiChain(policies, {}, RS);
    expect(r.gross).toBeCloseTo(41500, 6);
    expect(r.lsdIncPppCredit).toBeCloseTo(1500, 6); // 1000 + 500
    expect(r.netPersistency).toBeCloseTo(41500, 6); // no lapses/reinstatements
    expect(r.netProduction).toBeCloseTo(40000, 6);  // 41500 − 1500
  });

  it('Net-for-Persistency subtracts lapsed/surrendered(<2yr), adds reinstatements(<2yr)', () => {
    const policies = [{ newBusinessType: 'nb_ordinary', settledAPI: 50000 }];
    const r = computeApiChain(
      policies,
      { lapsedSurrenderedUnder2yrAPI: 8000, reinstatedUnder2yrAPI: 3000 },
      RS,
    );
    expect(r.gross).toBeCloseTo(50000, 6);
    expect(r.netPersistency).toBeCloseTo(45000, 6); // 50000 − 8000 + 3000
    expect(r.netProduction).toBeCloseTo(45000, 6);  // no LSD/inc-PPP credit
  });

  it('subtracts not-takens from Gross', () => {
    const policies = [{ newBusinessType: 'nb_ordinary', settledAPI: 50000 }];
    const r = computeApiChain(policies, { notTakenAPI: 12000 }, RS);
    expect(r.gross).toBeCloseTo(38000, 6);
  });

  it('isSelfOrFamily lines contribute 0 to Gross', () => {
    const policies = [
      { newBusinessType: 'nb_ordinary', settledAPI: 50000, isSelfOrFamily: true },
      { newBusinessType: 'nb_ordinary', settledAPI: 20000 },
    ];
    const r = computeApiChain(policies, {}, RS);
    expect(r.gross).toBeCloseTo(20000, 6);
  });

  it('parses string numerics (project rule)', () => {
    const policies = [{ newBusinessType: 'nb_ordinary', settledAPI: '37500.50' }];
    const r = computeApiChain(policies, { lapsedSurrenderedUnder2yrAPI: '500' }, RS);
    expect(r.gross).toBeCloseTo(37500.5, 6);
    expect(r.netPersistency).toBeCloseTo(37000.5, 6);
  });

  it('empty / non-array policies → all zeros', () => {
    expect(computeApiChain([], {}, RS)).toEqual({
      gross: 0, netPersistency: 0, netProduction: 0, lsdIncPppCredit: 0,
    });
    expect(computeApiChain(undefined, {}, RS).gross).toBe(0);
  });

  it('lumpsum credit is captured even when isSelfOrFamily zeroes it (credit = 0, not the raw API)', () => {
    const policies = [{ newBusinessType: 'lumpsum', settledAPI: 10000, isSelfOrFamily: true }];
    const r = computeApiChain(policies, {}, RS);
    expect(r.gross).toBe(0);
    expect(r.lsdIncPppCredit).toBe(0);
    expect(r.netProduction).toBe(0);
  });
});

// ──────────────────────────────────────────────────────
// computeQuarterGate — quarterly qualification (Decision 4)
// ──────────────────────────────────────────────────────
describe('computeQuarterGate', () => {
  it('gross just below $37,500 → gross gate not met', () => {
    const g = computeQuarterGate({ gross: 37499.99, persistency: 0.99, quarter: 2, yearInAgreement: 1 }, RS);
    expect(g.grossGateMet).toBe(false);
    expect(g.qualified).toBe(false);
  });
  it('gross exactly $37,500 → gross gate met', () => {
    const g = computeQuarterGate({ gross: 37500, persistency: 0.99, quarter: 2, yearInAgreement: 1 }, RS);
    expect(g.grossGateMet).toBe(true);
    expect(g.qualified).toBe(true);
  });
  it('gross above $37,500 → gross gate met', () => {
    const g = computeQuarterGate({ gross: 50000, persistency: 0.96, quarter: 2, yearInAgreement: 1 }, RS);
    expect(g.grossGateMet).toBe(true);
  });

  describe('Q1 exception (contract 3.3 / CD#3)', () => {
    it('no persistency test in Q1 — qualifies on gross alone even at 0 persistency', () => {
      const g = computeQuarterGate({ gross: 40000, persistency: 0, quarter: 1, yearInAgreement: 1 }, RS);
      expect(g.isQ1Exception).toBe(true);
      expect(g.persistencyGateMet).toBe(true);
      expect(g.qualified).toBe(true);
    });
    it('Q1 still requires the gross gate', () => {
      const g = computeQuarterGate({ gross: 30000, persistency: 0, quarter: 1, yearInAgreement: 1 }, RS);
      expect(g.grossGateMet).toBe(false);
      expect(g.qualified).toBe(false);
    });
  });

  describe('persistency boundaries (Q2+)', () => {
    it('year 1 — 94.99% fails, 95% passes', () => {
      expect(computeQuarterGate({ gross: 40000, persistency: 0.9499, quarter: 2, yearInAgreement: 1 }, RS).persistencyGateMet).toBe(false);
      expect(computeQuarterGate({ gross: 40000, persistency: 0.95, quarter: 2, yearInAgreement: 1 }, RS).persistencyGateMet).toBe(true);
    });
    it('year 2 — 89.99% fails, 90% passes', () => {
      expect(computeQuarterGate({ gross: 40000, persistency: 0.8999, quarter: 2, yearInAgreement: 2 }, RS).persistencyGateMet).toBe(false);
      expect(computeQuarterGate({ gross: 40000, persistency: 0.90, quarter: 2, yearInAgreement: 2 }, RS).persistencyGateMet).toBe(true);
    });
    it('year-2 agent at 92% would FAIL the year-1 95% line but PASSES the year-2 90% line', () => {
      expect(computeQuarterGate({ gross: 40000, persistency: 0.92, quarter: 2, yearInAgreement: 1 }, RS).persistencyGateMet).toBe(false);
      expect(computeQuarterGate({ gross: 40000, persistency: 0.92, quarter: 2, yearInAgreement: 2 }, RS).persistencyGateMet).toBe(true);
    });
  });

  it('qualified requires BOTH gates (Q2+)', () => {
    expect(computeQuarterGate({ gross: 40000, persistency: 0.80, quarter: 3, yearInAgreement: 1 }, RS).qualified).toBe(false);
    expect(computeQuarterGate({ gross: 30000, persistency: 0.99, quarter: 3, yearInAgreement: 1 }, RS).qualified).toBe(false);
    expect(computeQuarterGate({ gross: 40000, persistency: 0.99, quarter: 3, yearInAgreement: 1 }, RS).qualified).toBe(true);
  });
});

// ──────────────────────────────────────────────────────
// resolveRateTier — annual bonus-rate tiers (Decision 6)
// ──────────────────────────────────────────────────────
describe('resolveRateTier', () => {
  it('below $150K → null (no annual adjustment)', () => {
    expect(resolveRateTier(149999, RS)).toBeNull();
    expect(resolveRateTier(0, RS)).toBeNull();
  });
  it('exactly $150K → 25% band (20% API + 5% lives)', () => {
    const t = resolveRateTier(150000, RS);
    expect(t.apiRate).toBe(0.20);
    expect(t.livesRate).toBe(0.05);
  });
  it('mid-band $175K → 25% band', () => {
    expect(resolveRateTier(175000, RS).apiRate).toBe(0.20);
  });
  it('exactly $200K → 25% band (maxGross inclusive — literal "$150K–$200K")', () => {
    expect(resolveRateTier(200000, RS).apiRate).toBe(0.20);
  });
  it('$200,001 → 30% band (25% API + 5% lives)', () => {
    const t = resolveRateTier(200001, RS);
    expect(t.apiRate).toBe(0.25);
    expect(t.livesRate).toBe(0.05);
  });
  it('well above $200K → 30% band', () => {
    expect(resolveRateTier(500000, RS).apiRate).toBe(0.25);
  });
});

// ──────────────────────────────────────────────────────
// computeFinancingBonus — orchestrator
// ──────────────────────────────────────────────────────
describe('computeFinancingBonus — quarterly bonuses', () => {
  it('year 1, qualified quarter → consistency 15% and production 15% of Net-for-Persistency', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 60000 }],
      persistency: 0.96,
    }, RS);
    expect(r.gates.qualified).toBe(true);
    expect(r.netPersistency).toBeCloseTo(60000, 6);
    expect(r.consistencyBonus).toBeCloseTo(9000, 6);  // 0.15 × 60000
    expect(r.productionBonus).toBeCloseTo(9000, 6);   // 0.15 × 60000 (year 1)
  });

  it('year 2, qualified quarter → production rate steps to 20%; consistency stays 15%', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 2,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 60000 }],
      persistency: 0.91,
    }, RS);
    expect(r.gates.qualified).toBe(true);
    expect(r.consistencyBonus).toBeCloseTo(9000, 6);  // 0.15 × 60000
    expect(r.productionBonus).toBeCloseTo(12000, 6);  // 0.20 × 60000 (year 2)
  });

  it('not qualified (gross below gate) → both quarterly bonuses are 0', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 30000 }],
      persistency: 0.99,
    }, RS);
    expect(r.gates.grossGateMet).toBe(false);
    expect(r.consistencyBonus).toBe(0);
    expect(r.productionBonus).toBe(0);
  });

  it('not qualified (persistency below gate, Q2+) → both quarterly bonuses are 0', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 3,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 60000 }],
      persistency: 0.80,
    }, RS);
    expect(r.gates.qualified).toBe(false);
    expect(r.consistencyBonus).toBe(0);
    expect(r.productionBonus).toBe(0);
  });

  it('Q1 exception → qualifies and pays on submitted basis with no persistency test', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 1,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 40000 }], // submitted-basis figure
      persistency: 0, // unknown in Q1 — must be ignored
    }, RS);
    expect(r.gates.isQ1Exception).toBe(true);
    expect(r.gates.qualified).toBe(true);
    expect(r.consistencyBonus).toBeCloseTo(6000, 6); // 0.15 × 40000
  });
});

describe('computeFinancingBonus — annual adjustment', () => {
  const baseQuarter = {
    yearInAgreement: 1,
    quarter: 2,
    policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 60000 }],
    persistency: 0.96,
  };

  it('no annual block → annualAdjustment 0, rateTier null', () => {
    const r = computeFinancingBonus(baseQuarter, RS);
    expect(r.annualAdjustment).toBe(0);
    expect(r.rateTier).toBeNull();
    expect(r.totalBonusRate).toBe(0);
  });

  it('tier + 80 lives → totalBonusRate includes the lives portion; adjustment tops up prior bonuses', () => {
    const r = computeFinancingBonus({
      ...baseQuarter,
      annual: { grossAPI: 180000, netProductionAPI: 170000, netPoliciesSettled: 80, priorBonusesPaidYTD: 30000 },
    }, RS);
    expect(r.rateTier.apiRate).toBe(0.20);
    expect(r.livesQualified).toBe(true);
    expect(r.totalBonusRate).toBeCloseTo(0.25, 6);            // 0.20 + 0.05
    expect(r.annualQualifyingAmount).toBeCloseTo(42500, 6);   // 170000 × 0.25
    expect(r.annualGateMet).toBe(true);
    expect(r.annualAdjustment).toBeCloseTo(12500, 6);         // 42500 − 30000
  });

  it('fewer than 80 lives → no 5% lives portion', () => {
    const r = computeFinancingBonus({
      ...baseQuarter,
      annual: { grossAPI: 180000, netProductionAPI: 170000, netPoliciesSettled: 79, priorBonusesPaidYTD: 0 },
    }, RS);
    expect(r.livesQualified).toBe(false);
    expect(r.totalBonusRate).toBeCloseTo(0.20, 6);
    expect(r.annualQualifyingAmount).toBeCloseTo(34000, 6);   // 170000 × 0.20
    expect(r.annualAdjustment).toBeCloseTo(34000, 6);         // no prior bonuses
  });

  it('30% band (>$200K) with lives → 0.30 total rate', () => {
    const r = computeFinancingBonus({
      ...baseQuarter,
      annual: { grossAPI: 250000, netProductionAPI: 240000, netPoliciesSettled: 90, priorBonusesPaidYTD: 0 },
    }, RS);
    expect(r.rateTier.apiRate).toBe(0.25);
    expect(r.totalBonusRate).toBeCloseTo(0.30, 6);
    expect(r.annualQualifyingAmount).toBeCloseTo(72000, 6);   // 240000 × 0.30
  });

  it('max-out: prior bonuses ≥ qualifying amount → adjustment clamps to 0', () => {
    const r = computeFinancingBonus({
      ...baseQuarter,
      annual: { grossAPI: 180000, netProductionAPI: 170000, netPoliciesSettled: 80, priorBonusesPaidYTD: 50000 },
    }, RS);
    expect(r.annualQualifyingAmount).toBeCloseTo(42500, 6);
    expect(r.annualAdjustment).toBe(0); // max(0, 42500 − 50000)
  });

  it('annual gross below $150K → no tier, gate not met, adjustment 0', () => {
    const r = computeFinancingBonus({
      ...baseQuarter,
      annual: { grossAPI: 140000, netProductionAPI: 140000, netPoliciesSettled: 100, priorBonusesPaidYTD: 0 },
    }, RS);
    expect(r.rateTier).toBeNull();
    expect(r.annualGateMet).toBe(false);
    expect(r.annualAdjustment).toBe(0);
  });
});

// ──────────────────────────────────────────────────────
// Worked numeric example — the documented end-to-end case (PR description mirror)
// Year-1 agent, Q2 (settled): one $60,000 nb_ordinary policy, persistency 96%.
// Annual: Gross $180,000 (25% band), Net-for-Production $170,000, 80 lives,
// $30,000 consistency+production already paid YTD.
// ──────────────────────────────────────────────────────
describe('computeFinancingBonus — worked example (spec $37,500 gate / ~$10K bonus scale)', () => {
  it('produces the full documented figure set', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 60000 }],
      persistency: 0.96,
      annual: { grossAPI: 180000, netProductionAPI: 170000, netPoliciesSettled: 80, priorBonusesPaidYTD: 30000 },
    }, RS);

    expect(r.gross).toBeCloseTo(60000, 6);           // ≥ $37,500 gate
    expect(r.netPersistency).toBeCloseTo(60000, 6);
    expect(r.netProduction).toBeCloseTo(60000, 6);
    expect(r.gates.qualified).toBe(true);
    expect(r.consistencyBonus).toBeCloseTo(9000, 6); // 0.15 × 60000
    expect(r.productionBonus).toBeCloseTo(9000, 6);  // 0.15 × 60000
    expect(r.rateTier.apiRate).toBe(0.20);
    expect(r.livesQualified).toBe(true);
    expect(r.totalBonusRate).toBeCloseTo(0.25, 6);
    expect(r.annualQualifyingAmount).toBeCloseTo(42500, 6);
    expect(r.annualAdjustment).toBeCloseTo(12500, 6);
  });
});

// ──────────────────────────────────────────────────────
// Edges + default-ruleset behaviour
// ──────────────────────────────────────────────────────
describe('computeFinancingBonus — edges and defaults', () => {
  it('empty input → safe zeros, not-qualified, null tier', () => {
    const r = computeFinancingBonus({}, RS);
    expect(r.gross).toBe(0);
    expect(r.gates.qualified).toBe(false);
    expect(r.consistencyBonus).toBe(0);
    expect(r.productionBonus).toBe(0);
    expect(r.annualAdjustment).toBe(0);
    expect(r.rateTier).toBeNull();
  });

  it('uses DEFAULT_FINANCING_RULESET_2026 when no ruleset is passed', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 50000 }],
      persistency: 0.96,
    });
    expect(r.gates.qualified).toBe(true);
    expect(r.consistencyBonus).toBeCloseTo(7500, 6); // 0.15 × 50000 with default ruleset
  });

  it('string numerics and missing fields are tolerated end-to-end', () => {
    const r = computeFinancingBonus({
      yearInAgreement: '1',
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: '45000' }],
      persistency: '0.97',
    }, RS);
    expect(r.gross).toBeCloseTo(45000, 6);
    expect(r.gates.qualified).toBe(true);
  });

  it('negative net (heavy lapses) flows through without throwing; raw bases stay negative', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 40000 }],
      lapsedSurrenderedUnder2yrAPI: 100000,
      persistency: 0.99,
    }, RS);
    expect(r.gross).toBeCloseTo(40000, 6);
    expect(r.netPersistency).toBeCloseTo(-60000, 6); // raw base unclamped
    expect(r.netProduction).toBeCloseTo(-60000, 6);  // raw base unclamped
    // qualified on gross+persistency, but the negative base must FLOOR the payable bonuses to 0
    expect(r.gates.qualified).toBe(true);
    expect(r.consistencyBonus).toBe(0);
    expect(r.productionBonus).toBe(0);
  });
});

// ──────────────────────────────────────────────────────
// Payable bonuses floor at $0 (contract never pays a negative; K4 waterfall safety)
// ──────────────────────────────────────────────────────
describe('computeFinancingBonus — payable bonuses floor at $0 on a negative base', () => {
  it('negative Net-for-Persistency → consistencyBonus 0 (not negative)', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 40000 }],
      lapsedSurrenderedUnder2yrAPI: 90000, // netPersistency = -50000
      persistency: 0.99,
    }, RS);
    expect(r.netPersistency).toBeCloseTo(-50000, 6); // base stays raw
    expect(r.consistencyBonus).toBe(0);
  });

  it('negative Net-for-Persistency → productionBonus 0 (year 2 rate path too)', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 2,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 40000 }],
      lapsedSurrenderedUnder2yrAPI: 90000,
      persistency: 0.95,
    }, RS);
    expect(r.productionBonus).toBe(0);
  });

  it('negative annual Net-for-Production → annualAdjustment 0 (not negative)', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 60000 }],
      persistency: 0.96,
      annual: { grossAPI: 180000, netProductionAPI: -50000, netPoliciesSettled: 80, priorBonusesPaidYTD: 0 },
    }, RS);
    expect(r.rateTier.apiRate).toBe(0.20);       // tier still resolves
    expect(r.annualQualifyingAmount).toBeCloseTo(-12500, 6); // intermediate stays raw
    expect(r.annualAdjustment).toBe(0);          // payable floors
  });
});

// ──────────────────────────────────────────────────────
// Robustness hardening (Gemini review) — string coercion of quarter/year + explicit-null guards
// ──────────────────────────────────────────────────────
describe('robustness — string quarter / year coercion', () => {
  it("string quarter '1' still triggers the Q1 exception", () => {
    const g = computeQuarterGate({ gross: 40000, persistency: 0, quarter: '1', yearInAgreement: 1 }, RS);
    expect(g.isQ1Exception).toBe(true);
    expect(g.qualified).toBe(true);
  });
  it("string yearInAgreement '2' selects the year-2 90% gate (not the year-1 95% gate)", () => {
    // 0.91 passes the year-2 0.90 gate but would FAIL the year-1 0.95 gate
    const g = computeQuarterGate({ gross: 40000, persistency: 0.91, quarter: 2, yearInAgreement: '2' }, RS);
    expect(g.persistencyGateMet).toBe(true);
  });
  it("orchestrator: string yearInAgreement '2' applies the 20% production rate", () => {
    const r = computeFinancingBonus({
      yearInAgreement: '2',
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 60000 }],
      persistency: 0.91,
    }, RS);
    expect(r.gates.qualified).toBe(true);
    expect(r.productionBonus).toBeCloseTo(12000, 6); // 0.20 × 60000 — year-2 rate via string coercion
  });
});

describe('robustness — explicit null params do not throw (default-param bypass)', () => {
  it('creditWeight(policy, null) falls back to the default ruleset', () => {
    expect(creditWeight({ newBusinessType: 'nb_ordinary' }, null)).toBe(1.0);
  });
  it('computeApiChain(policies, null, null) uses defaults', () => {
    const r = computeApiChain([{ newBusinessType: 'nb_ordinary', settledAPI: 50000 }], null, null);
    expect(r.gross).toBeCloseTo(50000, 6);
  });
  it('computeQuarterGate(null) returns a safe not-qualified result', () => {
    const g = computeQuarterGate(null);
    expect(g.grossGateMet).toBe(false);
    expect(g.qualified).toBe(false);
  });
  it('resolveRateTier(g, null) uses the default tiers', () => {
    expect(resolveRateTier(180000, null).apiRate).toBe(0.20);
  });
  it('computeFinancingBonus(null) → safe zeros', () => {
    const r = computeFinancingBonus(null);
    expect(r.gross).toBe(0);
    expect(r.gates.qualified).toBe(false);
    expect(r.annualAdjustment).toBe(0);
  });
  it('computeFinancingBonus(input, null) falls back to the default ruleset', () => {
    const r = computeFinancingBonus({
      yearInAgreement: 1,
      quarter: 2,
      policies: [{ newBusinessType: 'nb_ordinary', settledAPI: 50000 }],
      persistency: 0.96,
    }, null);
    expect(r.consistencyBonus).toBeCloseTo(7500, 6);
  });
});
