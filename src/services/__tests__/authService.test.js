import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockCredential: { type: 'email' },
  mockReauth: vi.fn(),
  mockVerifyBefore: vi.fn(),
  mockEmailAuthProvider: { credential: vi.fn() },
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn((db, name) => ({ __col: name })),
  mockServerTimestamp: vi.fn(() => '__SERVER_TIMESTAMP__'),
  mockAuth: { currentUser: { uid: 'ta-uid', email: 'admin@tatillife.com' } },
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  EmailAuthProvider: hoisted.mockEmailAuthProvider,
  reauthenticateWithCredential: hoisted.mockReauth,
  verifyBeforeUpdateEmail: hoisted.mockVerifyBefore,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  collection: hoisted.mockCollection,
  addDoc: (...args) => hoisted.mockAddDoc(...args),
  serverTimestamp: hoisted.mockServerTimestamp,
}));

vi.mock('../../firebase', () => ({
  auth: hoisted.mockAuth,
  db: {},
}));

import { requestEmailUpdate } from '../authService';

const MOCK_USER = { uid: 'ta-uid', email: 'admin@tatillife.com' };

describe('authService.requestEmailUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockEmailAuthProvider.credential.mockReturnValue(hoisted.mockCredential);
    hoisted.mockReauth.mockResolvedValue();
    hoisted.mockVerifyBefore.mockResolvedValue();
    hoisted.mockAddDoc.mockResolvedValue({ id: 'audit-doc-1' });
  });

  it('builds a credential from user.email + currentPassword', async () => {
    await requestEmailUpdate(MOCK_USER, 'mypassword', 'new@email.com', 'tatillife_south');
    expect(hoisted.mockEmailAuthProvider.credential).toHaveBeenCalledWith(
      MOCK_USER.email,
      'mypassword',
    );
  });

  it('calls reauthenticateWithCredential with the built credential', async () => {
    await requestEmailUpdate(MOCK_USER, 'mypassword', 'new@email.com', 'tatillife_south');
    expect(hoisted.mockReauth).toHaveBeenCalledWith(MOCK_USER, hoisted.mockCredential);
  });

  it('calls verifyBeforeUpdateEmail with the new email', async () => {
    await requestEmailUpdate(MOCK_USER, 'mypassword', 'new@email.com', 'tatillife_south');
    expect(hoisted.mockVerifyBefore).toHaveBeenCalledWith(
      MOCK_USER,
      'new@email.com',
      expect.objectContaining({ url: expect.any(String) }),
    );
  });

  it('writes an audit doc to auditAdminEmailUpdates with correct shape', async () => {
    await requestEmailUpdate(MOCK_USER, 'mypassword', 'new@email.com', 'tatillife_south');
    expect(hoisted.mockAddDoc).toHaveBeenCalledOnce();
    const [colRef, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(colRef.__col).toBe('auditAdminEmailUpdates');
    expect(payload).toEqual({
      uid: MOCK_USER.uid,
      tenantId: 'tatillife_south',
      oldEmail: MOCK_USER.email,
      newEmail: 'new@email.com',
      initiatedByUid: MOCK_USER.uid,
      userAgent: expect.any(String),
      timestamp: '__SERVER_TIMESTAMP__',
    });
  });

  it('throws (does not catch) when reauthenticateWithCredential rejects', async () => {
    const authErr = Object.assign(new Error('wrong-password'), { code: 'auth/wrong-password' });
    hoisted.mockReauth.mockRejectedValueOnce(authErr);

    await expect(
      requestEmailUpdate(MOCK_USER, 'badpass', 'new@email.com', 'tatillife_south'),
    ).rejects.toBe(authErr);

    expect(hoisted.mockVerifyBefore).not.toHaveBeenCalled();
    expect(hoisted.mockAddDoc).not.toHaveBeenCalled();
  });

  it('throws when verifyBeforeUpdateEmail rejects (e.g. email already in use)', async () => {
    const emailErr = Object.assign(new Error(), { code: 'auth/email-already-in-use' });
    hoisted.mockVerifyBefore.mockRejectedValueOnce(emailErr);

    await expect(
      requestEmailUpdate(MOCK_USER, 'mypassword', 'taken@email.com', 'tatillife_south'),
    ).rejects.toBe(emailErr);

    expect(hoisted.mockAddDoc).not.toHaveBeenCalled();
  });

  it('sequencing: reauth fires before verifyBefore, verifyBefore fires before audit', async () => {
    const order = [];
    hoisted.mockReauth.mockImplementation(async () => { order.push('reauth'); });
    hoisted.mockVerifyBefore.mockImplementation(async () => { order.push('verify'); });
    hoisted.mockAddDoc.mockImplementation(async () => { order.push('audit'); return {}; });

    await requestEmailUpdate(MOCK_USER, 'mypassword', 'new@email.com', 'tatillife_south');
    expect(order).toEqual(['reauth', 'verify', 'audit']);
  });
});
