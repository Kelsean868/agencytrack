import { describe, it, expect } from 'vitest';
import {
  rem, policyDebitV2, grossOf, persistencyForModel, policyChargeForModel,
  bandKey, bandLabel, deriveRollingModel, PREVIEW_BOOK, GATE, FLOOR,
} from '../persistency/rollingModelV2';

describe('rollingModelV2 — primitives', () => {
  it('rem() counts months remaining to the 24-month horizon', () => {
    expect(rem(0)).toBe(24);
    expect(rem(6)).toBe(18);
    expect(rem(24)).toBe(0);
    expect(rem(30)).toBe(0);
  });

  it('policyDebitV2 is time-weighted; active/in-force policies charge 0', () => {
    expect(policyDebitV2({ state: 'active', api: 5000 })).toBe(0);
    // API 1200, lapse month 6 → rem 18, no reinstate → 1200*18/24 = 900
    expect(policyDebitV2({ state: 'lapsed', api: 1200, lapseMonth: 6, reinstateMonth: null })).toBe(900);
    // reinstated month 11 → rem 13 credit; lapse month 9 → rem 15 → 660*(15-13)/24 = 55
    expect(policyDebitV2({ state: 'lapsed', api: 660, lapseMonth: 9, reinstateMonth: 11 })).toBe(55);
  });

  it('grossOf sums API', () => {
    expect(grossOf(PREVIEW_BOOK)).toBe(13000);
  });
});

describe('rollingModelV2 — model reproduces the spec numbers', () => {
  it('v1 (settled ratio) ≈ 72.0% on the preview book', () => {
    expect(persistencyForModel(PREVIEW_BOOK, 'v1').toFixed(1)).toBe('72.0');
  });

  it('v2 (rolling 24-mo) ≈ 85.8% on the preview book', () => {
    expect(persistencyForModel(PREVIEW_BOOK, 'v2').toFixed(1)).toBe('85.8');
  });

  it('returns 0 for an empty / zero-gross book', () => {
    expect(persistencyForModel([], 'v2')).toBe(0);
  });
});

describe('rollingModelV2 — per-policy charge + bands', () => {
  it('policyChargeForModel differs between v1 (full API) and v2 (time-weighted)', () => {
    const p = { state: 'lapsed', api: 1960, lapseMonth: 18, reinstateMonth: null };
    expect(policyChargeForModel(p, 'v1')).toBe(1960);
    expect(policyChargeForModel(p, 'v2')).toBe(490); // 1960*6/24
  });

  it('bandKey/bandLabel key off GATE=90 / FLOOR=80', () => {
    expect(bandKey(92)).toBe('success');
    expect(bandKey(85)).toBe('warning');
    expect(bandKey(70)).toBe('danger');
    expect(bandLabel(GATE)).toBe('Award-eligible');
    expect(bandLabel(FLOOR)).toBe('Watch');
    expect(bandLabel(10)).toBe('Below floor');
  });
});

describe('deriveRollingModel', () => {
  it('returns null for an empty book', () => {
    expect(deriveRollingModel([], 'v2')).toBeNull();
  });

  it('produces both model %s + a per-lapse weighting list', () => {
    const d = deriveRollingModel(PREVIEW_BOOK, 'v2');
    expect(d.model).toBe('v2');
    expect(d.v1pct.toFixed(1)).toBe('72.0');
    expect(d.v2pct.toFixed(1)).toBe('85.8');
    expect(d.current.toFixed(1)).toBe('85.8');
    // 4 lapsed policies in the book
    expect(d.weighting).toHaveLength(4);
    const baksh = d.weighting.find((w) => w.id === 'baksh');
    expect(baksh.charged).toBe(490);
    expect(baksh.creditMonths).toBe(rem(21)); // age 21 → 3
  });

  it('defaults to v2 and switches to v1 charges when asked', () => {
    const v1 = deriveRollingModel(PREVIEW_BOOK, 'v1');
    expect(v1.model).toBe('v1');
    const baksh = v1.weighting.find((w) => w.id === 'baksh');
    expect(baksh.charged).toBe(1960); // full API under v1
    expect(baksh.creditMonths).toBeNull();
  });
});
