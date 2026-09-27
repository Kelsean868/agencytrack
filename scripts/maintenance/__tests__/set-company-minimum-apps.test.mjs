import { describe, it, expect } from 'vitest';
import {
  parseArgs, pendingChanges, run, TARGET, UPDATED_BY, COMPANY_MIN_APPS,
} from '../set-company-minimum-apps.mjs';

// Company minimum ruling (27 Sep 2026): annualApps 40, tenure bands confirmed.

// Production shape read 27 Sep 2026 (values illustrative, keys real).
const PROD_FIXTURE = () => ({
  annualApps: 42,
  annualAPI: 200000,
  persistency: 90,
  tenureApiFloors: {
    band0_lt12: 150000, band12_to_24: 200000, band25_to_36: 250000,
    band37_to_48: 300000, band49_to_60: 400000, band_gt60: 500000,
  },
  tenureApiFloorsProvisional: true,
  weeklyActivityFloors: { api: 4800, contacts: 20, ffi: 5 },
  updatedBy: 'seed:tenure-api-floors-2026-05-20',
  updatedAt: 'old-ts',
});

// Minimal in-memory Firestore: one doc path, get / update with merge semantics.
function fakeDb(initial) {
  const store = new Map();
  if (initial) store.set('tenants/t1/config/companyMinimums', initial);
  const calls = { update: 0 };
  return {
    calls,
    store,
    doc: (p) => ({
      get: async () => ({ exists: store.has(p), data: () => (store.has(p) ? structuredClone(store.get(p)) : undefined) }),
      update: async (payload) => {
        calls.update += 1;
        if (!store.has(p)) throw new Error('NOT_FOUND');
        store.set(p, { ...store.get(p), ...payload });
      },
    }),
  };
}

const quiet = () => {};
const TS = 'server-ts';

describe('parseArgs', () => {
  it('requires --tenant; dry run unless --apply', () => {
    expect(parseArgs(['--tenant', 't1'])).toEqual({ tenant: 't1', apply: false });
    expect(parseArgs(['--tenant=t1', '--apply'])).toEqual({ tenant: 't1', apply: true });
    expect(() => parseArgs([])).toThrow(/--tenant/);
    expect(() => parseArgs(['--apply'])).toThrow(/--tenant/);
    expect(() => parseArgs(['--tenant', '--apply'])).toThrow(/--tenant/);
    expect(() => parseArgs(['--tenant', 't1', '--execute'])).toThrow(/unknown argument/);
  });
});

describe('run — dry run', () => {
  it('writes nothing and reports the two pending keys', async () => {
    const db = fakeDb(PROD_FIXTURE());
    const lines = [];
    const res = await run({ db, tenant: 't1', apply: false, serverTimestamp: () => TS, log: (l) => lines.push(l) });
    expect(res.status).toBe('dry-run');
    expect(db.calls.update).toBe(0);
    expect(db.store.get('tenants/t1/config/companyMinimums')).toEqual(PROD_FIXTURE());
    expect(pendingChanges(res.before)).toEqual(['annualApps', 'tenureApiFloorsProvisional']);
    const out = lines.join('\n');
    expect(out).toMatch(/annualApps\s+42 → 40/);
    expect(out).toMatch(/tenureApiFloorsProvisional\s+true → false/);
  });
});

describe('run — apply', () => {
  it('changes only annualApps + tenureApiFloorsProvisional (plus the stamp)', async () => {
    const db = fakeDb(PROD_FIXTURE());
    const res = await run({ db, tenant: 't1', apply: true, serverTimestamp: () => TS, log: quiet });
    expect(res.status).toBe('applied');
    expect(db.calls.update).toBe(1);

    const before = PROD_FIXTURE();
    const after = db.store.get('tenants/t1/config/companyMinimums');
    expect(after.annualApps).toBe(COMPANY_MIN_APPS);
    expect(after.tenureApiFloorsProvisional).toBe(false);
    expect(after.updatedBy).toBe(UPDATED_BY);
    expect(after.updatedAt).toBe(TS);

    const changed = Object.keys({ ...before, ...after })
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .sort();
    expect(changed).toEqual(['annualApps', 'tenureApiFloorsProvisional', 'updatedAt', 'updatedBy']);
  });

  it('is a no-op when already at the target', async () => {
    const db = fakeDb({ ...PROD_FIXTURE(), ...TARGET });
    const res = await run({ db, tenant: 't1', apply: true, serverTimestamp: () => TS, log: quiet });
    expect(res.status).toBe('noop');
    expect(db.calls.update).toBe(0);
  });

  it('refuses to create a missing doc (wrong --tenant)', async () => {
    const db = fakeDb(null);
    const res = await run({ db, tenant: 't1', apply: true, serverTimestamp: () => TS, log: quiet });
    expect(res.status).toBe('missing');
    expect(db.calls.update).toBe(0);
    expect(db.store.size).toBe(0);
  });
});
