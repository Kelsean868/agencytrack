// @vitest-environment jsdom
/**
 * AuthContext role-resolution tests — SHAKEDOWN-001
 *
 * Covers the four scenarios from the brief + a fifth genuine-error scenario:
 *
 *   S1  Fresh account — claims fully empty, cached tenantId present
 *       → role resolves from Firestore doc immediately
 *   S2  Existing user — valid claims on first fetch
 *       → role resolves from claims, no retry, no regression
 *   S3  Partial claims — tenantId present but role absent
 *       → Firestore doc fallback fires for role
 *   S4  Sign-out → sign-in as different user
 *       → state cleared on sign-out, fresh resolution on next sign-in
 *   S5  Both claims and doc empty (genuine error / unprovisioned account)
 *       → role=null, tenantId=null, loading=false (ProvisioningScreen path)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement } from 'react';

// ── Hoisted mocks (declared before imports so vi.mock hoisting works) ─────────

const hoisted = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  getDoc: vi.fn(),
  docFn: vi.fn((_db, path) => ({ _path: path })),
  auth: {},
  db:   {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: hoisted.onAuthStateChanged,
}));

vi.mock('firebase/firestore', () => ({
  doc:    hoisted.docFn,
  getDoc: hoisted.getDoc,
}));

vi.mock('../../firebase', () => ({
  auth: hoisted.auth,
  db:   hoisted.db,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { AuthProvider, useAuth } from '../AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wrapper that provides the AuthContext to the hook under test. */
const wrapper = ({ children }) => createElement(AuthProvider, null, children);

/** Build a minimal mock Firebase user. */
function makeUser(uid = 'uid-test') {
  return { uid, email: `${uid}@example.com`, getIdTokenResult: vi.fn() };
}

/** Build a mock Firestore document snapshot. */
function makeSnap(exists, data = {}) {
  return { exists: () => exists, data: () => data };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let triggerAuth; // invoke to simulate onAuthStateChanged firing

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();

  hoisted.onAuthStateChanged.mockImplementation((_auth, cb) => {
    triggerAuth = cb;
    return vi.fn(); // unsubscribe
  });
});

afterEach(() => {
  localStorage.clear();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthContext — role resolution (SHAKEDOWN-001)', () => {

  // ── S1: Fresh account, claims empty, doc populated via cached tenantId ──────

  it('S1: resolves role from doc when claims are empty but cached tenantId present', async () => {
    const uid  = 'new-bm-001';
    const user = makeUser(uid);

    // Simulate a previous successful session having cached the tenantId.
    localStorage.setItem(`agencytrack-tenantid-${uid}`, 'tenant1');

    // Claims haven't propagated yet.
    user.getIdTokenResult.mockResolvedValue({ claims: {} });

    // Doc is populated (written by doCreateUser before the manager signed in).
    hoisted.getDoc.mockResolvedValue(
      makeSnap(true, { role: 'branch_manager', tenantId: 'tenant1' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => triggerAuth(user));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe('branch_manager');
    expect(result.current.tenantId).toBe('tenant1');
    expect(result.current.isAuthenticated).toBe(true);

    // tenantId should have been cached after successful resolution.
    expect(localStorage.getItem(`agencytrack-tenantid-${uid}`)).toBe('tenant1');

    // Only one token fetch — no retry loop.
    expect(user.getIdTokenResult).toHaveBeenCalledTimes(1);
  });

  // ── S2: Existing user — valid claims, no regression ──────────────────────────

  it('S2: resolves role from claims for existing user with valid claims', async () => {
    const uid  = 'existing-bm-001';
    const user = makeUser(uid);

    user.getIdTokenResult.mockResolvedValue({
      claims: { role: 'branch_manager', tenantId: 'tenant1' },
    });

    // Doc read triggered because claimTenantId is available.
    hoisted.getDoc.mockResolvedValue(
      makeSnap(true, { role: 'branch_manager', tenantId: 'tenant1' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => triggerAuth(user));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe('branch_manager');
    expect(result.current.tenantId).toBe('tenant1');

    // Exactly one token fetch — no retry loop.
    expect(user.getIdTokenResult).toHaveBeenCalledTimes(1);
  });

  // ── S3: Partial claims — tenantId present, role absent (doc fallback) ────────

  it('S3: uses doc.role when claimTenantId is present but claimRole is absent', async () => {
    const uid  = 'partial-claims-um-001';
    const user = makeUser(uid);

    user.getIdTokenResult.mockResolvedValue({
      claims: { tenantId: 'tenant1' }, // role absent
    });

    hoisted.getDoc.mockResolvedValue(
      makeSnap(true, { role: 'unit_manager', tenantId: 'tenant1' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => triggerAuth(user));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe('unit_manager');
    expect(result.current.tenantId).toBe('tenant1');
  });

  // ── S4: Sign-out → sign-in as different user — clean state ───────────────────

  it('S4: clears state on sign-out and resolves fresh on next sign-in', async () => {
    const userA = makeUser('user-a');
    userA.getIdTokenResult.mockResolvedValue({
      claims: { role: 'branch_manager', tenantId: 'tenant1' },
    });
    hoisted.getDoc.mockResolvedValue(
      makeSnap(true, { role: 'branch_manager', tenantId: 'tenant1' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Sign in as userA.
    await act(() => triggerAuth(userA));
    await waitFor(() => expect(result.current.role).toBe('branch_manager'));

    // Sign out.
    await act(() => triggerAuth(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.tenantId).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    // Sign in as a completely different user.
    vi.clearAllMocks();
    const userB = makeUser('user-b');
    userB.getIdTokenResult.mockResolvedValue({
      claims: { role: 'agent', tenantId: 'tenant1' },
    });
    hoisted.getDoc.mockResolvedValue(
      makeSnap(true, { role: 'agent', tenantId: 'tenant1' }),
    );

    await act(() => triggerAuth(userB));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe('agent');
    expect(result.current.tenantId).toBe('tenant1');
  });

  // ── S5: Both claims and doc empty — genuine error / unprovisioned account ─────

  it('S5: resolves to null role and tenantId when claims are empty and no cache', async () => {
    const uid  = 'unprovisioned-user';
    const user = makeUser(uid);

    // No cached tenantId — truly first login with absent claims.
    user.getIdTokenResult.mockResolvedValue({ claims: {} });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => triggerAuth(user));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBeNull();
    expect(result.current.tenantId).toBeNull();
    // User IS authenticated — App.jsx routes to ProvisioningScreen, not LoginScreen.
    expect(result.current.isAuthenticated).toBe(true);

    // No doc read attempted — no tenantId to construct the Firestore path.
    expect(hoisted.getDoc).not.toHaveBeenCalled();
  });

});
