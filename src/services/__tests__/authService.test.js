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
  mockFirestoreSignOut: vi.fn(),
  mockTerminate: vi.fn(),
  mockClearIndexedDbPersistence: vi.fn(),
  mockDb: { __brand: 'firestore-db-instance' },
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: (...args) => hoisted.mockFirestoreSignOut(...args),
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
  terminate: (...args) => hoisted.mockTerminate(...args),
  clearIndexedDbPersistence: (...args) => hoisted.mockClearIndexedDbPersistence(...args),
}));

vi.mock('../../firebase', () => ({
  auth: hoisted.mockAuth,
  db: hoisted.mockDb,
}));

import { requestEmailUpdate, signOut } from '../authService';

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

// SEC-10 — logout cache recovery. Order matters: clearIndexedDbPersistence
// throws if called before terminate() on a still-running instance, so the
// sequence itself is the thing under test, not just that each fn ran.
describe('authService.signOut', () => {
  let reload;

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockFirestoreSignOut.mockResolvedValue();
    hoisted.mockTerminate.mockResolvedValue();
    hoisted.mockClearIndexedDbPersistence.mockResolvedValue();
    reload = vi.fn();
    vi.stubGlobal('location', { reload });
  });

  it('runs firebaseSignOut → terminate(db) → clearIndexedDbPersistence(db) → reload, in that order', async () => {
    const order = [];
    hoisted.mockFirestoreSignOut.mockImplementation(async () => { order.push('signOut'); });
    hoisted.mockTerminate.mockImplementation(async () => { order.push('terminate'); });
    hoisted.mockClearIndexedDbPersistence.mockImplementation(async () => { order.push('clear'); });
    reload.mockImplementation(() => { order.push('reload'); });

    await signOut();

    expect(order).toEqual(['signOut', 'terminate', 'clear', 'reload']);
  });

  it('calls terminate(db) and clearIndexedDbPersistence(db) with the SAME Firestore db instance — never the auth store', async () => {
    await signOut();

    expect(hoisted.mockTerminate).toHaveBeenCalledWith(hoisted.mockDb);
    expect(hoisted.mockClearIndexedDbPersistence).toHaveBeenCalledWith(hoisted.mockDb);
    // Nothing here ever references `auth` — signOut(auth) is the ONLY call
    // that touches the Firebase Auth side; the cache-clear calls only ever
    // see the Firestore db instance.
    expect(hoisted.mockFirestoreSignOut).toHaveBeenCalledWith(hoisted.mockAuth);
    expect(hoisted.mockTerminate).not.toHaveBeenCalledWith(hoisted.mockAuth);
    expect(hoisted.mockClearIndexedDbPersistence).not.toHaveBeenCalledWith(hoisted.mockAuth);
  });

  it('still reloads (best-effort cache clear) when terminate() rejects', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.mockTerminate.mockRejectedValueOnce(new Error('boom'));

    await signOut();

    expect(hoisted.mockFirestoreSignOut).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('still reloads (best-effort cache clear) when clearIndexedDbPersistence() rejects', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.mockClearIndexedDbPersistence.mockRejectedValueOnce(new Error('boom'));

    await signOut();

    expect(hoisted.mockTerminate).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
