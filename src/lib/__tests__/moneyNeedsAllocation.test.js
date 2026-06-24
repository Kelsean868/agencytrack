import { describe, it, expect } from 'vitest';
import {
  AVG_POLICY_API, LINE_DEFAULT_RATES, ALLOC_LINE_KEYS, MAX_PRODUCTS, PRODUCT_SEEDS,
  visibleLineKeys, allocApps, isDrilled, productAPI, lineCommission, lineAPI, effectiveLineRate,
  totalAllocatedCommission, totalAllocatedAPI, seedAllocation, normalizeAllocation,
  autoBalanceProducts, sumProductCommission, sumProductAPI, buildAllocationSummary,
  allocationToYearPlan,
} from '../moneyNeedsAllocation';

describe('moneyNeedsAllocation — constants', () => {
  it('LINE_DEFAULT_RATES matches the locked decision', () => {
    expect(LINE_DEFAULT_RATES).toEqual({ life: 0.35, ah: 0.25, general: 0.10 });
  });
  it('AVG_POLICY_API is the shared 12000 divisor', () => {
    expect(AVG_POLICY_API).toBe(12000);
  });
  it('three allocation lines', () => {
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
  it('composite → all three', () => expect(visibleLineKeys('composite')).toEqual(['life', 'ah', 'general']));
  it('life_only → life + ah', () => expect(visibleLineKeys('life_only')).toEqual(['life', 'ah']));
  it('general_only → ah + general', () => expect(visibleLineKeys('general_only')).toEqual(['ah', 'general']));
  it('A&H present in every profile', () => {
    for (const p of ['composite', 'life_only', 'general_only']) expect(visibleLineKeys(p)).toContain('ah');
  });
  it('unknown profile falls back to composite', () => expect(visibleLineKeys(undefined)).toEqual(['life', 'ah', 'general']));
});

describe('allocApps — API ÷ blended avg-policy', () => {
  it('divides by 12000 by default', () => expect(allocApps(120000)).toBe(10));
  it('honours an override divisor', () => expect(allocApps(120000, 10000)).toBe(12));
  it('non-positive divisor falls back; zero api → 0', () => {
    expect(allocApps(120000, 0)).toBe(10);
    expect(allocApps(0)).toBe(0);
  });
});

describe('commission-canonical math — collapsed', () => {
  it('lineCommission = the stored commission (canonical)', () => {
    expect(lineCommission({ commission: 35000, rate: 0.35 })).toBe(35000);
  });
  it('lineAPI = commission ÷ rate (derived)', () => {
    expect(lineAPI({ commission: 35000, rate: 0.35 })).toBeCloseTo(100000);
  });
  it('rate change keeps commission, re-derives API (higher rate → less API)', () => {
    const line = { commission: 35000, rate: 0.35 };
    expect(lineAPI(line)).toBeCloseTo(100000);
    const better = { ...line, rate: 0.5 };
    expect(lineCommission(better)).toBe(35000);   // commission fixed
    expect(lineAPI(better)).toBeCloseTo(70000);   // API re-derived (35000/0.5)
  });
  it('effectiveLineRate collapsed = the line rate', () => {
    expect(effectiveLineRate({ commission: 10000, rate: 0.25 })).toBe(0.25);
  });
  it('rate 0 → derived API 0 (no divide-by-zero)', () => {
    expect(lineAPI({ commission: 10000, rate: 0 })).toBe(0);
  });
});

describe('commission-canonical math — drilled (products define the line)', () => {
  const drilled = {
    commission: 0, rate: 0.35, drilled: true,
    products: [
      { name: 'Whole Life', commission: 21000, rate: 0.35 }, // api 60000
      { name: 'Term',       commission: 8000,  rate: 0.20 }, // api 40000
    ],
  };
  it('productAPI = commission ÷ rate', () => {
    expect(productAPI(drilled.products[0])).toBeCloseTo(60000);
    expect(productAPI(drilled.products[1])).toBeCloseTo(40000);
  });
  it('lineCommission = Σ product.commission', () => {
    expect(lineCommission(drilled)).toBe(29000);
  });
  it('lineAPI = Σ productAPI', () => {
    expect(lineAPI(drilled)).toBeCloseTo(100000);
  });
  it('effectiveLineRate = lineCommission ÷ lineAPI (weighted, read-only)', () => {
    expect(effectiveLineRate(drilled)).toBeCloseTo(0.29); // 29000 / 100000
  });
  it('isDrilled requires flag AND non-empty products', () => {
    expect(isDrilled(drilled)).toBe(true);
    expect(isDrilled({ drilled: true, products: [] })).toBe(false);
    expect(isDrilled({ drilled: false, products: [{ commission: 1, rate: 1 }] })).toBe(false);
  });
});

describe('totals', () => {
  const lines = {
    life:    { commission: 35000, rate: 0.35 },
    ah:      { commission: 10000, rate: 0.25 },
    general: { commission: 20000, rate: 0.10 },
  };
  it('totalAllocatedCommission sums visible lines only', () => {
    expect(totalAllocatedCommission(lines, ['life', 'ah'])).toBe(45000);
  });
  it('totalAllocatedAPI sums derived API of visible lines only', () => {
    expect(totalAllocatedAPI(lines, ['life', 'general'])).toBeCloseTo(300000); // 100000 + 200000
  });
});

describe('seedAllocation — commission seeded directly from targets', () => {
  const ws = { firstYearCommissionsTargets: { life: 35000, ah: 10000, property: 10000, motor: 10000 } };
  it('seeds line commission = the commission target (no ÷ rate)', () => {
    const a = seedAllocation(ws, 'composite');
    expect(a.lines.life.commission).toBe(35000);
    expect(a.lines.ah.commission).toBe(10000);
    expect(a.lines.general.commission).toBe(20000); // property + motor
  });
  it('seeds default rates + product lists (commission:0)', () => {
    const a = seedAllocation(ws, 'composite');
    expect(a.lines.life.rate).toBe(0.35);
    expect(a.lines.life.products).toHaveLength(4);
    expect(a.lines.life.products[0]).toMatchObject({ name: 'Whole Life', commission: 0, rate: 0.35 });
    expect(a.lines.general.products[1]).toMatchObject({ name: 'Property', commission: 0, rate: 0.125 });
  });
  it('absent targets seed 0', () => expect(seedAllocation({}, 'composite').lines.life.commission).toBe(0));
  it('records licenseClass', () => expect(seedAllocation(ws, 'life_only').licenseClass).toBe('life_only'));
});

describe('normalizeAllocation — merge stored (commission) onto seed', () => {
  const ws = { firstYearCommissionsTargets: { life: 35000 } };
  it('null stored → fresh seed', () => {
    expect(normalizeAllocation(null, ws, 'composite').lines.life.commission).toBe(35000);
  });
  it('stored commission wins, gaps backfill', () => {
    const stored = { licenseClass: 'composite', lines: { life: { commission: 50000, rate: 0.4, drilled: false } } };
    const a = normalizeAllocation(stored, ws, 'composite');
    expect(a.lines.life.commission).toBe(50000);
    expect(a.lines.life.rate).toBe(0.4);
    expect(a.lines.ah).toBeDefined();
    expect(a.lines.life.products).toHaveLength(4);
  });
  it('caps stored products at MAX_PRODUCTS, carries commission', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, commission: 1000, rate: 0.3 }));
    const stored = { lines: { life: { commission: 5000, drilled: true, products: five } } };
    const a = normalizeAllocation(stored, ws, 'composite');
    expect(a.lines.life.products).toHaveLength(MAX_PRODUCTS);
    expect(a.lines.life.products[0]).toMatchObject({ commission: 1000, rate: 0.3 });
  });
});

describe('autoBalanceProducts / sums (commission)', () => {
  it('distributes a COMMISSION total evenly, remainder on last', () => {
    const balanced = autoBalanceProducts([{ name: 'A', rate: 0.3 }, { name: 'B', rate: 0.3 }, { name: 'C', rate: 0.3 }], 100000);
    expect(balanced.map((p) => p.commission)).toEqual([33333, 33333, 33334]);
    expect(sumProductCommission(balanced)).toBe(100000);
  });
  it('preserves names + rates', () => {
    const balanced = autoBalanceProducts([{ name: 'A', rate: 0.35 }, { name: 'B', rate: 0.2 }], 50000);
    expect(balanced.map((p) => [p.name, p.rate])).toEqual([['A', 0.35], ['B', 0.2]]);
  });
  it('sumProductAPI is derived (Σ commission ÷ rate)', () => {
    const products = [{ commission: 21000, rate: 0.35 }, { commission: 8000, rate: 0.20 }];
    expect(sumProductAPI(products)).toBeCloseTo(100000); // 60000 + 40000
  });
  it('caps at MAX_PRODUCTS; empty → empty', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, rate: 0.3 }));
    expect(autoBalanceProducts(many, 40000)).toHaveLength(MAX_PRODUCTS);
    expect(autoBalanceProducts([], 100)).toEqual([]);
  });
});

describe('buildAllocationSummary', () => {
  const collapsedAlloc = {
    lines: {
      life:    { commission: 35000, rate: 0.35 },
      ah:      { commission: 10000, rate: 0.25 },
      general: { commission: 20000, rate: 0.10 },
    },
  };

  it('collapsed line — commission, derived api, apps, effectiveRate; products = null', () => {
    const s = buildAllocationSummary(collapsedAlloc, ['life'], 100000);
    const life = s.lines[0];
    expect(life.key).toBe('life');
    expect(life.label).toBe('Life');
    expect(life.commission).toBe(35000);
    expect(life.api).toBeCloseTo(100000);       // 35000 ÷ 0.35
    expect(life.apps).toBe(Math.round(100000 / 12000)); // ≈8
    expect(life.effectiveRate).toBeCloseTo(0.35);
    expect(life.products).toBeNull();
  });

  it('drilled line — product rows, line totals = Σ products, effective weighted rate', () => {
    const drilledAlloc = {
      lines: {
        life: {
          commission: 0, rate: 0.35, drilled: true,
          products: [
            { name: 'Whole Life', commission: 21000, rate: 0.35 }, // api 60000
            { name: 'Term',       commission: 8000,  rate: 0.20 }, // api 40000
          ],
        },
      },
    };
    const s = buildAllocationSummary(drilledAlloc, ['life'], 100000);
    const life = s.lines[0];
    expect(life.commission).toBe(29000);          // 21000 + 8000
    expect(life.api).toBeCloseTo(100000);         // 60000 + 40000
    expect(life.effectiveRate).toBeCloseTo(0.29); // 29000 ÷ 100000
    expect(life.products).toHaveLength(2);
    expect(life.products[0]).toMatchObject({ name: 'Whole Life', commission: 21000, rate: 0.35 });
    expect(life.products[0].api).toBeCloseTo(60000);
    expect(life.products[1]).toMatchObject({ name: 'Term', commission: 8000, rate: 0.20 });
    expect(life.products[1].api).toBeCloseTo(40000);
  });

  it('totals — totalCommission, totalAPI, allocatedPct', () => {
    const s = buildAllocationSummary(collapsedAlloc, ['life', 'ah', 'general'], 130000);
    expect(s.totalCommission).toBe(65000);        // 35000+10000+20000
    expect(s.totalAPI).toBeCloseTo(340000);       // 100000+40000+200000
    expect(s.allocatedPct).toBeCloseTo(65000 / 130000);
    expect(s.required).toBe(130000);
  });

  it('required = 0 guard → allocatedPct = 0 (no divide-by-zero)', () => {
    const s = buildAllocationSummary(collapsedAlloc, ['life'], 0);
    expect(s.allocatedPct).toBe(0);
  });

  it('empty alloc → all commissions 0, products null, totals 0', () => {
    const s = buildAllocationSummary({ lines: {} }, ['life', 'ah', 'general'], 100000);
    expect(s.lines.every((l) => l.commission === 0)).toBe(true);
    expect(s.lines.every((l) => l.products === null)).toBe(true);
    expect(s.totalCommission).toBe(0);
    expect(s.allocatedPct).toBe(0);
  });

  it('visibleKeys defaults to all three lines when omitted', () => {
    const s = buildAllocationSummary(collapsedAlloc, undefined, 100000);
    expect(s.lines.map((l) => l.key)).toEqual(['life', 'ah', 'general']);
  });
});

describe('allocationToYearPlan — commission allocation → yearPlan keyed object (Direction 1.5)', () => {
  const composite = {
    licenseClass: 'composite',
    lines: {
      life:    { commission: 35000, rate: 0.35 }, // api 100000
      ah:      { commission: 10000, rate: 0.25 }, // api 40000
      general: { commission: 20000, rate: 0.10 }, // api 200000
    },
  };

  it('emits exactly the 3 canonical keys with targetAPI = lineAPI', () => {
    const lines = allocationToYearPlan(composite);
    expect(Object.keys(lines)).toEqual(['life', 'ah', 'general']);
    expect(lines.life.targetAPI).toBeCloseTo(100000);
    expect(lines.ah.targetAPI).toBeCloseTo(40000);
    expect(lines.general.targetAPI).toBeCloseTo(200000); // general carried, never dropped
  });

  it('carries derivedCommission, rate, and pct share', () => {
    const lines = allocationToYearPlan(composite);
    expect(lines.life.derivedCommission).toBe(35000);
    expect(lines.life.rate).toBeCloseTo(0.35);
    // pct share of total enabled targetAPI (100000 / 340000)
    expect(lines.life.pct).toBeCloseTo((100000 / 340000) * 100, 1);
  });

  it('ROUND-TRIP invariant: Σ targetAPI (enabled) === totalAllocatedAPI (visible) — general non-zero', () => {
    const lines = allocationToYearPlan(composite);
    const sumTargets = ['life', 'ah', 'general']
      .reduce((s, k) => s + (lines[k].enabled ? lines[k].targetAPI : 0), 0);
    const allocatorTotal = totalAllocatedAPI(composite.lines, visibleLineKeys('composite'));
    expect(sumTargets).toBeCloseTo(allocatorTotal);
    expect(sumTargets).toBeCloseTo(340000); // 100000 + 40000 + 200000 (general's 200k present)
  });

  it('drilled line carries products as { name, api, rate } (≤4) and weighted rate', () => {
    const drilled = {
      licenseClass: 'composite',
      lines: {
        life: {
          commission: 0, rate: 0.35, drilled: true,
          products: [
            { name: 'Whole Life', commission: 21000, rate: 0.35 }, // api 60000
            { name: 'Term',       commission: 8000,  rate: 0.20 }, // api 40000
          ],
        },
        ah:      { commission: 0, rate: 0.25 },
        general: { commission: 0, rate: 0.10 },
      },
    };
    const lines = allocationToYearPlan(drilled);
    expect(lines.life.targetAPI).toBeCloseTo(100000);      // Σ productAPI
    expect(lines.life.derivedCommission).toBe(29000);      // Σ product commission
    expect(lines.life.rate).toBeCloseTo(0.29);             // weighted
    expect(lines.life.products).toHaveLength(2);
    expect(lines.life.products[0]).toMatchObject({ name: 'Whole Life', rate: 0.35 });
    expect(lines.life.products[0].api).toBeCloseTo(60000);
    expect(lines.life.products[1]).toMatchObject({ name: 'Term', rate: 0.20 });
    expect(lines.life.products[1].api).toBeCloseTo(40000);
  });

  it('license gating: life_only disables general (enabled:false, targetAPI:0) — not in total', () => {
    const lines = allocationToYearPlan({ ...composite, licenseClass: 'life_only' });
    expect(lines.life.enabled).toBe(true);
    expect(lines.ah.enabled).toBe(true);
    expect(lines.general.enabled).toBe(false);
    expect(lines.general.targetAPI).toBe(0);
    const sumTargets = ['life', 'ah', 'general']
      .reduce((s, k) => s + (lines[k].enabled ? lines[k].targetAPI : 0), 0);
    expect(sumTargets).toBeCloseTo(140000); // life 100000 + ah 40000 only
  });

  it('unknown licenseClass falls back to composite (all three enabled)', () => {
    const lines = allocationToYearPlan({ licenseClass: 'bogus', lines: composite.lines });
    expect(lines.life.enabled && lines.ah.enabled && lines.general.enabled).toBe(true);
  });

  it('empty allocation → zeroed lines, no throw', () => {
    const lines = allocationToYearPlan({});
    expect(Object.keys(lines)).toEqual(['life', 'ah', 'general']);
    expect(['life', 'ah', 'general'].every((k) => lines[k].targetAPI === 0)).toBe(true);
  });
});
