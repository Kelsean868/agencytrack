// P2c (audit 2026-09-24 BUG-07) — financing writes are atomic.
//
// A small in-memory Firestore with OPTIMISTIC CONCURRENCY stands in for the SDK:
// a transaction records the version of every doc it reads, buffers its writes, and
// at commit either applies ALL writes (versions unchanged) or retries the update
// function (a read doc moved underneath it) — the same contract the real
// runTransaction gives. Errors thrown by the update function abort with nothing
// written. `store.failWritesTo` injects a failure (network drop / rules denial) on
// any write op — a setDoc or a transaction commit — that touches that path, so
// "neither doc changes" can be asserted directly. A non-atomic write-then-transition
// sequence would persist its first write and fail the second; one commit cannot.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const store = {
    docs: new Map(),          // path → { data, version }
    commits: 0,
    failWritesTo: null,       // path: any write op touching it throws
  };
  return { store, auth: { currentUser: { uid: 'mgr-uid' } } };
});
const { store } = hoisted;

vi.mock('../../firebase', () => ({ db: {}, auth: hoisted.auth }));

vi.mock('firebase/firestore', () => {
  const snapOf = (path, rec) => ({
    id: path.split('/').pop(),
    exists: () => !!rec,
    data: () => (rec ? structuredClone(rec.data) : undefined),
  });
  const apply = (path, data, opts) => {
    const prev = store.docs.get(path);
    const next = opts?.merge && prev ? { ...prev.data, ...data } : { ...data };
    store.docs.set(path, { data: next, version: (prev?.version ?? 0) + 1 });
  };
  return {
    doc: (db, path) => ({ path, id: path.split('/').pop() }),
    getDoc: async (ref) => snapOf(ref.path, store.docs.get(ref.path)),
    setDoc: async (ref, data, opts) => {
      if (store.failWritesTo === ref.path) throw new Error('Missing or insufficient permissions.');
      store.commits++;
      apply(ref.path, data, opts);
    },
    collection: () => ({}), query: () => ({}), where: () => ({}), getDocs: async () => ({ docs: [] }),
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    Timestamp: { now: () => ({ __ts: Date.now() }) },
    runTransaction: async (db, fn) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const readVersions = new Map();
        const writes = [];
        const tx = {
          get: async (ref) => {
            await Promise.resolve(); // yield so concurrent transactions interleave
            const rec = store.docs.get(ref.path);
            readVersions.set(ref.path, rec?.version ?? 0);
            return snapOf(ref.path, rec);
          },
          set: (ref, data, opts) => { writes.push([ref.path, data, opts]); return tx; },
        };
        const result = await fn(tx); // a throw here propagates, nothing written
        const conflict = [...readVersions].some(([p, v]) => (store.docs.get(p)?.version ?? 0) !== v);
        if (conflict) continue; // retry with fresh reads
        if (writes.some(([p]) => p === store.failWritesTo)) {
          throw new Error('Missing or insufficient permissions.');
        }
        store.commits++;
        for (const [p, d, o] of writes) apply(p, d, o);
        return result;
      }
      throw new Error('transaction: too much contention');
    },
  };
});

import { transitionFinancingStatus, reconcileFinancing } from '../financingService';

const T = 't1';
const A = 'agent-1';
const TERMS = `tenants/${T}/financingTerms/${A}`;
const RECON = `tenants/${T}/financingReconciliation/${A}_2026`;
const USER  = `tenants/${T}/users/${A}`;
const BM1 = { role: 'branch_manager', name: 'BM One' };
const BM2 = { role: 'branch_manager', name: 'BM Two' };

const RECON_OWING = {
  totalFinancingDrawn: 30000, totalOffsets: 11800, closingBalance: 18200,
  waiverApplied: 12000, serviceMet: true, serviceMonths: 12,
  reconciledPosition: 6200, outcome: 'owing', surplusPaid: 0, triggeredBy: 'auto_month12',
};

function seedTerms(status, extra = {}) {
  store.docs.set(TERMS, {
    version: 1,
    data: {
      agentId: A, tenantId: T, agreedMonthlyFinancing: 5000, currentMonthlyFinancing: 5000,
      validatingAPI: 30000, effectiveDate: '2025-01-01', financingStatus: status, statusHistory: [],
      ...extra,
    },
  });
}
const terms = () => store.docs.get(TERMS)?.data;

beforeEach(() => {
  store.docs.clear();
  store.commits = 0;
  store.failWritesTo = null;
  hoisted.auth.currentUser = { uid: 'mgr-uid' };
  store.docs.set(USER, { version: 1, data: { branchId: 'branchA', unitId: 'umA1' } });
});

describe('transitionFinancingStatus — concurrent moves (BUG-07)', () => {
  it('same move twice at once: one wins, the other gets a clear error, history has ONE entry', async () => {
    seedTerms('not_on_financing');
    const results = await Promise.allSettled([
      transitionFinancingStatus(T, A, 'on_financing', BM1),
      transitionFinancingStatus(T, A, 'on_financing', BM2),
    ]);
    const ok  = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(bad[0].reason.message).toMatch(/transitionFinancingStatus: already in "on_financing"/);
    expect(terms().financingStatus).toBe('on_financing');
    expect(terms().statusHistory).toHaveLength(1);
    expect(store.commits).toBe(1);
  });

  it('diverging moves from reconciling: one wins, the loser re-checks legality and is refused', async () => {
    seedTerms('reconciling');
    const results = await Promise.allSettled([
      transitionFinancingStatus(T, A, 'cleared', BM1),
      transitionFinancingStatus(T, A, 'post_financing_repayment', BM2),
    ]);
    const ok  = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(bad[0].reason.message).toMatch(/transitionFinancingStatus: illegal transition/);
    const winner = ok[0].value.financingStatus;
    expect(terms().financingStatus).toBe(winner);
    expect(terms().statusHistory).toEqual([expect.objectContaining({ from: 'reconciling', to: winner })]);
  });

  it('stamps branchId / unitId from the agent user doc inside the transaction', async () => {
    seedTerms('not_on_financing');
    await transitionFinancingStatus(T, A, 'on_financing', BM1);
    expect(terms()).toMatchObject({ branchId: 'branchA', unitId: 'umA1' });
  });
});

describe('reconcileFinancing — record + status move are one commit (BUG-07)', () => {
  it('success: record and terms status land together in ONE commit', async () => {
    seedTerms('reconciling');
    await reconcileFinancing(T, A, 2026, RECON_OWING, BM1);
    expect(store.commits).toBe(1);
    expect(store.docs.get(RECON).data).toMatchObject({
      outcome: 'owing', reconciledPosition: 6200, branchId: 'branchA', unitId: 'umA1',
    });
    expect(terms().financingStatus).toBe('post_financing_repayment');
    expect(terms().statusHistory).toEqual([
      expect.objectContaining({ from: 'reconciling', to: 'post_financing_repayment', note: 'K6 reconciliation — owing (auto_month12)' }),
    ]);
  });

  it('commit failure mid-way: NEITHER the record nor the terms doc changes', async () => {
    seedTerms('reconciling');
    const before = structuredClone(terms());
    store.failWritesTo = TERMS; // the status move is refused
    await expect(reconcileFinancing(T, A, 2026, RECON_OWING, BM1)).rejects.toThrow(/insufficient permissions/);
    expect(store.docs.has(RECON)).toBe(false);
    expect(terms()).toEqual(before);
  });

  it('status moved underneath (a concurrent clear): exactly one of the two lands, never half', async () => {
    seedTerms('reconciling');
    const results = await Promise.allSettled([
      transitionFinancingStatus(T, A, 'cleared', BM2),
      reconcileFinancing(T, A, 2026, RECON_OWING, BM1),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    if (store.docs.has(RECON)) {
      // Reconcile won: record + status move together; the clear was refused.
      expect(terms().financingStatus).toBe('post_financing_repayment');
      expect(results[0].status).toBe('rejected');
    } else {
      // The clear won: the reconcile re-read 'cleared' and wrote NOTHING.
      expect(terms().financingStatus).toBe('cleared');
      expect(results[1].reason.message).toMatch(/must be in 'reconciling'/);
    }
    expect(terms().statusHistory).toHaveLength(1);
  });

  it('precondition failure (not reconciling): nothing is written', async () => {
    seedTerms('on_financing');
    await expect(reconcileFinancing(T, A, 2026, RECON_OWING, BM1)).rejects.toThrow(/must be in 'reconciling'/);
    expect(store.docs.has(RECON)).toBe(false);
    expect(terms().financingStatus).toBe('on_financing');
    expect(store.commits).toBe(0);
  });
});
