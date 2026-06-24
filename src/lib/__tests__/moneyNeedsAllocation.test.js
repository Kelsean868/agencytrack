import { describe, it, expect } from 'vitest';
import {
  AVG_POLICY_API, LINE_DEFAULT_RATES, ALLOC_LINE_KEYS, MAX_PRODUCTS, PRODUCT_SEEDS,
  visibleLineKeys, allocApps, isDrilled, lineCommission, effectiveLineRate,
  totalAllocatedCommission, totalAllocatedAPI, seedAllocation, normalizeAllocation,
  autoBalanceProducts, sumProductAPI,
} from '../moneyNeedsAllocation';

describe('moneyNeedsAllocation — constants', () => {
  it('LINE_DEFAULT_RATES matches the locked decision', () => {
    expect(LINE_DEFAULT_RATES).toEqual({ life: 0.35, ah: 0.25, general: 0.10 });
  });
  it('AVG_POLICY_API is the shared 12000 divisor', () => {
    expect(AVG_POLICY_API).toBe(12000);
  });
  it('three allocation lines, general subsumes property/motor', () => {
    expect(ALLOC_LINE_KEYS).toEqual(['life', 'ah', 'general']);
  });
  it('product seeds: Life all 0.35; General Motor/Property/Group/Commercial', () => {
    expect(PRODUCT_SEEDS.life.every((p) => p.rate === 0.35)).toBe(true);
    expect(PRODUCT_SEEDS.general.map((p) => [p.name, p.rate])).toEqual([
      ['Motor', 0.10], ['Property', 0.125], ['Group', 0.10], ['Commercial', 0.10],
    ]);
  });
});

describe('visibleLineKeys — license → visible lines (A&H always present)', () => {
  it('composite → all three', () => {
    expect(visibleLineKeys('composite')).toEqual(['life', 'ah', 'general']);
  });
  it('life_only → life + ah (no general)', () => {
    expect(visibleLineKeys('life_only')).toEqual(['life', 'ah']);
  });
  it('general_only → ah + general (no life)', () => {
    expect(visibleLineKeys('general_only')).toEqual(['ah', 'general']);
  });
  it('A&H is present in every profile', () => {
    for (const p of ['composite', 'life_only', 'general_only']) {
      expect(visibleLineKeys(p)).toContain('ah');
    }
  });
  it('unknown profile falls back to composite', () => {
    expect(visibleLineKeys(undefined)).toEqual(['life', 'ah', 'general']);
  });
});

describe('allocApps — API ÷ blended avg-policy', () => {
  it('divides by 12000 by default', () => {
    expect(allocApps(120000)).toBe(10);
  });
  it('honours an override divisor', () => {
    expect(allocApps(120000, 10000)).toBe(12);
  });
  it('zero / non-positive divisor → 0', () => {
    expect(allocApps(120000, 0)).toBe(10); // falls back to AVG_POLICY_API
    expect(allocApps(0)).toBe(0);
  });
});

describe('lineCommission — collapsed = API × rate', () => {
  it('collapsed line uses the editable line rate', () => {
    expect(lineCommission({ api: 100000, rate: 0.35 })).toBeCloseTo(35000);
  });
  it('editing the rate changes the commission', () => {
    expect(lineCommission({ api: 100000, rate: 0.4 })).toBeCloseTo(40000);
  });
  it('general uses API × rate (6% premium-tax deferred this PR)', () => {
    expect(lineCommission({ api: 200000, rate: 0.10 })).toBeCloseTo(20000);
  });
});

describe('lineCommission / effectiveLineRate — drilled = Σ(product.api × rate)', () => {
  const drilled = {
    api: 100000,
    rate: 0.35,
    drilled: true,
    products: [
      { name: 'Whole Life', api: 60000, rate: 0.35 },
      { name: 'Term',       api: 40000, rate: 0.20 },
    ],
  };
  it('drilled commission sums product api × product rate', () => {
    // 60000*0.35 + 40000*0.20 = 21000 + 8000 = 29000
    expect(lineCommission(drilled)).toBeCloseTo(29000);
  });
  it('derived weighted-average rate = lineCommission ÷ lineAPI', () => {
    // 29000 / 100000 = 0.29
    expect(effectiveLineRate(drilled)).toBeCloseTo(0.29);
  });
  it('collapsed effective rate is the line rate', () => {
    expect(effectiveLineRate({ api: 50000, rate: 0.35 })).toBe(0.35);
  });
  it('isDrilled requires drilled flag AND non-empty products', () => {
    expect(isDrilled(drilled)).toBe(true);
    expect(isDrilled({ drilled: true, products: [] })).toBe(false);
    expect(isDrilled({ drilled: false, products: [{ api: 1, rate: 1 }] })).toBe(false);
  });
});

describe('totals', () => {
  const lines = {
    life:    { api: 100000, rate: 0.35 },
    ah:      { api: 40000,  rate: 0.25 },
    general: { api: 200000, rate: 0.10 },
  };
  it('totalAllocatedCommission sums visible lines only', () => {
    // life 35000 + ah 10000 = 45000 (general omitted)
    expect(totalAllocatedCommission(lines, ['life', 'ah'])).toBeCloseTo(45000);
  });
  it('totalAllocatedAPI sums visible lines only', () => {
    expect(totalAllocatedAPI(lines, ['life', 'general'])).toBe(300000);
  });
});

describe('seedAllocation — from worksheet commission targets', () => {
  const ws = {
    firstYearCommissionsTargets: { life: 35000, ah: 10000, property: 10000, motor: 10000 },
  };
  it('seeds line API = target ÷ default rate', () => {
    const a = seedAllocation(ws, 'composite');
    expect(a.lines.life.api).toBe(100000);   // 35000 / 0.35
    expect(a.lines.ah.api).toBe(40000);       // 10000 / 0.25
    expect(a.lines.general.api).toBe(200000); // (10000+10000) / 0.10
  });
  it('seeds default rates and seeded product lists', () => {
    const a = seedAllocation(ws, 'composite');
    expect(a.lines.life.rate).toBe(0.35);
    expect(a.lines.life.products).toHaveLength(4);
    expect(a.lines.life.drilled).toBe(false);
    expect(a.lines.general.products[1]).toMatchObject({ name: 'Property', rate: 0.125 });
  });
  it('absent targets seed 0 (honest-data, no zeros-as-data)', () => {
    const a = seedAllocation({}, 'composite');
    expect(a.lines.life.api).toBe(0);
  });
  it('records the licenseClass', () => {
    expect(seedAllocation(ws, 'life_only').licenseClass).toBe('life_only');
  });
});

describe('normalizeAllocation — merge stored onto seed', () => {
  const ws = { firstYearCommissionsTargets: { life: 35000 } };
  it('null stored → fresh seed', () => {
    expect(normalizeAllocation(null, ws, 'composite').lines.life.api).toBe(100000);
  });
  it('stored values win, gaps backfill', () => {
    const stored = { licenseClass: 'composite', lines: { life: { api: 500000, rate: 0.4, drilled: false } } };
    const a = normalizeAllocation(stored, ws, 'composite');
    expect(a.lines.life.api).toBe(500000);
    expect(a.lines.life.rate).toBe(0.4);
    expect(a.lines.ah).toBeDefined();        // backfilled
    expect(a.lines.life.products).toHaveLength(4); // backfilled
  });
  it('caps stored products at MAX_PRODUCTS', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, api: 1000, rate: 0.3 }));
    const stored = { lines: { life: { api: 5000, drilled: true, products: five } } };
    const a = normalizeAllocation(stored, ws, 'composite');
    expect(a.lines.life.products).toHaveLength(MAX_PRODUCTS);
  });
});

describe('autoBalanceProducts / sumProductAPI', () => {
  it('distributes a total evenly, remainder on the last product', () => {
    const balanced = autoBalanceProducts([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 100000);
    expect(balanced.map((p) => p.api)).toEqual([33333, 33333, 33334]);
    expect(sumProductAPI(balanced)).toBe(100000);
  });
  it('preserves names and rates', () => {
    const balanced = autoBalanceProducts([{ name: 'A', rate: 0.3 }, { name: 'B', rate: 0.2 }], 50000);
    expect(balanced.map((p) => [p.name, p.rate])).toEqual([['A', 0.3], ['B', 0.2]]);
  });
  it('caps at MAX_PRODUCTS and handles empty', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}` }));
    expect(autoBalanceProducts(many, 40000)).toHaveLength(MAX_PRODUCTS);
    expect(autoBalanceProducts([], 100)).toEqual([]);
  });
});
