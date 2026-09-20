'use strict';

/**
 * Ruling 3 — TWO CALLS. Preview returns a plan and writes nothing to the ledger;
 * apply writes THAT EXACT PLAN; plans expire after 15 minutes.
 *
 * Each refusal below is a different real event: a stale review, a double press of
 * Import, a changed profile, a plan that is not yours. They get different messages
 * because they need different actions from the person reading them.
 */

jest.mock('firebase-functions/v1', () => require('../testHelpers/fakeFirestore').createFakeFunctions());

const { createFakeDb } = require('../testHelpers/fakeFirestore');
const {
  savePlan, loadPlan, markApplied, purgeOldPlans, PLAN_TTL_MS, MAX_PLAN_BYTES,
} = require('../portfolioImport/planStore');

const TENANT = 'tatillife_south';
const UID = 'uid-kyron';
const AGENT_NO = '011B94';

const planOf = (creates = 2, updates = 1, skips = 3) => ({
  creates: Array.from({ length: creates }, (_, i) => ({ policyNumber: `C${i}`, doc: {} })),
  updates: Array.from({ length: updates }, (_, i) => ({ policyNumber: `U${i}`, changed: {} })),
  skips: [],
  report: { creates, updates, skips },
});

async function save(db, over = {}) {
  return savePlan(db, {
    tenantId: TENANT, uid: UID, agentNumber: AGENT_NO, exportDate: '2026-09-15',
    plan: planOf(), parseReport: { docs: 229 }, fileName: 'export.xlsx', ...over,
  });
}
const load = (db, over = {}) => loadPlan(db, {
  tenantId: TENANT, uid: UID, agentNumber: AGENT_NO, ...over,
});
async function code(fn) {
  try { await fn(); return null; } catch (e) { return e.code; }
}

describe('planStore', () => {
  it('round-trips a plan', async () => {
    const db = createFakeDb();
    const planId = await save(db);
    const { plan, parseReport, meta } = await load(db, { planId });
    expect(plan.report).toEqual({ creates: 2, updates: 1, skips: 3 });
    expect(parseReport).toEqual({ docs: 229 });
    expect(meta.exportDate).toBe('2026-09-15');
  });

  it('parks the plan where no browser can reach it', async () => {
    // The path has no block in firestore.rules, so the client is denied by
    // default. If this path ever moves under a permitted match, the plan becomes
    // client-editable and "apply" turns into a write-anything endpoint.
    const db = createFakeDb();
    const planId = await save(db);
    expect([...db._docs.keys()]).toContain(
      `tenants/${TENANT}/users/${UID}/importPlans/${planId}`,
    );
  });

  it('writes nothing into the policies collection', async () => {
    const db = createFakeDb();
    await save(db);
    expect([...db._docs.keys()].filter((p) => p.includes('/policies'))).toEqual([]);
  });

  it('refuses a plan older than 15 minutes', async () => {
    const db = createFakeDb();
    const planId = await save(db);
    expect(await code(() => load(db, { planId, now: Date.now() + PLAN_TTL_MS + 1 })))
      .toBe('deadline-exceeded');
  });

  it('accepts a plan at exactly 15 minutes, and refuses it one millisecond later', async () => {
    // The boundary is stated as "after 15 minutes", so 15:00 is still valid. An
    // off-by-one here shows up as an agent who reviewed carefully being told to
    // start again.
    //
    // `now` is derived from the STORED `createdAtMs`, never from a fresh
    // `Date.now()`. Re-reading the clock made this test flaky: `savePlan` stamps
    // the document, the test then read the clock again, and a single millisecond
    // of drift between the two turned "exactly the TTL" into "the TTL plus one"
    // and the plan came back expired. Caught at roughly 1 run in 8.
    const db = createFakeDb();
    const planId = await save(db);
    const { createdAtMs } = db._docs.get(`tenants/${TENANT}/users/${UID}/importPlans/${planId}`);

    const loaded = await load(db, { planId, now: createdAtMs + PLAN_TTL_MS });
    expect(loaded.plan).toBeDefined();

    // The other side of the same boundary, so a change that widens the window
    // cannot pass by making both assertions true.
    expect(await code(() => load(db, { planId, now: createdAtMs + PLAN_TTL_MS + 1 })))
      .toBe('deadline-exceeded');
  });

  it('refuses a plan that was already applied', async () => {
    const db = createFakeDb();
    const planId = await save(db);
    const { ref } = await load(db, { planId });
    await markApplied(ref, { created: 229, updated: 0 });
    expect(await code(() => load(db, { planId }))).toBe('failed-precondition');
  });

  it('refuses a plan belonging to another agent', async () => {
    const db = createFakeDb();
    const planId = await save(db);
    // Same path, wrong caller: the stored ownerUid is the proof, not the path.
    db._docs.set(`tenants/${TENANT}/users/${UID}/importPlans/${planId}`, {
      ...db._docs.get(`tenants/${TENANT}/users/${UID}/importPlans/${planId}`),
      ownerUid: 'somebody-else',
    });
    expect(await code(() => load(db, { planId }))).toBe('permission-denied');
  });

  it('refuses when the agent number changed since the review', async () => {
    // Every isWritingAgent flag and every servicing match in the plan was decided
    // against the old number.
    const db = createFakeDb();
    const planId = await save(db);
    expect(await code(() => load(db, { planId, agentNumber: '099Z00' })))
      .toBe('failed-precondition');
  });

  it('refuses a missing plan id', async () => {
    const db = createFakeDb();
    expect(await code(() => load(db, { planId: 'nope' }))).toBe('not-found');
    expect(await code(() => load(db, { planId: '' }))).toBe('invalid-argument');
    expect(await code(() => load(db, { planId: undefined }))).toBe('invalid-argument');
  });

  it('refuses a plan too big to store, naming the size', async () => {
    // Over 1 MiB Firestore rejects the WRITE, which would reach the agent as
    // "preview failed" with no reason. This guard makes the failure say why.
    const db = createFakeDb();
    const huge = { ...planOf(), filler: 'x'.repeat(MAX_PLAN_BYTES + 1) };
    try {
      await save(db, { plan: huge });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.code).toBe('resource-exhausted');
      expect(e.message).toMatch(/KB/);
    }
  });

  it('purges earlier plans so a stale one cannot be applied later', async () => {
    const db = createFakeDb();
    const first = await save(db);
    const second = await save(db);
    const removed = await purgeOldPlans(db, { tenantId: TENANT, uid: UID, keepId: second });
    expect(removed).toBe(1);
    expect(await code(() => load(db, { planId: first }))).toBe('not-found');
    expect((await load(db, { planId: second })).plan).toBeDefined();
  });

  it('purge leaves another agent plans alone', async () => {
    const db = createFakeDb();
    db._seed(`tenants/${TENANT}/users/other-uid/importPlans/p1`, { ownerUid: 'other-uid' });
    await save(db);
    await purgeOldPlans(db, { tenantId: TENANT, uid: UID });
    expect(db._docs.has(`tenants/${TENANT}/users/other-uid/importPlans/p1`)).toBe(true);
  });
});
