import { describe, it, expect } from 'vitest';
import {
  decomposeFromIncome,
  decomposeFromAPI,
  deriveRatiosFromHistory,
  roundTo10,
  roundToWhole,
  WEEKLY_DIVISOR,
  DEFAULT_DECOMPOSITION_INPUTS,
} from '../goalDecomposition';

// ── CHARACTERIZATION (Finding C) ────────────────────────────────────────────
// These expected values were captured from the ORIGINAL inline math in
// GoalDecompositionTab.jsx (`computed` useMemo) BEFORE the extraction. They
// prove decomposeFromIncome reproduces the shipped Playground behavior exactly
// — the zero-behavior-change guarantee. Do not "fix" these numbers; if the math
// changes intentionally, re-capture from the new behavior in a dedicated PR.
describe('decomposeFromIncome — characterization (zero behavior change)', () => {
  it('DEFAULT inputs → captured chain outputs', () => {
    const out = decomposeFromIncome(DEFAULT_DECOMPOSITION_INPUTS);
    expect(out.incomeGoal).toBe(300000);
    expect(out.apiToWrite).toBeCloseTo(1269841.2698412698, 6);
    expect(out.apiToSettle).toBeCloseTo(1142857.142857143, 6);
    expect(out.applications).toBeCloseTo(105.82010582010582, 9);
    expect(out.ci).toBeCloseTo(211.64021164021165, 9);
    expect(out.dials).toBeCloseTo(529.1005291005291, 9);
    expect(out.prospects).toBeCloseTo(1058.2010582010582, 9);
  });

  it('a second known input set → captured chain outputs', () => {
    const out = decomposeFromIncome({
      incomeGoal: 200000, taxRate: 30, renewalIncome: 20000, settlementRate: 85,
      commissionRate: 40, avgPolicyAPI: 10000, persistencyRate: 95,
      ciToSaleRatio: 2.2, dialsToCIRatio: 3, prospectRatio: 1.5,
    });
    expect(out.apiToWrite).toBeCloseTo(699248.1203007519, 6);
    expect(out.apiToSettle).toBeCloseTo(594360.9022556391, 6);
    expect(out.applications).toBeCloseTo(69.92481203007519, 9);
    expect(out.ci).toBeCloseTo(153.83458646616543, 9);
    expect(out.dials).toBeCloseTo(461.5037593984963, 9);
    expect(out.prospects).toBeCloseTo(692.2556390977445, 9);
  });

  it('taxRate = 100 → whole chain collapses to 0 (preTax guard)', () => {
    const out = decomposeFromIncome({ ...DEFAULT_DECOMPOSITION_INPUTS, taxRate: 100 });
    expect(out.apiToWrite).toBe(0);
    expect(out.applications).toBe(0);
    expect(out.dials).toBe(0);
  });

  it('commissionRate = 0 → API and downstream are 0', () => {
    const out = decomposeFromIncome({ ...DEFAULT_DECOMPOSITION_INPUTS, commissionRate: 0 });
    expect(out.apiToWrite).toBe(0);
    expect(out.prospects).toBe(0);
  });

  it('persistencyRate = 0 → API and downstream are 0', () => {
    const out = decomposeFromIncome({ ...DEFAULT_DECOMPOSITION_INPUTS, persistencyRate: 0 });
    expect(out.apiToWrite).toBe(0);
  });

  it('avgPolicyAPI = 0 → API computed but applications/downstream 0 (÷0 guard)', () => {
    const out = decomposeFromIncome({ ...DEFAULT_DECOMPOSITION_INPUTS, avgPolicyAPI: 0 });
    expect(out.apiToWrite).toBeCloseTo(1269841.2698412698, 6);
    expect(out.applications).toBe(0);
    expect(out.ci).toBe(0);
  });
});

// ── decomposeFromAPI — the card's anchor → activity path ─────────────────────
describe('decomposeFromAPI — API anchor → weekly activity', () => {
  it('derives applications/CIs/dials/prospects from a committed API', () => {
    const out = decomposeFromAPI({
      apiToWrite: 600000, avgPolicyAPI: 12000,
      ciToSaleRatio: 2, dialsToCIRatio: 2.5, prospectRatio: 2,
    });
    expect(out.applications).toBeCloseTo(50, 9);       // 600000 / 12000
    expect(out.ci).toBeCloseTo(100, 9);                // 50 × 2
    expect(out.dials).toBeCloseTo(250, 9);             // 100 × 2.5
    expect(out.prospects).toBeCloseTo(500, 9);         // 250 × 2
    expect(out.apiToWrite).toBe(600000);
  });

  it('matches the API→activity tail of decomposeFromIncome for the same anchor', () => {
    const full = decomposeFromIncome(DEFAULT_DECOMPOSITION_INPUTS);
    const tail = decomposeFromAPI({
      apiToWrite: full.apiToWrite,
      avgPolicyAPI: DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI,
      ciToSaleRatio: DEFAULT_DECOMPOSITION_INPUTS.ciToSaleRatio,
      dialsToCIRatio: DEFAULT_DECOMPOSITION_INPUTS.dialsToCIRatio,
      prospectRatio: DEFAULT_DECOMPOSITION_INPUTS.prospectRatio,
    });
    expect(tail.applications).toBeCloseTo(full.applications, 9);
    expect(tail.ci).toBeCloseTo(full.ci, 9);
    expect(tail.dials).toBeCloseTo(full.dials, 9);
    expect(tail.prospects).toBeCloseTo(full.prospects, 9);
  });

  it('avgPolicyAPI = 0 → 0 activity (÷0 guard)', () => {
    const out = decomposeFromAPI({ apiToWrite: 600000, avgPolicyAPI: 0, ciToSaleRatio: 2, dialsToCIRatio: 2.5, prospectRatio: 2 });
    expect(out.applications).toBe(0);
    expect(out.dials).toBe(0);
  });

  it('non-numeric anchor → 0 activity (parseFloat guard)', () => {
    const out = decomposeFromAPI({ apiToWrite: null, avgPolicyAPI: 12000, ciToSaleRatio: 2, dialsToCIRatio: 2.5, prospectRatio: 2 });
    expect(out.apiToWrite).toBe(0);
    expect(out.applications).toBe(0);
  });
});

// ── deriveRatiosFromHistory — 8-week gate ────────────────────────────────────
describe('deriveRatiosFromHistory', () => {
  const week = (over) => ({
    status: 'submitted', ciConducted: 4, applicationsSold: 2,
    referralCalls: 10, followUpCalls: 5, coldCalls: 5, seminarTradeshowCalls: 0,
    ...over,
  });

  it('< 8 submitted weeks → no history, null ratios', () => {
    const out = deriveRatiosFromHistory(Array.from({ length: 7 }, () => week()));
    expect(out.hasHistory).toBe(false);
    expect(out.autoCiToSale).toBeNull();
    expect(out.autoDialsToCI).toBeNull();
    expect(out.weeksUsed).toBe(7);
  });

  it('≥ 8 submitted weeks → derives ratios', () => {
    const out = deriveRatiosFromHistory(Array.from({ length: 8 }, () => week()));
    expect(out.hasHistory).toBe(true);
    // totalCI 32 / totalApps 16 = 2 ; totalDials 160 / totalCI 32 = 5
    expect(out.autoCiToSale).toBeCloseTo(2, 9);
    expect(out.autoDialsToCI).toBeCloseTo(5, 9);
    expect(out.weeksUsed).toBe(8);
  });

  it('ignores draft/unsubmitted weeks', () => {
    const subs = [...Array.from({ length: 8 }, () => week()), { status: 'draft', ciConducted: 99 }];
    const out = deriveRatiosFromHistory(subs);
    expect(out.weeksUsed).toBe(8);
  });

  it('caps at the most recent 12 weeks', () => {
    const out = deriveRatiosFromHistory(Array.from({ length: 20 }, () => week()));
    expect(out.weeksUsed).toBe(12);
  });

  it('falls back to appsSold when applicationsSold is absent', () => {
    const out = deriveRatiosFromHistory(Array.from({ length: 8 }, () => week({ applicationsSold: undefined, appsSold: 2 })));
    expect(out.autoCiToSale).toBeCloseTo(2, 9);
  });

  it('null/empty input → no history', () => {
    expect(deriveRatiosFromHistory(null).hasHistory).toBe(false);
    expect(deriveRatiosFromHistory([]).hasHistory).toBe(false);
  });
});

// ── rounding + constants ─────────────────────────────────────────────────────
describe('rounding helpers + WEEKLY_DIVISOR', () => {
  it('roundTo10 rounds to nearest $10', () => {
    expect(roundTo10(1234)).toBe(1230);
    expect(roundTo10(1235)).toBe(1240);
  });
  it('roundToWhole rounds to nearest integer', () => {
    expect(roundToWhole(2.4)).toBe(2);
    expect(roundToWhole(2.5)).toBe(3);
  });
  it('WEEKLY_DIVISOR is the 10-month production-year week count', () => {
    expect(WEEKLY_DIVISOR).toBe(43);
  });
});
