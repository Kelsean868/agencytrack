'use strict';

jest.mock('firebase-admin', () => {
  const firestoreFn = jest.fn();
  firestoreFn.FieldValue = { serverTimestamp: jest.fn().mockReturnValue('SERVER_TS') };
  return { initializeApp: jest.fn(), firestore: firestoreFn };
});

jest.mock('firebase-functions/v1', () => ({
  firestore: {
    document: jest.fn(() => ({
      onCreate: jest.fn((handler) => ({ run: handler })),
    })),
  },
}));

const admin = require('firebase-admin');
const {
  onFinancingEscalationCreate,
  _internals,
} = require('../financing/onFinancingEscalationCreate');

const CONTEXT = { params: { tenantId: 'tatillife_south', escalationId: 'agent1_draw_decision_2026_07' } };

const ESC = {
  tenantId:     'tatillife_south',
  agentId:      'agent1',
  agentName:    'Agent One',
  agentUnitId:  'um1',
  branchId:     'branchX',
  raisedByUid:  'um1',
  raisedByName: 'Unit Mgr One',
  raisedByRole: 'unit_manager',
  reason:       'draw_decision',
  note:         'Needs a draw decision.',
  status:       'open',
};

function makeSnap(data) {
  return data ? { exists: true, data: () => data } : { exists: false, data: () => null };
}

/**
 * Configure admin.firestore mock.
 *   collection(/users)         → where(role).where(branchId).get() → recipientDocs
 *   collection(/notifications) → doc(id).create() → createFn
 */
function setupAdminMock({ recipientDocs = [], createFn } = {}) {
  createFn = createFn || jest.fn().mockResolvedValue({});
  const getRecipients = jest.fn().mockResolvedValue({
    docs: recipientDocs,
    empty: recipientDocs.length === 0,
    size: recipientDocs.length,
  });
  const whereCalls = [];
  const where2 = { get: getRecipients };
  const where1 = jest.fn((...args) => { whereCalls.push(args); return where2; });
  const whereEntry = jest.fn((...args) => { whereCalls.push(args); return { where: where1 }; });
  const docFn = jest.fn(() => ({ create: createFn }));

  admin.firestore.mockReturnValue({
    collection: jest.fn((path) => {
      if (path.includes('/users')) return { where: whereEntry };
      // notifications
      return { doc: docFn };
    }),
  });

  return { createFn, getRecipients, whereCalls, docFn };
}

describe('onFinancingEscalationCreate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('create → one bell notification per same-branch BM (shape + escalationId in payload)', async () => {
    const { createFn } = setupAdminMock({ recipientDocs: [{ id: 'bm1' }, { id: 'bm2' }] });

    await onFinancingEscalationCreate.run(makeSnap(ESC), CONTEXT);

    expect(createFn).toHaveBeenCalledTimes(2);
    const first = createFn.mock.calls[0][0];
    expect(first.userId).toBe('bm1');
    expect(first.tenantId).toBe('tatillife_south');
    expect(first.type).toBe('manager_alert');
    expect(first.read).toBe(false);
    expect(first.link).toBeNull();
    expect(first.escalationId).toBe('agent1_draw_decision_2026_07');
    expect(first.title).toMatch(/escalation/i);
    expect(first.body).toMatch(/Agent One/);
    expect(first.body).toMatch(/Unit Mgr One/);
    // second recipient
    expect(createFn.mock.calls[1][0].userId).toBe('bm2');
  });

  test('recipient lookup filters on role=branch_manager AND the doc branchId', async () => {
    const { getRecipients, whereCalls } = setupAdminMock({ recipientDocs: [{ id: 'bm1' }] });
    await onFinancingEscalationCreate.run(makeSnap(ESC), CONTEXT);
    expect(getRecipients).toHaveBeenCalledTimes(1);
    // Both filter clauses present, with the escalation's branchId (not a hardcode).
    expect(whereCalls).toEqual(
      expect.arrayContaining([
        ['role', '==', 'branch_manager'],
        ['branchId', '==', 'branchX'],
      ]),
    );
  });

  test('notification doc id is the deterministic dedupe key (idempotent .create target)', async () => {
    const { docFn } = setupAdminMock({ recipientDocs: [{ id: 'bm1' }] });
    await onFinancingEscalationCreate.run(makeSnap(ESC), CONTEXT);
    expect(docFn).toHaveBeenCalledWith('finesc_agent1_draw_decision_2026_07_bm1');
  });

  test('no same-branch BM recipients → no notification written', async () => {
    const { createFn } = setupAdminMock({ recipientDocs: [] });
    await onFinancingEscalationCreate.run(makeSnap(ESC), CONTEXT);
    expect(createFn).not.toHaveBeenCalled();
  });

  test('missing branchId → no recipient query, no notification', async () => {
    const { createFn, getRecipients } = setupAdminMock({ recipientDocs: [{ id: 'bm1' }] });
    await onFinancingEscalationCreate.run(makeSnap({ ...ESC, branchId: undefined }), CONTEXT);
    expect(getRecipients).not.toHaveBeenCalled();
    expect(createFn).not.toHaveBeenCalled();
  });

  test('deleted/absent snapshot → no-op', async () => {
    const { createFn } = setupAdminMock({ recipientDocs: [{ id: 'bm1' }] });
    await onFinancingEscalationCreate.run(makeSnap(null), CONTEXT);
    expect(createFn).not.toHaveBeenCalled();
  });

  test('idempotence: re-delivery ALREADY_EXISTS (code 6) is swallowed, does not throw', async () => {
    const alreadyExists = Object.assign(new Error('already exists'), { code: 6 });
    const createFn = jest.fn().mockRejectedValue(alreadyExists);
    setupAdminMock({ recipientDocs: [{ id: 'bm1' }], createFn });

    await expect(
      onFinancingEscalationCreate.run(makeSnap(ESC), CONTEXT)
    ).resolves.toBeNull();
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  test('notification write failure (non-dedupe) is swallowed, does not throw', async () => {
    const createFn = jest.fn().mockRejectedValue(new Error('Firestore unavailable'));
    setupAdminMock({ recipientDocs: [{ id: 'bm1' }], createFn });

    await expect(
      onFinancingEscalationCreate.run(makeSnap(ESC), CONTEXT)
    ).resolves.toBeNull();
  });

  test('notifDedupeId is deterministic per (escalation, recipient)', () => {
    const { notifDedupeId } = _internals;
    expect(notifDedupeId('agent1_draw_decision_2026_07', 'bm1'))
      .toBe('finesc_agent1_draw_decision_2026_07_bm1');
    // stable across calls
    expect(notifDedupeId('e', 'r')).toBe(notifDedupeId('e', 'r'));
  });
});
