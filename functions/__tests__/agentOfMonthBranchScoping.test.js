'use strict';

// SEC-06 (audit 2026-09-24) — Agent-of-month CFs trusted the caller-supplied
// `branchId` instead of the caller's own branch. These tests pin the fix in
// both callables: a branch_manager may only act on/read their own branch;
// sales_manager (and, by the same code path, tenant_admin/platform_admin)
// keep free choice of branch.

// Module-scope mutable state — must be prefixed 'mock' for jest.mock() hoisting.
let mockUsersByUid = {};
let mockSubmissionDocs = [];

jest.mock('firebase-admin', () => {
  function makeSubmissionsQuery(docs) {
    const q = {
      where: () => q,
      get: async () => ({ docs: docs.map((d) => ({ data: () => d })), empty: docs.length === 0 }),
    };
    return q;
  }

  const docFn = jest.fn((path) => {
    const userMatch = path.match(/^tenants\/[^/]+\/users\/(.+)$/);
    if (userMatch) {
      const uid = userMatch[1];
      const data = mockUsersByUid[uid];
      return { get: jest.fn().mockResolvedValue({ exists: !!data, data: () => data }) };
    }
    // agentOfMonth/{monthKey} write target
    return {
      get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
      set: jest.fn().mockResolvedValue({}),
    };
  });

  const collectionFn = jest.fn(() => makeSubmissionsQuery(mockSubmissionDocs));

  const firestore = () => ({ doc: docFn, collection: collectionFn });
  firestore.FieldValue = { serverTimestamp: () => '__SERVER_TIMESTAMP__' };

  return { initializeApp: () => {}, firestore };
});

jest.mock('firebase-functions/v1', () => {
  const HttpsError = class extends Error {
    constructor(code, message) { super(message); this.code = code; }
  };
  return {
    https: {
      HttpsError,
      onCall: (fn) => ({ _onCall: fn }),
      onRequest: () => ({}),
    },
  };
});

const { setAgentOfMonth } = require('../agentOfMonth/setAgentOfMonth');
const { getAgentOfMonthCandidates } = require('../agentOfMonth/getCandidates');

const setHandler = setAgentOfMonth._onCall;
const getHandler = getAgentOfMonthCandidates._onCall;

const TENANT = 't1';

function ctx(uid, role, extraTokenFields = {}) {
  return { auth: { uid, token: { role, tenantId: TENANT, ...extraTokenFields } } };
}

function expectPermissionDenied(promise) {
  return promise.then(
    () => { throw new Error('Expected permission-denied but resolved'); },
    (err) => { expect(err.code).toBe('permission-denied'); }
  );
}

// Fix the clock mid-month so getCurrentMonthKey()/isWithinEditWindow() are
// deterministic — setAgentOfMonth throws failed-precondition otherwise, an
// unrelated axis to the SEC-06 branch-scoping fix under test.
const FIXED_NOW = new Date('2026-06-15T12:00:00Z');
const CURRENT_MONTH_KEY = '2026-06';

beforeEach(() => {
  mockUsersByUid = {};
  mockSubmissionDocs = [];
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('setAgentOfMonth — SEC-06 branch scoping', () => {
  it('branch_manager acting on their own branch is allowed', async () => {
    mockUsersByUid['bm-1'] = { branchId: 'branch-a' };
    mockUsersByUid['agent-1'] = { branchId: 'branch-a', name: 'Agent One' };

    const result = await setHandler(
      { branchId: 'branch-a', monthKey: CURRENT_MONTH_KEY, category: 'api', agentUid: 'agent-1' },
      ctx('bm-1', 'branch_manager')
    );
    expect(result).toEqual({ success: true, monthKey: CURRENT_MONTH_KEY, category: 'api', agentUid: 'agent-1' });
  });

  it('branch_manager acting on a DIFFERENT branch throws permission-denied', async () => {
    mockUsersByUid['bm-1'] = { branchId: 'branch-a' };
    mockUsersByUid['agent-1'] = { branchId: 'branch-b', name: 'Agent One' };

    await expectPermissionDenied(
      setHandler(
        { branchId: 'branch-b', monthKey: CURRENT_MONTH_KEY, category: 'api', agentUid: 'agent-1' },
        ctx('bm-1', 'branch_manager')
      )
    );
  });

  it('sales_manager may act on any branch', async () => {
    mockUsersByUid['sm-1'] = { role: 'sales_manager' }; // no branchId on the caller doc at all
    mockUsersByUid['agent-1'] = { branchId: 'branch-z', name: 'Agent One' };

    const result = await setHandler(
      { branchId: 'branch-z', monthKey: CURRENT_MONTH_KEY, category: 'api', agentUid: 'agent-1' },
      ctx('sm-1', 'sales_manager')
    );
    expect(result).toEqual({ success: true, monthKey: CURRENT_MONTH_KEY, category: 'api', agentUid: 'agent-1' });
  });

  it('a branch_manager token.branchId that disagrees with the caller doc does not let a spoofed branch through', async () => {
    // token claims branch-a, but the caller's own doc (authoritative) says branch-b.
    mockUsersByUid['bm-1'] = { branchId: 'branch-b' };
    mockUsersByUid['agent-1'] = { branchId: 'branch-a', name: 'Agent One' };

    await expectPermissionDenied(
      setHandler(
        { branchId: 'branch-a', monthKey: CURRENT_MONTH_KEY, category: 'api', agentUid: 'agent-1' },
        ctx('bm-1', 'branch_manager', { branchId: 'branch-a' })
      )
    );
  });
});

describe('getAgentOfMonthCandidates — SEC-06 branch scoping', () => {
  it('branch_manager reading their own branch is allowed', async () => {
    mockUsersByUid['bm-1'] = { branchId: 'branch-a' };

    const result = await getHandler(
      { branchId: 'branch-a', monthKey: CURRENT_MONTH_KEY },
      ctx('bm-1', 'branch_manager')
    );
    expect(result).toEqual({ api: [], apps: [], activity: [] });
  });

  it('branch_manager reading a DIFFERENT branch throws permission-denied', async () => {
    mockUsersByUid['bm-1'] = { branchId: 'branch-a' };

    await expectPermissionDenied(
      getHandler({ branchId: 'branch-b', monthKey: CURRENT_MONTH_KEY }, ctx('bm-1', 'branch_manager'))
    );
  });

  it('sales_manager may read any branch', async () => {
    mockUsersByUid['sm-1'] = { role: 'sales_manager' };

    const result = await getHandler(
      { branchId: 'branch-z', monthKey: CURRENT_MONTH_KEY },
      ctx('sm-1', 'sales_manager')
    );
    expect(result).toEqual({ api: [], apps: [], activity: [] });
  });
});
