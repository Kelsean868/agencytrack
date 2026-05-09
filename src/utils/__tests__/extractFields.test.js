import { describe, it, expect } from 'vitest';
import { extractFields, extractTotalProductionCredit, extractTotalCommission } from '../extractFields';

describe('extractFields — V2-first reads', () => {
  it('V2 doc: apiSold reads from newBusiness.api', () => {
    const doc = { version: 2, newBusiness: { api: 18500, apps: 3 } };
    expect(extractFields(doc).apiSold).toBe(18500);
  });

  it('V2 doc: applicationsSold reads from newBusiness.apps', () => {
    const doc = { version: 2, newBusiness: { api: 18500, apps: 3 } };
    expect(extractFields(doc).applicationsSold).toBe(3);
  });

  it('V2 doc: V1 apiSold field is ignored when version===2', () => {
    const doc = { version: 2, newBusiness: { api: 5000, apps: 1 }, apiSold: 99999 };
    expect(extractFields(doc).apiSold).toBe(5000);
  });

  it('V2 doc: V1 applicationsSold field is ignored when version===2', () => {
    const doc = { version: 2, newBusiness: { api: 5000, apps: 1 }, applicationsSold: 99 };
    expect(extractFields(doc).applicationsSold).toBe(1);
  });

  it('V2 doc: missing newBusiness returns 0 (no crash)', () => {
    const doc = { version: 2 };
    expect(extractFields(doc).apiSold).toBe(0);
    expect(extractFields(doc).applicationsSold).toBe(0);
  });
});

describe('extractFields — V1 fallback reads', () => {
  it('V1 doc: apiSold reads from apiSold field', () => {
    expect(extractFields({ apiSold: 20000, applicationsSold: 4 }).apiSold).toBe(20000);
  });

  it('V1 doc: apiSold falls back to api alias', () => {
    expect(extractFields({ api: 15000 }).apiSold).toBe(15000);
  });

  it('V1 doc: apiSold falls back to annualPremium alias', () => {
    expect(extractFields({ annualPremium: 8000 }).apiSold).toBe(8000);
  });

  it('V1 doc: applicationsSold reads from applicationsSold field', () => {
    expect(extractFields({ applicationsSold: 4 }).applicationsSold).toBe(4);
  });

  it('V1 doc: applicationsSold falls back to appsSold alias', () => {
    expect(extractFields({ appsSold: 2 }).applicationsSold).toBe(2);
  });

  it('V1 doc: applicationsSold wins over appsSold when both present', () => {
    expect(extractFields({ applicationsSold: 3, appsSold: 99 }).applicationsSold).toBe(3);
  });

  it('V1 doc: no production fields → both return 0', () => {
    expect(extractFields({ referralCalls: 5 }).apiSold).toBe(0);
    expect(extractFields({ referralCalls: 5 }).applicationsSold).toBe(0);
  });
});

describe('extractTotalProductionCredit', () => {
  it('V2 doc with stored totalProductionCredit → returns stored value', () => {
    const doc = { version: 2, totalProductionCredit: 32300, newBusiness: { api: 25000 } };
    expect(extractTotalProductionCredit(doc)).toBe(32300);
  });

  it('V2 doc without stored field → derives NB + PPP + LMPS', () => {
    const doc = {
      newBusiness:  { api: 25000, apps: 3 },
      pppIncreases: { apps: 1, apiIncrease: 4800 },
      lumpsums:     { grossAmount: 25000, apiCredit: 2500, commission: 125 },
    };
    expect(extractTotalProductionCredit(doc)).toBe(32300);
  });

  it('V2 doc: NB + PPP only (no LMPS)', () => {
    const doc = {
      newBusiness:  { api: 20000 },
      pppIncreases: { apiIncrease: 5000 },
      lumpsums:     { grossAmount: 0, apiCredit: 0 },
    };
    expect(extractTotalProductionCredit(doc)).toBe(25000);
  });

  it('V1 doc: falls back to apiSold', () => {
    expect(extractTotalProductionCredit({ apiSold: 18000 })).toBe(18000);
  });

  it('V1 doc: falls back to annualPremium legacy alias', () => {
    expect(extractTotalProductionCredit({ annualPremium: 8000 })).toBe(8000);
  });

  it('null/undefined → returns 0 (no crash)', () => {
    expect(extractTotalProductionCredit(null)).toBe(0);
    expect(extractTotalProductionCredit(undefined)).toBe(0);
    expect(extractTotalProductionCredit({})).toBe(0);
  });
});

describe('extractTotalCommission', () => {
  it('V2 doc with stored totalCommission → returns stored value', () => {
    const doc = { version: 2, totalCommission: 8875, newBusiness: { api: 25000 } };
    expect(extractTotalCommission(doc, 35)).toBe(8875);
  });

  it('V2 doc without stored field: commissionRate as percentage (35 not 0.35)', () => {
    const doc = {
      newBusiness: { api: 20000 },
      lumpsums:    { commission: 0 },
    };
    expect(extractTotalCommission(doc, 35)).toBeCloseTo(7000);
  });

  it('V2 doc: PPP excluded from commission (only NB + LMPS commission)', () => {
    const doc = {
      newBusiness:  { api: 20000 },
      pppIncreases: { apiIncrease: 5000 },
      lumpsums:     { commission: 125 },
    };
    expect(extractTotalCommission(doc, 35)).toBeCloseTo(7125);
  });

  it('V1 doc: falls back to apiSold × rate', () => {
    expect(extractTotalCommission({ apiSold: 10000 }, 35)).toBeCloseTo(3500);
  });

  it('zero commissionRate → returns 0 (for agents without rate set)', () => {
    const doc = { newBusiness: { api: 20000 } };
    expect(extractTotalCommission(doc, 0)).toBe(0);
  });

  it('null/undefined → returns 0 (no crash)', () => {
    expect(extractTotalCommission(null, 35)).toBe(0);
    expect(extractTotalCommission(undefined, 35)).toBe(0);
  });
});
