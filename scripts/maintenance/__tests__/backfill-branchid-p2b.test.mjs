import { describe, it, expect } from 'vitest';
import {
  planDocUpdate,
  planBackfill,
  formatSummary,
  parseArgs,
} from '../backfill-branchid-p2b.mjs';

// Fixture tenant: two branches, two units, one BM owner, one agent with no branch.
const USERS = [
  { id: 'agentA1', data: { role: 'agent', branchId: 'branchA', unitId: 'umA1' } },
  { id: 'agentB1', data: { role: 'agent', branchId: 'branchB', unitId: 'umB1' } },
  { id: 'umA1', data: { role: 'unit_manager', branchId: 'branchA', unitId: 'umA1' } },
  { id: 'bmA', data: { role: 'branch_manager', branchId: 'branchA' } },
  { id: 'agentNoBranch', data: { role: 'agent', unitId: 'umA1' } },
  { id: 'agentNoUnit', data: { role: 'agent', branchId: 'branchA' } },
];
const usersById = new Map(USERS.map((u) => [u.id, u.data]));

describe('planDocUpdate', () => {
  it('missing field → set from the agent user doc (both fields)', () => {
    const p = planDocUpdate('financing', 'agentA1_2026_01', { agentId: 'agentA1' }, usersById);
    expect(p).toMatchObject({ outcome: 'update', patch: { branchId: 'branchA', unitId: 'umA1' } });
  });

  it('only the missing field is written', () => {
    const p = planDocUpdate('policies', 'p1', { agentId: 'agentA1', branchId: 'branchA' }, usersById);
    expect(p.outcome).toBe('update');
    expect(p.patch).toEqual({ unitId: 'umA1' });
  });

  it('financingTerms resolves the agent from the doc ID when agentId is absent', () => {
    const p = planDocUpdate('financingTerms', 'agentB1', {}, usersById);
    expect(p).toMatchObject({ outcome: 'update', patch: { branchId: 'branchB', unitId: 'umB1' } });
  });

  it('existing same value → skipped as already OK', () => {
    const p = planDocUpdate('policies', 'p2', { agentId: 'agentA1', branchId: 'branchA', unitId: 'umA1' }, usersById);
    expect(p.outcome).toBe('ok');
    expect(p.patch).toBeUndefined();
  });

  it('conflicting existing branchId → reported, not written', () => {
    const p = planDocUpdate('policies', 'p3', { agentId: 'agentA1', branchId: 'branchB' }, usersById);
    expect(p.outcome).toBe('conflict');
    expect(p.patch).toBeUndefined();
    expect(p.reason).toMatch(/branchId doc=branchB agent=branchA/);
  });

  it('conflicting existing unitId → reported, not written', () => {
    const p = planDocUpdate('financing', 'f1', { agentId: 'agentA1', unitId: 'umX' }, usersById);
    expect(p.outcome).toBe('conflict');
    expect(p.reason).toMatch(/unitId doc=umX agent=umA1/);
  });

  it('unresolvable agent → reported with a reason', () => {
    expect(planDocUpdate('policies', 'p4', { agentId: 'ghost' }, usersById))
      .toMatchObject({ outcome: 'unresolvable', reason: 'agent user doc not found' });
    expect(planDocUpdate('policies', 'p5', { agentId: 'agentNoBranch' }, usersById))
      .toMatchObject({ outcome: 'unresolvable', reason: 'agent user doc has no branchId' });
    expect(planDocUpdate('policies', 'p6', {}, usersById))
      .toMatchObject({ outcome: 'unresolvable', reason: 'doc has no agentId' });
    expect(planDocUpdate('policies', 'p7', { agentId: 'agentNoUnit' }, usersById))
      .toMatchObject({ outcome: 'unresolvable', reason: 'agent user doc has no unitId (role agent)' });
  });

  it('BM owner (no unit by role) → branchId only, flagged branch-only, not unresolvable', () => {
    const p = planDocUpdate('policies', 'p8', { agentId: 'bmA' }, usersById);
    expect(p).toMatchObject({ outcome: 'update', patch: { branchId: 'branchA' }, branchOnly: true });
    expect('unitId' in p.patch).toBe(false);
    // Already has the branch: nothing to write, still OK.
    expect(planDocUpdate('policies', 'p9', { agentId: 'bmA', branchId: 'branchA', unitId: null }, usersById))
      .toMatchObject({ outcome: 'ok', branchOnly: true });
  });

  it('UM owner → unit is their own uid', () => {
    const p = planDocUpdate('financingTerms', 'umA1', { agentId: 'umA1' }, usersById);
    expect(p.patch).toEqual({ branchId: 'branchA', unitId: 'umA1' });
  });
});

describe('planBackfill', () => {
  const docs = {
    policies: [
      { id: 'p-missing', data: { agentId: 'agentA1' } },
      { id: 'p-ok', data: { agentId: 'agentB1', branchId: 'branchB', unitId: 'umB1' } },
      { id: 'p-conflict', data: { agentId: 'agentA1', branchId: 'branchB' } },
    ],
    financingTerms: [{ id: 'agentB1', data: { agentId: 'agentB1' } }],
    financing: [{ id: 'ghost_2026_01', data: { agentId: 'ghost' } }],
    financingReconciliation: [],
  };

  it('counts per collection and totals; lists updates, conflicts and unresolvable', () => {
    const plan = planBackfill(docs, USERS);
    expect(plan.perCollection.policies).toEqual({ scanned: 3, ok: 1, update: 1, unresolvable: 0, conflict: 1 });
    expect(plan.perCollection.financingTerms).toEqual({ scanned: 1, ok: 0, update: 1, unresolvable: 0, conflict: 0 });
    expect(plan.perCollection.financing).toEqual({ scanned: 1, ok: 0, update: 0, unresolvable: 1, conflict: 0 });
    expect(plan.totals).toEqual({ scanned: 5, ok: 1, update: 2, unresolvable: 1, conflict: 1 });
    expect(plan.updates.map((u) => `${u.collection}/${u.id}`)).toEqual(['policies/p-missing', 'financingTerms/agentB1']);
    expect(plan.conflicts.map((c) => c.id)).toEqual(['p-conflict']);
    expect(plan.unresolvable).toEqual([{ collection: 'financing', id: 'ghost_2026_01', agentId: 'ghost', reason: 'agent user doc not found' }]);
  });

  it('is idempotent: applying the updates then re-planning yields no updates', () => {
    const first = planBackfill(docs, USERS);
    const applied = JSON.parse(JSON.stringify(docs));
    for (const u of first.updates) {
      const d = applied[u.collection].find((x) => x.id === u.id);
      Object.assign(d.data, u.patch);
    }
    const second = planBackfill(applied, USERS);
    expect(second.updates).toEqual([]);
    expect(second.totals.ok).toBe(first.totals.ok + first.totals.update);
  });

  it('summary names every category and the --apply guidance', () => {
    const plan = planBackfill(docs, USERS);
    const text = formatSummary(plan, { tenantId: 't1', apply: false });
    expect(text).toContain('Summary: scanned 5 · already OK 1 · would update 2 · cannot resolve 1 · conflicts 1');
    expect(text).toContain('financing/ghost_2026_01  agentId=ghost  reason: agent user doc not found');
    expect(text).toContain('policies/p-conflict');
    expect(text).toContain('Fix the "cannot resolve" / "conflicts" rows before --apply');
  });
});

describe('parseArgs', () => {
  it('dry run by default; --tenant required by main; --apply opt-in', () => {
    expect(parseArgs([])).toEqual({ apply: false, tenant: null });
    expect(parseArgs(['--tenant', 'tatillife_south'])).toEqual({ apply: false, tenant: 'tatillife_south' });
    expect(parseArgs(['--tenant=t1', '--apply'])).toEqual({ apply: true, tenant: 't1' });
    expect(() => parseArgs(['--execute'])).toThrow(/unknown argument/);
  });
});
