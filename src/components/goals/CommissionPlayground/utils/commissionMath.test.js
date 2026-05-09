import { describe, it, expect } from 'vitest';
import {
  FIRST_PAYMENT_RATIO,
  reverseCalc,
  commissionThisMonth,
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
