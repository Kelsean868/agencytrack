import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  ALLOWED_KEYS,
  financingDocProblems,
  userCreateProblem,
  planDryRun,
  formatDryRun,
  parseArgs,
} from '../p2c-financing-dryrun.mjs';

describe('financingDocProblems', () => {
  it('a service-shaped doc in each collection is clean', () => {
    for (const c of Object.keys(ALLOWED_KEYS)) {
      const data = Object.fromEntries(ALLOWED_KEYS[c].map((k) => [k, k === 'financingStatus' ? 'on_financing' : 0]));
      expect(financingDocProblems(c, data)).toEqual([]);
    }
  });

  it('flags unknown keys, a bad status, an out-of-range adjustmentPct and a string runningBalance', () => {
    expect(financingDocProblems('financingTerms', { agentId: 'a', financingStatus: 'on_financing', zz: 1 }))
      .toEqual(['unknown keys: zz']);
    expect(financingDocProblems('financingTerms', { agentId: 'a' }))
      .toEqual(['financingStatus missing is not a valid state']);
    expect(financingDocProblems('financing', { adjustmentPct: -2 })).toEqual(['adjustmentPct -2 outside [-1, 1]']);
    expect(financingDocProblems('financing', { adjustmentPct: 1 })).toEqual([]);
    expect(financingDocProblems('financing', { runningBalance: '100' })).toEqual(['runningBalance "100" is not a number']);
    expect(financingDocProblems('financing', { runningBalance: -500 })).toEqual([]);
  });
});

describe('userCreateProblem', () => {
  it('only active policy creators without a branchId are flagged', () => {
    expect(userCreateProblem({ role: 'agent' })).toMatch(/no branchId/);
    expect(userCreateProblem({ role: 'agent', active: false })).toBeNull();
    expect(userCreateProblem({ role: 'agent', branchId: 'b' })).toBeNull();
    expect(userCreateProblem({ role: 'sales_manager' })).toBeNull();
  });
});

describe('planDryRun + formatDryRun', () => {
  it('counts per collection and reports CLEAN only when nothing fails', () => {
    const clean = planDryRun({ financingTerms: [{ id: 'a', data: { financingStatus: 'cleared' } }] }, []);
    expect(clean.totalWouldFail).toBe(0);
    expect(formatDryRun(clean, { tenantId: 't' })).toMatch(/CLEAN/);

    const dirty = planDryRun(
      { financing: [{ id: 'a_2026_01', data: { adjustmentPct: 1.5 } }] },
      [{ id: 'u1', data: { role: 'agent' } }],
    );
    expect(dirty.perCollection.financing).toEqual({ scanned: 1, wouldFail: 1 });
    expect(dirty.userProblems).toHaveLength(1);
    expect(formatDryRun(dirty, { tenantId: 't' })).toMatch(/NOT CLEAN/);
  });

  it('parseArgs has no write flag', () => {
    expect(parseArgs(['--tenant', 't'])).toEqual({ tenant: 't' });
    expect(() => parseArgs(['--apply'])).toThrow(/read-only/);
  });
});

// The allowlists are copied into firestore.rules (rules cannot import JS). Pin the
// two copies together so a change to one without the other fails here.
describe('allowlists mirror firestore.rules', () => {
  const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'); // scripts/maintenance/__tests__
  const rules = readFileSync(resolve(REPO_ROOT, 'firestore.rules'), 'utf8');
  const listFrom = (fn) => {
    const start = rules.indexOf(`function ${fn}()`);
    expect(start).toBeGreaterThan(-1);
    const open = rules.indexOf('hasOnly([', start);
    const close = rules.indexOf('])', open);
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(-1);
    return [...rules.slice(open, close).matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]).sort();
  };
  it.each([
    ['financingTerms', 'termsKeysAllowed'],
    ['financing', 'monthKeysAllowed'],
    ['financingReconciliation', 'reconKeysAllowed'],
  ])('%s', (collection, fn) => {
    expect(listFrom(fn)).toEqual([...ALLOWED_KEYS[collection]].sort());
  });
});
