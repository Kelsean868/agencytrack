import { describe, it, expect } from 'vitest';
import {
  LICENSE_LINE_GATING,
  applyGating,
  seedFromTargets,
  derivedApps,
  derivedCommission,
  recomputePct,
  applyPctToLines,
  switchToDirectMode,
  switchToPercentMode,
  absorbRounding,
  blankLines,
  enrichLines,
} from '../yearPlanAllocation';

// ── applyGating ───────────────────────────────────────────────────────────────

describe('applyGating', () => {
  it('composite enables all four lines', () => {
    const lines = blankLines();
    const result = applyGating(lines, 'composite');
    expect(result.life.enabled).toBe(true);
    expect(result.ah.enabled).toBe(true);
    expect(result.property.enabled).toBe(true);
    expect(result.motor.enabled).toBe(true);
  });

  it('life_only enables life + ah, disables property + motor', () => {
    const lines = blankLines();
    const result = applyGating(lines, 'life_only');
    expect(result.life.enabled).toBe(true);
    expect(result.ah.enabled).toBe(true);
    expect(result.property.enabled).toBe(false);
    expect(result.motor.enabled).toBe(false);
  });

  it('general_only disables life, enables ah + property + motor', () => {
    const lines = blankLines();
    const result = applyGating(lines, 'general_only');
    expect(result.life.enabled).toBe(false);
    expect(result.ah.enabled).toBe(true);
    expect(result.property.enabled).toBe(true);
    expect(result.motor.enabled).toBe(true);
  });

  it('unknown profile falls back to composite', () => {
    const lines = blankLines();
    const result = applyGating(lines, 'unknown_profile');
    expect(result.life.enabled).toBe(true);
    expect(result.ah.enabled).toBe(true);
  });

  it('matches LICENSE_LINE_GATING export exactly', () => {
    const lines = blankLines();
    for (const profile of ['composite', 'life_only', 'general_only']) {
      const result = applyGating(lines, profile);
      for (const key of ['life', 'ah', 'property', 'motor']) {
        expect(result[key].enabled).toBe(LICENSE_LINE_GATING[profile][key]);
      }
    }
  });
});

// ── seedFromTargets ───────────────────────────────────────────────────────────

describe('seedFromTargets', () => {
  it('converts commission target to API via rate (35%)', () => {
    const targets = { life: 35000, ah: 0, property: 0, motor: 0 };
    const result = seedFromTargets(targets, 35);
    // 35000 ÷ 0.35 = 100 000
    expect(result.life.targetAPI).toBeCloseTo(100000, 2);
    expect(result.life.seeded).toBe(true);
    expect(result.life.seedSource).toBe(35000);
  });

  it('marks lines with target=0 as not seeded', () => {
    const targets = { life: 0, ah: 0, property: 0, motor: 0 };
    const result = seedFromTargets(targets, 35);
    expect(result.life.seeded).toBe(false);
    expect(result.life.targetAPI).toBe(0);
  });

  it('handles all four lines independently', () => {
    const targets = { life: 14000, ah: 7000, property: 3500, motor: 3500 };
    const result = seedFromTargets(targets, 35);
    expect(result.life.targetAPI).toBeCloseTo(40000, 2);
    expect(result.ah.targetAPI).toBeCloseTo(20000, 2);
    expect(result.property.targetAPI).toBeCloseTo(10000, 2);
    expect(result.motor.targetAPI).toBeCloseTo(10000, 2);
  });

  it('defaults to 35% rate if commissionRate is 0 or missing', () => {
    const targets = { life: 35000, ah: 0, property: 0, motor: 0 };
    const result = seedFromTargets(targets, 0);
    expect(result.life.targetAPI).toBeCloseTo(100000, 2);
  });
});

// ── derivedApps + derivedCommission ──────────────────────────────────────────

describe('derivedApps', () => {
  it('divides targetAPI by avgPolicyAPI', () => {
    expect(derivedApps(120000, 12000)).toBeCloseTo(10, 4);
  });

  it('defaults to 12000 avg policy when not provided', () => {
    expect(derivedApps(12000)).toBeCloseTo(1, 4);
  });

  it('returns 0 for zero targetAPI', () => {
    expect(derivedApps(0, 12000)).toBe(0);
  });
});

describe('derivedCommission', () => {
  it('multiplies targetAPI by rate fraction (35%)', () => {
    expect(derivedCommission(100000, 35)).toBeCloseTo(35000, 2);
  });

  it('defaults to 35% when rate is 0 or missing', () => {
    expect(derivedCommission(100000, 0)).toBeCloseTo(35000, 2);
  });
});

// ── recomputePct ──────────────────────────────────────────────────────────────

describe('recomputePct', () => {
  it('shares sum to 100 for two equal enabled lines', () => {
    const lines = {
      life:     { targetAPI: 50000, pct: 0, enabled: true  },
      ah:       { targetAPI: 50000, pct: 0, enabled: true  },
      property: { targetAPI: 0,     pct: 0, enabled: false },
      motor:    { targetAPI: 0,     pct: 0, enabled: false },
    };
    const result = recomputePct(lines);
    expect(result.life.pct).toBeCloseTo(50, 1);
    expect(result.ah.pct).toBeCloseTo(50, 1);
    expect(result.life.pct + result.ah.pct).toBeCloseTo(100, 5);
  });

  it('last-line absorbs rounding — pcts sum to exactly 100', () => {
    const lines = {
      life:     { targetAPI: 33333, pct: 0, enabled: true },
      ah:       { targetAPI: 33333, pct: 0, enabled: true },
      property: { targetAPI: 33334, pct: 0, enabled: true },
      motor:    { targetAPI: 0,     pct: 0, enabled: false },
    };
    const result = recomputePct(lines);
    const total = result.life.pct + result.ah.pct + result.property.pct;
    expect(total).toBeCloseTo(100, 5);
  });

  it('returns 0 pct for all lines when total is 0', () => {
    const lines = blankLines();
    lines.life.enabled = true;
    const result = recomputePct(lines);
    expect(result.life.pct).toBe(0);
  });
});

// ── applyPctToLines ───────────────────────────────────────────────────────────

describe('applyPctToLines', () => {
  it('sets targetAPI from totalAPI × pct for enabled lines', () => {
    const lines = {
      life:     { targetAPI: 0, pct: 60, enabled: true  },
      ah:       { targetAPI: 0, pct: 40, enabled: true  },
      property: { targetAPI: 0, pct: 0,  enabled: false },
      motor:    { targetAPI: 0, pct: 0,  enabled: false },
    };
    const result = applyPctToLines(lines, 100000);
    expect(result.life.targetAPI).toBeCloseTo(60000, 2);
    expect(result.ah.targetAPI).toBeCloseTo(40000, 2);
    expect(result.property.targetAPI).toBe(0);
    expect(result.motor.targetAPI).toBe(0);
  });
});

// ── INVARIANT: mode switch preserves targetAPI ────────────────────────────────

describe('mode switch preserves targetAPI (core invariant)', () => {
  const lines = {
    life:     { targetAPI: 60000, pct: 0, enabled: true  },
    ah:       { targetAPI: 25000, pct: 0, enabled: true  },
    property: { targetAPI: 15000, pct: 0, enabled: true  },
    motor:    { targetAPI: 0,     pct: 0, enabled: false },
  };

  it('Direct→% does not change any targetAPI', () => {
    const result = switchToPercentMode(lines);
    expect(result.life.targetAPI).toBe(60000);
    expect(result.ah.targetAPI).toBe(25000);
    expect(result.property.targetAPI).toBe(15000);
  });

  it('%→Direct does not change any targetAPI', () => {
    const withPct = recomputePct(lines);
    const result = switchToDirectMode(withPct);
    expect(result.life.targetAPI).toBe(60000);
    expect(result.ah.targetAPI).toBe(25000);
    expect(result.property.targetAPI).toBe(15000);
  });

  it('round-trip Direct→%→Direct preserves targetAPI', () => {
    const step1 = switchToPercentMode(lines);
    const step2 = switchToDirectMode(step1);
    expect(step2.life.targetAPI).toBe(lines.life.targetAPI);
    expect(step2.ah.targetAPI).toBe(lines.ah.targetAPI);
    expect(step2.property.targetAPI).toBe(lines.property.targetAPI);
  });
});

// ── absorbRounding ────────────────────────────────────────────────────────────

describe('absorbRounding', () => {
  it('two-line case: other gets 100 - edited', () => {
    const pcts = { life: 50, ah: 50 };
    const result = absorbRounding(pcts, 'life', 70, ['life', 'ah']);
    expect(result.life).toBe(70);
    expect(result.ah).toBeCloseTo(30, 5);
    expect(result.life + result.ah).toBeCloseTo(100, 5);
  });

  it('four-line case: pcts sum to 100 after absorption', () => {
    const pcts = { life: 25, ah: 25, property: 25, motor: 25 };
    const result = absorbRounding(pcts, 'life', 50, ['life', 'ah', 'property', 'motor']);
    const total = result.life + result.ah + result.property + result.motor;
    expect(total).toBeCloseTo(100, 4);
  });

  it('clamps edited pct to [0, 100]', () => {
    const pcts = { life: 50, ah: 50 };
    const result = absorbRounding(pcts, 'life', 150, ['life', 'ah']);
    expect(result.life).toBe(100);
    expect(result.ah).toBeCloseTo(0, 5);
  });

  it('sum-to-100 invariant — last-line absorbs rounding', () => {
    const pcts = { life: 33.33, ah: 33.33, property: 33.33, motor: 0 };
    const enabled = ['life', 'ah', 'property'];
    const result = absorbRounding(pcts, 'life', 40, enabled);
    const total = result.life + result.ah + result.property;
    expect(total).toBeCloseTo(100, 4);
  });
});

// ── enrichLines ───────────────────────────────────────────────────────────────

describe('enrichLines', () => {
  it('computes derivedApps and derivedCommission per line', () => {
    const lines = {
      life:     { targetAPI: 120000, pct: 60, enabled: true  },
      ah:       { targetAPI: 0,      pct: 0,  enabled: true  },
      property: { targetAPI: 0,      pct: 0,  enabled: false },
      motor:    { targetAPI: 0,      pct: 0,  enabled: false },
    };
    const result = enrichLines(lines, 35, 12000);
    expect(result.life.derivedApps).toBeCloseTo(10, 4);
    expect(result.life.derivedCommission).toBeCloseTo(42000, 2);
    expect(result.ah.derivedApps).toBe(0);
  });
});
