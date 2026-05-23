import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockSetDoc:          vi.fn(),
  mockGetDoc:          vi.fn(),
  mockDoc:             vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  mockCollection:      vi.fn(),
  mockGetDocs:         vi.fn(),
  mockQuery:           vi.fn((...args) => args),
  mockWhere:           vi.fn((...args) => args),
}));

vi.mock('../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc:             (...args) => hoisted.mockDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
  collection:      (...args) => hoisted.mockCollection(...args),
  getDocs:         (...args) => hoisted.mockGetDocs(...args),
  query:           (...args) => hoisted.mockQuery(...args),
  where:           (...args) => hoisted.mockWhere(...args),
}));

// managerWarService re-export of getWarRoleRank used by rollup service
vi.mock('../managerWarService', () => ({
  getWarRoleRank: (role) => ({
    unit_manager:   1,
    branch_manager: 2,
    sales_manager:  3,
    tenant_admin:   4,
    platform_admin: 5,
  }[role] ?? 0),
}));

import {
  rollupDocId,
  saveRollupDraft,
  submitRollup,
  getRollup,
  getRollupsForUpline,
} from '../managerMonthlyRollupService';

const TENANT_ID    = 'test-tenant';
const MANAGER_ID   = 'um1';
const MANAGER_NAME = 'Unit Manager 1';
const MONTH_KEY    = '2026-05';

const MANAGER_META_UM = {
  managerRole: 'unit_manager',
  branchId:    'branch-a',
  unitId:      'um1',          // UM has non-null unitId
};

const MANAGER_META_BM = {
  managerRole: 'branch_manager',
  branchId:    'branch-a',
  unitId:      null,           // BM has null unitId — Item 3
};

const FORM_DATA = {
  candidatesAssessed: '3',
  agentsContracted:   '1',
  notes:              '  Two promising candidates  ',
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockDoc.mockReturnValue('mock-ref');
  hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
});

// ── rollupDocId ───────────────────────────────────────────────────────────────

describe('rollupDocId', () => {
  it('produces {managerId}_{monthKey} format', () => {
    expect(rollupDocId('um1', '2026-05')).toBe('um1_2026-05');
  });
});

// ── saveRollupDraft ───────────────────────────────────────────────────────────

describe('saveRollupDraft', () => {
  it('calls setDoc with status draft and parsed numeric fields', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY, FORM_DATA, MANAGER_META_UM);
    expect(hoisted.mockSetDoc).toHaveBeenCalledOnce();
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.status).toBe('draft');
    expect(payload.candidatesAssessed).toBe(3);
    expect(payload.agentsContracted).toBe(1);
    expect(payload.managerRoleRank).toBe(1);
    expect(payload.managerRole).toBe('unit_manager');
    expect(payload.branchId).toBe('branch-a');
    expect(payload.unitId).toBe('um1');
  });

  it('notes are trimmed on save', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY, FORM_DATA, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.notes).toBe('Two promising candidates');
  });

  it('notes are sliced to 1000 chars', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    const longNotes = 'x'.repeat(1200);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY,
      { ...FORM_DATA, notes: longNotes }, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.notes).toHaveLength(1000);
  });

  it('meta fields sourced from managerMeta — never forged from form', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY, FORM_DATA, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.managerId).toBe(MANAGER_ID);
    expect(payload.tenantId).toBe(TENANT_ID);
    expect(payload.monthKey).toBe(MONTH_KEY);
    expect(payload.managerName).toBe(MANAGER_NAME);
  });

  it('writes unitId: null for BM (Item 3 — BM has null unitId)', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, 'bm1', 'BM One', MONTH_KEY, FORM_DATA, MANAGER_META_BM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.unitId).toBeNull();
    expect(payload.managerRoleRank).toBe(2);
  });

  it('sets createdAt only on first save', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY, FORM_DATA, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.createdAt).toBeDefined();
  });

  it('omits createdAt on subsequent saves', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => true });
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY, FORM_DATA, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.createdAt).toBeUndefined();
  });

  it('clamps negative candidatesAssessed to 0', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY,
      { candidatesAssessed: '-5', agentsContracted: '0', notes: '' }, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.candidatesAssessed).toBe(0);
  });

  it('clamps negative agentsContracted to 0', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY,
      { candidatesAssessed: '0', agentsContracted: '-3', notes: '' }, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.agentsContracted).toBe(0);
  });

  it('floors float input to int (parseFloat then floor)', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY,
      { candidatesAssessed: '2.9', agentsContracted: '1.1', notes: '' }, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.candidatesAssessed).toBe(2);
    expect(payload.agentsContracted).toBe(1);
  });

  it('treats non-numeric as 0', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveRollupDraft(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY,
      { candidatesAssessed: 'abc', agentsContracted: '', notes: '' }, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.candidatesAssessed).toBe(0);
    expect(payload.agentsContracted).toBe(0);
  });
});

// ── submitRollup ──────────────────────────────────────────────────────────────

describe('submitRollup', () => {
  it('calls setDoc with status submitted and submittedAt', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await submitRollup(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY, FORM_DATA, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.status).toBe('submitted');
    expect(payload.submittedAt).toBeDefined();
  });

  it('draft → submit transition preserves parsed fields', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => true });
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await submitRollup(TENANT_ID, MANAGER_ID, MANAGER_NAME, MONTH_KEY, FORM_DATA, MANAGER_META_UM);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.candidatesAssessed).toBe(3);
    expect(payload.agentsContracted).toBe(1);
  });
});

// ── getRollup ─────────────────────────────────────────────────────────────────

describe('getRollup', () => {
  it('returns null when doc does not exist', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getRollup(TENANT_ID, MANAGER_ID, MONTH_KEY);
    expect(result).toBeNull();
  });

  it('returns doc data with id when doc exists', async () => {
    hoisted.mockGetDoc.mockResolvedValue({
      exists: () => true,
      id:     'um1_2026-05',
      data:   () => ({ candidatesAssessed: 3, agentsContracted: 1, status: 'draft' }),
    });
    const result = await getRollup(TENANT_ID, MANAGER_ID, MONTH_KEY);
    expect(result).toEqual({ id: 'um1_2026-05', candidatesAssessed: 3, agentsContracted: 1, status: 'draft' });
  });
});

// ── getRollupsForUpline ───────────────────────────────────────────────────────

describe('getRollupsForUpline', () => {
  const makeSnap = (docs) => ({
    docs: docs.map((d) => ({ id: d.id, data: () => d })),
  });

  it('BM (rank 2) queries by branchId AND monthKey', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap([]));
    await getRollupsForUpline({ tenantId: TENANT_ID, monthKey: MONTH_KEY, role: 'branch_manager', branchId: 'branch-a' });
    expect(hoisted.mockWhere).toHaveBeenCalledWith('branchId', '==', 'branch-a');
    expect(hoisted.mockWhere).toHaveBeenCalledWith('monthKey', '==', MONTH_KEY);
  });

  it('SM (rank 3) queries by monthKey only (tenant-wide)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap([]));
    await getRollupsForUpline({ tenantId: TENANT_ID, monthKey: MONTH_KEY, role: 'sales_manager', branchId: 'branch-a' });
    // Only one where call for SM+
    const whereCalls = hoisted.mockWhere.mock.calls;
    const monthKeyCalls = whereCalls.filter(([field]) => field === 'monthKey');
    const branchIdCalls = whereCalls.filter(([field]) => field === 'branchId');
    expect(monthKeyCalls).toHaveLength(1);
    expect(branchIdCalls).toHaveLength(0);
  });

  it('returns mapped docs array', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap([
      { id: 'um1_2026-05', candidatesAssessed: 2, agentsContracted: 0, status: 'submitted' },
      { id: 'um2_2026-05', candidatesAssessed: 1, agentsContracted: 1, status: 'draft' },
    ]));
    const results = await getRollupsForUpline({ tenantId: TENANT_ID, monthKey: MONTH_KEY, role: 'branch_manager', branchId: 'branch-a' });
    expect(results).toHaveLength(2);
    expect(results[0].candidatesAssessed).toBe(2);
    expect(results[1].candidatesAssessed).toBe(1);
  });
});
