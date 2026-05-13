import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock state — must use vi.hoisted because vi.mock factories run
// before any top-level `const` in the test file.
const hoisted = vi.hoisted(() => ({
  mockAuth: { currentUser: { uid: 'writer-uid' } },
  mockGetDoc:  vi.fn(),
  mockGetDocs: vi.fn(),
  mockSetDoc:  vi.fn(),
}));
const { mockAuth, mockGetDoc, mockGetDocs, mockSetDoc } = hoisted;

vi.mock('../../firebase', () => ({
  db: {},
  auth: hoisted.mockAuth,
}));

vi.mock('firebase/firestore', () => ({
  doc:  (db, path) => ({ __ref: path, id: path.split('/').pop() }),
  collection: (db, path) => ({ __collection: path }),
  query: (...args) => ({ __query: args }),
  where: (field, op, value) => ({ __where: [field, op, value] }),
  getDoc:  (...args) => hoisted.mockGetDoc(...args),
  getDocs: (...args) => hoisted.mockGetDocs(...args),
  setDoc:  (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

vi.mock('../managerService', () => ({
  getTenantUsers: vi.fn(),
}));

import {
  isE3Doc,
  monthKeyFromYearMonth,
  parseMonthKey,
  persistencyDocId,
  reportPeriodFromMonthKey,
  getPersistencyForAgent,
  getPersistencyForBranch,
  getPersistencyMapForYear,
  getAvailableMonths,
  getAgentHistory,
  savePersistency,
  calculateAndCacheBranchAggregate,
} from '../persistencyService';
import { getTenantUsers } from '../managerService';

const E3_INPUTS = {
  businessPlaced: 357468.84,
  notTakens: 0,
  incPPPs: 48000,
  lumpsums100: 8666.90,
  lapses: 133600.08,
  reinstatements: 27662.28,
};

const E3_FULL_DOC = {
  ...E3_INPUTS,
  agentId: 'agent-1',
  tenantId: 'tenant1',
  year: 2026,
  month: 2,
  monthKey: '2026-02',
  grossSettled: 406335.53,
  netSettled: 300397.73,
  persistency: 0.7393,
};

describe('isE3Doc', () => {
  it('returns true when all six business-input fields are present', () => {
    expect(isE3Doc(E3_FULL_DOC)).toBe(true);
  });

  it('returns false for null / non-object', () => {
    expect(isE3Doc(null)).toBe(false);
    expect(isE3Doc(undefined)).toBe(false);
    expect(isE3Doc('string')).toBe(false);
  });

  it('returns false when only legacy `persistency` field is present (pre-E3 doc)', () => {
    const legacy = {
      agentId: 'agent-1',
      year: 2026,
      month: 2,
      persistency: 92.5, // legacy 0–100 scale
      enteredBy: 'manager-uid',
    };
    expect(isE3Doc(legacy)).toBe(false);
  });

  it('returns false when one of the six required fields is missing', () => {
    for (const f of ['businessPlaced', 'notTakens', 'incPPPs', 'lumpsums100', 'lapses', 'reinstatements']) {
      const partial = { ...E3_INPUTS };
      delete partial[f];
      expect(isE3Doc(partial), `missing ${f} should fail`).toBe(false);
    }
  });

  it('returns true when extra optional fields (notes, value) coexist with the six', () => {
    expect(isE3Doc({ ...E3_INPUTS, notes: 'legacy note', value: 92.5 })).toBe(true);
  });

  it('treats null/undefined values for required fields as missing', () => {
    expect(isE3Doc({ ...E3_INPUTS, lapses: null })).toBe(false);
    expect(isE3Doc({ ...E3_INPUTS, incPPPs: undefined })).toBe(false);
  });

  it('treats numeric zero as present (0 is a valid input value)', () => {
    expect(isE3Doc({ ...E3_INPUTS, notTakens: 0 })).toBe(true);
  });
});

describe('monthKey helpers', () => {
  it('monthKeyFromYearMonth zero-pads single-digit months', () => {
    expect(monthKeyFromYearMonth(2026, 2)).toBe('2026-02');
    expect(monthKeyFromYearMonth(2026, 12)).toBe('2026-12');
  });

  it('parseMonthKey round-trips with monthKeyFromYearMonth', () => {
    const { year, month } = parseMonthKey('2026-02');
    expect(year).toBe(2026);
    expect(month).toBe(2);
  });

  it('persistencyDocId has YYYY_MM (underscore, not dash)', () => {
    expect(persistencyDocId('agent-1', '2026-02')).toBe('agent-1_2026_02');
  });

  it('reportPeriodFromMonthKey returns 12-month rolling window ending in month', () => {
    expect(reportPeriodFromMonthKey('2026-02'))
      .toEqual({ reportPeriodStart: '2025-03-01', reportPeriodEnd: '2026-02-28' });
  });

  it('reportPeriodFromMonthKey handles leap year (Feb 29)', () => {
    expect(reportPeriodFromMonthKey('2024-02'))
      .toEqual({ reportPeriodStart: '2023-03-01', reportPeriodEnd: '2024-02-29' });
  });

  it('reportPeriodFromMonthKey handles December (rolls into same year start)', () => {
    expect(reportPeriodFromMonthKey('2026-12'))
      .toEqual({ reportPeriodStart: '2026-01-01', reportPeriodEnd: '2026-12-31' });
  });
});

describe('getPersistencyForAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getPersistencyForAgent('tenant1', '2026-02', 'agent-1')).toBeNull();
  });

  it('returns the doc when it is E3-shaped', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => E3_FULL_DOC,
    });
    const result = await getPersistencyForAgent('tenant1', '2026-02', 'agent-1');
    expect(result.persistency).toBe(0.7393);
  });

  it('returns null when doc is pre-E3 (legacy single-percentage doc) — silent filter', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => ({
        agentId: 'agent-1',
        year: 2026,
        month: 2,
        persistency: 92.5, // legacy 0–100
      }),
    });
    expect(await getPersistencyForAgent('tenant1', '2026-02', 'agent-1')).toBeNull();
  });
});

describe('getPersistencyForBranch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters users by branchId + role==="agent"', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent',          branchId: 'branch-x' },
      { id: 'a2', role: 'agent',          branchId: 'branch-y' }, // wrong branch
      { id: 'm1', role: 'unit_manager',   branchId: 'branch-x' }, // wrong role
      { id: 'a3', role: 'agent',          branchId: 'branch-x' },
    ]);
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await getPersistencyForBranch('tenant1', '2026-02', 'branch-x');

    // Only a1 + a3 should be looked up (2 calls).
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  it('silently filters pre-E3 docs out of the returned list', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent', branchId: 'b1' },
      { id: 'a2', role: 'agent', branchId: 'b1' },
    ]);
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, id: 'a1_2026_02', data: () => E3_FULL_DOC })
      .mockResolvedValueOnce({ exists: () => true, id: 'a2_2026_02', data: () => ({ persistency: 92.5 }) });

    const result = await getPersistencyForBranch('tenant1', '2026-02', 'b1');
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('agent-1');
  });
});

describe('getAvailableMonths', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns distinct E3 monthKeys sorted newest-first', async () => {
    mockGetDocs.mockResolvedValueOnce({
      forEach(cb) {
        [
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-01' }) },
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-02' }) },
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-01' }) },     // duplicate
          { data: () => ({                  monthKey: '2025-12' }) },  // pre-E3 — filtered
        ].forEach(cb);
      },
    });
    expect(await getAvailableMonths('tenant1', 'tenant', 'tenant1')).toEqual(['2026-02', '2026-01']);
  });

  it('returns current month as fallback when no E3 docs exist', async () => {
    mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
    const result = await getAvailableMonths('tenant1', 'tenant', 'tenant1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('getAgentHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns oldest-first records, filtered to E3 only, capped at lastNMonths', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'a1_2025_11', data: () => ({ ...E3_INPUTS, monthKey: '2025-11' }) },
        { id: 'a1_2026_02', data: () => ({ ...E3_INPUTS, monthKey: '2026-02' }) },
        { id: 'a1_2026_01', data: () => ({ ...E3_INPUTS, monthKey: '2026-01' }) },
        { id: 'a1_2025_10', data: () => ({                  monthKey: '2025-10' }) }, // pre-E3
      ],
    });
    const out = await getAgentHistory('tenant1', 'a1', 12);
    expect(out.map((r) => r.monthKey)).toEqual(['2025-11', '2026-01', '2026-02']);
  });

  it('caps results at lastNMonths', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: Array.from({ length: 14 }, (_, i) => ({
        id: `a1_2025_${String(i + 1).padStart(2, '0')}`,
        data: () => ({ ...E3_INPUTS, monthKey: `2025-${String(i + 1).padStart(2, '0')}` }),
      })),
    });
    const out = await getAgentHistory('tenant1', 'a1', 6);
    expect(out).toHaveLength(6);
  });
});

describe('savePersistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'writer-uid' };
  });

  it('throws when no user is signed in', async () => {
    mockAuth.currentUser = null;
    await expect(
      savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'agent'),
    ).rejects.toThrow(/no signed-in user/);
  });

  it('throws on invalid role', async () => {
    await expect(
      savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'super_admin'),
    ).rejects.toThrow(/invalid role/);
  });

  it('throws on malformed monthKey', async () => {
    await expect(
      savePersistency('tenant1', '2026/02', 'agent-1', E3_INPUTS, 'agent'),
    ).rejects.toThrow(/invalid monthKey/);
  });

  it('throws on negative input', async () => {
    await expect(
      savePersistency('tenant1', '2026-02', 'agent-1', { ...E3_INPUTS, lapses: -100 }, 'agent'),
    ).rejects.toThrow(/lapses must be a non-negative number/);
  });

  it('applies derived calculations (gross/net/persistency/meetsAwardGate) on write', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'agent');

    expect(result.grossSettled).toBeCloseTo(406335.53, 2);
    expect(result.netSettled).toBeCloseTo(300397.73, 2);
    expect(result.persistency).toBeCloseTo(0.7393, 4);
    expect(result.meetsAwardGate).toBe(false); // 0.7393 < 0.90
    expect(result.year).toBe(2026);
    expect(result.month).toBe(2);
    expect(result.monthKey).toBe('2026-02');

    // Verify the actual setDoc payload included the derived fields.
    const writtenPayload = mockSetDoc.mock.calls[0][1];
    expect(writtenPayload.persistency).toBeCloseTo(0.7393, 4);
    expect(writtenPayload.tenantId).toBe('tenant1');
    expect(writtenPayload.enteredBy).toBe('writer-uid');
    expect(writtenPayload.enteredByRole).toBe('agent');
  });

  it('marks meetsAwardGate=true when persistency >= 0.90', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const highInputs = {
      businessPlaced: 1000000, notTakens: 0, incPPPs: 0, lumpsums100: 0,
      lapses: 50000, reinstatements: 10000,
    };
    const result = await savePersistency('tenant1', '2026-02', 'agent-1', highInputs, 'branch_manager');
    // (1000000 - 50000 + 10000) / 1000000 = 0.96
    expect(result.persistency).toBeCloseTo(0.96, 4);
    expect(result.meetsAwardGate).toBe(true);
  });

  it('preserves enteredAt/By/ByRole on overwrite, updates only lastEdit*', async () => {
    const priorTimestamp = { seconds: 1700000000, nanoseconds: 0 };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => ({
        ...E3_FULL_DOC,
        enteredAt: priorTimestamp,
        enteredBy: 'original-writer',
        enteredByRole: 'agent',
      }),
    });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'branch_manager');

    const written = mockSetDoc.mock.calls[0][1];
    expect(written.enteredAt).toEqual(priorTimestamp);
    expect(written.enteredBy).toBe('original-writer');
    expect(written.enteredByRole).toBe('agent');
    expect(written.lastEditedBy).toBe('writer-uid');
    expect(written.lastEditedByRole).toBe('branch_manager');
  });

  it('treats overwriting a pre-E3 doc as a fresh first-write (no audit pollution)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => ({ persistency: 92.5, agentId: 'agent-1' }), // legacy doc
    });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'branch_manager');

    const written = mockSetDoc.mock.calls[0][1];
    expect(written.enteredBy).toBe('writer-uid');
    expect(written.enteredByRole).toBe('branch_manager');
    expect(written.lastEditedBy).toBe('writer-uid');
    expect(written.lastEditedByRole).toBe('branch_manager');
  });
});

describe('getPersistencyMapForYear', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns map keyed by agentId with E3 records only, scoped by branchId', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent',          branchId: 'b1' },
      { id: 'a2', role: 'agent',          branchId: 'b2' }, // wrong branch
      { id: 'm1', role: 'unit_manager',   branchId: 'b1' }, // not an agent
      { id: 'a3', role: 'agent',          branchId: 'b1' },
    ]);
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ ...E3_INPUTS, agentId: 'a1', year: 2026, monthKey: '2026-01' }) },
          { data: () => ({ ...E3_INPUTS, agentId: 'a1', year: 2026, monthKey: '2026-02' }) },
          { data: () => ({                  agentId: 'a1', year: 2026 }) }, // pre-E3 — filtered
        ],
      })
      .mockResolvedValueOnce({ docs: [] });

    const map = await getPersistencyMapForYear('tenant1', 2026, { branchId: 'b1' });

    // Two agents queried (a1, a3), only a1 had records.
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(Object.keys(map)).toEqual(['a1']);
    expect(map.a1).toHaveLength(2);
  });

  it('silently skips agents whose query is rejected by rules', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent', branchId: 'b1' },
      { id: 'a2', role: 'agent', branchId: 'b1' },
    ]);
    mockGetDocs
      .mockRejectedValueOnce(new Error('PERMISSION_DENIED'))
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ ...E3_INPUTS, agentId: 'a2', year: 2026, monthKey: '2026-01' }) },
        ],
      });

    const map = await getPersistencyMapForYear('tenant1', 2026, { branchId: 'b1' });
    expect(map.a1).toBeUndefined();
    expect(map.a2).toHaveLength(1);
  });
});

describe('calculateAndCacheBranchAggregate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns sum-then-divide aggregate from branch records', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent', branchId: 'b1' },
      { id: 'a2', role: 'agent', branchId: 'b1' },
    ]);
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'a1_2026_02',
        data: () => ({
          ...E3_INPUTS,
          grossSettled: 100,
          netSettled: 90,
          lapses: 10,
          reinstatements: 0,
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'a2_2026_02',
        data: () => ({
          ...E3_INPUTS,
          grossSettled: 1000,
          netSettled: 500,
          lapses: 500,
          reinstatements: 0,
        }),
      });

    const out = await calculateAndCacheBranchAggregate('tenant1', '2026-02', 'b1');
    expect(out.recordCount).toBe(2);
    expect(out.sumGrossSettled).toBe(1100);
    expect(out.sumNetSettled).toBe(590);
    expect(out.aggregatedPersistency).toBeCloseTo(0.5364, 3);
  });

  it('returns zeroes (not NaN) when branch has no E3 records', async () => {
    getTenantUsers.mockResolvedValueOnce([{ id: 'a1', role: 'agent', branchId: 'b1' }]);
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const out = await calculateAndCacheBranchAggregate('tenant1', '2026-02', 'b1');
    expect(out.recordCount).toBe(0);
    expect(out.aggregatedPersistency).toBe(0);
  });
});
