'use strict';

// Unit tests for notifyFinancingAdjustment callable CF (Track K · K7).
// firebase-admin + firebase-functions mocked; handler exercised via the ._onCall
// shim (the sendComplianceNudge precedent). Asserts: auth + BM+ role gate, input
// validation, agent-subject scope, server-side recipient resolution (unset /
// missing → structured returns, no writes), the three-artifact atomic batch
// shapes (bell / tenant-scoped audit / deterministic cooldown), and email
// non-fatality.

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

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return { https: { onCall: (fn) => ({ _onCall: fn }), HttpsError } };
});

jest.mock('../utils/email', () => ({
  buildMailDoc: jest.fn((to, subject, txt, html, vars) => ({ to, message: { subject, txt, html, vars } })),
}));

const { notifyFinancingAdjustment, _internals } = require('../financing/notifyFinancingAdjustment');
const handler = notifyFinancingAdjustment._onCall;

const TENANT = 'tatillife_south';
const MONTH = '2026_07';

function seedUser(uid, fields) {
  docData[`tenants/${TENANT}/users/${uid}`] = { uid, tenantId: TENANT, ...fields };
}
function seedConfig(notifyRecipientUid) {
  docData[`tenants/${TENANT}/config/financingConfig`] = { notifyRecipientUid };
}
function seedTerms(agentId, currentMonthlyFinancing) {
  docData[`tenants/${TENANT}/financingTerms/${agentId}`] = { agentId, tenantId: TENANT, currentMonthlyFinancing };
}
function seedLedger(agentId, month, fields) {
  docData[`tenants/${TENANT}/financing/${agentId}_${month}`] = { agentId, tenantId: TENANT, month, ...fields };
}
function ctx(role, uid, tenantId = TENANT) {
  return { auth: { uid, token: { role, tenantId } } };
}
async function expectCode(promise, code) {
  await expect(promise).rejects.toMatchObject({ code });
}
const callData = (over = {}) => ({
  agentId: 'agentA',
  month: MONTH,
  payload: { adjustmentPct: 0.14, monthLabel: 'Jul 2026', agentName: 'Ann' },
  ...over,
});

beforeEach(() => {
  docData = {};
  committedBatches = [];
  mailAdds = [];
  mailShouldThrow = false;
  autoId = 0;
  // Callers
  seedUser('bm1', { role: 'branch_manager', name: 'Bo BM',  unitId: null, branchId: 'branch-a' });
  seedUser('bm2', { role: 'branch_manager', name: 'Bea BM', unitId: null, branchId: 'branch-b' });
  seedUser('sm1', { role: 'sales_manager',  name: 'Sam SM', unitId: null, branchId: null });
  seedUser('ta1', { role: 'tenant_admin',   name: 'Ty TA',  unitId: null, branchId: null });
  seedUser('um1', { role: 'unit_manager',   name: 'Uma UM', unitId: 'unit-1', branchId: 'branch-a' });
  // Agents
  seedUser('agentA', { role: 'agent', name: 'Ann',  email: 'ann@x.com',  unitId: 'unit-1', branchId: 'branch-a' });
  seedUser('agentB', { role: 'agent', name: 'Bill', email: 'bill@x.com', unitId: 'unit-2', branchId: 'branch-b' });
  // The configured recipient (CRO-function holder, tenant-level)
  seedUser('cro1', { role: 'tenant_admin', name: 'Cleo CRO', email: 'cro@x.com', unitId: null, branchId: null });
  // Canonical financing state — a CONFIRMED 14% cut (5000 → 4300) so the happy
  // paths clear the server-side clause-5.3 recompute gate. Condition-not-met tests
  // override the ledger row.
  seedTerms('agentA', 5000);
  seedLedger('agentA', MONTH, { managerFinancing: 4300, basisSource: 'settled-confirmed' });
  seedTerms('agentB', 5000);
  seedLedger('agentB', MONTH, { managerFinancing: 4300, basisSource: 'settled-confirmed' });
});

// ── Auth + role gate ──────────────────────────────────────────────────────────

test('rejects unauthenticated', async () => {
  await expectCode(handler(callData(), {}), 'unauthenticated');
});

test('rejects agent role', async () => {
  await expectCode(handler(callData(), ctx('agent', 'agentA')), 'permission-denied');
});

test('rejects unit_manager (UM excluded — BM and up only)', async () => {
  await expectCode(handler(callData(), ctx('unit_manager', 'um1')), 'permission-denied');
  expect(committedBatches).toHaveLength(0);
});

test('rejects caller with no tenant', async () => {
  await expectCode(
    handler(callData(), { auth: { uid: 'bm1', token: { role: 'branch_manager', tenantId: null } } }),
    'failed-precondition'
  );
});

// ── Input validation ──────────────────────────────────────────────────────────

test('rejects empty agentId', async () => {
  await expectCode(handler(callData({ agentId: '' }), ctx('branch_manager', 'bm1')), 'invalid-argument');
});

test('rejects malformed month', async () => {
  await expectCode(handler(callData({ month: '2026-07' }), ctx('branch_manager', 'bm1')), 'invalid-argument');
});

test('rejects missing caller profile', async () => {
  await expectCode(handler(callData(), ctx('branch_manager', 'ghostbm')), 'failed-precondition');
});

test('rejects missing agent doc', async () => {
  seedConfig('cro1');
  await expectCode(handler(callData({ agentId: 'ghost' }), ctx('branch_manager', 'bm1')), 'not-found');
  expect(committedBatches).toHaveLength(0);
});

// ── Agent-subject scope ───────────────────────────────────────────────────────

test('BM cannot notify about an other-branch agent', async () => {
  seedConfig('cro1');
  await expectCode(handler(callData({ agentId: 'agentB' }), ctx('branch_manager', 'bm1')), 'permission-denied');
  expect(committedBatches).toHaveLength(0);
});

test('SM may notify about any-branch agent (tenant-wide)', async () => {
  seedConfig('cro1');
  const res = await handler(callData({ agentId: 'agentB' }), ctx('sales_manager', 'sm1'));
  expect(res.success).toBe(true);
});

test('TA may notify (tenant-wide)', async () => {
  seedConfig('cro1');
  const res = await handler(callData(), ctx('tenant_admin', 'ta1'));
  expect(res.success).toBe(true);
});

// ── Server-side recipient resolution ──────────────────────────────────────────

test('no financingConfig doc → structured no-recipient, nothing written', async () => {
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'no-recipient' });
  expect(committedBatches).toHaveLength(0);
  expect(mailAdds).toHaveLength(0);
});

test('null notifyRecipientUid → structured no-recipient', async () => {
  seedConfig(null);
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'no-recipient' });
  expect(committedBatches).toHaveLength(0);
});

test('configured recipient missing as a user → structured recipient-not-found, nothing written', async () => {
  seedConfig('ghostcro');
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'recipient-not-found', recipientUid: 'ghostcro' });
  expect(committedBatches).toHaveLength(0);
});

// ── Happy path — the three-artifact atomic batch ──────────────────────────────

test('BM same-branch + configured recipient → success, batch of 3, mail queued', async () => {
  seedConfig('cro1');
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toMatchObject({ success: true, recipientUid: 'cro1', agentId: 'agentA', month: MONTH, emailQueued: true });

  expect(committedBatches).toHaveLength(1);
  const ops = committedBatches[0];
  expect(ops).toHaveLength(3);

  const bell = ops.find((o) => o.path.includes('/notifications/'));
  expect(bell.data).toMatchObject({
    userId: 'cro1',
    tenantId: TENANT,
    type: 'financing.adjustment.notify',
    title: 'Financing adjustment notice (clause 5.3)',
    read: false,
    link: null,
  });
  expect(bell.data.body).toContain('Ann');
  expect(bell.data.body).toContain('14%');

  const audit = ops.find((o) => o.path.includes('/auditNudges/'));
  expect(audit.data).toMatchObject({
    actorUid: 'bm1',
    actorRole: 'branch_manager',
    type: 'financing.adjustment.notify',
    agentId: 'agentA',
    recipientUid: 'cro1',
    month: MONTH,
    adjustmentPct: 0.14,        // SERVER-recomputed (5000 → 4300), not the client payload
    basisSource: 'settled-confirmed',
  });

  const cooldown = ops.find((o) => o.path.includes('/nudges/'));
  expect(cooldown.path).toBe(`tenants/${TENANT}/nudges/agentA_financing.adjustment.notify_${MONTH}`);
  expect(cooldown.merge).toBe(true);
  expect(cooldown.data).toMatchObject({ type: 'financing.adjustment.notify', audienceUid: 'agentA', createdBy: 'bm1' });

  expect(mailAdds).toHaveLength(1);
  expect(mailAdds[0].to).toBe('cro@x.com');
});

test('cooldown id uses split-safe deterministic shape (uid first)', async () => {
  seedConfig('cro1');
  await handler(callData(), ctx('branch_manager', 'bm1'));
  const cooldown = committedBatches[0].find((o) => o.path.includes('/nudges/'));
  // The nudges rule parses split('_')[0] as the audience uid.
  const id = cooldown.path.split('/').pop();
  expect(id.split('_')[0]).toBe('agentA');
});

test('recipient with no email → success but emailQueued:false, no mail add', async () => {
  seedUser('cro2', { role: 'tenant_admin', name: 'No Email CRO', email: null, branchId: null });
  seedConfig('cro2');
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toMatchObject({ success: true, emailQueued: false, emailError: 'no email on file' });
  expect(committedBatches).toHaveLength(1); // batch still commits
  expect(mailAdds).toHaveLength(0);
});

test('mail write failure is non-fatal (batch still committed, success returned)', async () => {
  seedConfig('cro1');
  mailShouldThrow = true;
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res.success).toBe(true);
  expect(res.emailQueued).toBe(false);
  expect(committedBatches).toHaveLength(1);
});

// ── Server-side clause-5.3 recompute (legal-integrity gate) ───────────────────

test('IGNORES the client payload.adjustmentPct — audit records the server-recomputed value', async () => {
  seedConfig('cro1');
  // Client LIES: claims a 99% cut. Ledger says 14% (5000 → 4300, confirmed).
  const res = await handler(
    callData({ payload: { adjustmentPct: 0.99, monthLabel: 'Jul 2026', agentName: 'Ann' } }),
    ctx('branch_manager', 'bm1'),
  );
  expect(res.success).toBe(true);
  const audit = committedBatches[0].find((o) => o.path.includes('/auditNudges/'));
  expect(audit.data.adjustmentPct).toBe(0.14);  // the server value, NOT the client's 0.99
  expect(audit.data.basisSource).toBe('settled-confirmed');
  const bell = committedBatches[0].find((o) => o.path.includes('/notifications/'));
  expect(bell.data.body).toContain('14%');
  expect(bell.data.body).not.toContain('99%');
});

test('client claims a cut but ledger shows <=10% → condition-not-met, nothing written', async () => {
  seedConfig('cro1');
  seedLedger('agentA', MONTH, { managerFinancing: 4800, basisSource: 'settled-confirmed' }); // (5000-4800)/5000 = 4%
  const res = await handler(callData({ payload: { adjustmentPct: 0.50 } }), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'condition-not-met' });
  expect(committedBatches).toHaveLength(0);
  expect(mailAdds).toHaveLength(0);
});

test('exactly 10% cut → condition-not-met (CD#5 requires strictly >10%)', async () => {
  seedConfig('cro1');
  seedLedger('agentA', MONTH, { managerFinancing: 4500, basisSource: 'settled-confirmed' }); // 0.10 exact
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'condition-not-met' });
  expect(committedBatches).toHaveLength(0);
});

test('provisional basis (even with a real >10% cut) → condition-not-met', async () => {
  seedConfig('cro1');
  seedLedger('agentA', MONTH, { managerFinancing: 4300, basisSource: 'submitted-provisional' }); // 14% but unconfirmed
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'condition-not-met' });
  expect(committedBatches).toHaveLength(0);
});

test('missing ledger month → condition-not-met', async () => {
  seedConfig('cro1');
  delete docData[`tenants/${TENANT}/financing/agentA_${MONTH}`];
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'condition-not-met' });
  expect(committedBatches).toHaveLength(0);
});

test('unconfirmed managerFinancing (no manager figure) → condition-not-met', async () => {
  seedConfig('cro1');
  seedLedger('agentA', MONTH, { basisSource: 'settled-confirmed' }); // managerFinancing undefined
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'condition-not-met' });
  expect(committedBatches).toHaveLength(0);
});

test('missing terms doc → condition-not-met (cannot recompute the denominator)', async () => {
  seedConfig('cro1');
  delete docData[`tenants/${TENANT}/financingTerms/agentA`];
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res).toEqual({ success: false, reason: 'condition-not-met' });
  expect(committedBatches).toHaveLength(0);
});

test('a confirmed >10% cut on a submitted-final basis fires (records that basis)', async () => {
  seedConfig('cro1');
  seedLedger('agentA', MONTH, { managerFinancing: 4300, basisSource: 'submitted-final' });
  const res = await handler(callData(), ctx('branch_manager', 'bm1'));
  expect(res.success).toBe(true);
  const audit = committedBatches[0].find((o) => o.path.includes('/auditNudges/'));
  expect(audit.data.basisSource).toBe('submitted-final');
});

// ── Internals ─────────────────────────────────────────────────────────────────

test('pctLabel formats a ratio as whole percent; non-finite → ""', () => {
  expect(_internals.pctLabel(0.14)).toBe('14%');
  expect(_internals.pctLabel(0.205)).toBe('21%');
  expect(_internals.pctLabel(undefined)).toBe('');
  expect(_internals.pctLabel('x')).toBe('');
});

test('agentInScope: BM same-branch yes, other-branch no; SM/TA always', () => {
  const caller = { branchId: 'branch-a' };
  expect(_internals.agentInScope('branch_manager', caller, { branchId: 'branch-a' })).toBe(true);
  expect(_internals.agentInScope('branch_manager', caller, { branchId: 'branch-b' })).toBe(false);
  expect(_internals.agentInScope('branch_manager', caller, { branchId: null })).toBe(false);
  expect(_internals.agentInScope('sales_manager', caller, { branchId: 'branch-z' })).toBe(true);
  expect(_internals.agentInScope('tenant_admin', caller, {})).toBe(true);
});
