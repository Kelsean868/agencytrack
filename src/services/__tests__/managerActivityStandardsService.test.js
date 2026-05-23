import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
}));
const { mockGetDoc, mockSetDoc } = hoisted;

vi.mock('firebase/firestore', () => ({
  doc:             (db, path) => ({ __ref: path }),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

import {
  getManagerActivityStandards,
  getRoleStandards,
  setManagerActivityStandards,
  NUMERIC_STANDARDS,
  BOOLEAN_STANDARDS,
  STANDARDS_ROLE_KEYS,
} from '../managerActivityStandardsService';

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('NUMERIC_STANDARDS covers the 6 standard-bearing numeric activities', () => {
    expect(NUMERIC_STANDARDS).toEqual([
      'jfwCount', 'oneOnOnesConducted', 'namesSourced',
      'interviewsConducted', 'recruitsInFirstWeeks', 'trainingSessions',
    ]);
  });

  it('BOOLEAN_STANDARDS covers the 2 boolean-expectation activities', () => {
    expect(BOOLEAN_STANDARDS).toEqual(['unitMeetingHeld', 'dashboardReviewDone']);
  });

  it('STANDARDS_ROLE_KEYS covers the 3 manager roles', () => {
    expect(STANDARDS_ROLE_KEYS).toEqual(['unit_manager', 'branch_manager', 'sales_manager']);
  });
});

// ── getManagerActivityStandards ───────────────────────────────────────────────

describe('getManagerActivityStandards', () => {
  it('reads from the correct Firestore path', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await getManagerActivityStandards('tenant1');
    const [docRef] = mockGetDoc.mock.calls[0];
    expect(docRef.__ref).toBe('tenants/tenant1/config/managerActivityStandards');
  });

  it('returns {} when the doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getManagerActivityStandards('tenant1');
    expect(result).toEqual({});
  });

  it('returns the stored data when the doc exists', async () => {
    const stored = {
      unit_manager:    { jfwCount: 2, oneOnOnesConducted: 5 },
      branch_manager:  { jfwCount: 3, oneOnOnesConducted: 8 },
      sales_manager:   { jfwCount: 4, oneOnOnesConducted: 10 },
      updatedBy: 'admin1',
      updatedAt: '__TS__',
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored });
    const result = await getManagerActivityStandards('tenant1');
    expect(result.unit_manager.jfwCount).toBe(2);
    expect(result.branch_manager.oneOnOnesConducted).toBe(8);
    expect(result.updatedBy).toBe('admin1');
  });
});

// ── getRoleStandards ──────────────────────────────────────────────────────────

describe('getRoleStandards', () => {
  it('returns the role sub-map when present', () => {
    const standards = { unit_manager: { jfwCount: 2 } };
    expect(getRoleStandards(standards, 'unit_manager')).toEqual({ jfwCount: 2 });
  });

  it('returns {} when the role key is absent', () => {
    const standards = { unit_manager: { jfwCount: 2 } };
    expect(getRoleStandards(standards, 'branch_manager')).toEqual({});
  });

  it('returns {} when standards is an empty object', () => {
    expect(getRoleStandards({}, 'unit_manager')).toEqual({});
  });

  it('returns {} when standards is null or undefined', () => {
    expect(getRoleStandards(null, 'unit_manager')).toEqual({});
    expect(getRoleStandards(undefined, 'unit_manager')).toEqual({});
  });
});

// ── setManagerActivityStandards ───────────────────────────────────────────────

describe('setManagerActivityStandards', () => {
  it('writes to the correct Firestore path', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setManagerActivityStandards('tenant1', {}, 'uid1');
    const [docRef] = mockSetDoc.mock.calls[0];
    expect(docRef.__ref).toBe('tenants/tenant1/config/managerActivityStandards');
  });

  it('merges updatedBy + updatedAt onto the payload', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const data = { unit_manager: { jfwCount: 2 } };
    await setManagerActivityStandards('tenant1', data, 'uid1');
    const [, written, opts] = mockSetDoc.mock.calls[0];
    expect(written.updatedBy).toBe('uid1');
    expect(written.updatedAt).toBe('__SERVER_TIMESTAMP__');
    expect(opts).toEqual({ merge: true });
  });

  it('preserves the role sub-maps in the written payload', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const data = {
      unit_manager:   { jfwCount: 2, unitMeetingHeld: true },
      branch_manager: { jfwCount: 3 },
      sales_manager:  {},
    };
    await setManagerActivityStandards('tenant1', data, 'uid1');
    const [, written] = mockSetDoc.mock.calls[0];
    expect(written.unit_manager.jfwCount).toBe(2);
    expect(written.branch_manager.jfwCount).toBe(3);
  });
});
