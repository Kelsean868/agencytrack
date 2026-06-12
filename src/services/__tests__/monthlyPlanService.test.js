import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const mockSetDoc          = vi.fn().mockResolvedValue(undefined);
  const mockUpdateDoc       = vi.fn().mockResolvedValue(undefined);
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
    mockUpdateDoc,
    mockServerTimestamp,
    makeDocSnap,
  };
});

vi.mock('firebase/firestore', () => ({
  doc:             (...args) => hoisted.mockDoc(...args),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  updateDoc:       (...args) => hoisted.mockUpdateDoc(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  createMonthlyPlan, getMonthlyPlan, saveMonthlyPlan,
} from '../monthlyPlanService';

const TENANT_ID  = 'tenant-1';
const UID        = 'agent-1';
const YEAR       = 2026;
const ANCHOR_API = 120000;

const EXISTING_DOC_DATA = {
  year: YEAR,
  tenantId: TENANT_ID,
  uid: UID,
  targets: Array(11).fill(10000).concat([10000]),
  split: 'even',
  status: 'draft',
  anchorAPI: ANCHOR_API,
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(false, null));
});

// ── createMonthlyPlan ─────────────────────────────────────────────────────────

describe('createMonthlyPlan', () => {
  it('scaffolds the correct shape: targets[12], split:even, status:draft, anchorAPI', async () => {
    await createMonthlyPlan(TENANT_ID, UID, YEAR, ANCHOR_API);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.targets).toHaveLength(12);
    expect(payload.split).toBe('even');
    expect(payload.status).toBe('draft');
    expect(payload.anchorAPI).toBe(ANCHOR_API);
  });

  it('targets sum to anchorAPI exactly (even-split invariant)', async () => {
    await createMonthlyPlan(TENANT_ID, UID, YEAR, ANCHOR_API);

    const { targets } = hoisted.mockSetDoc.mock.calls[0][1];
    const sum = targets.reduce((s, v) => s + v, 0);
    expect(parseFloat(sum.toFixed(2))).toBe(ANCHOR_API);
  });

  it('stores year as a number, tenantId, and uid', async () => {
    await createMonthlyPlan(TENANT_ID, UID, YEAR, ANCHOR_API);

    const payload = hoisted.mockSetDoc.mock.calls[0][1];
    expect(payload.year).toBe(2026);
    expect(payload.tenantId).toBe(TENANT_ID);
    expect(payload.uid).toBe(UID);
  });

  it('returns id = String(year)', async () => {
    const result = await createMonthlyPlan(TENANT_ID, UID, YEAR, ANCHOR_API);
    expect(result.id).toBe('2026');
  });

  it('is idempotent — returns existing doc without calling setDoc', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(true, EXISTING_DOC_DATA));

    const result = await createMonthlyPlan(TENANT_ID, UID, YEAR, ANCHOR_API);

    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
    expect(result.id).toBe('2026');
    expect(result.anchorAPI).toBe(ANCHOR_API);
  });

  it('uses String(parsedYear) as doc ID', async () => {
    await createMonthlyPlan(TENANT_ID, UID, '2026', ANCHOR_API);

    const docArgs = hoisted.mockDoc.mock.calls[0];
    expect(docArgs[docArgs.length - 1]).toBe('2026');
  });

  it('throws on year below 2020', async () => {
    await expect(createMonthlyPlan(TENANT_ID, UID, 2019, ANCHOR_API)).rejects.toThrow(
      'year must be a valid integer between 2020 and 2100',
    );
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('throws on year above 2100', async () => {
    await expect(createMonthlyPlan(TENANT_ID, UID, 2101, ANCHOR_API)).rejects.toThrow(
      'year must be a valid integer between 2020 and 2100',
    );
  });

  it('throws on non-numeric year', async () => {
    await expect(createMonthlyPlan(TENANT_ID, UID, 'bad', ANCHOR_API)).rejects.toThrow(
      'year must be a valid integer between 2020 and 2100',
    );
  });
});

// ── getMonthlyPlan ────────────────────────────────────────────────────────────

describe('getMonthlyPlan', () => {
  it('returns data with id when doc exists', async () => {
    hoisted.mockGetDoc.mockResolvedValue(hoisted.makeDocSnap(true, EXISTING_DOC_DATA));

    const result = await getMonthlyPlan(TENANT_ID, UID, YEAR);

    expect(result.id).toBe('2026');
    expect(result.status).toBe('draft');
    expect(result.anchorAPI).toBe(ANCHOR_API);
  });

  it('returns null when doc does not exist', async () => {
    const result = await getMonthlyPlan(TENANT_ID, UID, YEAR);
    expect(result).toBeNull();
  });

  it('returns null (no throw) on falsy year', async () => {
    await expect(getMonthlyPlan(TENANT_ID, UID, 0)).resolves.toBeNull();
    await expect(getMonthlyPlan(TENANT_ID, UID, '')).resolves.toBeNull();
    await expect(getMonthlyPlan(TENANT_ID, UID, null)).resolves.toBeNull();
    expect(hoisted.mockGetDoc).not.toHaveBeenCalled();
  });
});

// ── saveMonthlyPlan ───────────────────────────────────────────────────────────

describe('saveMonthlyPlan', () => {
  const VALID_TARGETS = Array(12).fill(10000);

  it('calls updateDoc with parseFloat targets, split, status:draft, updatedAt', async () => {
    await saveMonthlyPlan(TENANT_ID, UID, YEAR, VALID_TARGETS, 'even');

    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.targets).toHaveLength(12);
    expect(payload.targets.every((v) => typeof v === 'number')).toBe(true);
    expect(payload.split).toBe('even');
    expect(payload.status).toBe('draft');
    expect(payload.updatedAt).toBeDefined();
  });

  it('enforces parseFloat on string-numeric targets', async () => {
    const stringTargets = Array(12).fill('10000');
    await saveMonthlyPlan(TENANT_ID, UID, YEAR, stringTargets, 'custom');

    const { targets } = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(targets.every((v) => v === 10000)).toBe(true);
  });

  it('rejects a non-12-length targets array', async () => {
    await expect(
      saveMonthlyPlan(TENANT_ID, UID, YEAR, Array(11).fill(10000), 'even'),
    ).rejects.toThrow('targets must be an array of exactly 12 values');
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rejects targets containing a non-numeric value', async () => {
    const bad = [...VALID_TARGETS];
    bad[5] = 'not-a-number';
    await expect(
      saveMonthlyPlan(TENANT_ID, UID, YEAR, bad, 'even'),
    ).rejects.toThrow('each target must be a finite number');
  });
});
