import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks — must run before module imports.
const hoisted = vi.hoisted(() => ({
  mockCallable: vi.fn(),
  mockHttpsCallable: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
  getTenantId: vi.fn(() => 'test-tenant'),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({ __fns: true }),
  httpsCallable: (...args) => hoisted.mockHttpsCallable(...args),
}));

import { createUser } from '../agentManagementService';

const SAMPLE_USER = { role: 'agent', name: 'Test Agent', email: 'test@example.com' };

describe('agentManagementService.createUser', () => {
  beforeEach(() => {
    hoisted.mockCallable.mockReset();
    hoisted.mockHttpsCallable.mockReset();
    hoisted.mockHttpsCallable.mockReturnValue(hoisted.mockCallable);
  });

  // HIGH#1 regression guard: wrapper must not swallow or reshape CF response fields.

  it('returns CF response data unchanged on success (happy path)', async () => {
    hoisted.mockCallable.mockResolvedValue({ data: { uid: 'test-uid', emailQueued: true } });
    const result = await createUser(SAMPLE_USER);
    expect(result).toEqual({ uid: 'test-uid', emailQueued: true });
  });

  it('returns CF response data unchanged when email dispatch fails (PR #136 regression guard)', async () => {
    hoisted.mockCallable.mockResolvedValue({
      data: { uid: 'test-uid', emailQueued: false, emailError: 'mail/ write failed' },
    });
    const result = await createUser(SAMPLE_USER);
    expect(result).toEqual({ uid: 'test-uid', emailQueued: false, emailError: 'mail/ write failed' });
  });

  it('propagates callable rejection without swallowing', async () => {
    const err = Object.assign(new Error('internal'), { code: 'internal' });
    hoisted.mockCallable.mockRejectedValue(err);
    await expect(createUser(SAMPLE_USER)).rejects.toThrow('internal');
  });

  it('preserves emailQueued: true from CF success response', async () => {
    hoisted.mockCallable.mockResolvedValue({ data: { uid: 'test-uid', emailQueued: true } });
    const result = await createUser(SAMPLE_USER);
    expect(result.emailQueued).toBe(true);
  });

  it('preserves emailQueued: false and emailError string from CF email-failure response', async () => {
    hoisted.mockCallable.mockResolvedValue({
      data: { uid: 'test-uid', emailQueued: false, emailError: 'mail/ write failed' },
    });
    const result = await createUser(SAMPLE_USER);
    expect(result.emailQueued).toBe(false);
    expect(typeof result.emailError).toBe('string');
  });
});
