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
  resendInvite,
  getInviteLink,
  saveOnboardingIdentity,
  markOnboardingComplete,
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

  it('allowlist export contains the manager-editable field set including license fields', () => {
    expect(Array.from(MANAGER_EDITABLE_FIELDS)).toEqual([
      'name', 'phone', 'bio',
      'unitId', 'unitName',
      'agentNumber', 'contractStartDate',
      'canConfirmSettlements',
      'licenseStatus', 'cbttExamPassedDate', 'cbttExtensionGranted', 'licenseProfile',
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

describe('userService.resendInvite', () => {
  beforeEach(() => {
    hoisted.mockCallable.mockReset();
    hoisted.mockHttpsCallable.mockReset();
    hoisted.mockCallable.mockResolvedValue({
      data: {
        success: true,
        targetUid: 'target-uid',
        targetEmail: 'target@example.com',
        emailQueued: true,
      },
    });
    hoisted.mockHttpsCallable.mockImplementation(() => hoisted.mockCallable);
  });

  it('invokes the resendInviteEmail CF with the uid payload', async () => {
    const result = await resendInvite('target-uid');
    expect(hoisted.mockHttpsCallable).toHaveBeenCalledTimes(1);
    expect(hoisted.mockHttpsCallable.mock.calls[0][1]).toBe('resendInviteEmail');
    expect(hoisted.mockCallable).toHaveBeenCalledWith({ uid: 'target-uid' });
    expect(result).toEqual({
      success: true,
      targetUid: 'target-uid',
      targetEmail: 'target@example.com',
      emailQueued: true,
    });
  });

  it('propagates emailQueued:false return shape unchanged', async () => {
    hoisted.mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        targetUid: 'target-uid',
        targetEmail: 'target@example.com',
        emailQueued: false,
        emailError: 'mail/ write failed',
      },
    });
    const result = await resendInvite('target-uid');
    expect(result.emailQueued).toBe(false);
    expect(result.emailError).toBe('mail/ write failed');
  });

  it('throws when uid is missing without invoking the CF', async () => {
    await expect(resendInvite()).rejects.toThrow(/uid is required/);
    expect(hoisted.mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('throws when uid is empty string without invoking the CF', async () => {
    await expect(resendInvite('')).rejects.toThrow(/uid is required/);
    expect(hoisted.mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('propagates Firebase HttpsError from the CF (permission-denied, not-found, etc.)', async () => {
    const cfErr = Object.assign(new Error('permission-denied: cross-tenant resend'), {
      code: 'permission-denied',
    });
    hoisted.mockCallable.mockRejectedValueOnce(cfErr);
    await expect(resendInvite('target-uid')).rejects.toBe(cfErr);
  });
});

describe('userService.getInviteLink', () => {
  const FAKE_LINK = 'https://agencytrack.vercel.app/__/auth/action?oobCode=FAKETOKEN';

  beforeEach(() => {
    hoisted.mockCallable.mockReset();
    hoisted.mockHttpsCallable.mockReset();
    hoisted.mockCallable.mockResolvedValue({
      data: {
        success: true,
        targetUid: 'target-uid',
        targetEmail: 'target@example.com',
        emailQueued: false,
        link: FAKE_LINK,
      },
    });
    hoisted.mockHttpsCallable.mockImplementation(() => hoisted.mockCallable);
  });

  it("invokes resendInviteEmail CF with channel:'link' and returns data.link", async () => {
    const result = await getInviteLink('target-uid');
    expect(hoisted.mockHttpsCallable.mock.calls[0][1]).toBe('resendInviteEmail');
    expect(hoisted.mockCallable).toHaveBeenCalledWith({ uid: 'target-uid', channel: 'link' });
    expect(result).toBe(FAKE_LINK);
  });

  it('throws when uid is missing without invoking the CF', async () => {
    await expect(getInviteLink()).rejects.toThrow(/uid is required/);
    expect(hoisted.mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('throws when uid is empty string without invoking the CF', async () => {
    await expect(getInviteLink('')).rejects.toThrow(/uid is required/);
    expect(hoisted.mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('propagates Firebase HttpsError from the CF', async () => {
    const cfErr = Object.assign(new Error('failed-precondition: inactive'), {
      code: 'failed-precondition',
    });
    hoisted.mockCallable.mockRejectedValueOnce(cfErr);
    await expect(getInviteLink('target-uid')).rejects.toBe(cfErr);
  });
});

// ── Slice B onboarding write-once functions ───────────────────────────────────

describe('userService.saveOnboardingIdentity', () => {
  beforeEach(() => {
    hoisted.mockUpdateDoc.mockReset();
    hoisted.mockUpdateDoc.mockResolvedValue();
  });

  it('writes agentNumber and dateOfBirth WITHOUT updatedAt', async () => {
    await saveOnboardingIdentity('tenant-1', 'uid-1', {
      agentNumber: '012B34',
      dateOfBirth: '1990-05-15',
    });
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/tenant-1/users/uid-1');
    expect(payload).toEqual({ agentNumber: '012B34', dateOfBirth: '1990-05-15' });
    expect(payload).not.toHaveProperty('updatedAt');
  });

  it('writes only agentNumber when dateOfBirth is omitted', async () => {
    await saveOnboardingIdentity('tenant-1', 'uid-1', { agentNumber: '012B34' });
    const [, payload] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(payload).toEqual({ agentNumber: '012B34' });
  });

  it('writes only dateOfBirth when agentNumber is omitted', async () => {
    await saveOnboardingIdentity('tenant-1', 'uid-1', { dateOfBirth: '1990-05-15' });
    const [, payload] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(payload).toEqual({ dateOfBirth: '1990-05-15' });
  });

  it('does not call updateDoc when both fields are absent', async () => {
    await saveOnboardingIdentity('tenant-1', 'uid-1', {});
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when tenantId is missing', async () => {
    await expect(saveOnboardingIdentity(null, 'uid-1', { agentNumber: 'x' }))
      .rejects.toThrow(/tenantId and uid are required/);
  });

  it('throws when uid is missing', async () => {
    await expect(saveOnboardingIdentity('tenant-1', null, { agentNumber: 'x' }))
      .rejects.toThrow(/tenantId and uid are required/);
  });
});

describe('userService.markOnboardingComplete', () => {
  beforeEach(() => {
    hoisted.mockUpdateDoc.mockReset();
    hoisted.mockUpdateDoc.mockResolvedValue();
  });

  it('writes only { onboardingComplete: true } without updatedAt', async () => {
    await markOnboardingComplete('tenant-1', 'uid-1');
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/tenant-1/users/uid-1');
    expect(payload).toEqual({ onboardingComplete: true });
    expect(payload).not.toHaveProperty('updatedAt');
  });

  it('throws when tenantId is missing', async () => {
    await expect(markOnboardingComplete(null, 'uid-1'))
      .rejects.toThrow(/tenantId and uid are required/);
  });

  it('throws when uid is missing', async () => {
    await expect(markOnboardingComplete('tenant-1', null))
      .rejects.toThrow(/tenantId and uid are required/);
  });
});
