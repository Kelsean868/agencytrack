'use strict';

/**
 * P4d — the import run record, and the stamps that make counts truthful.
 *
 * The question this slice answers is "which import wrote this policy". Before it,
 * that had no stored answer: undo reconstructed it from each policy's history,
 * and the counts an agent saw came from the PLAN — what the importer meant to do
 * — rather than from what it did.
 */

jest.mock('firebase-functions', () => require('../testHelpers/fakeFirestore').createFakeFunctions());
jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => globalThis.__fakeDb, {
    FieldValue: { serverTimestamp: () => '<ts>' },
  }),
}));

const { createFakeDb } = require('../testHelpers/fakeFirestore');
const {
  startRun, finishRun, findLatestRun,
  RUN_STATUS_RUNNING, RUN_STATUS_COMPLETE, RUN_STATUS_UNDONE,
} = require('../portfolioImport/importRuns');
const { applyPlan } = require('../portfolioImport/applyPlan');
const { findRunBatch } = require('../portfolioImport/rollback');

const TENANT = 'tatillife_south';
const UID = 'uid-kyron';
const AGENT_NO = '011B94';
const SOURCE = 'oipa_import';
const CALLER = { uid: UID, tenantId: TENANT, agentNumber: AGENT_NO };
const P = `tenants/${TENANT}/policies`;
const RUNS = `tenants/${TENANT}/users/${UID}/importRuns`;

const create = (n) => ({
  policyNumber: n,
  doc: { policyNumber: n, agentId: UID, servicingAgentNumber: AGENT_NO, importSource: SOURCE },
  history: { source: SOURCE, exportDate: '2026-09-15', action: 'create' },
});
const update = (n, changed = { proposedAPI: 1500 }) => ({
  policyNumber: n, id: `doc-${n}`, changed,
  history: { source: SOURCE, exportDate: '2026-09-30', action: 'update' },
});

const startOpts = (over = {}) => ({
  tenantId: TENANT, uid: UID, agentId: UID,
  exportDate: '2026-09-15', fileName: '15sep.xlsx', planId: 'plan-1', ...over,
});

describe('startRun / finishRun', () => {
  it('opens the run BEFORE any policy is touched', async () => {
    // A run that crashes halfway must still have a record, or its policies are
    // invisible to the only tool that could clean them up.
    const db = createFakeDb();
    const { runId } = await startRun(db, startOpts());
    const run = db._docs.get(`${RUNS}/${runId}`);
    expect(run).toMatchObject({
      runId, agentId: UID, exportDate: '2026-09-15', fileName: '15sep.xlsx',
      status: RUN_STATUS_RUNNING, finishedAt: null, counts: null,
    });
    expect(typeof run.startedAtMs).toBe('number');
  });

  it('records the WRITER counts, not the plan counts', async () => {
    const db = createFakeDb();
    const { ref } = await startRun(db, startOpts());
    const counts = await finishRun(ref, {
      // The writer committed 2, though the plan asked for 3 — one was refused.
      written: { created: 2, updated: 1, refused: ['X9'] },
      planCounts: { unchanged: 226, statusOverwrites: 3, skippedNotYours: 4, testRecords: 5, planClassPending: 2 },
    });
    expect(counts).toEqual({
      created: 2, updated: 1, refused: 1,
      // P4e — how many of the agent's own status decisions this import overrode.
      unchanged: 226, statusOverwrites: 3, skippedNotYours: 4, testRecords: 5, planClassPending: 2,
    });
    const stored = db._docs.get(ref.path);
    expect(stored.status).toBe(RUN_STATUS_COMPLETE);
    expect(stored.refusedPolicyNumbers).toEqual(['X9']);
    // A reader must never have to guess which numbers were measured.
    expect(stored.countsSource.writer).toEqual(['created', 'updated', 'refused']);
    expect(stored.countsSource.plan).toContain('unchanged');
    expect(stored.countsSource.plan).toContain('statusOverwrites');
  });

  it('omits refusedPolicyNumbers when nothing was refused', async () => {
    const db = createFakeDb();
    const { ref } = await startRun(db, startOpts());
    await finishRun(ref, {
      written: { created: 229, updated: 0, refused: [] },
      planCounts: { unchanged: 0, skippedNotYours: 0, testRecords: 5, planClassPending: 2 },
    });
    expect(db._docs.get(ref.path).refusedPolicyNumbers).toBeUndefined();
  });

  it('records the status overwrites by policy number, not just a count (P4e)', () => {
    // A count alone cannot answer "which of my decisions did head office
    // override", which is the question the agent will actually ask afterwards.
    const db = createFakeDb();
    return startRun(db, startOpts()).then(({ ref }) => finishRun(ref, {
      written: { created: 0, updated: 1, refused: [] },
      statusOverwrites: [{ policyNumber: 'R00175245', from: 'ntu', to: 'lapsed', source: 'agent', setBy: 'uid-kyron' }],
      planCounts: { unchanged: 228, statusOverwrites: 1, skippedNotYours: 0, testRecords: 5, planClassPending: 2 },
    }).then(() => {
      const stored = db._docs.get(ref.path);
      expect(stored.statusOverwriteCount).toBe(1);
      expect(stored.statusOverwrites[0]).toMatchObject({ policyNumber: 'R00175245', from: 'ntu', to: 'lapsed' });
      expect(stored.counts.statusOverwrites).toBe(1);
    }));
  });

  it('defaults statusOverwrites to empty when an import overrode nothing', () => {
    const db = createFakeDb();
    return startRun(db, startOpts()).then(({ ref }) => finishRun(ref, {
      written: { created: 229, updated: 0, refused: [] },
      planCounts: { unchanged: 0, skippedNotYours: 0, testRecords: 5, planClassPending: 2 },
    }).then(() => {
      expect(db._docs.get(ref.path).statusOverwrites).toEqual([]);
      expect(db._docs.get(ref.path).counts.statusOverwrites).toBe(0);
    }));
  });
});

describe('findLatestRun', () => {
  it('returns null when the agent has no runs', async () => {
    expect(await findLatestRun(createFakeDb(), TENANT, UID)).toBeNull();
  });

  it('picks the newest by startedAtMs, not by document order', async () => {
    const db = createFakeDb();
    db._seed(`${RUNS}/a`, { runId: 'a', startedAtMs: 300, status: RUN_STATUS_COMPLETE });
    db._seed(`${RUNS}/b`, { runId: 'b', startedAtMs: 100, status: RUN_STATUS_COMPLETE });
    db._seed(`${RUNS}/c`, { runId: 'c', startedAtMs: 200, status: RUN_STATUS_COMPLETE });
    expect((await findLatestRun(db, TENANT, UID)).runId).toBe('a');
  });

  it('skips an UNDONE run and offers the one before it', async () => {
    // Its policies are already gone. Offering it again answers "0 to remove" for
    // an import the agent has finished with, and hides the one they want.
    const db = createFakeDb();
    db._seed(`${RUNS}/older`, { runId: 'older', startedAtMs: 100, status: RUN_STATUS_COMPLETE });
    db._seed(`${RUNS}/newer`, { runId: 'newer', startedAtMs: 200, status: RUN_STATUS_UNDONE });
    expect((await findLatestRun(db, TENANT, UID)).runId).toBe('older');
  });

  it('returns null when every run has been undone', async () => {
    const db = createFakeDb();
    db._seed(`${RUNS}/x`, { runId: 'x', startedAtMs: 100, status: RUN_STATUS_UNDONE });
    expect(await findLatestRun(db, TENANT, UID)).toBeNull();
  });

  it('does NOT skip a run still running', async () => {
    // A crashed import left policies stamped with its id, and undo is the only
    // thing that can clear them.
    const db = createFakeDb();
    db._seed(`${RUNS}/x`, { runId: 'x', startedAtMs: 100, status: RUN_STATUS_RUNNING });
    expect((await findLatestRun(db, TENANT, UID)).runId).toBe('x');
  });
});

describe('applyPlan stamps the run (ruling 2)', () => {
  it('a CREATE gets firstImportRunId AND lastImportRunId, both this run', async () => {
    const db = createFakeDb();
    await applyPlan(db, { creates: [create('A1')], updates: [], report: {} }, CALLER, SOURCE, 'run-1');
    const doc = [...db._docs.entries()].find(([k]) => /policies\/[^/]+$/.test(k))[1];
    expect(doc.firstImportRunId).toBe('run-1');
    expect(doc.lastImportRunId).toBe('run-1');
  });

  it('an UPDATE moves lastImportRunId and NEVER touches firstImportRunId', async () => {
    // This is the field undo deletes on. An update moving it would make a later
    // undo remove a policy that a later import merely touched.
    const db = createFakeDb();
    db._seed(`${P}/doc-B1`, {
      policyNumber: 'B1', agentId: UID, importSource: SOURCE,
      firstImportRunId: 'run-1', lastImportRunId: 'run-1', proposedAPI: 1200,
    });
    await applyPlan(db, { creates: [], updates: [update('B1')], report: {} }, CALLER, SOURCE, 'run-2');
    const after = db._docs.get(`${P}/doc-B1`);
    expect(after.firstImportRunId).toBe('run-1');
    expect(after.lastImportRunId).toBe('run-2');
    expect(after.proposedAPI).toBe(1500);
  });

  it('stamps the run id on the history doc too', async () => {
    const db = createFakeDb();
    await applyPlan(db, { creates: [create('A1')], updates: [], report: {} }, CALLER, SOURCE, 'run-7');
    const hist = [...db._docs.entries()].find(([k]) => k.includes('/history/'))[1];
    expect(hist.runId).toBe('run-7');
  });

  it('refuses to run without a run id', async () => {
    // Writing policies that belong to no run is the exact state P4d removes.
    const db = createFakeDb();
    await expect(
      applyPlan(db, { creates: [create('A1')], updates: [], report: {} }, CALLER, SOURCE),
    ).rejects.toThrow(/runId is required/);
    expect([...db._docs.keys()]).toEqual([]);
  });
});

describe('findRunBatch (ruling 4)', () => {
  const seed = (id, policyNumber, first, last) => ({
    id, policyNumber, agentId: UID, importSource: SOURCE,
    firstImportRunId: first, lastImportRunId: last,
  });

  it('splits created-by-this-run from updated-by-this-run', async () => {
    const db = createFakeDb();
    // run-2 created N1 and updated O1. O2 was left alone entirely.
    db._seed(`${P}/n1`, seed('n1', 'N1', 'run-2', 'run-2'));
    db._seed(`${P}/o1`, seed('o1', 'O1', 'run-1', 'run-2'));
    db._seed(`${P}/o2`, seed('o2', 'O2', 'run-1', 'run-1'));

    const b = await findRunBatch(db, TENANT, UID, SOURCE, { runId: 'run-2', exportDate: '2026-09-30' });
    expect(b.created.map((d) => d.policyNumber)).toEqual(['N1']);
    expect(b.updated.map((d) => d.policyNumber)).toEqual(['O1']);
    expect(b.totalImported).toBe(3);
    expect(b.exportDate).toBe('2026-09-30');
  });

  it('ignores another agent policies even at the same run id', async () => {
    const db = createFakeDb();
    db._seed(`${P}/mine`, seed('mine', 'MINE', 'run-2', 'run-2'));
    db._seed(`${P}/theirs`, { ...seed('theirs', 'THEIRS', 'run-2', 'run-2'), agentId: 'other' });
    const b = await findRunBatch(db, TENANT, UID, SOURCE, { runId: 'run-2' });
    expect(b.created.map((d) => d.policyNumber)).toEqual(['MINE']);
  });

  it('ignores an organically logged policy', async () => {
    const db = createFakeDb();
    db._seed(`${P}/imp`, seed('imp', 'IMP', 'run-2', 'run-2'));
    db._seed(`${P}/org`, { policyNumber: 'ORG', agentId: UID, firstImportRunId: 'run-2' });
    const b = await findRunBatch(db, TENANT, UID, SOURCE, { runId: 'run-2' });
    expect(b.created.map((d) => d.policyNumber)).toEqual(['IMP']);
    expect(b.totalImported).toBe(1);
  });

  it('returns an empty batch for a run that touched nothing', async () => {
    const db = createFakeDb();
    db._seed(`${P}/o1`, seed('o1', 'O1', 'run-1', 'run-1'));
    const b = await findRunBatch(db, TENANT, UID, SOURCE, { runId: 'run-9' });
    expect(b.created).toEqual([]);
    expect(b.updated).toEqual([]);
    expect(b.totalImported).toBe(1);
  });
});
