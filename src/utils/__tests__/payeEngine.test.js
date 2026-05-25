import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYE_CONFIG, computePAYE, grossFromNet } from '../payeEngine.js';

describe('DEFAULT_PAYE_CONFIG shape', () => {
  it('personalAllowance is 90,000', () => {
    expect(DEFAULT_PAYE_CONFIG.personalAllowance).toBe(90000);
  });
  it('has two chargeableBrackets', () => {
    expect(DEFAULT_PAYE_CONFIG.chargeableBrackets).toHaveLength(2);
  });
  it('first bracket: 25% up to 1,000,000 chargeable', () => {
    expect(DEFAULT_PAYE_CONFIG.chargeableBrackets[0]).toEqual({ upToChargeable: 1000000, rate: 0.25 });
  });
  it('second bracket: 30% open-top', () => {
    expect(DEFAULT_PAYE_CONFIG.chargeableBrackets[1]).toEqual({ upToChargeable: null, rate: 0.30 });
  });
});

describe('computePAYE — forward vectors', () => {
  it('50,000 → 0 (below allowance)', () => {
    expect(computePAYE(50000)).toBe(0);
  });
  it('90,000 → 0 (at allowance ceiling)', () => {
    expect(computePAYE(90000)).toBe(0);
  });
  it('370,000 → 70,000 (25% band)', () => {
    expect(computePAYE(370000)).toBe(70000);
  });
  it('1,090,000 → 250,000 (25% band ceiling)', () => {
    expect(computePAYE(1090000)).toBe(250000);
  });
  it('1,318,571.43 → 318,571.43 (30% band)', () => {
    expect(computePAYE(1318571.43)).toBeCloseTo(318571.43, 2);
  });
  it('1,500,000 → 373,000 (30% band)', () => {
    expect(computePAYE(1500000)).toBe(373000);
  });
});

describe('computePAYE — edge cases', () => {
  it('0 → 0', () => {
    expect(computePAYE(0)).toBe(0);
  });
  it('negative → 0', () => {
    expect(computePAYE(-1000)).toBe(0);
  });
  it('non-numeric string → 0', () => {
    expect(computePAYE('abc')).toBe(0);
  });
  it('NaN → 0', () => {
    expect(computePAYE(NaN)).toBe(0);
  });
  it('undefined → 0', () => {
    expect(computePAYE(undefined)).toBe(0);
  });
  it('numeric string parses correctly', () => {
    expect(computePAYE('370000')).toBe(70000);
  });
});

describe('grossFromNet — reverse vectors', () => {
  it('60,000 → 60,000 (below allowance)', () => {
    expect(grossFromNet(60000)).toBe(60000);
  });
  it('90,000 → 90,000 (at allowance)', () => {
    expect(grossFromNet(90000)).toBe(90000);
  });
  it('300,000 → 370,000 (25% band)', () => {
    expect(grossFromNet(300000)).toBe(370000);
  });
  it('500,000 → 636,666.67 (25% band)', () => {
    expect(grossFromNet(500000)).toBeCloseTo(636666.67, 2);
  });
  it('840,000 → 1,090,000 (pivot — top of 25% band)', () => {
    expect(grossFromNet(840000)).toBe(1090000);
  });
  it('1,000,000 → 1,318,571.43 (30% band)', () => {
    expect(grossFromNet(1000000)).toBeCloseTo(1318571.43, 2);
  });
});

describe('grossFromNet — edge cases', () => {
  it('0 → 0', () => {
    expect(grossFromNet(0)).toBe(0);
  });
  it('negative → 0', () => {
    expect(grossFromNet(-1000)).toBe(0);
  });
  it('non-numeric string → 0', () => {
    expect(grossFromNet('abc')).toBe(0);
  });
  it('NaN → 0', () => {
    expect(grossFromNet(NaN)).toBe(0);
  });
  it('undefined → 0', () => {
    expect(grossFromNet(undefined)).toBe(0);
  });
  it('numeric string parses correctly', () => {
    expect(grossFromNet('300000')).toBe(370000);
  });
});

describe('band formulas', () => {
  it('25% band: gross = (net − 22,500) / 0.75', () => {
    expect(grossFromNet(500000)).toBeCloseTo((500000 - 22500) / 0.75, 2);
  });
  it('30% band: gross = (net − 77,000) / 0.70', () => {
    expect(grossFromNet(1000000)).toBeCloseTo((1000000 - 77000) / 0.70, 2);
  });
});

describe('pivot continuity', () => {
  it('grossFromNet(840,000) === 1,090,000', () => {
    expect(grossFromNet(840000)).toBe(1090000);
  });
  it('computePAYE(1,090,000) === 250,000', () => {
    expect(computePAYE(1090000)).toBe(250000);
  });
  it('1,090,000 − computePAYE(1,090,000) === 840,000', () => {
    expect(1090000 - computePAYE(1090000)).toBe(840000);
  });
});

describe('round-trip property: grossFromNet(gross − computePAYE(gross)) ≈ gross', () => {
  const cases = [50000, 90000, 150000, 370000, 600000, 840000, 1090000, 1200000, 1500000, 2000000];
  cases.forEach(gross => {
    it(`round-trip at gross = ${gross.toLocaleString()}`, () => {
      const net = gross - computePAYE(gross);
      expect(grossFromNet(net)).toBeCloseTo(gross, 2);
    });
  });
});
