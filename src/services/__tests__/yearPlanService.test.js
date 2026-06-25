import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const mockSetDoc          = vi.fn().mockResolvedValue(undefined);
  const mockServerTimestamp = vi.fn(() => ({ _type: 'serverTimestamp' }));

  const makeDocSnap = (exists, data) => ({
    exists: () => exists,
    id: exists ? '2026' : undefined,
    data: () => (exists ? data : undefined),
  });

  return {
    mockDoc:             vi.fn((...args) => ({ _ref: args })),
    mockGetDoc:          vi.fn(),
    mockSetDoc,
    mockServerTimestamp,
    makeDocSnap,
  };
});

vi.mock('firebase/firestore', () => ({
  doc:             (...args) => hoisted.mockDoc(...args),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  createYearPlan, getYearPlan, saveYearPlan,
  resolveLicenseProfile, LICENSE_PROFILES, LINE_KEYS,
} from '../yearPlanService';

const TENANT_ID = 'tenant-1';
const UID       = 'agent-1';
const YEAR      = 2026;

const EXISTING_DOC_DATA = {
  year: YEAR,
  status: 'draft',
  licenseProfile: 'composite',
  lines: {
    life:    { targetAPI: 100, pct: 25, derivedApps: 0, derivedCommission: 0, enabled: true, rate: 0, products: [] },
    ah:      { targetAPI: 0,   pct: 0,  derivedApps: 0, derivedCommission: 0, enabled: true, rate: 0, products: [] },
    general: { targetAPI: 0,   pct: 0,  derivedApps: 0, derivedCommission: 0, enabled: true, rate: 0, products: [] },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));
  hoisted.mockSetDoc.mockResolvedValue(undefined);
});

// ── LICENSE_PROFILES ──────────────────────────────────────────────────────────

describe('LICENSE_PROFILES', () => {
  it('contains exactly composite, life_only, general_only', () => {
    expect(LICENSE_PROFILES).toEqual(['composite', 'life_only', 'general_only']);
  });
});

// ── resolveLicenseProfile ─────────────────────────────────────────────────────

describe('resolveLicenseProfile', () => {
  it('returns the profile when it is a valid member', () => {
    expect(resolveLicenseProfile({ licenseProfile: 'life_only' })).toBe('life_only');
    expect(resolveLicenseProfile({ licenseProfile: 'general_only' })).toBe('general_only');
    expect(resolveLicenseProfile({ licenseProfile: 'composite' })).toBe('composite');
  });

  it('returns composite when licenseProfile is absent', () => {
    expect(resolveLicenseProfile({})).toBe('composite');
  });

  it('returns composite when licenseProfile is an unknown value', () => {
    expect(resolveLicenseProfile({ licenseProfile: 'life_and_general' })).toBe('composite');
  });

  it('returns composite when userDoc is null or undefined', () => {
    expect(resolveLicenseProfile(null)).toBe('composite');
    expect(resolveLicenseProfile(undefined)).toBe('composite');
  });
});

// ── createYearPlan ────────────────────────────────────────────────────────────

describe('createYearPlan', () => {
  it('scaffolds the three canonical lines (life/ah/general) with zeroed fields + additive rate/products', async () => {
    await createYearPlan(TENANT_ID, UID, YEAR);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    const { lines } = payload;
    expect(Object.keys(lines)).toEqual(['life', 'ah', 'general']);
    for (const key of ['life', 'ah', 'general']) {
      expect(lines[key]).toEqual({
        targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true,
        rate: 0, products: [],
      });
    }
  });

  it('scaffolds status:draft, correct year (number), tenantId, uid', async () => {
    await createYearPlan(TENANT_ID, UID, YEAR);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.status).toBe('draft');
    expect(payload.year).toBe(2026);
    expect(payload.tenantId).toBe(TENANT_ID);
    expect(payload.uid).toBe(UID);
  });

  it('stores the valid licenseProfile passed in', async () => {
    await createYearPlan(TENANT_ID, UID, YEAR, 'life_only');

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.licenseProfile).toBe('life_only');
  });

  it('clamps an invalid licenseProfile param to composite', async () => {
    await createYearPlan(TENANT_ID, UID, YEAR, 'bogus_profile');

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.licenseProfile).toBe('composite');
  });

  it('defaults licenseProfile to composite when not passed', async () => {
    await createYearPlan(TENANT_ID, UID, YEAR);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.licenseProfile).toBe('composite');
  });

  it('returns the new doc with id = String(year)', async () => {
    const result = await createYearPlan(TENANT_ID, UID, YEAR);

    expect(result.id).toBe('2026');
    expect(result.status).toBe('draft');
  });

  it('is idempotent — returns existing doc without calling setDoc', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(true, EXISTING_DOC_DATA));

    const result = await createYearPlan(TENANT_ID, UID, YEAR);

    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
    expect(result.id).toBe('2026');
    expect(result.lines.life.targetAPI).toBe(100);
  });

  it('uses String(parsedYear) as doc ID', async () => {
    await createYearPlan(TENANT_ID, UID, '2026');

    const docArgs = hoisted.mockDoc.mock.calls[0];
    expect(docArgs[docArgs.length - 1]).toBe('2026');
  });

  it('throws on year below 2020', async () => {
    await expect(createYearPlan(TENANT_ID, UID, 2019)).rejects.toThrow(
      'year must be a valid integer between 2020 and 2100',
    );
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('throws on year above 2100', async () => {
    await expect(createYearPlan(TENANT_ID, UID, 2101)).rejects.toThrow(
      'year must be a valid integer between 2020 and 2100',
    );
  });

  it('throws on non-numeric year', async () => {
    await expect(createYearPlan(TENANT_ID, UID, 'bad')).rejects.toThrow(
      'year must be a valid integer between 2020 and 2100',
    );
  });
});

// ── getYearPlan ───────────────────────────────────────────────────────────────

describe('getYearPlan', () => {
  it('returns data with id when doc exists', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(true, EXISTING_DOC_DATA));

    const result = await getYearPlan(TENANT_ID, UID, YEAR);

    expect(result.id).toBe('2026');
    expect(result.status).toBe('draft');
  });

  it('returns null when doc does not exist', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));

    const result = await getYearPlan(TENANT_ID, UID, YEAR);

    expect(result).toBeNull();
  });

  it('returns null (no throw) on falsy year', async () => {
    await expect(getYearPlan(TENANT_ID, UID, 0)).resolves.toBeNull();
    await expect(getYearPlan(TENANT_ID, UID, '')).resolves.toBeNull();
    await expect(getYearPlan(TENANT_ID, UID, null)).resolves.toBeNull();
    expect(hoisted.mockGetDoc).not.toHaveBeenCalled();
  });
});

// ── LINE_KEYS (Direction 1.5) ─────────────────────────────────────────────────

describe('LINE_KEYS', () => {
  it('is the shared 3-line taxonomy life/ah/general', () => {
    expect(LINE_KEYS).toEqual(['life', 'ah', 'general']);
  });
});

// ── saveYearPlan — additive rate/products sanitization ────────────────────────

describe('saveYearPlan — 3-key write with additive rate/products', () => {
  it('writes the 3 canonical lines, preserving rate + products (≤4) on life/general', async () => {
    const lines = {
      life: {
        targetAPI: 100000, rate: 0.35, enabled: true,
        products: [
          { name: 'Whole Life', api: 60000, rate: 0.35 },
          { name: 'Term',       api: 40000, rate: 0.20 },
        ],
      },
      ah:      { targetAPI: 40000, rate: 0.25, enabled: true },
      general: { targetAPI: 200000, rate: 0.10, enabled: true, products: [] },
    };

    await saveYearPlan(TENANT_ID, UID, YEAR, lines, 'composite');

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(Object.keys(payload.lines)).toEqual(['life', 'ah', 'general']);
    expect(payload.status).toBe('draft');
    expect(payload.lines.life.targetAPI).toBe(100000);
    expect(payload.lines.life.rate).toBe(0.35);
    expect(payload.lines.life.products).toEqual([
      { name: 'Whole Life', api: 60000, rate: 0.35 },
      { name: 'Term',       api: 40000, rate: 0.20 },
    ]);
    expect(payload.lines.general.targetAPI).toBe(200000);
  });

  it('caps products at 4 and never carries products on the A&H line', async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, api: 1000, rate: 0.3 }));
    const lines = {
      life:    { targetAPI: 5000, rate: 0.35, products: five },
      ah:      { targetAPI: 1000, rate: 0.25, products: [{ name: 'X', api: 1, rate: 1 }] },
      general: { targetAPI: 0, rate: 0.1 },
    };

    await saveYearPlan(TENANT_ID, UID, YEAR, lines, 'composite');

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.lines.life.products).toHaveLength(4);
    expect(payload.lines.ah.products).toEqual([]); // A&H is never a product line
  });
});
