import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockTerminate: vi.fn(),
  mockClearIndexedDbPersistence: vi.fn(),
  mockDb: { __brand: 'firestore-db-instance' },
  mockAuth: { __brand: 'firebase-auth-instance' },
}));

vi.mock('firebase/firestore', () => ({
  terminate: (...args) => hoisted.mockTerminate(...args),
  clearIndexedDbPersistence: (...args) => hoisted.mockClearIndexedDbPersistence(...args),
}));

// Project convention: src/firebase.js is globally stubbed via
// firebaseTestStubPlugin (vite.config.js) — this mock only needs to expose
// a distinguishable `db` (and `auth`, to prove repair never touches it).
vi.mock('../../firebase', () => ({
  db: hoisted.mockDb,
  auth: hoisted.mockAuth,
}));

import { isFirestoreAssertionFailure, repairFirestoreCache } from '../firestoreRecovery';

describe('isFirestoreAssertionFailure', () => {
  it('matches the live 2026-09-23 incident message (ID: b815)', () => {
    expect(isFirestoreAssertionFailure(
      new Error('FIRESTORE (12.12.1) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)')
    )).toBe(true);
  });

  it('matches regardless of SDK version or assertion ID (the "family", not one instance)', () => {
    expect(isFirestoreAssertionFailure(
      new Error('FIRESTORE (11.0.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)')
    )).toBe(true);
  });

  it('matches a plain string message', () => {
    expect(isFirestoreAssertionFailure('INTERNAL ASSERTION FAILED: something')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isFirestoreAssertionFailure('internal assertion failed')).toBe(true);
  });

  it('does not match an unrelated error', () => {
    expect(isFirestoreAssertionFailure(new Error('Network request failed'))).toBe(false);
  });

  it('does not match null/undefined', () => {
    expect(isFirestoreAssertionFailure(null)).toBe(false);
    expect(isFirestoreAssertionFailure(undefined)).toBe(false);
  });
});

describe('repairFirestoreCache', () => {
  let reload;

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockTerminate.mockResolvedValue();
    hoisted.mockClearIndexedDbPersistence.mockResolvedValue();
    reload = vi.fn();
    vi.stubGlobal('location', { reload });
  });

  it('runs terminate(db) → clearIndexedDbPersistence(db) → reload, in that order', async () => {
    const order = [];
    hoisted.mockTerminate.mockImplementation(async () => { order.push('terminate'); });
    hoisted.mockClearIndexedDbPersistence.mockImplementation(async () => { order.push('clear'); });
    reload.mockImplementation(() => { order.push('reload'); });

    await repairFirestoreCache();

    expect(order).toEqual(['terminate', 'clear', 'reload']);
  });

  it('only ever touches the Firestore db instance — never the auth store', async () => {
    await repairFirestoreCache();

    expect(hoisted.mockTerminate).toHaveBeenCalledWith(hoisted.mockDb);
    expect(hoisted.mockClearIndexedDbPersistence).toHaveBeenCalledWith(hoisted.mockDb);
    expect(hoisted.mockTerminate).not.toHaveBeenCalledWith(hoisted.mockAuth);
    expect(hoisted.mockClearIndexedDbPersistence).not.toHaveBeenCalledWith(hoisted.mockAuth);
  });

  it('still reloads when terminate() rejects (best-effort)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.mockTerminate.mockRejectedValueOnce(new Error('boom'));

    await repairFirestoreCache();

    expect(reload).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('still reloads when clearIndexedDbPersistence() rejects (best-effort)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.mockClearIndexedDbPersistence.mockRejectedValueOnce(new Error('boom'));

    await repairFirestoreCache();

    expect(reload).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
