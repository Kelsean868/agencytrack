'use strict';

/**
 * P4b — undo last import.
 *
 * The case this file exists for is the SECOND import. Re-importing a newer export
 * bumps `exportDate` on every existing policy even when no fact about the policy
 * changed, so "delete everything carrying the latest export date" would delete the
 * whole book and call it an undo. Nothing errors. The history subcollection is
 * what tells a created policy from an updated one, and these tests pin that.
 */

jest.mock('firebase-functions', () => require('../testHelpers/fakeFirestore').createFakeFunctions());
jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => globalThis.__fakeDb, {
    FieldValue: { serverTimestamp: () => '<ts>' },
  }),
}));
// The ESM bridge uses a dynamic `import()`, which Jest cannot run without
// --experimental-vm-modules. Undo needs exactly one thing from it — the
// `oipa_import` provenance tag — so the bridge is mocked here rather than the
// whole suite being reconfigured. The bridge itself is exercised for real in the
// emulator run, which is where a CommonJS-to-ESM load can actually be proven.
jest.mock('../portfolioImport/loadPortfolioImport', () => ({
  loadPortfolioImport: async () => ({ OIPA_IMPORT_SOURCE: 'oipa_import' }),
}));

const { createFakeDb } = require('../testHelpers/fakeFirestore');
const {
  findImportedDocs, findLastImportBatch, deletePolicies, countOrphanedHistory, MAX_WRITES,
} = require('../portfolioImport/rollback');
const undo = require('../portfolioImport/undoImport');

const TENANT = 'tatillife_south';
const UID = 'uid-kyron';
const AGENT_NO = '011B94';
const SOURCE = 'oipa_import';
const P = `tenants/${TENANT}/policies`;

/** Seeds one policy plus the history the importer would have written for it. */
function seedPolicy(db, { id, policyNumber, exportDate, actions = ['create'], agentId = UID, importSource = SOURCE }) {
  db._seed(`${P}/${id}`, { policyNumber, exportDate, agentId, importSource, servicingAgentNumber: AGENT_NO });
  actions.forEach((action, i) => {
    db._seed(`${P}/${id}/history/h${i}`, { source: importSource, exportDate, action });
  });
}

function dbWithUser() {
  const db = createFakeDb();
  db._seed(`tenants/${TENANT}/users/${UID}`, {
    agentNumber: AGENT_NO, unitId: 'u', branchId: 'b', name: 'Kyron',
  });
  return db;
}
const ctx = () => ({ auth: { uid: UID, token: { role: 'agent', tenantId: TENANT } } });

async function call(db, data) {
  globalThis.__fakeDb = db;
  return undo.__handler(data, ctx());
}
async function code(fn) {
  try { await fn(); return null; } catch (e) { return e.code; }
}
async function message(fn) {
  try { await fn(); return null; } catch (e) { return e.message; }
}

describe('findImportedDocs — both conditions, applied and re-checked', () => {
  it('returns only this agent imported policies', () => {
    const db = createFakeDb();
    seedPolicy(db, { id: 'a', policyNumber: 'A1', exportDate: '2026-09-15' });
    seedPolicy(db, { id: 'b', policyNumber: 'B1', exportDate: '2026-09-15', agentId: 'other-agent' });
    // An organically logged policy: same agent, no import source.
    db._seed(`${P}/c`, { policyNumber: 'C1', agentId: UID });
    return findImportedDocs(db, TENANT, UID, SOURCE).then(({ docs }) => {
      expect(docs.map((d) => d.policyNumber)).toEqual(['A1']);
    });
  });
});

describe('findLastImportBatch', () => {
  it('picks the latest export date and splits created from updated', async () => {
    const db = createFakeDb();
    // Import 1 (15 Sep) created P1 and P2. Import 2 (30 Sep) created P3 and
    // updated P1 and P2 — which is what a real second import looks like.
    seedPolicy(db, { id: '1', policyNumber: 'P1', exportDate: '2026-09-30', actions: ['update'] });
    seedPolicy(db, { id: '2', policyNumber: 'P2', exportDate: '2026-09-30', actions: ['update'] });
    seedPolicy(db, { id: '3', policyNumber: 'P3', exportDate: '2026-09-30', actions: ['create'] });

    const b = await findLastImportBatch(db, TENANT, UID, SOURCE);
    expect(b.exportDate).toBe('2026-09-30');
    expect(b.created.map((d) => d.policyNumber)).toEqual(['P3']);
    expect(b.updated.map((d) => d.policyNumber)).toEqual(['P1', 'P2']);
    expect(b.totalImported).toBe(3);
  });

  it('ignores policies carrying an OLDER export date', async () => {
    // A policy the last import did not touch keeps its old export date, because an
    // unchanged policy is skipped and never written.
    const db = createFakeDb();
    seedPolicy(db, { id: '1', policyNumber: 'OLD', exportDate: '2026-09-15' });
    seedPolicy(db, { id: '2', policyNumber: 'NEW', exportDate: '2026-09-30' });
    const b = await findLastImportBatch(db, TENANT, UID, SOURCE);
    expect(b.created.map((d) => d.policyNumber)).toEqual(['NEW']);
    expect(b.updated).toEqual([]);
  });

  it('sorts export dates chronologically, not by insertion order', async () => {
    const db = createFakeDb();
    seedPolicy(db, { id: '1', policyNumber: 'DEC', exportDate: '2026-12-01' });
    seedPolicy(db, { id: '2', policyNumber: 'SEP', exportDate: '2026-09-30' });
    seedPolicy(db, { id: '3', policyNumber: 'OCT', exportDate: '2026-10-15' });
    const b = await findLastImportBatch(db, TENANT, UID, SOURCE);
    expect(b.exportDate).toBe('2026-12-01');
    expect(b.created.map((d) => d.policyNumber)).toEqual(['DEC']);
  });

  it('classes a policy with no history at this export date as NOT created', async () => {
    // Absence of a create record is not evidence of one. Guessing here is what
    // turns an undo into a deletion of something the import never added.
    const db = createFakeDb();
    seedPolicy(db, { id: '1', policyNumber: 'P1', exportDate: '2026-09-30', actions: [] });
    const b = await findLastImportBatch(db, TENANT, UID, SOURCE);
    expect(b.created).toEqual([]);
    expect(b.updated.map((d) => d.policyNumber)).toEqual(['P1']);
  });

  it('returns an empty batch when nothing was ever imported', async () => {
    const b = await findLastImportBatch(createFakeDb(), TENANT, UID, SOURCE);
    expect(b).toMatchObject({ exportDate: null, created: [], updated: [], totalImported: 0 });
  });
});

describe('deletePolicies', () => {
  it('removes the policy and its history together', async () => {
    const db = createFakeDb();
    seedPolicy(db, { id: '1', policyNumber: 'P1', exportDate: '2026-09-15', actions: ['create', 'update'] });
    const r = await deletePolicies(db, TENANT, [{ id: '1', policyNumber: 'P1' }]);
    expect(r).toEqual({ deleted: 1, historyDeleted: 2 });
    expect([...db._docs.keys()].filter((k) => k.includes('/policies/'))).toEqual([]);
  });

  it('stays under the batch limit for 229 policies', async () => {
    const db = createFakeDb();
    const docs = [];
    for (let i = 0; i < 229; i += 1) {
      seedPolicy(db, { id: `p${i}`, policyNumber: `P${i}`, exportDate: '2026-09-15' });
      docs.push({ id: `p${i}`, policyNumber: `P${i}` });
    }
    const r = await deletePolicies(db, TENANT, docs);
    expect(r).toEqual({ deleted: 229, historyDeleted: 229 });
    expect(db._commits.length).toBeGreaterThan(1);
    expect(Math.max(...db._commits)).toBeLessThanOrEqual(MAX_WRITES);
  });

  it('leaves another agent policies untouched', async () => {
    const db = createFakeDb();
    seedPolicy(db, { id: '1', policyNumber: 'MINE', exportDate: '2026-09-15' });
    seedPolicy(db, { id: '2', policyNumber: 'THEIRS', exportDate: '2026-09-15', agentId: 'other' });
    await deletePolicies(db, TENANT, [{ id: '1', policyNumber: 'MINE' }]);
    expect(db._docs.has(`${P}/2`)).toBe(true);
  });
});

describe('countOrphanedHistory', () => {
  it('reports 0 after a clean delete', async () => {
    const db = createFakeDb();
    seedPolicy(db, { id: '1', policyNumber: 'P1', exportDate: '2026-09-15' });
    const ids = [{ id: '1', policyNumber: 'P1' }];
    await deletePolicies(db, TENANT, ids);
    expect(await countOrphanedHistory(db, TENANT, ids)).toEqual({ orphaned: 0, orphanedUnder: [] });
  });

  it('DETECTS history that outlived its parent', async () => {
    // Firestore does not cascade. This is the failure the check exists for, and a
    // check that cannot produce a non-zero answer proves nothing.
    const db = createFakeDb();
    seedPolicy(db, { id: '1', policyNumber: 'P1', exportDate: '2026-09-15', actions: ['create', 'update'] });
    db._docs.delete(`${P}/1`); // parent removed, subcollection left behind
    const r = await countOrphanedHistory(db, TENANT, [{ id: '1', policyNumber: 'P1' }]);
    expect(r.orphaned).toBe(2);
    expect(r.orphanedUnder).toEqual([{ id: '1', policyNumber: 'P1', count: 2 }]);
  });
});

describe('undoLastPortfolioImport — the callable', () => {
  function seedFirstImport(db, n = 3) {
    for (let i = 0; i < n; i += 1) {
      seedPolicy(db, { id: `p${i}`, policyNumber: `P${i}`, exportDate: '2026-09-15' });
    }
  }

  it('DRY RUN by default: counts, and writes nothing', async () => {
    const db = dbWithUser();
    seedFirstImport(db);
    const before = db._docs.size;

    const r = await call(db, {});
    expect(r).toMatchObject({
      dryRun: true, exportDate: '2026-09-15', found: 3, notRemovable: 0, deleted: 0,
    });
    expect(r.policyNumbers).toEqual(['P0', 'P1', 'P2']);
    expect(db._docs.size).toBe(before);
  });

  it('a missing confirm flag does NOT delete', async () => {
    // The destructive path must be opt-in. A forgotten flag returns a count.
    const db = dbWithUser();
    seedFirstImport(db);
    await call(db, { exportDate: '2026-09-15' });
    expect(db._docs.has(`${P}/p0`)).toBe(true);
    await call(db, { confirm: 'true', exportDate: '2026-09-15' }); // string, not boolean
    expect(db._docs.has(`${P}/p0`)).toBe(true);
  });

  it('deletes on confirm, and reports 0 orphaned history', async () => {
    const db = dbWithUser();
    seedFirstImport(db);
    const r = await call(db, { confirm: true, exportDate: '2026-09-15' });
    expect(r).toMatchObject({
      dryRun: false, found: 3, deleted: 3, historyDeleted: 3, orphanedHistory: 0,
    });
    expect([...db._docs.keys()].filter((k) => k.startsWith(`${P}/`))).toEqual([]);
  });

  it('refuses when the echoed export date is stale', async () => {
    // Another import landed between the dialog and the delete, so the count the
    // agent agreed to describes a batch that is no longer the last one.
    const db = dbWithUser();
    seedFirstImport(db);
    expect(await code(() => call(db, { confirm: true, exportDate: '2026-08-01' })))
      .toBe('failed-precondition');
    expect(db._docs.has(`${P}/p0`)).toBe(true);
  });

  it('refuses a confirm with no export date at all', async () => {
    const db = dbWithUser();
    seedFirstImport(db);
    expect(await code(() => call(db, { confirm: true }))).toBe('failed-precondition');
    expect(db._docs.has(`${P}/p0`)).toBe(true);
  });

  it('refuses when the last import ALSO updated existing policies', async () => {
    // This is the whole reason undo is not "delete by exportDate". The updates
    // overwrote values nothing stored, so half an undo is worse than none.
    const db = dbWithUser();
    seedPolicy(db, { id: 'n1', policyNumber: 'NEW1', exportDate: '2026-09-30', actions: ['create'] });
    seedPolicy(db, { id: 'o1', policyNumber: 'OLD1', exportDate: '2026-09-30', actions: ['update'] });

    const msg = await message(() => call(db, { confirm: true, exportDate: '2026-09-30' }));
    expect(msg).toMatch(/added 1 policies and updated 1/);
    expect(msg).toMatch(/cannot put the other 1 back/);
    expect(db._docs.has(`${P}/n1`)).toBe(true); // nothing deleted
    expect(db._docs.has(`${P}/o1`)).toBe(true);
  });

  it('refuses an import that only updated, and says why', async () => {
    const db = dbWithUser();
    seedPolicy(db, { id: 'o1', policyNumber: 'OLD1', exportDate: '2026-09-30', actions: ['update'] });
    const msg = await message(() => call(db, {}));
    expect(msg).toMatch(/only updated 1 you already had/);
    expect(msg).toMatch(/never saved/);
  });

  it('refuses when the agent has no imported policies', async () => {
    const db = dbWithUser();
    expect(await code(() => call(db, {}))).toBe('not-found');
  });

  it('undoes only the LATEST import, leaving the earlier one alone', async () => {
    const db = dbWithUser();
    seedPolicy(db, { id: 'old', policyNumber: 'OLD', exportDate: '2026-09-15' });
    seedPolicy(db, { id: 'new', policyNumber: 'NEW', exportDate: '2026-09-30' });
    const r = await call(db, { confirm: true, exportDate: '2026-09-30' });
    expect(r.deleted).toBe(1);
    expect(db._docs.has(`${P}/old`)).toBe(true);
    expect(db._docs.has(`${P}/new`)).toBe(false);
  });

  it('never touches another agent policies, even at the same export date', async () => {
    const db = dbWithUser();
    seedPolicy(db, { id: 'mine', policyNumber: 'MINE', exportDate: '2026-09-15' });
    seedPolicy(db, { id: 'theirs', policyNumber: 'THEIRS', exportDate: '2026-09-15', agentId: 'other-agent' });
    const r = await call(db, { confirm: true, exportDate: '2026-09-15' });
    expect(r.deleted).toBe(1);
    expect(db._docs.has(`${P}/theirs`)).toBe(true);
  });

  it('never touches an organically logged policy', async () => {
    const db = dbWithUser();
    seedPolicy(db, { id: 'imported', policyNumber: 'IMP', exportDate: '2026-09-15' });
    db._seed(`${P}/organic`, { policyNumber: 'ORG', agentId: UID, exportDate: '2026-09-15' });
    await call(db, { confirm: true, exportDate: '2026-09-15' });
    expect(db._docs.has(`${P}/organic`)).toBe(true);
  });

  it('applies the same identity rules as the import (ruling 2)', async () => {
    const db = dbWithUser();
    seedFirstImport(db);
    globalThis.__fakeDb = db;
    // A body carrying uid is rejected before anything is read, let alone deleted.
    expect(await code(() => undo.__handler({ uid: 'someone-else', confirm: true }, ctx())))
      .toBe('invalid-argument');
    expect(await code(() => undo.__handler({}, { auth: null }))).toBe('unauthenticated');
    expect(db._docs.has(`${P}/p0`)).toBe(true);
  });

  it('truncates the displayed policy numbers but not the count', async () => {
    const db = dbWithUser();
    seedFirstImport(db, undo.SAMPLE_SIZE + 10);
    const r = await call(db, {});
    expect(r.found).toBe(undo.SAMPLE_SIZE + 10);
    expect(r.policyNumbers).toHaveLength(undo.SAMPLE_SIZE);
    expect(r.policyNumbersTruncated).toBe(true);
  });
});
