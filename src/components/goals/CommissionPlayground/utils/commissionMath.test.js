import { describe, it, expect } from 'vitest';
import {
  FIRST_PAYMENT_RATIO,
  reverseCalc,
  commissionThisMonth,
  modeBreakdown,
  cashFlowForecast,
} from './commissionMath.js';

describe('FIRST_PAYMENT_RATIO constants', () => {
  it('annual = 1.0', () => expect(FIRST_PAYMENT_RATIO.annual).toBe(1.0));
  it('semiAnnual = 0.5', () => expect(FIRST_PAYMENT_RATIO.semiAnnual).toBe(0.5));
  it('quarterly = 0.25', () => expect(FIRST_PAYMENT_RATIO.quarterly).toBe(0.25));
  it('monthly ≈ 1/12', () => expect(FIRST_PAYMENT_RATIO.monthly).toBeCloseTo(1 / 12, 10));
});

// All cases: commissionRate = 50%, target = $5,000
describe('reverseCalc — spec worked examples', () => {
  const C = 50;
  const T = 5000;

  it('all annual → $10,000 API', () => {
    const mix = { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 };
    expect(Math.round(reverseCalc({ targetCommission: T, modeMix: mix, commissionRate: C }))).toBe(10000);
  });

  it('all monthly → $120,000 API', () => {
    const mix = { annual: 0, semiAnnual: 0, quarterly: 0, monthly: 1 };
    expect(Math.round(reverseCalc({ targetCommission: T, modeMix: mix, commissionRate: C }))).toBe(120000);
  });

  it('50/50 annual+semi → $13,333 API', () => {
    const mix = { annual: 0.5, semiAnnual: 0.5, quarterly: 0, monthly: 0 };
    expect(Math.round(reverseCalc({ targetCommission: T, modeMix: mix, commissionRate: C }))).toBe(13333);
  });

  it('30A/30S/20Q/20M → $19,355 API', () => {
    // NOTE: Track-E-Specs.md §E2 cites $21,432 for this case.
    // The formula as stated yields ~$19,355 and is consistent with all other cases.
    // $21,432 appears to be a spec typo; trusting the formula here.
    const mix = { annual: 0.3, semiAnnual: 0.3, quarterly: 0.2, monthly: 0.2 };
    expect(Math.round(reverseCalc({ targetCommission: T, modeMix: mix, commissionRate: C }))).toBe(19355);
  });
});

describe('reverseCalc — edge cases', () => {
  const allAnnual = { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 };

  it('returns 0 when commissionRate is 0', () => {
    expect(reverseCalc({ targetCommission: 5000, modeMix: allAnnual, commissionRate: 0 })).toBe(0);
  });

  it('returns 0 when targetCommission is 0', () => {
    expect(reverseCalc({ targetCommission: 0, modeMix: allAnnual, commissionRate: 50 })).toBe(0);
  });

  it('$1M target at 35% all-annual → ~$2,857,143 API', () => {
    const api = reverseCalc({ targetCommission: 1_000_000, modeMix: allAnnual, commissionRate: 35 });
    expect(Math.round(api)).toBe(2857143);
  });
});

describe('forward/reverse identity', () => {
  const cases = [
    { annual: 1,   semiAnnual: 0,   quarterly: 0,   monthly: 0   },
    { annual: 0,   semiAnnual: 0,   quarterly: 0,   monthly: 1   },
    { annual: 0.5, semiAnnual: 0.5, quarterly: 0,   monthly: 0   },
    { annual: 0.3, semiAnnual: 0.3, quarterly: 0.2, monthly: 0.2 },
  ];

  cases.forEach((mix, i) => {
    it(`round-trips case ${i + 1}: commissionThisMonth(reverseCalc(T)) ≈ T`, () => {
      const target = 5000;
      const rate   = 50;
      const api  = reverseCalc({ targetCommission: target, modeMix: mix, commissionRate: rate });
      const back = commissionThisMonth({ totalApi: api, modeMix: mix, commissionRate: rate });
      expect(back).toBeCloseTo(target, 6);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Characterization additions (Item 5, night queue). The existing blocks above
// pin reverseCalc + the round-trip identity; the decomposition chain is pinned
// separately in src/utils/__tests__/goalDecomposition.test.js. These pin the
// previously-UNTESTED exports — commissionThisMonth (direct, table-driven),
// modeBreakdown, and cashFlowForecast (payment timing) — plus the zero/missing
// modeMix boundaries (commissionMath.js:13–18 weightedRatioSum ?? 0 guard).
// ─────────────────────────────────────────────────────────────────────────────

describe('commissionThisMonth — direct (commissionMath.js:22)', () => {
  // forward = totalApi × (rate/100) × Σ(weight × FIRST_PAYMENT_RATIO[mode])
  const cases = [
    { name: 'all-annual',        mix: { annual: 1 },                                    api: 10000,  rate: 50, expected: 5000 },
    { name: 'all-monthly',       mix: { monthly: 1 },                                   api: 120000, rate: 50, expected: 5000 },
    { name: '50/50 annual+semi', mix: { annual: 0.5, semiAnnual: 0.5 },                 api: 10000,  rate: 50, expected: 3750 },
    { name: 'all-quarterly',     mix: { quarterly: 1 },                                 api: 80000,  rate: 50, expected: 10000 },
    { name: 'rate 35% all-annual', mix: { annual: 1 },                                  api: 100000, rate: 35, expected: 35000 },
  ];
  cases.forEach(({ name, mix, api, rate, expected }) => {
    it(`${name} → $${expected}`, () => {
      expect(commissionThisMonth({ totalApi: api, modeMix: mix, commissionRate: rate })).toBeCloseTo(expected, 6);
    });
  });

  it('empty modeMix → 0 (weightedRatioSum guard)', () => {
    expect(commissionThisMonth({ totalApi: 100000, modeMix: {}, commissionRate: 50 })).toBe(0);
  });
  it('commissionRate 0 → 0', () => {
    expect(commissionThisMonth({ totalApi: 100000, modeMix: { annual: 1 }, commissionRate: 0 })).toBe(0);
  });
  it('missing mode keys default to 0 weight (?? guard)', () => {
    // only annual specified; semiAnnual/quarterly/monthly absent → treated as 0.
    expect(commissionThisMonth({ totalApi: 100000, modeMix: { annual: 0.4 }, commissionRate: 50 }))
      .toBeCloseTo(100000 * 0.5 * 0.4, 6);
  });
});

describe('modeBreakdown — per-mode API + commission (commissionMath.js:35)', () => {
  it('returns one row per mode, in FIRST_PAYMENT_RATIO order', () => {
    const rows = modeBreakdown({ totalApi: 100000, modeMix: { annual: 1 }, commissionRate: 40 });
    expect(rows.map((r) => r.mode)).toEqual(['annual', 'semiAnnual', 'quarterly', 'monthly']);
  });

  it('50/50 annual+semi at 40% → per-mode modeApi + first-payment commission', () => {
    const rows = modeBreakdown({ totalApi: 100000, modeMix: { annual: 0.5, semiAnnual: 0.5 }, commissionRate: 40 });
    const byMode = Object.fromEntries(rows.map((r) => [r.mode, r]));
    // modeApi = totalApi × weight
    expect(byMode.annual.modeApi).toBe(50000);
    expect(byMode.semiAnnual.modeApi).toBe(50000);
    // commission = modeApi × C × FIRST_PAYMENT_RATIO[mode]
    expect(byMode.annual.commission).toBeCloseTo(50000 * 0.4 * 1.0, 6);     // 20000
    expect(byMode.semiAnnual.commission).toBeCloseTo(50000 * 0.4 * 0.5, 6); // 10000
    expect(byMode.quarterly.modeApi).toBe(0);
    expect(byMode.monthly.commission).toBe(0);
  });

  it('Σ row commission == commissionThisMonth for the same inputs (cross-fn identity)', () => {
    const args = { totalApi: 250000, modeMix: { annual: 0.3, semiAnnual: 0.3, quarterly: 0.2, monthly: 0.2 }, commissionRate: 35 };
    const sum = modeBreakdown(args).reduce((s, r) => s + r.commission, 0);
    expect(sum).toBeCloseTo(commissionThisMonth(args), 6);
  });

  it('missing mode keys → weight 0, modeApi 0, commission 0', () => {
    const rows = modeBreakdown({ totalApi: 100000, modeMix: { annual: 1 }, commissionRate: 40 });
    const monthly = rows.find((r) => r.mode === 'monthly');
    expect(monthly).toMatchObject({ weight: 0, modeApi: 0, commission: 0 });
  });
});

describe('cashFlowForecast — 12-month payment timing (commissionMath.js:55)', () => {
  it('returns 12 entries numbered 1–12', () => {
    const f = cashFlowForecast({ totalApi: 100000, modeMix: { annual: 1 }, commissionRate: 50 });
    expect(f).toHaveLength(12);
    expect(f.map((e) => e.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('all-annual → full commission in month 1 only', () => {
    const f = cashFlowForecast({ totalApi: 100000, modeMix: { annual: 1 }, commissionRate: 50 });
    expect(f[0].amount).toBeCloseTo(50000, 6);
    expect(f.slice(1).every((e) => e.amount === 0)).toBe(true);
  });

  it('all-semiAnnual → half in month 1, half in month 7', () => {
    const f = cashFlowForecast({ totalApi: 100000, modeMix: { semiAnnual: 1 }, commissionRate: 50 });
    expect(f[0].amount).toBeCloseTo(25000, 6);
    expect(f[6].amount).toBeCloseTo(25000, 6);
    expect(f[1].amount).toBe(0);
  });

  it('all-quarterly → equal quarters in months 1, 4, 7, 10', () => {
    const f = cashFlowForecast({ totalApi: 100000, modeMix: { quarterly: 1 }, commissionRate: 50 });
    [0, 3, 6, 9].forEach((i) => expect(f[i].amount).toBeCloseTo(12500, 6));
    [1, 2, 4, 5].forEach((i) => expect(f[i].amount).toBe(0));
  });

  it('all-monthly → equal twelfths across all 12 months', () => {
    const f = cashFlowForecast({ totalApi: 120000, modeMix: { monthly: 1 }, commissionRate: 50 });
    f.forEach((e) => expect(e.amount).toBeCloseTo(5000, 6));
  });

  it('total across 12 months == totalApi × C × Σ(weights) (full-year arrival)', () => {
    const args = { totalApi: 200000, modeMix: { annual: 0.25, semiAnnual: 0.25, quarterly: 0.25, monthly: 0.25 }, commissionRate: 40 };
    const total = cashFlowForecast(args).reduce((s, e) => s + e.amount, 0);
    // Σ weights = 1 → total = 200000 × 0.40 × 1 = 80000.
    expect(total).toBeCloseTo(200000 * 0.4 * 1, 6);
  });

  it('empty modeMix → all months 0', () => {
    const f = cashFlowForecast({ totalApi: 100000, modeMix: {}, commissionRate: 50 });
    expect(f.every((e) => e.amount === 0)).toBe(true);
  });
});
