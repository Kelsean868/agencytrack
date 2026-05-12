import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted firebase mocks — must use vi.hoisted so the mock factories run
// before any module-level imports.
const hoisted = vi.hoisted(() => ({
  mockGetTenantId: vi.fn(() => 'tenant1'),
  mockAuth: { currentUser: { uid: 'caller-uid' } },
  mockUpdateDoc: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
  storage: {},
  auth: hoisted.mockAuth,
  getTenantId: hoisted.mockGetTenantId,
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

import { updateUserFields, MANAGER_EDITABLE_FIELDS } from '../userService';

describe('userService.updateUserFields', () => {
  beforeEach(() => {
    hoisted.mockUpdateDoc.mockReset();
    hoisted.mockUpdateDoc.mockResolvedValue();
    hoisted.mockAuth.currentUser = { uid: 'caller-uid' };
  });

  it('writes the supplied allowlist fields with updatedAt + updatedBy stamps', async () => {
    await updateUserFields('target-uid', { name: 'New Name', phone: '868-555-1234' });
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
    await expect(updateUserFields('target-uid', { role: 'tenant_admin' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on branchId (claim-keyed; deferred to PR-4b)', async () => {
    await expect(updateUserFields('target-uid', { branchId: 'branch-x' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on active (must flow through deactivateUser CF)', async () => {
    await expect(updateUserFields('target-uid', { active: false }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on email (auth-keyed; deferred entirely)', async () => {
    await expect(updateUserFields('target-uid', { email: 'x@y.com' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on createdAt / createdBy / tenantId (audit-immutable + isolation)', async () => {
    for (const key of ['createdAt', 'createdBy', 'tenantId']) {
      hoisted.mockUpdateDoc.mockReset();
      await expect(updateUserFields('target-uid', { [key]: 'tampered' }))
        .rejects.toThrow(/Disallowed field/);
      expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
    }
  });

  it('rejects mixed allowed + disallowed fields without partial writes', async () => {
    await expect(updateUserFields('target-uid', { name: 'OK', role: 'tenant_admin' }))
      .rejects.toThrow(/Disallowed field/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when caller is not signed in (no currentUser)', async () => {
    hoisted.mockAuth.currentUser = null;
    await expect(updateUserFields('target-uid', { name: 'Anon Edit' }))
      .rejects.toThrow(/Not signed in/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws on empty patch', async () => {
    await expect(updateUserFields('target-uid', {})).rejects.toThrow(/No fields to update/);
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
