import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock state — vi.mock factories run before any top-level const.
const hoisted = vi.hoisted(() => ({
  mockAuth: { currentUser: { uid: 'mgr-uid' } },
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  tsCounter: { n: 0 },
}));
const { mockGetDoc, mockSetDoc } = hoisted;

vi.mock('../../firebase', () => ({
  db: {},
  auth: hoisted.mockAuth,
}));

vi.mock('firebase/firestore', () => ({
  doc: (db, path) => ({ __ref: path, id: path.split('/').pop() }),
  getDoc: (...args) => hoisted.mockGetDoc(...args),
  setDoc: (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
  // Real-value timestamp sentinel substitute (PR #373 — sentinels can't go in arrays).
  Timestamp: { now: () => ({ __ts: ++hoisted.tsCounter.n }) },
}));

import {
  FINANCING_STATUSES,
  DEFAULT_FINANCING_STATUS,
  isLegalFinancingTransition,
  allowedNextStatuses,
  getFinancingTerms,
  setFinancingTerms,
  transitionFinancingStatus,
} from '../financingService';

const TENANT = 'tenant-1';
const AGENT = 'agent-1';
const ACTOR = { role: 'branch_manager', name: 'B. Manager' };

const VALID_TERMS = {
  agreedMonthlyFinancing: 8000,
  currentMonthlyFinancing: 8000,
  validatingAPI: 30000,
  effectiveDate: '2025-12-01',
};

function snap(data) {
  return data == null
    ? { exists: () => false, id: AGENT }
    : { exists: () => true, id: AGENT, data: () => data };
}

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
  mockSetDoc.mockResolvedValue(undefined);
  hoisted.mockAuth.currentUser = { uid: 'mgr-uid' };
  hoisted.tsCounter.n = 0;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('status constants + transition legality', () => {
  it('exposes the five forward-only states with the locked default', () => {
    expect(FINANCING_STATUSES).toEqual([
      'not_on_financing', 'on_financing', 'reconciling',
      'post_financing_repayment', 'cleared',
    ]);
    expect(DEFAULT_FINANCING_STATUS).toBe('not_on_financing');
  });

  it('permits only the Addendum B.9 forward edges', () => {
    expect(isLegalFinancingTransition('not_on_financing', 'on_financing')).toBe(true);
    expect(isLegalFinancingTransition('on_financing', 'reconciling')).toBe(true);
    expect(isLegalFinancingTransition('reconciling', 'post_financing_repayment')).toBe(true);
    expect(isLegalFinancingTransition('reconciling', 'cleared')).toBe(true);
    expect(isLegalFinancingTransition('post_financing_repayment', 'cleared')).toBe(true);
  });

  it('rejects backward and skip transitions', () => {
    expect(isLegalFinancingTransition('on_financing', 'cleared')).toBe(false);
    expect(isLegalFinancingTransition('on_financing', 'not_on_financing')).toBe(false);
    expect(isLegalFinancingTransition('reconciling', 'on_financing')).toBe(false);
    expect(isLegalFinancingTransition('cleared', 'on_financing')).toBe(false);
  });

  it('allowedNextStatuses reflects the legal map', () => {
    expect(allowedNextStatuses('reconciling')).toEqual(['post_financing_repayment', 'cleared']);
    expect(allowedNextStatuses('cleared')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getFinancingTerms', () => {
  it('returns null when the doc does not exist', async () => {
    mockGetDoc.mockResolvedValue(snap(null));
    expect(await getFinancingTerms(TENANT, AGENT)).toBeNull();
  });

  it('returns { id, ...data } when present', async () => {
    mockGetDoc.mockResolvedValue(snap({ ...VALID_TERMS, financingStatus: 'on_financing' }));
    const out = await getFinancingTerms(TENANT, AGENT);
    expect(out).toMatchObject({ id: AGENT, financingStatus: 'on_financing', agreedMonthlyFinancing: 8000 });
  });

  it('requires tenantId and agentId', async () => {
    await expect(getFinancingTerms(null, AGENT)).rejects.toThrow(/tenantId/);
    await expect(getFinancingTerms(TENANT, null)).rejects.toThrow(/agentId/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('setFinancingTerms', () => {
  it('first write seeds default status + empty history + creation audit', async () => {
    mockGetDoc.mockResolvedValue(snap(null));
    const out = await setFinancingTerms(TENANT, AGENT, VALID_TERMS, ACTOR);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toBeUndefined(); // full write, not a merge
    expect(payload).toMatchObject({
      agentId: AGENT,
      tenantId: TENANT,
      agreedMonthlyFinancing: 8000,
      currentMonthlyFinancing: 8000,
      validatingAPI: 30000,
      effectiveDate: '2025-12-01',
      financingStatus: 'not_on_financing',
      statusHistory: [],
      createdBy: 'mgr-uid',
      updatedBy: 'mgr-uid',
    });
    expect(out.financingStatus).toBe('not_on_financing');
  });

  it('overwrite preserves status + history + creation audit (merge write)', async () => {
    mockGetDoc.mockResolvedValue(snap({
      ...VALID_TERMS,
      financingStatus: 'on_financing',
      statusHistory: [{ from: 'not_on_financing', to: 'on_financing' }],
      createdBy: 'orig-mgr',
    }));
    await setFinancingTerms(TENANT, AGENT, { ...VALID_TERMS, currentMonthlyFinancing: 6000 }, ACTOR);

    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(payload.currentMonthlyFinancing).toBe(6000);
    expect(payload).not.toHaveProperty('financingStatus'); // status untouched on terms save
    expect(payload).not.toHaveProperty('statusHistory');
    expect(payload).not.toHaveProperty('createdBy');
  });

  it('parseFloat-coerces string numerics', async () => {
    mockGetDoc.mockResolvedValue(snap(null));
    await setFinancingTerms(TENANT, AGENT, {
      agreedMonthlyFinancing: '8000', currentMonthlyFinancing: '7500',
      validatingAPI: '30000', effectiveDate: '2025-12-01',
    }, ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.agreedMonthlyFinancing).toBe(8000);
    expect(payload.currentMonthlyFinancing).toBe(7500);
  });

  it('rejects current > agreed (B.12 hard validation)', async () => {
    await expect(setFinancingTerms(TENANT, AGENT, {
      ...VALID_TERMS, agreedMonthlyFinancing: 8000, currentMonthlyFinancing: 9000,
    }, ACTOR)).rejects.toThrow(/cannot exceed/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects negative numerics', async () => {
    await expect(setFinancingTerms(TENANT, AGENT, { ...VALID_TERMS, validatingAPI: -1 }, ACTOR))
      .rejects.toThrow(/validatingAPI/);
  });

  it('rejects a non-YYYY-MM-DD effectiveDate', async () => {
    await expect(setFinancingTerms(TENANT, AGENT, { ...VALID_TERMS, effectiveDate: '01 Dec 2025' }, ACTOR))
      .rejects.toThrow(/YYYY-MM-DD/);
    await expect(setFinancingTerms(TENANT, AGENT, { ...VALID_TERMS, effectiveDate: '' }, ACTOR))
      .rejects.toThrow(/YYYY-MM-DD/);
  });

  it('requires a signed-in user and an actor role', async () => {
    hoisted.mockAuth.currentUser = null;
    await expect(setFinancingTerms(TENANT, AGENT, VALID_TERMS, ACTOR)).rejects.toThrow(/signed-in/);
    hoisted.mockAuth.currentUser = { uid: 'mgr-uid' };
    await expect(setFinancingTerms(TENANT, AGENT, VALID_TERMS, {})).rejects.toThrow(/actor\.role/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('transitionFinancingStatus', () => {
  it('appends a forward transition with Timestamp.now() (not a sentinel) in the array', async () => {
    mockGetDoc.mockResolvedValue(snap({ ...VALID_TERMS, financingStatus: 'not_on_financing', statusHistory: [] }));
    const out = await transitionFinancingStatus(TENANT, AGENT, 'on_financing', ACTOR, 'kickoff');

    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(payload.financingStatus).toBe('on_financing');
    expect(payload.statusHistory).toHaveLength(1);
    const entry = payload.statusHistory[0];
    expect(entry).toMatchObject({
      from: 'not_on_financing', to: 'on_financing',
      by: 'mgr-uid', byName: 'B. Manager', role: 'branch_manager', note: 'kickoff',
    });
    // `at` is a real value, never the serverTimestamp sentinel string.
    expect(entry.at).not.toBe('__SERVER_TIMESTAMP__');
    expect(entry.at).toHaveProperty('__ts');
    // top-level updatedAt keeps the sentinel
    expect(payload.updatedAt).toBe('__SERVER_TIMESTAMP__');
    expect(out.financingStatus).toBe('on_financing');
  });

  it('preserves prior history when appending', async () => {
    const prior = [{ from: 'not_on_financing', to: 'on_financing', at: { __ts: 1 } }];
    mockGetDoc.mockResolvedValue(snap({ ...VALID_TERMS, financingStatus: 'on_financing', statusHistory: prior }));
    await transitionFinancingStatus(TENANT, AGENT, 'reconciling', ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.statusHistory).toHaveLength(2);
    expect(payload.statusHistory[0]).toBe(prior[0]);
  });

  it('rejects an illegal transition', async () => {
    mockGetDoc.mockResolvedValue(snap({ ...VALID_TERMS, financingStatus: 'on_financing', statusHistory: [] }));
    await expect(transitionFinancingStatus(TENANT, AGENT, 'cleared', ACTOR)).rejects.toThrow(/illegal transition/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects a no-op (same-status) transition', async () => {
    mockGetDoc.mockResolvedValue(snap({ ...VALID_TERMS, financingStatus: 'on_financing', statusHistory: [] }));
    await expect(transitionFinancingStatus(TENANT, AGENT, 'on_financing', ACTOR)).rejects.toThrow(/already in/);
  });

  it('rejects an unknown target status', async () => {
    await expect(transitionFinancingStatus(TENANT, AGENT, 'bogus', ACTOR)).rejects.toThrow(/unknown status/);
  });

  it('rejects when no terms doc exists', async () => {
    mockGetDoc.mockResolvedValue(snap(null));
    await expect(transitionFinancingStatus(TENANT, AGENT, 'on_financing', ACTOR)).rejects.toThrow(/no financing terms/);
  });
});
