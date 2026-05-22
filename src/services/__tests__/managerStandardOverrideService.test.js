import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc:    vi.fn(),
  mockSetDoc:    vi.fn(),
  mockDeleteDoc: vi.fn(),
}));

vi.mock('../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc:             (_db, path) => ({ __ref: path }),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  deleteDoc:       (...args) => hoisted.mockDeleteDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

// Stub the org-standards service for getResolvedStandards tests.
vi.mock('../managerActivityStandardsService', () => ({
  getManagerActivityStandards: vi.fn(),
  getRoleStandards:            (stds, role) => stds?.[role] ?? {},
  NUMERIC_STANDARDS:           ['jfwCount', 'oneOnOnesConducted', 'namesSourced',
                                 'interviewsConducted', 'recruitsInFirstWeeks', 'trainingSessions'],
  BOOLEAN_STANDARDS:           ['unitMeetingHeld', 'dashboardReviewDone'],
}));

import { getManagerActivityStandards } from '../managerActivityStandardsService';
import {
  getManagerActivityStandardOverride,
  setManagerActivityStandardOverride,
  clearManagerActivityStandardOverride,
  getResolvedStandards,
  getResolvedStandardsForMany,
} from '../managerStandardOverrideService';

const { mockGetDoc, mockSetDoc, mockDeleteDoc } = hoisted;

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
  mockDeleteDoc.mockReset();
  vi.mocked(getManagerActivityStandards).mockReset();
});

// ── getManagerActivityStandardOverride ───────────────────────────────────────

describe('getManagerActivityStandardOverride', () => {
  it('reads from the correct Firestore path', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await getManagerActivityStandardOverride('t1', 'mgr1');
    const [ref] = mockGetDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/t1/managerActivityStandardOverrides/mgr1');
  });

  it('returns {} when the doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getManagerActivityStandardOverride('t1', 'mgr1');
    expect(result).toEqual({});
  });

  it('returns the stored data when the doc exists', async () => {
    const stored = { tenantId: 't1', managerId: 'mgr1', jfwCount: 3, updatedBy: 'bm1' };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getManagerActivityStandardOverride('t1', 'mgr1');
    expect(result.jfwCount).toBe(3);
    expect(result.managerId).toBe('mgr1');
  });
});

// ── setManagerActivityStandardOverride ───────────────────────────────────────

describe('setManagerActivityStandardOverride', () => {
  it('writes to the correct Firestore path', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setManagerActivityStandardOverride('t1', 'mgr1', {}, 'bm1');
    const [ref] = mockSetDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/t1/managerActivityStandardOverrides/mgr1');
  });

  it('merges tenantId, managerId, updatedBy, updatedAt onto the payload', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setManagerActivityStandardOverride('t1', 'mgr1', { jfwCount: 4 }, 'bm1');
    const [, written] = mockSetDoc.mock.calls[0];
    expect(written.tenantId).toBe('t1');
    expect(written.managerId).toBe('mgr1');
    expect(written.updatedBy).toBe('bm1');
    expect(written.updatedAt).toBe('__SERVER_TIMESTAMP__');
  });

  it('includes the override activity keys in the written payload', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setManagerActivityStandardOverride('t1', 'mgr1', { jfwCount: 4, oneOnOnesConducted: 6 }, 'bm1');
    const [, written] = mockSetDoc.mock.calls[0];
    expect(written.jfwCount).toBe(4);
    expect(written.oneOnOnesConducted).toBe(6);
  });

  it('does NOT use merge:true — overwrites to clear previous overrides', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setManagerActivityStandardOverride('t1', 'mgr1', {}, 'bm1');
    const [, , opts] = mockSetDoc.mock.calls[0];
    expect(opts).toBeUndefined();
  });
});

// ── clearManagerActivityStandardOverride ─────────────────────────────────────

describe('clearManagerActivityStandardOverride', () => {
  it('calls deleteDoc on the correct path', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await clearManagerActivityStandardOverride('t1', 'mgr1');
    const [ref] = mockDeleteDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/t1/managerActivityStandardOverrides/mgr1');
  });
});

// ── getResolvedStandards ──────────────────────────────────────────────────────

describe('getResolvedStandards', () => {
  const ORG_STANDARDS = {
    unit_manager: { jfwCount: 2, oneOnOnesConducted: 5, namesSourced: 10,
                    interviewsConducted: 4, recruitsInFirstWeeks: 1, trainingSessions: 1,
                    unitMeetingHeld: true, dashboardReviewDone: true },
  };

  beforeEach(() => {
    vi.mocked(getManagerActivityStandards).mockResolvedValue(ORG_STANDARDS);
  });

  it('fetches org standards and override in parallel', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await getResolvedStandards({ tenantId: 't1', managerId: 'um1', role: 'unit_manager' });
    expect(getManagerActivityStandards).toHaveBeenCalledWith('t1');
    expect(mockGetDoc).toHaveBeenCalledOnce();
  });

  it('returns org-default when no override doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getResolvedStandards({ tenantId: 't1', managerId: 'um1', role: 'unit_manager' });
    expect(result.jfwCount).toBe(2);
    expect(result.oneOnOnesConducted).toBe(5);
  });

  it('override value takes precedence over org-default', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ tenantId: 't1', managerId: 'um1', jfwCount: 5 }),
    });
    const result = await getResolvedStandards({ tenantId: 't1', managerId: 'um1', role: 'unit_manager' });
    expect(result.jfwCount).toBe(5);        // override wins
    expect(result.oneOnOnesConducted).toBe(5); // org-default retained for non-overridden
  });

  it('blank-both (no org-default, no override) → key absent — no "0 of 0"', async () => {
    vi.mocked(getManagerActivityStandards).mockResolvedValue({});
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getResolvedStandards({ tenantId: 't1', managerId: 'um1', role: 'unit_manager' });
    expect(result.jfwCount).toBeUndefined();
    expect(result.oneOnOnesConducted).toBeUndefined();
  });

  it('null override values do not overwrite org-default', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ tenantId: 't1', managerId: 'um1', jfwCount: null }),
    });
    const result = await getResolvedStandards({ tenantId: 't1', managerId: 'um1', role: 'unit_manager' });
    expect(result.jfwCount).toBe(2); // org-default retained — null override is skipped
  });

  it('non-activity keys on the override doc are ignored', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ tenantId: 't1', managerId: 'um1', updatedBy: 'bm1', jfwCount: 3 }),
    });
    const result = await getResolvedStandards({ tenantId: 't1', managerId: 'um1', role: 'unit_manager' });
    expect(result.tenantId).toBeUndefined();
    expect(result.updatedBy).toBeUndefined();
    expect(result.jfwCount).toBe(3);
  });

  it('unknown role → all org-default blank, no override crash', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getResolvedStandards({ tenantId: 't1', managerId: 'um1', role: 'unknown_role' });
    expect(result).toEqual({});
  });
});

// ── getResolvedStandardsForMany (I3a — bulk per-row standards) ───────────────

describe('getResolvedStandardsForMany', () => {
  it('returns empty Map when managers list is empty', async () => {
    const result = await getResolvedStandardsForMany({ tenantId: 't1', managers: [] });
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(vi.mocked(getManagerActivityStandards)).not.toHaveBeenCalled();
  });

  it('fetches org-default standards exactly once', async () => {
    vi.mocked(getManagerActivityStandards).mockResolvedValue({
      unit_manager:   { namesSourced: 5 },
      branch_manager: { namesSourced: 8 },
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await getResolvedStandardsForMany({
      tenantId: 't1',
      managers: [
        { managerId: 'um1', managerRole: 'unit_manager' },
        { managerId: 'um2', managerRole: 'unit_manager' },
        { managerId: 'bm1', managerRole: 'branch_manager' },
      ],
    });
    expect(vi.mocked(getManagerActivityStandards)).toHaveBeenCalledOnce();
  });

  it('returns org-default standards keyed by managerId when no overrides exist', async () => {
    vi.mocked(getManagerActivityStandards).mockResolvedValue({
      unit_manager:   { namesSourced: 5 },
      branch_manager: { namesSourced: 8 },
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getResolvedStandardsForMany({
      tenantId: 't1',
      managers: [
        { managerId: 'um1', managerRole: 'unit_manager' },
        { managerId: 'bm1', managerRole: 'branch_manager' },
      ],
    });
    expect(result.get('um1')).toEqual({ namesSourced: 5 });
    expect(result.get('bm1')).toEqual({ namesSourced: 8 });
  });

  it('applies per-manager overrides over org-default', async () => {
    vi.mocked(getManagerActivityStandards).mockResolvedValue({
      unit_manager: { namesSourced: 5, jfwCount: 2 },
    });
    // First call → um1 override; second call → um2 no override
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ namesSourced: 10 }) })
      .mockResolvedValueOnce({ exists: () => false });
    const result = await getResolvedStandardsForMany({
      tenantId: 't1',
      managers: [
        { managerId: 'um1', managerRole: 'unit_manager' },
        { managerId: 'um2', managerRole: 'unit_manager' },
      ],
    });
    // um1 has override on namesSourced; jfwCount falls back to org-default
    expect(result.get('um1')).toEqual({ namesSourced: 10, jfwCount: 2 });
    // um2 only the org-default
    expect(result.get('um2')).toEqual({ namesSourced: 5, jfwCount: 2 });
  });

  it('degrades to org-default when a single override fetch rejects', async () => {
    vi.mocked(getManagerActivityStandards).mockResolvedValue({
      unit_manager: { namesSourced: 5 },
    });
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ namesSourced: 10 }) })
      .mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    const result = await getResolvedStandardsForMany({
      tenantId: 't1',
      managers: [
        { managerId: 'um1', managerRole: 'unit_manager' },
        { managerId: 'um2', managerRole: 'unit_manager' },
      ],
    });
    expect(result.get('um1')).toEqual({ namesSourced: 10 });
    // Override rejected → fall back to org-default
    expect(result.get('um2')).toEqual({ namesSourced: 5 });
  });
});
