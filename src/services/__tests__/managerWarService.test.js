import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockSetDoc:          vi.fn(),
  mockGetDoc:          vi.fn(),
  mockDoc:             vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc:             (...args) => hoisted.mockDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

vi.mock('../../utils/validators', () => ({
  validateSundayDate: (s) => {
    const d = new Date(s + 'T00:00:00');
    return d.getDay() === 0;
  },
}));

import {
  getWarRoleRank,
  warDocId,
  saveWarDraft,
  submitWar,
  getWar,
  getWarById,
} from '../managerWarService';

const TENANT_ID   = 'test-tenant';
const MANAGER_ID  = 'um1';
const WEEK_START  = '2026-05-17'; // confirmed Sunday
const NON_SUNDAY  = '2026-05-18'; // Monday
const MANAGER_META = {
  managerRole:        'unit_manager',
  branchId:           'branch-a',
  unitId:             'um1',
  isProducingManager: false,
};

const FORM_DATA = {
  oneOnOnesConducted:   '3',
  namesSourced:         '5',
  interviewsConducted:  '2',
  recruitsInFirstWeeks: '1',
  trainingSessions:     '1',
  trainingTopic:        'Prospecting',
  unitMeetingHeld:      true,
  attendanceCount:      '12',
  dashboardReviewDone:  true,
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockDoc.mockReturnValue('mock-ref');
  hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
});

// ── getWarRoleRank ────────────────────────────────────────────────────────────

describe('getWarRoleRank', () => {
  it('returns correct rank for each manager role', () => {
    expect(getWarRoleRank('unit_manager')).toBe(1);
    expect(getWarRoleRank('branch_manager')).toBe(2);
    expect(getWarRoleRank('sales_manager')).toBe(3);
    expect(getWarRoleRank('tenant_admin')).toBe(4);
    expect(getWarRoleRank('platform_admin')).toBe(5);
  });

  it('returns 0 for agent and unknown roles', () => {
    expect(getWarRoleRank('agent')).toBe(0);
    expect(getWarRoleRank('')).toBe(0);
    expect(getWarRoleRank(undefined)).toBe(0);
  });
});

// ── warDocId ─────────────────────────────────────────────────────────────────

describe('warDocId', () => {
  it('produces {managerId}_{weekStart} format', () => {
    expect(warDocId('um1', '2026-05-18')).toBe('um1_2026-05-18');
  });
});

// ── saveWarDraft ──────────────────────────────────────────────────────────────

describe('saveWarDraft', () => {
  it('throws if weekStart is not a Sunday', async () => {
    await expect(
      saveWarDraft(TENANT_ID, MANAGER_ID, 'Test UM', NON_SUNDAY, FORM_DATA, MANAGER_META)
    ).rejects.toThrow('weekStart must be a Sunday');
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });

  it('calls setDoc with status draft and parsed numeric fields', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveWarDraft(TENANT_ID, MANAGER_ID, 'Test UM', WEEK_START, FORM_DATA, MANAGER_META);
    expect(hoisted.mockSetDoc).toHaveBeenCalledOnce();
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.status).toBe('draft');
    expect(payload.oneOnOnesConducted).toBe(3);
    expect(payload.namesSourced).toBe(5);
    expect(payload.interviewsConducted).toBe(2);
    expect(payload.recruitsInFirstWeeks).toBe(1);
    expect(payload.trainingSessions).toBe(1);
    expect(payload.attendanceCount).toBe(12);
    expect(payload.jfwCount).toBe(0);
    expect(payload.managerRoleRank).toBe(1);
    expect(payload.managerRole).toBe('unit_manager');
    expect(payload.branchId).toBe('branch-a');
  });

  it('sets createdAt only on first save (when doc does not exist)', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveWarDraft(TENANT_ID, MANAGER_ID, 'Test UM', WEEK_START, FORM_DATA, MANAGER_META);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.createdAt).toBeDefined();
  });

  it('omits createdAt on subsequent saves (when doc exists)', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => true });
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveWarDraft(TENANT_ID, MANAGER_ID, 'Test UM', WEEK_START, FORM_DATA, MANAGER_META);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.createdAt).toBeUndefined();
  });

  it('omits personalApi/personalApps when isProducingManager is false', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveWarDraft(TENANT_ID, MANAGER_ID, 'Test UM', WEEK_START, FORM_DATA, MANAGER_META);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.personalApi).toBeUndefined();
    expect(payload.personalApps).toBeUndefined();
  });

  it('includes personalApi/personalApps when isProducingManager is true', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    const meta = { ...MANAGER_META, isProducingManager: true };
    await saveWarDraft(TENANT_ID, MANAGER_ID, 'Test UM', WEEK_START,
      { ...FORM_DATA, personalApi: '1500.50', personalApps: '2' }, meta);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.personalApi).toBe(1500.5);
    expect(payload.personalApps).toBe(2);
  });

  it('sets attendanceCount null when unitMeetingHeld is false', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await saveWarDraft(TENANT_ID, MANAGER_ID, 'Test UM', WEEK_START,
      { ...FORM_DATA, unitMeetingHeld: false }, MANAGER_META);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.attendanceCount).toBeNull();
  });
});

// ── submitWar ─────────────────────────────────────────────────────────────────

describe('submitWar', () => {
  it('throws if weekStart is not a Sunday', async () => {
    await expect(
      submitWar(TENANT_ID, MANAGER_ID, 'Test UM', NON_SUNDAY, FORM_DATA, MANAGER_META)
    ).rejects.toThrow('weekStart must be a Sunday');
  });

  it('calls setDoc with status submitted and submittedAt', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    await submitWar(TENANT_ID, MANAGER_ID, 'Test UM', WEEK_START, FORM_DATA, MANAGER_META);
    expect(hoisted.mockSetDoc).toHaveBeenCalledOnce();
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.status).toBe('submitted');
    expect(payload.submittedAt).toBeDefined();
  });
});

// ── getWar ────────────────────────────────────────────────────────────────────

describe('getWar', () => {
  it('returns null when doc does not exist', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getWar(TENANT_ID, MANAGER_ID, WEEK_START);
    expect(result).toBeNull();
  });

  it('returns merged id + data when doc exists', async () => {
    const docData = { managerId: MANAGER_ID, status: 'draft' };
    hoisted.mockGetDoc.mockResolvedValue({
      exists: () => true,
      id:     'um1_2026-05-18',
      data:   () => docData,
    });
    const result = await getWar(TENANT_ID, MANAGER_ID, WEEK_START);
    expect(result).toEqual({ id: 'um1_2026-05-18', ...docData });
  });
});

// ── getWarById ────────────────────────────────────────────────────────────────

describe('getWarById', () => {
  it('returns null when doc does not exist', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getWarById(TENANT_ID, 'um1_2026-05-18');
    expect(result).toBeNull();
  });

  it('returns merged id + data when doc exists', async () => {
    const docData = { managerId: 'um1', status: 'submitted' };
    hoisted.mockGetDoc.mockResolvedValue({
      exists: () => true,
      id:     'um1_2026-05-18',
      data:   () => docData,
    });
    const result = await getWarById(TENANT_ID, 'um1_2026-05-18');
    expect(result).toEqual({ id: 'um1_2026-05-18', ...docData });
  });
});
