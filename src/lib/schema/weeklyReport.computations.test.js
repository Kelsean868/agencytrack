import { describe, it, expect } from 'vitest';
import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  computeTotalProductionCredit,
  computeTotalCommission,
  validatePppIncrease,
  validateReport,
} from './weeklyReport.computations.js';

// ── Lumpsum credit ────────────────────────────────────────────────────────────

describe('computeLumpsumCredit', () => {
  it('$50K gross → $5K credit (10%)', () => {
    expect(computeLumpsumCredit(50000)).toBe(5000);
  });

  it('zero gross → zero credit', () => {
    expect(computeLumpsumCredit(0)).toBe(0);
  });

  it('missing/null gross → zero (parseFloat guard)', () => {
    expect(computeLumpsumCredit(null)).toBe(0);
    expect(computeLumpsumCredit(undefined)).toBe(0);
  });
});

// ── Lumpsum commission ────────────────────────────────────────────────────────

describe('computeLumpsumCommission', () => {
  it('$50K gross → $250 commission (0.5%)', () => {
    expect(computeLumpsumCommission(50000)).toBe(250);
  });

  it('zero gross → zero commission', () => {
    expect(computeLumpsumCommission(0)).toBe(0);
  });
});

// ── Total production credit ───────────────────────────────────────────────────

describe('computeTotalProductionCredit', () => {
  it('NB $20K + PPP $5K + LMPS credit $5K = $30K', () => {
    const report = {
      newBusiness:  { apps: 2, api: 20000 },
      pppIncreases: { apps: 1, apiIncrease: 5000 },
      lumpsums:     { grossAmount: 50000, apiCredit: 5000, commission: 250 },
    };
    expect(computeTotalProductionCredit(report)).toBe(30000);
  });

  it('NB only → equals NB.api', () => {
    const report = {
      newBusiness:  { apps: 1, api: 15000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    expect(computeTotalProductionCredit(report)).toBe(15000);
  });

  it('missing nested fields → 0 (parseFloat guard)', () => {
    expect(computeTotalProductionCredit({})).toBe(0);
    expect(computeTotalProductionCredit(null)).toBe(0);
  });
});

// ── Total commission ──────────────────────────────────────────────────────────

describe('computeTotalCommission', () => {
  it('NB $20K × 50% + LMPS comm $250 = $10,250', () => {
    const report = {
      newBusiness:  { apps: 2, api: 20000 },
      pppIncreases: { apps: 1, apiIncrease: 5000 },
      lumpsums:     { grossAmount: 50000, apiCredit: 5000, commission: 250 },
    };
    expect(computeTotalCommission(report, 0.5)).toBe(10250);
  });

  it('PPP is excluded from commission regardless of value', () => {
    const withPpp = {
      newBusiness:  { apps: 0, api: 0 },
      pppIncreases: { apps: 1, apiIncrease: 10000 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    expect(computeTotalCommission(withPpp, 0.5)).toBe(0);
  });

  it('NB only, no LMPS → NB × rate', () => {
    const report = {
      newBusiness:  { apps: 3, api: 30000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    expect(computeTotalCommission(report, 0.35)).toBeCloseTo(10500);
  });

  it('zero rate → zero commission', () => {
    const report = {
      newBusiness:  { apps: 1, api: 20000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    expect(computeTotalCommission(report, 0)).toBe(0);
  });
});

// ── PPP validation ────────────────────────────────────────────────────────────

describe('validatePppIncrease', () => {
  it('$2,400 is valid (at minimum)', () => {
    expect(validatePppIncrease(2400)).toBe(true);
  });

  it('$2,399 is invalid (below minimum)', () => {
    expect(validatePppIncrease(2399)).toBe(false);
  });

  it('0 is invalid', () => {
    expect(validatePppIncrease(0)).toBe(false);
  });

  it('negative is invalid', () => {
    expect(validatePppIncrease(-100)).toBe(false);
  });

  it('large value is valid', () => {
    expect(validatePppIncrease(8000)).toBe(true);
  });
});

// ── Report validation ─────────────────────────────────────────────────────────

describe('validateReport', () => {
  it('all-zeros report is valid', () => {
    const report = {
      newBusiness:  { apps: 0, api: 0 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    const result = validateReport(report);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('negative NB api is invalid', () => {
    const report = {
      newBusiness:  { apps: 1, api: -5000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    const result = validateReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('newBusiness.api cannot be negative');
  });

  it('PPP below minimum when non-zero is invalid', () => {
    const report = {
      newBusiness:  { apps: 0, api: 0 },
      pppIncreases: { apps: 1, apiIncrease: 1000 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    const result = validateReport(report);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/below minimum/);
  });

  it('PPP at exactly minimum is valid', () => {
    const report = {
      newBusiness:  { apps: 0, api: 0 },
      pppIncreases: { apps: 1, apiIncrease: 2400 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    expect(validateReport(report).valid).toBe(true);
  });

  it('zero LMPS → both credit and commission zero is valid', () => {
    const report = {
      newBusiness:  { apps: 1, api: 10000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    };
    expect(validateReport(report).valid).toBe(true);
  });
});
