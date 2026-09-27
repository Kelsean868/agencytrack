import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock state — vi.mock factories run before any top-level const.
const hoisted = vi.hoisted(() => ({
  mockAuth: { currentUser: { uid: 'mgr-uid' } },
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  // P2b: the agent user-doc read (branchId/unitId stamp) is routed here so the
  // sequenced mockGetDoc queues below keep meaning what they meant.
  mockGetUserDoc: vi.fn(),
  tsCounter: { n: 0 },
}));
const { mockGetDoc, mockSetDoc, mockGetDocs } = hoisted;

vi.mock('../../firebase', () => ({
  db: {},
  auth: hoisted.mockAuth,
}));

// Reads route by path: the agent user doc → mockGetUserDoc, everything else →
// mockGetDoc. Shared by getDoc and a transaction's tx.get.
const routeGet = (ref, ...rest) => (ref?.__ref?.includes('/users/')
  ? hoisted.mockGetUserDoc(ref, ...rest)
  : hoisted.mockGetDoc(ref, ...rest));

vi.mock('firebase/firestore', () => ({
  doc: (db, path) => ({ __ref: path, id: path.split('/').pop() }),
  getDoc: (...args) => routeGet(...args),
  setDoc: (...args) => hoisted.mockSetDoc(...args),
  // P2c (BUG-07): transactional paths. tx.get uses the same read routing; tx.set
  // BUFFERS writes and forwards them to mockSetDoc only after the update function
  // resolves — so a throw inside the transaction records no write, like Firestore.
  runTransaction: async (db, fn) => {
    const pending = [];
    const tx = {
      get: (ref) => routeGet(ref),
      set: (ref, data, opts) => { pending.push(opts === undefined ? [ref, data] : [ref, data, opts]); return tx; },
    };
    const out = await fn(tx);
    for (const call of pending) hoisted.mockSetDoc(...call);
    return out;
  },
  collection: (db, path) => ({ __col: path }),
  query: (col, ...clauses) => ({ __col: col, __clauses: clauses }),
  where: (field, op, value) => ({ __where: [field, op, value] }),
  getDocs: (...args) => hoisted.mockGetDocs(...args),
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
  BASIS_SOURCES,
  financingMonthIndex,
  deriveBasisSource,
  financingCeiling,
  detectSkippedMonths,
  getFinancingMonth,
  setFinancingMonth,
  setFinancingProration,
  listFinancingMonths,
  RECONCILIATION_OUTCOMES,
  RECONCILIATION_TRIGGERS,
  getFinancingReconciliation,
  reconcileFinancing,
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
  mockGetDocs.mockReset();
  mockSetDoc.mockResolvedValue(undefined);
  hoisted.mockGetUserDoc.mockReset();
  hoisted.mockGetUserDoc.mockResolvedValue({ exists: () => false });
  hoisted.mockAuth.currentUser = { uid: 'mgr-uid' };
  hoisted.tsCounter.n = 0;
});

// Ledger doc snapshot (composite-ID doc).
function ledgerSnap(data) {
  return data == null
    ? { exists: () => false, id: `${AGENT}_2026_01` }
    : { exists: () => true, id: `${AGENT}_2026_01`, data: () => data };
}

const VALID_STATEMENT = {
  financingPaid: 4000,
  netCommission: 6200,
  bonusOffset: 0,
  runningBalance: 22400,
  notes: 'June statement',
};

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

// ─────────────────────────────────────────────────────────────────────────────
// Track K · K2 — monthly ledger
// ─────────────────────────────────────────────────────────────────────────────
describe('K2 basis + ceiling + gap helpers', () => {
  it('exposes the three basis-source states (provisional reserved for K5)', () => {
    expect(BASIS_SOURCES).toEqual(['submitted-final', 'submitted-provisional', 'settled-confirmed']);
  });

  it('financingMonthIndex — effectiveDate month is month 1 (1-based)', () => {
    expect(financingMonthIndex('2026-01-15', '2026_01')).toBe(1);
    expect(financingMonthIndex('2026-01-15', '2026_07')).toBe(7);
    expect(financingMonthIndex('2025-11-20', '2026_02')).toBe(4);
  });

  it('financingMonthIndex — returns null on a malformed effectiveDate/month (Gemini #3)', () => {
    expect(financingMonthIndex('not-a-date', '2026_01')).toBeNull();
    expect(financingMonthIndex('2026-01-15', 'bad')).toBeNull();
    expect(financingMonthIndex(null, '2026_01')).toBeNull();
  });

  it('deriveBasisSource — months 1–3 final, month 4+ confirmed; never provisional', () => {
    expect(deriveBasisSource('2026-01-15', '2026_01')).toBe('submitted-final');
    expect(deriveBasisSource('2026-01-15', '2026_03')).toBe('submitted-final');
    expect(deriveBasisSource('2026-01-15', '2026_04')).toBe('settled-confirmed');
    expect(deriveBasisSource('2026-01-15', '2026_09')).toBe('settled-confirmed');
  });

  it('deriveBasisSource — malformed effectiveDate falls back to submitted-final', () => {
    expect(deriveBasisSource('not-a-date', '2026_01')).toBe('submitted-final');
  });

  it('financingCeiling — 6 × currentMonthlyFinancing (corrected basis), null when unusable', () => {
    expect(financingCeiling(8000)).toBe(48000);
    expect(financingCeiling('7500')).toBe(45000);
    expect(financingCeiling(undefined)).toBeNull();
    expect(financingCeiling('abc')).toBeNull();
  });

  it('detectSkippedMonths — flags the gap between first month and latest entry', () => {
    expect(detectSkippedMonths('2026-01-15', ['2026_01', '2026_02', '2026_04'])).toEqual(['2026_03']);
  });

  it('detectSkippedMonths — no gaps when the sequence is contiguous', () => {
    expect(detectSkippedMonths('2026-01-15', ['2026_01', '2026_02', '2026_03'])).toEqual([]);
  });

  it('detectSkippedMonths — empty when no months entered', () => {
    expect(detectSkippedMonths('2026-01-15', [])).toEqual([]);
  });

  it('detectSkippedMonths — multiple gaps across a year boundary', () => {
    expect(detectSkippedMonths('2025-11-01', ['2025_11', '2026_02'])).toEqual(['2025_12', '2026_01']);
  });
});

describe('getFinancingMonth', () => {
  it('returns null when the month doc does not exist', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    expect(await getFinancingMonth(TENANT, AGENT, '2026_01')).toBeNull();
  });

  it('returns { id, ...data } when present', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap({ ...VALID_STATEMENT, month: '2026_01', agentId: AGENT }));
    const out = await getFinancingMonth(TENANT, AGENT, '2026_01');
    expect(out).toMatchObject({ id: `${AGENT}_2026_01`, runningBalance: 22400, month: '2026_01' });
  });

  it('requires tenantId, agentId, and a YYYY_MM month', async () => {
    await expect(getFinancingMonth(null, AGENT, '2026_01')).rejects.toThrow(/tenantId/);
    await expect(getFinancingMonth(TENANT, null, '2026_01')).rejects.toThrow(/agentId/);
    await expect(getFinancingMonth(TENANT, AGENT, '2026-01')).rejects.toThrow(/YYYY_MM/);
  });
});

describe('setFinancingMonth', () => {
  it('first write stamps entry audit + source + the parsed statement', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    const out = await setFinancingMonth(TENANT, AGENT, '2026_01', VALID_STATEMENT, ACTOR);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toBeUndefined(); // full write on first entry
    expect(payload).toMatchObject({
      agentId: AGENT,
      tenantId: TENANT,
      month: '2026_01',
      financingPaid: 4000,
      netCommission: 6200,
      bonusOffset: 0,
      runningBalance: 22400,
      notes: 'June statement',
      source: 'manager_entry',
      enteredBy: 'mgr-uid',
      enteredByName: 'B. Manager',
    });
    expect(payload.enteredAt).toBe('__SERVER_TIMESTAMP__');
    expect(payload.updatedAt).toBe('__SERVER_TIMESTAMP__');
    expect(out.month).toBe('2026_01');
  });

  it('accepts a NEGATIVE runningBalance (surplus owed to agent)', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingMonth(TENANT, AGENT, '2026_05', { ...VALID_STATEMENT, runningBalance: -1500 }, ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.runningBalance).toBe(-1500);
  });

  it('parseFloat-coerces string statement numerics', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingMonth(TENANT, AGENT, '2026_01', {
      financingPaid: '4000', netCommission: '6200', bonusOffset: '0', runningBalance: '22400',
    }, ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.financingPaid).toBe(4000);
    expect(payload.runningBalance).toBe(22400);
    expect(payload.notes).toBe(''); // missing notes → empty string
  });

  it('overwrite preserves first-entry audit, bumps updatedAt (merge write)', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap({
      ...VALID_STATEMENT, month: '2026_01', agentId: AGENT,
      enteredBy: 'orig-mgr', enteredByName: 'O. Manager', enteredAt: '__ORIG_TS__',
    }));
    await setFinancingMonth(TENANT, AGENT, '2026_01', { ...VALID_STATEMENT, runningBalance: 19000 }, ACTOR);

    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(payload.runningBalance).toBe(19000);
    expect(payload.updatedAt).toBe('__SERVER_TIMESTAMP__');
    // core write does not re-stamp the first-entry audit — preserved from existing
    expect(payload).not.toHaveProperty('enteredBy');
    expect(payload).not.toHaveProperty('enteredAt');
  });

  it('rejects negative financingPaid / netCommission / bonusOffset', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await expect(setFinancingMonth(TENANT, AGENT, '2026_01', { ...VALID_STATEMENT, financingPaid: -1 }, ACTOR))
      .rejects.toThrow(/financingPaid/);
    await expect(setFinancingMonth(TENANT, AGENT, '2026_01', { ...VALID_STATEMENT, bonusOffset: -5 }, ACTOR))
      .rejects.toThrow(/bonusOffset/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects a non-number runningBalance', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await expect(setFinancingMonth(TENANT, AGENT, '2026_01', { ...VALID_STATEMENT, runningBalance: 'NaN' }, ACTOR))
      .rejects.toThrow(/runningBalance/);
  });

  it('rejects a bad month key, missing auth, and missing actor.role', async () => {
    await expect(setFinancingMonth(TENANT, AGENT, '2026-01', VALID_STATEMENT, ACTOR)).rejects.toThrow(/YYYY_MM/);
    hoisted.mockAuth.currentUser = null;
    await expect(setFinancingMonth(TENANT, AGENT, '2026_01', VALID_STATEMENT, ACTOR)).rejects.toThrow(/signed-in/);
    hoisted.mockAuth.currentUser = { uid: 'mgr-uid' };
    await expect(setFinancingMonth(TENANT, AGENT, '2026_01', VALID_STATEMENT, {})).rejects.toThrow(/actor\.role/);
  });

  // K6 amendment — source-override (gap-fill provenance flag).
  it('defaults source to manager_entry when none is passed', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingMonth(TENANT, AGENT, '2026_01', VALID_STATEMENT, ACTOR);
    expect(mockSetDoc.mock.calls[0][1].source).toBe('manager_entry');
  });

  it('writes source:reconciliation_gap_fill when the gap-fill flag is passed', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingMonth(
      TENANT, AGENT, '2026_02',
      { financingPaid: 0, netCommission: 0, bonusOffset: 0, runningBalance: 0, source: 'reconciliation_gap_fill' },
      ACTOR,
    );
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.source).toBe('reconciliation_gap_fill');
    expect(payload.runningBalance).toBe(0); // a manager-confirmed genuine $0 month
  });

  it('falls back to manager_entry for an unrecognised source value', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingMonth(TENANT, AGENT, '2026_03', { ...VALID_STATEMENT, source: 'totally_bogus' }, ACTOR);
    expect(mockSetDoc.mock.calls[0][1].source).toBe('manager_entry');
  });
});

describe('setFinancingProration (K5)', () => {
  const SUGGESTION = {
    validatingAPI: 30000,
    actualAPI: 15000,
    suggestedFinancing: 4000,
    basisSource: 'submitted-final',
  };

  it('forward create (no statement) writes proration-only + entry audit', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    const out = await setFinancingProration(TENANT, AGENT, '2026_02', SUGGESTION, ACTOR);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toBeUndefined(); // full write on first proration
    expect(payload).toMatchObject({
      agentId: AGENT,
      tenantId: TENANT,
      month: '2026_02',
      validatingAPI: 30000,
      actualAPI: 15000,
      suggestedFinancing: 4000,
      basisSource: 'submitted-final',
      source: 'manager_entry',
      prorationEnteredBy: 'mgr-uid',
      prorationEnteredByName: 'B. Manager',
    });
    expect(payload.prorationEnteredAt).toBe('__SERVER_TIMESTAMP__');
    expect(payload.prorationUpdatedAt).toBe('__SERVER_TIMESTAMP__');
    // proration-only create never writes the statement core
    expect(payload).not.toHaveProperty('runningBalance');
    expect(payload).not.toHaveProperty('financingPaid');
    // no managerFinancing / adjustmentPct on a bare suggestion (lock b)
    expect(payload).not.toHaveProperty('managerFinancing');
    expect(payload).not.toHaveProperty('adjustmentPct');
    expect(out.month).toBe('2026_02');
  });

  it('merge onto an existing statement doc — preserves statement core, never re-stamps entry audit', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap({
      ...VALID_STATEMENT, month: '2026_02', agentId: AGENT,
      enteredBy: 'orig-mgr', runningBalance: 22400,
    }));
    await setFinancingProration(TENANT, AGENT, '2026_02', SUGGESTION, ACTOR);

    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(payload.actualAPI).toBe(15000);
    expect(payload.prorationUpdatedAt).toBe('__SERVER_TIMESTAMP__');
    // merge write never touches the authoritative statement, nor the entry audit
    expect(payload).not.toHaveProperty('runningBalance');
    expect(payload).not.toHaveProperty('prorationEnteredBy');
  });

  it('stores managerFinancing + adjustmentPct once the manager confirms', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingProration(TENANT, AGENT, '2026_02', {
      ...SUGGESTION, managerFinancing: 4000, adjustmentPct: 0.5,
    }, ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.managerFinancing).toBe(4000);
    expect(payload.adjustmentPct).toBe(0.5);
  });

  it('accepts a NEGATIVE adjustmentPct (managerFinancing above current)', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingProration(TENANT, AGENT, '2026_02', {
      ...SUGGESTION, managerFinancing: 9000, adjustmentPct: -0.125,
    }, ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.adjustmentPct).toBe(-0.125);
  });

  it('omits adjustmentPct when managerFinancing is unset, even if a pct is passed (lock b)', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingProration(TENANT, AGENT, '2026_02', { ...SUGGESTION, adjustmentPct: 0.5 }, ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload).not.toHaveProperty('managerFinancing');
    expect(payload).not.toHaveProperty('adjustmentPct');
  });

  it('parseFloat-coerces string proration numerics', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await setFinancingProration(TENANT, AGENT, '2026_02', {
      validatingAPI: '30000', actualAPI: '15000', suggestedFinancing: '4000',
      basisSource: 'settled-confirmed', managerFinancing: '4000', adjustmentPct: '0.5',
    }, ACTOR);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.actualAPI).toBe(15000);
    expect(payload.managerFinancing).toBe(4000);
    expect(payload.adjustmentPct).toBe(0.5);
  });

  it('rejects a bad basisSource enum', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await expect(setFinancingProration(TENANT, AGENT, '2026_02', { ...SUGGESTION, basisSource: 'bogus' }, ACTOR))
      .rejects.toThrow(/basisSource/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects negative / non-number proration numerics', async () => {
    mockGetDoc.mockResolvedValue(ledgerSnap(null));
    await expect(setFinancingProration(TENANT, AGENT, '2026_02', { ...SUGGESTION, actualAPI: -1 }, ACTOR))
      .rejects.toThrow(/actualAPI/);
    await expect(setFinancingProration(TENANT, AGENT, '2026_02', { ...SUGGESTION, validatingAPI: 'NaN' }, ACTOR))
      .rejects.toThrow(/validatingAPI/);
    await expect(setFinancingProration(TENANT, AGENT, '2026_02', { ...SUGGESTION, managerFinancing: -5 }, ACTOR))
      .rejects.toThrow(/managerFinancing/);
  });

  it('rejects a bad month key, missing auth, and missing actor.role', async () => {
    await expect(setFinancingProration(TENANT, AGENT, '2026-02', SUGGESTION, ACTOR)).rejects.toThrow(/YYYY_MM/);
    hoisted.mockAuth.currentUser = null;
    await expect(setFinancingProration(TENANT, AGENT, '2026_02', SUGGESTION, ACTOR)).rejects.toThrow(/signed-in/);
    hoisted.mockAuth.currentUser = { uid: 'mgr-uid' };
    await expect(setFinancingProration(TENANT, AGENT, '2026_02', SUGGESTION, {})).rejects.toThrow(/actor\.role/);
  });
});

describe('listFinancingMonths', () => {
  function docsSnap(rows) {
    return { docs: rows.map((r) => ({ id: `${AGENT}_${r.month}`, data: () => r })) };
  }

  it('maps rows and sorts by month ascending', async () => {
    mockGetDocs.mockResolvedValue(docsSnap([
      { month: '2026_03', runningBalance: 14000, agentId: AGENT },
      { month: '2026_01', runningBalance: 8000, agentId: AGENT },
      { month: '2026_02', runningBalance: 11000, agentId: AGENT },
    ]));
    const out = await listFinancingMonths(TENANT, AGENT);
    expect(out.map((r) => r.month)).toEqual(['2026_01', '2026_02', '2026_03']);
    expect(out[0]).toMatchObject({ id: `${AGENT}_2026_01`, runningBalance: 8000 });
  });

  it('applies an optional { from, to } range filter', async () => {
    mockGetDocs.mockResolvedValue(docsSnap([
      { month: '2026_01', runningBalance: 8000, agentId: AGENT },
      { month: '2026_02', runningBalance: 11000, agentId: AGENT },
      { month: '2026_03', runningBalance: 14000, agentId: AGENT },
      { month: '2026_04', runningBalance: 17000, agentId: AGENT },
    ]));
    const out = await listFinancingMonths(TENANT, AGENT, { from: '2026_02', to: '2026_03' });
    expect(out.map((r) => r.month)).toEqual(['2026_02', '2026_03']);
  });

  it('drops malformed-month docs before month math (Gemini #2)', async () => {
    mockGetDocs.mockResolvedValue(docsSnap([
      { month: '2026_01', runningBalance: 8000, agentId: AGENT },
      { month: 'garbage', runningBalance: 999, agentId: AGENT },
      { runningBalance: 111, agentId: AGENT }, // missing month
      { month: '2026_02', runningBalance: 11000, agentId: AGENT },
    ]));
    const out = await listFinancingMonths(TENANT, AGENT, { from: '2026_01' });
    expect(out.map((r) => r.month)).toEqual(['2026_01', '2026_02']);
  });

  it('requires tenantId and agentId', async () => {
    await expect(listFinancingMonths(null, AGENT)).rejects.toThrow(/tenantId/);
    await expect(listFinancingMonths(TENANT, null)).rejects.toThrow(/agentId/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Track K · K6 — reconciliation
// ─────────────────────────────────────────────────────────────────────────────
const YEAR = '2026';
// computeReconciliation output shape (owing path) the panel hands to the service.
const RECON_OWING = {
  totalFinancingDrawn: 48000,
  totalOffsets: 29800,
  closingBalance: 18200,
  waiverApplied: 12000,
  serviceMet: true,
  serviceMonths: 12,
  reconciledPosition: 6200,
  outcome: 'owing',
  surplusPaid: 0,
  garnishStarted: true,
  triggeredBy: 'auto_month12',
  nextStatus: 'post_financing_repayment',
};
const RECON_SURPLUS = {
  ...RECON_OWING,
  closingBalance: -3100,
  reconciledPosition: -15100,
  outcome: 'surplus',
  surplusPaid: 15100,
  garnishStarted: false,
  nextStatus: 'cleared',
};
const termsSnap = (status) => snap({ ...VALID_TERMS, financingStatus: status, statusHistory: [] });

describe('RECONCILIATION constants', () => {
  it('exports the two outcomes + two triggers', () => {
    expect(RECONCILIATION_OUTCOMES).toEqual(['owing', 'surplus']);
    expect(RECONCILIATION_TRIGGERS).toEqual(['auto_month12', 'manual_election']);
  });
});

describe('getFinancingReconciliation', () => {
  it('returns null when the record does not exist', async () => {
    mockGetDoc.mockResolvedValue(snap(null));
    expect(await getFinancingReconciliation(TENANT, AGENT, YEAR)).toBeNull();
  });
  it('returns { id, ...data } when present', async () => {
    mockGetDoc.mockResolvedValue(snap({ ...RECON_OWING, agentId: AGENT }));
    const out = await getFinancingReconciliation(TENANT, AGENT, YEAR);
    expect(out).toMatchObject({ outcome: 'owing', reconciledPosition: 6200 });
  });
  it('rejects a non-YYYY year and missing ids', async () => {
    await expect(getFinancingReconciliation(TENANT, AGENT, '26')).rejects.toThrow(/year/);
    await expect(getFinancingReconciliation(null, AGENT, YEAR)).rejects.toThrow(/tenantId/);
    await expect(getFinancingReconciliation(TENANT, null, YEAR)).rejects.toThrow(/agentId/);
  });
});

describe('reconcileFinancing', () => {
  it('owing → writes the record and advances reconciling → post_financing_repayment in one transaction', async () => {
    mockGetDoc
      .mockResolvedValueOnce(termsSnap('reconciling')) // status precondition (tx.get)
      .mockResolvedValueOnce(snap(null));              // recon doc (create)
    const out = await reconcileFinancing(TENANT, AGENT, YEAR, RECON_OWING, ACTOR);

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    // 1st write = the reconciliation record (full create with audit).
    const [recRef, recPayload, recOpts] = mockSetDoc.mock.calls[0];
    expect(recRef.__ref).toBe(`tenants/${TENANT}/financingReconciliation/${AGENT}_${YEAR}`);
    expect(recOpts).toBeUndefined();
    expect(recPayload).toMatchObject({
      agentId: AGENT, tenantId: TENANT, year: 2026,
      outcome: 'owing', garnishStarted: true, surplusPaid: 0,
      waiverApplied: 12000, reconciledPosition: 6200, serviceMet: true,
      triggeredBy: 'auto_month12', reconciledBy: 'mgr-uid', reconciledByName: 'B. Manager',
    });
    expect(recPayload.reconciledAt).toBe('__SERVER_TIMESTAMP__');
    // 2nd write = the status transition on the terms doc.
    const [termsRef, transPayload] = mockSetDoc.mock.calls[1];
    expect(termsRef.__ref).toBe(`tenants/${TENANT}/financingTerms/${AGENT}`);
    expect(transPayload.financingStatus).toBe('post_financing_repayment');
    expect(out.outcome).toBe('owing');
  });

  it('surplus → advances reconciling → cleared, pays surplus', async () => {
    mockGetDoc
      .mockResolvedValueOnce(termsSnap('reconciling'))
      .mockResolvedValueOnce(snap(null));
    await reconcileFinancing(TENANT, AGENT, YEAR, RECON_SURPLUS, ACTOR);
    const [, recPayload] = mockSetDoc.mock.calls[0];
    expect(recPayload).toMatchObject({ outcome: 'surplus', surplusPaid: 15100, garnishStarted: false });
    const [, transPayload] = mockSetDoc.mock.calls[1];
    expect(transPayload.financingStatus).toBe('cleared');
  });

  it('RE-DERIVES nextStatus from outcome — ignores a tampered nextStatus', async () => {
    mockGetDoc
      .mockResolvedValueOnce(termsSnap('reconciling'))
      .mockResolvedValueOnce(snap(null));
    // outcome owing but caller passes nextStatus 'cleared' → service still goes to repayment.
    await reconcileFinancing(TENANT, AGENT, YEAR, { ...RECON_OWING, nextStatus: 'cleared' }, ACTOR);
    const [, transPayload] = mockSetDoc.mock.calls[1];
    expect(transPayload.financingStatus).toBe('post_financing_repayment');
  });

  it('overwrite preserves first-create audit (merge), never re-stamps reconciledBy', async () => {
    mockGetDoc
      .mockResolvedValueOnce(termsSnap('reconciling'))
      .mockResolvedValueOnce(snap({ ...RECON_OWING, agentId: AGENT, reconciledBy: 'orig', reconciledAt: '__ORIG__' }));
    await reconcileFinancing(TENANT, AGENT, YEAR, RECON_OWING, ACTOR);
    const [, recPayload, recOpts] = mockSetDoc.mock.calls[0];
    expect(recOpts).toEqual({ merge: true });
    expect(recPayload).not.toHaveProperty('reconciledBy');
    expect(recPayload).not.toHaveProperty('reconciledAt');
    expect(recPayload.updatedAt).toBe('__SERVER_TIMESTAMP__');
  });

  it('rejects when the agent is NOT in reconciling (begin reconciliation first)', async () => {
    mockGetDoc.mockResolvedValueOnce(termsSnap('on_financing'));
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, RECON_OWING, ACTOR))
      .rejects.toThrow(/must be in 'reconciling'/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects when no financing terms exist', async () => {
    mockGetDoc.mockResolvedValueOnce(snap(null));
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, RECON_OWING, ACTOR))
      .rejects.toThrow(/no financing terms/);
  });

  it('rejects bad outcome / triggeredBy enums', async () => {
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, { ...RECON_OWING, outcome: 'bogus' }, ACTOR))
      .rejects.toThrow(/outcome/);
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, { ...RECON_OWING, triggeredBy: 'bogus' }, ACTOR))
      .rejects.toThrow(/triggeredBy/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects non-number / negative money fields', async () => {
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, { ...RECON_OWING, closingBalance: 'x' }, ACTOR))
      .rejects.toThrow(/closingBalance/);
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, { ...RECON_OWING, waiverApplied: -1 }, ACTOR))
      .rejects.toThrow(/waiverApplied/);
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, { ...RECON_OWING, surplusPaid: -1 }, ACTOR))
      .rejects.toThrow(/surplusPaid/);
  });

  it('rejects a bad year, missing auth, and missing actor.role', async () => {
    await expect(reconcileFinancing(TENANT, AGENT, '26', RECON_OWING, ACTOR)).rejects.toThrow(/year/);
    hoisted.mockAuth.currentUser = null;
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, RECON_OWING, ACTOR)).rejects.toThrow(/signed-in/);
    hoisted.mockAuth.currentUser = { uid: 'mgr-uid' };
    await expect(reconcileFinancing(TENANT, AGENT, YEAR, RECON_OWING, {})).rejects.toThrow(/actor\.role/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2b (SEC-08) — branchId/unitId stamped from the AGENT's user doc; manager-side
// ledger reads carry the scope clause the list rule requires.
// ─────────────────────────────────────────────────────────────────────────────
describe('P2b — branch/unit stamping + scoped ledger reads', () => {
  const userDoc = (data) => ({ exists: () => true, data: () => data });

  it('setFinancingTerms stamps branchId + unitId from the agent user doc', async () => {
    hoisted.mockGetUserDoc.mockResolvedValue(userDoc({ branchId: 'branchA', unitId: 'umA1' }));
    mockGetDoc.mockResolvedValueOnce(snap(null));
    await setFinancingTerms(TENANT, AGENT, VALID_TERMS, ACTOR);
    const [ref, payload] = mockSetDoc.mock.calls[0];
    expect(ref.__ref).toBe(`tenants/${TENANT}/financingTerms/${AGENT}`);
    expect(payload).toMatchObject({ branchId: 'branchA', unitId: 'umA1' });
    expect(hoisted.mockGetUserDoc.mock.calls[0][0].__ref).toBe(`tenants/${TENANT}/users/${AGENT}`);
  });

  it('an agent doc without unitId (a BM owner) stamps branchId only — never null', async () => {
    hoisted.mockGetUserDoc.mockResolvedValue(userDoc({ branchId: 'branchA' }));
    mockGetDoc.mockResolvedValueOnce(ledgerSnap(null));
    await setFinancingMonth(TENANT, AGENT, '2026_01', VALID_STATEMENT, ACTOR);
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.branchId).toBe('branchA');
    expect('unitId' in payload).toBe(false);
  });

  it('a missing agent doc stamps neither field', async () => {
    mockGetDoc.mockResolvedValueOnce(ledgerSnap(null));
    await setFinancingProration(TENANT, AGENT, '2026_01', {
      validatingAPI: 30000, actualAPI: 15000, suggestedFinancing: 4000, basisSource: 'submitted-final',
    }, ACTOR);
    const payload = mockSetDoc.mock.calls[0][1];
    expect('branchId' in payload).toBe(false);
    expect('unitId' in payload).toBe(false);
  });

  it('transitionFinancingStatus re-stamps the scope fields on the terms doc', async () => {
    hoisted.mockGetUserDoc.mockResolvedValue(userDoc({ branchId: 'branchA', unitId: 'umA1' }));
    mockGetDoc.mockResolvedValueOnce(snap({ financingStatus: 'not_on_financing', statusHistory: [] }));
    await transitionFinancingStatus(TENANT, AGENT, 'on_financing', ACTOR);
    expect(mockSetDoc.mock.calls[0][1]).toMatchObject({ branchId: 'branchA', unitId: 'umA1', financingStatus: 'on_financing' });
  });

  it('listFinancingMonths: BM scope adds where(branchId), UM scope where(unitId), none otherwise', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await listFinancingMonths(TENANT, AGENT, undefined, { role: 'branch_manager', uid: 'bmA', branchId: 'branchA' });
    await listFinancingMonths(TENANT, AGENT, undefined, { role: 'unit_manager', uid: 'umA1' });
    await listFinancingMonths(TENANT, AGENT, undefined, { role: 'sales_manager', uid: 'sm' });
    await listFinancingMonths(TENANT, AGENT);
    const clauses = mockGetDocs.mock.calls.map(([q]) => q.__clauses.map((c) => c.__where));
    expect(clauses[0]).toEqual([['agentId', '==', AGENT], ['branchId', '==', 'branchA']]);
    expect(clauses[1]).toEqual([['agentId', '==', AGENT], ['unitId', '==', 'umA1']]);
    expect(clauses[2]).toEqual([['agentId', '==', AGENT]]);
    expect(clauses[3]).toEqual([['agentId', '==', AGENT]]);
  });
});
