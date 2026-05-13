import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted firebase mocks — must use vi.hoisted so the mock factories run
// before any module-level imports.
const hoisted = vi.hoisted(() => ({
  mockAuth: { currentUser: { uid: 'caller-uid' } },
  mockUpdateDoc: vi.fn(),
  mockCallable: vi.fn(),
  mockHttpsCallable: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
  storage: {},
  auth: hoisted.mockAuth,
}));

vi.mock('firebase/firestore', () => ({
  doc: (db, path) => ({ __ref: path }),
  updateDoc: (...args) => hoisted.mockUpdateDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({ __fns: true }),
  httpsCallable: (...args) => hoisted.mockHttpsCallable(...args),
}));

import {
  updateUserFields,
  callUpdateUser,
  MANAGER_EDITABLE_FIELDS,
  CLAIM_KEYED_FIELDS,
} from '../userService';

describe('userService.updateUserFields', () => {
  beforeEach(() => {
    hoisted.mockUpdateDoc.mockReset();
    hoisted.mockUpdateDoc.mockResolvedValue();
    hoisted.mockAuth.currentUser = { uid: 'caller-uid' };
  });

  it('writes the supplied allowlist fields with updatedAt + updatedBy stamps', async () => {
    await updateUserFields('tenant1', 'target-uid', { name: 'New Name', phone: '868-555-1234' });
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/tenant1/users/target-uid');
    expect(payload).toEqual({
      name: 'New Name',
      phone: '868-555-1234',
      updatedAt: '__SERVER_TIMESTAMP__',
      updatedBy: 'caller-uid',
    });
  });

  it('throws on a disallowed field WITHOUT touching Firestore', async () => {
    await expect(updateUserFields('tenant1', 'target-uid', { role: 'tenant_admin' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on branchId (claim-keyed; deferred to PR-4b)', async () => {
    await expect(updateUserFields('tenant1', 'target-uid', { branchId: 'branch-x' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on active (must flow through deactivateUser CF)', async () => {
    await expect(updateUserFields('tenant1', 'target-uid', { active: false }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on email (auth-keyed; deferred entirely)', async () => {
    await expect(updateUserFields('tenant1', 'target-uid', { email: 'x@y.com' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on createdAt / createdBy / tenantId (audit-immutable + isolation)', async () => {
    for (const key of ['createdAt', 'createdBy', 'tenantId']) {
      hoisted.mockUpdateDoc.mockReset();
      await expect(updateUserFields('tenant1', 'target-uid', { [key]: 'tampered' }))
        .rejects.toThrow(/Disallowed field/);
      expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
    }
  });

  it('rejects mixed allowed + disallowed fields without partial writes', async () => {
    await expect(updateUserFields('tenant1', 'target-uid', { name: 'OK', role: 'tenant_admin' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when caller is not signed in (no currentUser)', async () => {
    hoisted.mockAuth.currentUser = null;
    await expect(updateUserFields('tenant1', 'target-uid', { name: 'Anon Edit' }))
      .rejects.toThrow(/Not signed in/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on empty patch', async () => {
    await expect(updateUserFields('tenant1', 'target-uid', {})).rejects.toThrow(/No fields to update/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('allowlist export contains exactly the v1 manager-editable field set', () => {
    expect(Array.from(MANAGER_EDITABLE_FIELDS)).toEqual([
      'name', 'phone', 'bio',
      'unitId', 'unitName',
      'agentNumber', 'contractStartDate',
      'canConfirmSettlements',
    ]);
  });
});

describe('userService.callUpdateUser', () => {
  beforeEach(() => {
    hoisted.mockCallable.mockReset();
    hoisted.mockHttpsCallable.mockReset();
    hoisted.mockCallable.mockResolvedValue({ data: { success: true, updatedFields: ['role'] } });
    hoisted.mockHttpsCallable.mockImplementation(() => hoisted.mockCallable);
  });

  it('invokes the updateUser CF with uid + updates payload', async () => {
    const result = await callUpdateUser({
      uid: 'target-uid',
      updates: { role: 'unit_manager' },
    });
    expect(hoisted.mockHttpsCallable).toHaveBeenCalledTimes(1);
    expect(hoisted.mockHttpsCallable.mock.calls[0][1]).toBe('updateUser');
    expect(hoisted.mockCallable).toHaveBeenCalledWith({
      uid: 'target-uid',
      updates: { role: 'unit_manager' },
    });
    expect(result).toEqual({ success: true, updatedFields: ['role'] });
  });

  it('threads confirmationPhrase through to the CF when provided', async () => {
    await callUpdateUser({
      uid: 'target-uid',
      updates: { role: 'tenant_admin' },
      confirmationPhrase: 'PROMOTE TO TENANT ADMIN',
    });
    expect(hoisted.mockCallable).toHaveBeenCalledWith({
      uid: 'target-uid',
      updates: { role: 'tenant_admin' },
      confirmationPhrase: 'PROMOTE TO TENANT ADMIN',
    });
  });

  it('omits confirmationPhrase when not provided', async () => {
    await callUpdateUser({
      uid: 'target-uid',
      updates: { branchId: 'branch-x' },
    });
    const payload = hoisted.mockCallable.mock.calls[0][0];
    expect('confirmationPhrase' in payload).toBe(false);
  });

  it('threads branchId-only updates', async () => {
    await callUpdateUser({
      uid: 'target-uid',
      updates: { branchId: 'branch-y' },
    });
    expect(hoisted.mockCallable).toHaveBeenCalledWith({
      uid: 'target-uid',
      updates: { branchId: 'branch-y' },
    });
  });

  it('threads combined role + branchId + unitId updates (demotion-to-agent shape)', async () => {
    await callUpdateUser({
      uid: 'target-uid',
      updates: { role: 'agent', branchId: 'branch-z', unitId: 'unit-1' },
    });
    expect(hoisted.mockCallable).toHaveBeenCalledWith({
      uid: 'target-uid',
      updates: { role: 'agent', branchId: 'branch-z', unitId: 'unit-1' },
    });
  });

  it('throws when uid is missing without invoking the CF', async () => {
    await expect(callUpdateUser({ updates: { role: 'agent' } }))
      .rejects.toThrow(/uid is required/);
    expect(hoisted.mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('throws when updates is missing without invoking the CF', async () => {
    await expect(callUpdateUser({ uid: 'target-uid' }))
      .rejects.toThrow(/updates object is required/);
    expect(hoisted.mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('throws when updates is not an object without invoking the CF', async () => {
    await expect(callUpdateUser({ uid: 'target-uid', updates: 'role=agent' }))
      .rejects.toThrow(/updates object is required/);
    expect(hoisted.mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('propagates Firebase HttpsError from the CF', async () => {
    const cfErr = Object.assign(new Error('permission-denied: caller cannot edit'), {
      code: 'permission-denied',
    });
    hoisted.mockCallable.mockRejectedValueOnce(cfErr);
    await expect(callUpdateUser({ uid: 'target-uid', updates: { role: 'agent' } }))
      .rejects.toBe(cfErr);
  });

  it('CLAIM_KEYED_FIELDS contains exactly the v1 claim-keyed field set', () => {
    expect(Array.from(CLAIM_KEYED_FIELDS)).toEqual(['role', 'branchId']);
  });
});
