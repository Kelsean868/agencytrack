import { describe, it, expect } from 'vitest';
import { buildStackedData } from '../utils/cashFlowStacking';
import { cashFlowForecast } from '../utils/commissionMath';

// ── Structural tests ──────────────────────────────────────────────────────────

describe('buildStackedData — mode presence by month', () => {
  const allMix = { annual: 0.25, semiAnnual: 0.25, quarterly: 0.25, monthly: 0.25 };

  it('returns 12 rows', () => {
    expect(buildStackedData(10000, allMix, 35)).toHaveLength(12);
  });

  it('annual fires only in month 0', () => {
    const rows = buildStackedData(10000, allMix, 35);
    expect(rows[0].annual).toBeGreaterThan(0);
    for (let i = 1; i < 12; i++) expect(rows[i].annual).toBe(0);
  });

  it('semiAnnual fires in months 0 and 6 only', () => {
    const rows = buildStackedData(10000, allMix, 35);
    expect(rows[0].semiAnnual).toBeGreaterThan(0);
    expect(rows[6].semiAnnual).toBeGreaterThan(0);
    for (let i = 1; i < 12; i++) {
      if (i !== 6) expect(rows[i].semiAnnual).toBe(0);
    }
  });

  it('quarterly fires in months 0, 3, 6, 9 only', () => {
    const rows = buildStackedData(10000, allMix, 35);
    [0, 3, 6, 9].forEach((m) => expect(rows[m].quarterly).toBeGreaterThan(0));
    [1, 2, 4, 5, 7, 8, 10, 11].forEach((m) => expect(rows[m].quarterly).toBe(0));
  });

  it('monthly fires in every month', () => {
    const rows = buildStackedData(10000, allMix, 35);
    rows.forEach((row) => expect(row.monthly).toBeGreaterThan(0));
  });

  it('cumulative is non-decreasing', () => {
    const rows = buildStackedData(12000, allMix, 40);
    for (let i = 1; i < 12; i++) {
      expect(rows[i].cumulative).toBeGreaterThanOrEqual(rows[i - 1].cumulative);
    }
  });
});

describe('buildStackedData — boundary inputs', () => {
  it('zero API → all zeros', () => {
    const rows = buildStackedData(0, { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 }, 35);
    rows.forEach((row) => {
      expect(row.annual).toBe(0);
      expect(row.semiAnnual).toBe(0);
      expect(row.quarterly).toBe(0);
      expect(row.monthly).toBe(0);
      expect(row.cumulative).toBe(0);
    });
  });

  it('zero commission rate → all zeros', () => {
    const rows = buildStackedData(10000, { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 }, 0);
    rows.forEach((row) => expect(row.annual + row.semiAnnual + row.quarterly + row.monthly).toBe(0));
  });

  it('single-mode all-annual: full payment in month 0 only', () => {
    const rows = buildStackedData(10000, { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 }, 50);
    // 10000 × 50% × 1.0 = 5000, all in month 0
    expect(rows[0].annual).toBe(5000);
    for (let i = 1; i < 12; i++) {
      expect(rows[i].annual + rows[i].semiAnnual + rows[i].quarterly + rows[i].monthly).toBe(0);
    }
  });
});

// ── Parity suite (centerpiece) ────────────────────────────────────────────────
//
// For identical {totalApi, modeMix, commissionRate} inputs, the per-month SUM of the
// four stacked modes in buildStackedData must equal cashFlowForecast's amount for that
// month, within ±3 TTD. The 3-TTD tolerance arises from independent per-component
// rounding in buildStackedData (4 components × max ±0.5 each) vs. exact float
// accumulation in cashFlowForecast. This proves the two functions share the same
// arithmetic model with no divergence beyond rounding.

const PARITY_CASES = [
  {
    label: 'all-annual',
    totalApi: 12000, commissionRate: 35,
    modeMix: { annual: 1, semiAnnual: 0, quarterly: 0, monthly: 0 },
  },
  {
    label: 'all-semiAnnual',
    totalApi: 8000, commissionRate: 40,
    modeMix: { annual: 0, semiAnnual: 1, quarterly: 0, monthly: 0 },
  },
  {
    label: 'all-quarterly',
    totalApi: 6000, commissionRate: 30,
    modeMix: { annual: 0, semiAnnual: 0, quarterly: 1, monthly: 0 },
  },
  {
    label: 'all-monthly',
    totalApi: 12000, commissionRate: 35,
    modeMix: { annual: 0, semiAnnual: 0, quarterly: 0, monthly: 1 },
  },
  {
    label: 'equal-mix all modes',
    totalApi: 20000, commissionRate: 35,
    modeMix: { annual: 0.25, semiAnnual: 0.25, quarterly: 0.25, monthly: 0.25 },
  },
  {
    label: 'heavy-annual light-monthly',
    totalApi: 50000, commissionRate: 35,
    modeMix: { annual: 0.7, semiAnnual: 0.1, quarterly: 0.1, monthly: 0.1 },
  },
  {
    label: 'high API high rate (boundary)',
    totalApi: 500000, commissionRate: 100,
    modeMix: { annual: 0.5, semiAnnual: 0.3, quarterly: 0.1, monthly: 0.1 },
  },
];

describe('buildStackedData parity with cashFlowForecast', () => {
  function sumStacked(row) {
    return row.annual + row.semiAnnual + row.quarterly + row.monthly;
  }

  PARITY_CASES.forEach(({ label, totalApi, modeMix, commissionRate }) => {
    it(`${label}: per-month sum matches cashFlowForecast within ±3 TTD`, () => {
      const stacked  = buildStackedData(totalApi, modeMix, commissionRate);
      const forecast = cashFlowForecast({ totalApi, modeMix, commissionRate });

      for (let i = 0; i < 12; i++) {
        const diff = Math.abs(sumStacked(stacked[i]) - forecast[i].amount);
        expect(diff).toBeLessThan(3);
      }
    });
  });

  it('cumulative total equals sum of all cashFlowForecast amounts (within ±36 TTD)', () => {
    // 12 months × 3 TTD = 36 TTD worst-case cumulative drift
    const { totalApi, modeMix, commissionRate } = PARITY_CASES[4]; // equal mix
    const stacked  = buildStackedData(totalApi, modeMix, commissionRate);
    const forecast = cashFlowForecast({ totalApi, modeMix, commissionRate });
    const stackedTotal   = stacked[11].cumulative;
    const forecastTotal  = forecast.reduce((s, r) => s + r.amount, 0);
    expect(Math.abs(stackedTotal - forecastTotal)).toBeLessThan(36);
  });
});
