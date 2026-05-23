'use strict';

jest.mock('firebase-admin', () => {
  const firestoreFn = jest.fn();
  firestoreFn.FieldValue = { serverTimestamp: jest.fn().mockReturnValue('SERVER_TS') };
  return { initializeApp: jest.fn(), firestore: firestoreFn };
});

jest.mock('firebase-functions', () => ({
  firestore: {
    document: jest.fn(() => ({
      onWrite: jest.fn(handler => ({ run: handler })),
    })),
  },
}));

const admin = require('firebase-admin');
const { onWarSubmitNotifyUpline } = require('../war/onWarSubmitNotifyUpline');

const CONTEXT = { params: { tenantId: 'tatillife_south', warId: 'mgr1_2026-05-17' } };

// org-default: UM needs 3 JFW; BM needs 2 JFW
const ORG_DEFAULT = {
  unit_manager:   { jfwCount: 3 },
  branch_manager: { jfwCount: 2 },
  sales_manager:  {},
};

// WAR that misses jfwCount (0 < 3)
const MISSED_UM_AFTER = {
  managerId: 'mgr1', managerName: 'Alice UM', managerRole: 'unit_manager',
  branchId: 'south', weekStart: '2026-05-17', tenantId: 'tatillife_south',
  status: 'submitted', jfwCount: 0,
};

// WAR that meets the standard (3 >= 3)
const COMPLIANT_UM_AFTER = { ...MISSED_UM_AFTER, jfwCount: 5 };

// A BM recipient doc from the users collection query
const BM_RECIPIENT = { id: 'bm1' };

function makeChange(before, after) {
  return {
    before: before ? { exists: true,  data: () => before } : { exists: false, data: () => ({}) },
    after:  after  ? { exists: true,  data: () => after  } : { exists: false, data: () => ({}) },
  };
}

/**
 * Configure admin.firestore mock for tests that exercise the full CF body.
 *
 * doc() calls are satisfied sequentially:
 *   call 1 → config/managerActivityStandards (org-default)
 *   call 2 → managerActivityStandardOverrides/{managerId} (override)
 *
 * collection() is dispatched by path substring:
 *   /users       → where chain → getRecipients mock
 *   /notifications → add mock
 */
function setupAdminMock({ orgDefaultData, overrideData, recipientDocs, addFn } = {}) {
  addFn = addFn || jest.fn().mockResolvedValue({});

  let getCallCount = 0;
  const docGet = jest.fn(() => {
    getCallCount += 1;
    if (getCallCount === 1) {
      return Promise.resolve({
        exists: orgDefaultData != null,
        data: jest.fn(() => orgDefaultData || {}),
      });
    }
    return Promise.resolve({
      exists: overrideData != null,
      data: jest.fn(() => overrideData || {}),
    });
  });

  const getRecipients = jest.fn().mockResolvedValue({ docs: recipientDocs || [] });
  const where2 = { get: getRecipients };
  const where1 = { where: jest.fn(() => where2), get: getRecipients };

  admin.firestore.mockReturnValue({
    doc:        jest.fn(() => ({ get: docGet })),
    collection: jest.fn(path => {
      if (path.includes('/users')) return { where: jest.fn(() => where1) };
      return { add: addFn };
    }),
  });

  return { addFn, getRecipients, docGet };
}

// ── handler tests ──────────────────────────────────────────────────────────────

describe('onWarSubmitNotifyUpline', () => {
  beforeEach(() => {
    // Reset call-tracking (.mock.calls) between tests; does NOT clear mockReturnValue
    // or properties on the mock function (admin.firestore.FieldValue persists).
    jest.clearAllMocks();
  });
  test('submit-transition with missed standards → writes one notification per recipient', async () => {
    const { addFn } = setupAdminMock({
      orgDefaultData: ORG_DEFAULT,
      overrideData:   null,
      recipientDocs:  [BM_RECIPIENT],
    });

    await onWarSubmitNotifyUpline.run(
      makeChange({ status: 'draft' }, MISSED_UM_AFTER),
      CONTEXT,
    );

    expect(addFn).toHaveBeenCalledTimes(1);
    const notif = addFn.mock.calls[0][0];
    expect(notif.userId).toBe('bm1');
    expect(notif.tenantId).toBe('tatillife_south');
    expect(notif.type).toBe('manager_alert');
    expect(notif.read).toBe(false);
    expect(notif.title).toMatch(/Alice UM/);
    expect(notif.title).toMatch(/missed 1 standard/);
    expect(notif.body).toMatch(/week of 2026-05-17/);
    expect(notif.body).toMatch(/Joint Field Work/);
  });

  test('draft save (status stays draft) → no admin calls made', async () => {
    const addFn = jest.fn();

    await onWarSubmitNotifyUpline.run(
      makeChange({ status: 'draft' }, { ...MISSED_UM_AFTER, status: 'draft' }),
      CONTEXT,
    );

    expect(addFn).not.toHaveBeenCalled();
    expect(admin.firestore).not.toHaveBeenCalled();
  });

  test('jfwCount write-back (submitted → submitted) → no notification (de-dup)', async () => {
    // onWarWrite's own update leaves status='submitted' on both sides
    const addFn = jest.fn();

    await onWarSubmitNotifyUpline.run(
      makeChange({ status: 'submitted' }, MISSED_UM_AFTER),
      CONTEXT,
    );

    expect(addFn).not.toHaveBeenCalled();
    expect(admin.firestore).not.toHaveBeenCalled();
  });

  test('compliant submit → no notification written', async () => {
    const { addFn } = setupAdminMock({
      orgDefaultData: ORG_DEFAULT,
      overrideData:   null,
      recipientDocs:  [BM_RECIPIENT],
    });

    await onWarSubmitNotifyUpline.run(
      makeChange({ status: 'draft' }, COMPLIANT_UM_AFTER),
      CONTEXT,
    );

    expect(addFn).not.toHaveBeenCalled();
  });

  test('sales_manager submit → no notification (chain stops before any admin call)', async () => {
    const smAfter = { ...MISSED_UM_AFTER, managerRole: 'sales_manager' };

    await onWarSubmitNotifyUpline.run(
      makeChange({ status: 'draft' }, smAfter),
      CONTEXT,
    );

    expect(admin.firestore).not.toHaveBeenCalled();
  });

  test('notification write throw does not propagate (best-effort)', async () => {
    const throwingAdd = jest.fn().mockRejectedValue(new Error('Firestore unavailable'));
    setupAdminMock({
      orgDefaultData: ORG_DEFAULT,
      overrideData:   null,
      recipientDocs:  [BM_RECIPIENT],
      addFn:          throwingAdd,
    });

    await expect(
      onWarSubmitNotifyUpline.run(
        makeChange({ status: 'draft' }, MISSED_UM_AFTER),
        CONTEXT,
      )
    ).resolves.toBeNull();
  });
});
