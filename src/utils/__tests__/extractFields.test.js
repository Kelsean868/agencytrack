import { describe, it, expect } from 'vitest';
import { extractFields } from '../extractFields';

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
