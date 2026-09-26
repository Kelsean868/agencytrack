'use strict';

// BUG-09 (audit 2026-09-24) — the Sunday cron read the draft, checked its
// status, and only later wrote the aggregated draft — outside a transaction.
// A report that became `submitted` between the read and the write was
// silently overwritten. The fix moves the status check and the write into
// one `db.runTransaction`. These tests exercise `runAggregation` directly
// against a hand-built fake `db` (the module already takes `db` as an
// injected param for exactly this kind of test).

jest.mock('firebase-admin', () => ({
  firestore: { FieldValue: { serverTimestamp: () => '__SERVER_TIMESTAMP__' } },
}));

const { runAggregation, draftDocPath } = require('../aggregators/sundayDailyToWeekly');

const TENANT = 'tatillife_south';
const WEEK = '2026-05-10';

/**
 * A minimal fake Firestore: one users collection (role==agent), one
 * dailyActivity sub-collection per agent, and a draft doc store keyed by
 * path. `runTransaction` calls the callback with a `tx` whose `get`/`set`
 * delegate straight to the underlying doc ref — the same shape the real
 * Admin SDK transaction object exposes, so it pins the "check and write
 * happen inside one transaction" contract without needing the emulator.
 */
function makeFakeDb({ agents, dailyByAgent, draftStore }) {
  const store = { ...draftStore };

  function draftRef(path) {
    return {
      path,
      get: async () => ({ exists: store[path] !== undefined, data: () => store[path] }),
      set: (data, opts) => {
        store[path] = opts && opts.merge ? { ...(store[path] ?? {}), ...data } : data;
      },
    };
  }

  return {
    _store: store,
    collection: (path) => {
      if (path === `tenants/${TENANT}/users`) {
        return {
          where: (field, op, val) => ({
            get: async () => ({
              docs: agents
                .filter((a) => a[field] === val)
                .map((a) => ({ id: a.id, data: () => a })),
            }),
          }),
        };
      }
      const m = path.match(new RegExp(`^tenants/${TENANT}/users/([^/]+)/dailyActivity$`));
      if (m) {
        const entries = dailyByAgent[m[1]] ?? [];
        return { where: () => ({ get: async () => ({ empty: entries.length === 0, docs: entries.map((e) => ({ data: () => e })) }) }) };
      }
      throw new Error(`unexpected collection path in test: ${path}`);
    },
    doc: (path) => draftRef(path),
    runTransaction: async (cb) => {
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, data, opts) => ref.set(data, opts),
      };
      return cb(tx);
    },
  };
}

const DAILY_ENTRY = { weekStarting: WEEK, apps: 1, api: 1000 };

describe('runAggregation — BUG-09 transactional check-then-write', () => {
  test('draft with no existing doc: aggregates and writes (existing behavior preserved)', async () => {
    const db = makeFakeDb({
      agents: [{ id: 'agent-1', role: 'agent', name: 'Agent One' }],
      dailyByAgent: { 'agent-1': [DAILY_ENTRY] },
      draftStore: {},
    });

    const result = await runAggregation({ tenantId: TENANT, weekStarting: WEEK, db });

    expect(result).toEqual({ aggregated: 1, skippedEmpty: 0, skippedSubmitted: 0 });
    const path = draftDocPath(TENANT, 'agent-1', WEEK);
    expect(db._store[path].status).toBe('draft');
  });

  test('draft already submitted at transaction read-time is NOT overwritten', async () => {
    // Models the race: by the time the transaction's tx.get() actually reads
    // the doc (whether on the first attempt or after Firestore retries the
    // transaction on contention), the agent's submit has already landed.
    const path = draftDocPath(TENANT, 'agent-1', WEEK);
    const db = makeFakeDb({
      agents: [{ id: 'agent-1', role: 'agent', name: 'Agent One' }],
      dailyByAgent: { 'agent-1': [DAILY_ENTRY] },
      draftStore: { [path]: { status: 'submitted', someRealAgentData: true } },
    });

    const result = await runAggregation({ tenantId: TENANT, weekStarting: WEEK, db });

    expect(result).toEqual({ aggregated: 0, skippedEmpty: 0, skippedSubmitted: 1 });
    // The submitted doc must be untouched — no clobbering with the stale draft.
    expect(db._store[path]).toEqual({ status: 'submitted', someRealAgentData: true });
  });

  test('the read and the write happen inside runTransaction (not two separate calls)', async () => {
    const db = makeFakeDb({
      agents: [{ id: 'agent-1', role: 'agent', name: 'Agent One' }],
      dailyByAgent: { 'agent-1': [DAILY_ENTRY] },
      draftStore: {},
    });
    const spy = jest.spyOn(db, 'runTransaction');

    await runAggregation({ tenantId: TENANT, weekStarting: WEEK, db });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('empty daily entries: no draft write, not counted as submitted-skip', async () => {
    const db = makeFakeDb({
      agents: [{ id: 'agent-1', role: 'agent', name: 'Agent One' }],
      dailyByAgent: { 'agent-1': [] },
      draftStore: {},
    });

    const result = await runAggregation({ tenantId: TENANT, weekStarting: WEEK, db });

    expect(result).toEqual({ aggregated: 0, skippedEmpty: 1, skippedSubmitted: 0 });
  });
});
