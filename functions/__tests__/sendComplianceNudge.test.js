'use strict';

// Unit tests for sendComplianceNudge callable CF.
// firebase-admin + firebase-functions mocked; the onCall handler is exercised
// via the ._onCall shim (the leaderboardAggregate precedent). Asserts: auth +
// role gate, all-or-nothing scope enforcement, input validation (array cap,
// dupes, type, Sunday weekStart), the four-artifact write shapes, structural
// dedupe (deterministic nudge id + merge), and email-failure non-fatality.

// ── In-memory Firestore state ─────────────────────────────────────────────────
let docData = {};          // path → data (undefined = absent)
let committedBatches = []; // array of op-arrays
let mailAdds = [];         // queued mail docs
let mailShouldThrow = false;
let autoId = 0;

function makeDocRef(path) {
  return {
    path,
    async get() {
      return { exists: docData[path] !== undefined, data: () => docData[path] };
    },
  };
}

function makeCollRef(path) {
  return {
    path,
    doc() { autoId += 1; return makeDocRef(`${path}/auto${autoId}`); },
    async add(data) {
      if (path === 'mail') {
        if (mailShouldThrow) throw new Error('mail boom');
        mailAdds.push(data);
        return { id: `mail${mailAdds.length}` };
      }
      autoId += 1;
      return { id: `auto${autoId}` };
    },
  };
}

function makeBatch() {
  const ops = [];
  return {
    set(ref, data, opts) {
      ops.push({ path: ref.path, data, merge: !!(opts && opts.merge) });
      return this;
    },
    async commit() { committedBatches.push(ops); return null; },
  };
}

const mockFirestore = () => ({
  doc: (path) => makeDocRef(path),
  collection: (path) => makeCollRef(path),
  batch: () => makeBatch(),
});

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockFirestore()), {
    FieldValue: { serverTimestamp: () => '<ts>' },
  }),
}));

jest.mock('firebase-functions/v1', () => {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return { https: { onCall: (fn) => ({ _onCall: fn }), HttpsError } };
});

// Mock the email helper so tests don't touch the filesystem and can force a throw.
jest.mock('../utils/email', () => ({
  buildMailDoc: jest.fn((to, subject, txt, html, vars) => ({ to, message: { subject, txt, html, vars } })),
}));

const { sendComplianceNudge, _internals } = require('../compliance/sendComplianceNudge');
const handler = sendComplianceNudge._onCall;

const TENANT = 'tatillife_south';
const WEEK = '2026-06-07';   // Sunday
const TYPE = 'compliance.filing.nudge';

function seedUser(uid, fields) {
  docData[`tenants/${TENANT}/users/${uid}`] = { uid, tenantId: TENANT, ...fields };
}
function ctx(role, uid, tenantId = TENANT) {
  return { auth: { uid, token: { role, tenantId } } };
}
async function expectCode(promise, code) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  docData = {};
  committedBatches = [];
  mailAdds = [];
  mailShouldThrow = false;
  autoId = 0;
  // Caller managers
  seedUser('um1', { role: 'unit_manager',   name: 'Uma UM', unitId: 'unit-1', branchId: 'branch-a' });
  seedUser('bm1', { role: 'branch_manager', name: 'Bo BM',  unitId: null,     branchId: 'branch-a' });
  seedUser('sm1', { role: 'sales_manager',  name: 'Sam SM', unitId: null,     branchId: null });
  seedUser('ta1', { role: 'tenant_admin',   name: 'Ty TA',  unitId: null,     branchId: null });
  // Agents
  seedUser('agentA', { role: 'agent', name: 'Ann',  email: 'ann@x.com',  unitId: 'unit-1', branchId: 'branch-a' });
  seedUser('agentB', { role: 'agent', name: 'Bill', email: 'bill@x.com', unitId: 'unit-2', branchId: 'branch-b' });
  seedUser('agentC', { role: 'agent', name: 'Cara', email: 'cara@x.com', unitId: 'unit-1', branchId: 'branch-a' });
  seedUser('agentNoEmail', { role: 'agent', name: 'Dee', email: null, unitId: 'unit-1', branchId: 'branch-a' });
});

// ── Auth + role gate ──────────────────────────────────────────────────────────

test('rejects unauthenticated', async () => {
  await expectCode(handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, {}), 'unauthenticated');
});

test('rejects agent role (not in actor set)', async () => {
  await expectCode(
    handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, ctx('agent', 'agentA')),
    'permission-denied'
  );
  expect(committedBatches).toHaveLength(0);
});

test('rejects caller with no tenant', async () => {
  await expectCode(
    handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, { auth: { uid: 'um1', token: { role: 'unit_manager', tenantId: null } } }),
    'failed-precondition'
  );
});

// ── Scope enforcement (all-or-nothing) ────────────────────────────────────────

test('UM nudges same-unit agent → success', async () => {
  const res = await handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1'));
  expect(res).toMatchObject({ success: true, count: 1, type: TYPE, weekStart: WEEK });
  expect(committedBatches).toHaveLength(1);
});

test('UM cannot nudge outside unit → permission-denied, nothing written', async () => {
  await expectCode(
    handler({ audienceUids: ['agentB'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1')),
    'permission-denied'
  );
  expect(committedBatches).toHaveLength(0);
  expect(mailAdds).toHaveLength(0);
});

test('UM mixed batch with one out-of-scope target → whole call rejected (atomic)', async () => {
  await expectCode(
    handler({ audienceUids: ['agentA', 'agentB'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1')),
    'permission-denied'
  );
  expect(committedBatches).toHaveLength(0);
});

test('BM nudges same-branch agent → success', async () => {
  const res = await handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, ctx('branch_manager', 'bm1'));
  expect(res.success).toBe(true);
});

test('BM cannot nudge other-branch agent → permission-denied', async () => {
  await expectCode(
    handler({ audienceUids: ['agentB'], type: TYPE, weekStart: WEEK }, ctx('branch_manager', 'bm1')),
    'permission-denied'
  );
});

test('SM nudges any agent (tenant-wide) → success', async () => {
  const res = await handler({ audienceUids: ['agentA', 'agentB'], type: TYPE, weekStart: WEEK }, ctx('sales_manager', 'sm1'));
  expect(res.count).toBe(2);
});

test('TA nudges any agent (tenant-wide) → success', async () => {
  const res = await handler({ audienceUids: ['agentB'], type: TYPE, weekStart: WEEK }, ctx('tenant_admin', 'ta1'));
  expect(res.success).toBe(true);
});

test('missing target doc → not-found, nothing written', async () => {
  await expectCode(
    handler({ audienceUids: ['ghost'], type: TYPE, weekStart: WEEK }, ctx('sales_manager', 'sm1')),
    'not-found'
  );
  expect(committedBatches).toHaveLength(0);
});

// ── Input validation ──────────────────────────────────────────────────────────

test('empty audienceUids → invalid-argument', async () => {
  await expectCode(handler({ audienceUids: [], type: TYPE, weekStart: WEEK }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

test('over-cap audienceUids (51) → invalid-argument', async () => {
  const big = Array.from({ length: 51 }, (_, i) => `u${i}`);
  await expectCode(handler({ audienceUids: big, type: TYPE, weekStart: WEEK }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

test('duplicate audienceUids → invalid-argument', async () => {
  await expectCode(handler({ audienceUids: ['agentA', 'agentA'], type: TYPE, weekStart: WEEK }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

test('non-string audienceUid → invalid-argument', async () => {
  await expectCode(handler({ audienceUids: [123], type: TYPE, weekStart: WEEK }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

test('unknown type → invalid-argument (allowlist is exactly the two known types)', async () => {
  await expectCode(handler({ audienceUids: ['agentA'], type: 'compliance.bogus.nudge', weekStart: WEEK }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

test('plan type accepted — lens=plan, plan notif copy, plan email template (S3 allowlist extension)', async () => {
  const res = await handler({ audienceUids: ['agentA'], type: 'compliance.plan.nudge', weekStart: WEEK }, ctx('unit_manager', 'um1'));
  expect(res).toMatchObject({ success: true, count: 1, type: 'compliance.plan.nudge', weekStart: WEEK });
  const ops = committedBatches[0];
  const nudge = ops.find((o) => o.path.includes('/nudges/'));
  expect(nudge.path).toBe(`tenants/${TENANT}/nudges/agentA_compliance.plan.nudge_${WEEK}`);
  expect(nudge.data.payload.lens).toBe('plan');
  const notif = ops.find((o) => o.path.includes('/notifications/'));
  expect(notif.data.type).toBe('compliance.plan.nudge');
  expect(notif.data.title).toMatch(/plan/i);
  expect(notif.data.body).toMatch(/plan/i);
  // Template selection: plan type → compliance-plan-nudge.* (not the filing pair).
  expect(mailAdds[0].message.txt).toBe('compliance-plan-nudge.txt');
  expect(mailAdds[0].message.html).toBe('compliance-plan-nudge.html');
  expect(mailAdds[0].message.subject).toMatch(/plan/i);
});

test('filing type still selects the filing template (no cross-wiring)', async () => {
  await handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1'));
  expect(mailAdds[0].message.txt).toBe('compliance-nudge.txt');
  expect(mailAdds[0].message.html).toBe('compliance-nudge.html');
});

test('non-Sunday weekStart → invalid-argument', async () => {
  await expectCode(handler({ audienceUids: ['agentA'], type: TYPE, weekStart: '2026-06-08' }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

test('malformed weekStart → invalid-argument', async () => {
  await expectCode(handler({ audienceUids: ['agentA'], type: TYPE, weekStart: '2026-6-7' }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

test('impossible weekStart date → invalid-argument', async () => {
  await expectCode(handler({ audienceUids: ['agentA'], type: TYPE, weekStart: '2026-02-30' }, ctx('sales_manager', 'sm1')), 'invalid-argument');
});

// ── Four-artifact write shapes ────────────────────────────────────────────────

test('writes nudge + notification + audit in one atomic batch with correct shapes', async () => {
  await handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1'));
  expect(committedBatches).toHaveLength(1);
  const ops = committedBatches[0];
  expect(ops).toHaveLength(3);

  const nudge = ops.find((o) => o.path.includes('/nudges/'));
  expect(nudge.path).toBe(`tenants/${TENANT}/nudges/agentA_${TYPE}_${WEEK}`);
  expect(nudge.merge).toBe(true); // structural dedupe — deterministic id + SET-MERGE
  expect(nudge.data).toMatchObject({
    type: TYPE,
    audienceUid: 'agentA',
    payload: { weekStart: WEEK, lens: 'filing', managerName: 'Uma UM' },
    createdBy: 'um1',
    createdAt: '<ts>',
    readAt: null,
  });

  const notif = ops.find((o) => o.path.includes('/notifications/'));
  expect(notif.merge).toBe(false);
  expect(notif.data).toMatchObject({
    userId: 'agentA',
    tenantId: TENANT,
    type: TYPE,
    read: false,
    link: null,
    createdAt: '<ts>',
  });
  expect(typeof notif.data.title).toBe('string');
  expect(notif.data.body).toContain(WEEK);

  const audit = ops.find((o) => o.path.includes('/auditNudges/'));
  expect(audit.data).toMatchObject({
    actorUid: 'um1',
    actorRole: 'unit_manager',
    audienceUid: 'agentA',
    type: TYPE,
    weekStart: WEEK,
    at: '<ts>',
  });

  expect(mailAdds).toHaveLength(1);
  expect(mailAdds[0].to).toBe('ann@x.com');
});

test('Nudge-all: N targets → 3N batch ops + N emails + count N', async () => {
  const res = await handler({ audienceUids: ['agentA', 'agentC'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1'));
  expect(res.count).toBe(2);
  expect(committedBatches).toHaveLength(1);
  expect(committedBatches[0]).toHaveLength(6); // 3 artifacts × 2 targets
  expect(mailAdds).toHaveLength(2);
});

// ── Email non-fatality ────────────────────────────────────────────────────────

test('email failure is non-fatal — notification still committed, emailQueued false', async () => {
  mailShouldThrow = true;
  const res = await handler({ audienceUids: ['agentA'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1'));
  expect(res.success).toBe(true);
  expect(committedBatches).toHaveLength(1);          // notification persisted
  expect(res.results[0]).toMatchObject({ audienceUid: 'agentA', notified: true, emailQueued: false });
  expect(res.results[0].emailError).toBeDefined();
});

test('target with no email → notified true, emailQueued false, no mail add', async () => {
  const res = await handler({ audienceUids: ['agentNoEmail'], type: TYPE, weekStart: WEEK }, ctx('unit_manager', 'um1'));
  expect(res.results[0]).toMatchObject({ notified: true, emailQueued: false, emailError: 'no email on file' });
  expect(mailAdds).toHaveLength(0);
  expect(committedBatches).toHaveLength(1);
});

// ── _internals helpers ────────────────────────────────────────────────────────

describe('_internals.isValidSundayString', () => {
  const { isValidSundayString } = _internals;
  test('accepts a Sunday', () => expect(isValidSundayString('2026-06-07')).toBe(true));
  test('rejects a Monday', () => expect(isValidSundayString('2026-06-08')).toBe(false));
  test('rejects malformed', () => expect(isValidSundayString('2026-6-7')).toBe(false));
  test('rejects impossible date', () => expect(isValidSundayString('2026-02-30')).toBe(false));
  test('rejects non-string', () => expect(isValidSundayString(20260607)).toBe(false));
});

describe('_internals.targetInScope', () => {
  const { targetInScope } = _internals;
  test('SM is tenant-wide', () => expect(targetInScope('sales_manager', {}, { unitId: 'z' })).toBe(true));
  test('TA is tenant-wide', () => expect(targetInScope('tenant_admin', {}, { branchId: 'z' })).toBe(true));
  test('UM same unit', () => expect(targetInScope('unit_manager', { unitId: 'u1' }, { unitId: 'u1' })).toBe(true));
  test('UM other unit', () => expect(targetInScope('unit_manager', { unitId: 'u1' }, { unitId: 'u2' })).toBe(false));
  test('UM null unit never matches', () => expect(targetInScope('unit_manager', { unitId: null }, { unitId: null })).toBe(false));
  test('BM same branch', () => expect(targetInScope('branch_manager', { branchId: 'b1' }, { branchId: 'b1' })).toBe(true));
  test('BM other branch', () => expect(targetInScope('branch_manager', { branchId: 'b1' }, { branchId: 'b2' })).toBe(false));
});
