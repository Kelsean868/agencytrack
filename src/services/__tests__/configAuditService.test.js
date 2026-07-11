import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ mockGetDocs: vi.fn(), autoId: 0 }));

vi.mock('firebase/firestore', () => ({
  collection: (_db, path) => ({ __col: path }),
  doc: (a) => ({ __ref: `${a.__col}/auto${(hoisted.autoId += 1)}`, __col: a.__col }),
  serverTimestamp: () => ({ _type: 'SERVER_TS' }),
  query: (col, ...clauses) => ({ __col: col.__col, __clauses: clauses }),
  orderBy: (field, dir) => ({ __orderBy: [field, dir] }),
  limit: (n) => ({ __limit: n }),
  getDocs: (...args) => hoisted.mockGetDocs(...args),
}));

import { buildAuditEntry, addAuditEntryToBatch, getConfigAudit } from '../configAuditService';

const ACTOR = { uid: 'u9', name: 'Nine' };

beforeEach(() => {
  hoisted.mockGetDocs.mockReset();
  hoisted.autoId = 0;
});

describe('buildAuditEntry', () => {
  it('builds the base shape with who/whoName from actor and a serverTimestamp at', () => {
    const e = buildAuditEntry({ settingId: 'k', section: 'sec', from: 'A', to: 'B', actor: ACTOR });
    expect(e).toMatchObject({
      settingId: 'k',
      section: 'sec',
      from: 'A',
      to: 'B',
      who: 'u9',
      whoName: 'Nine',
    });
    expect(e.at).toBeDefined();
    expect(e).not.toHaveProperty('correction');
  });

  it('includes correction when provided (slice-2 reserved field)', () => {
    const e = buildAuditEntry({
      settingId: 'k',
      section: 'sec',
      from: 'A',
      to: 'B',
      actor: ACTOR,
      correction: 'fat-fingered the threshold',
    });
    expect(e.correction).toBe('fat-fingered the threshold');
  });

  it('omits correction when falsy/absent', () => {
    expect(buildAuditEntry({ settingId: 'k', section: 's', from: null, to: 'x', actor: ACTOR, correction: '' }))
      .not.toHaveProperty('correction');
  });

  it('tolerates a missing actor (who/whoName → null)', () => {
    const e = buildAuditEntry({ settingId: 'k', section: 's', from: null, to: 'x' });
    expect(e.who).toBe(null);
    expect(e.whoName).toBe(null);
  });
});

describe('addAuditEntryToBatch', () => {
  it('sets the entry on a fresh auto-id ref under configAudit', () => {
    const batch = { set: vi.fn() };
    const entry = buildAuditEntry({ settingId: 'k', section: 's', from: 'A', to: 'B', actor: ACTOR });
    const ref = addAuditEntryToBatch(batch, 't1', entry);
    expect(ref.__col).toBe('tenants/t1/configAudit');
    expect(batch.set).toHaveBeenCalledWith(ref, entry);
  });
});

describe('getConfigAudit', () => {
  it('missing tenantId → [] (no query)', async () => {
    expect(await getConfigAudit('')).toEqual([]);
    expect(hoisted.mockGetDocs).not.toHaveBeenCalled();
  });

  it('read error → []', async () => {
    hoisted.mockGetDocs.mockRejectedValue(new Error('boom'));
    expect(await getConfigAudit('t1')).toEqual([]);
  });

  it('maps docs to {id, ...data}, ordered newest-first with the default limit', async () => {
    hoisted.mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'a', data: () => ({ settingId: 'x', to: 'ON' }) },
        { id: 'b', data: () => ({ settingId: 'y', to: 'OFF' }) },
      ],
    });
    const out = await getConfigAudit('t1');
    expect(out).toEqual([
      { id: 'a', settingId: 'x', to: 'ON' },
      { id: 'b', settingId: 'y', to: 'OFF' },
    ]);
    const q = hoisted.mockGetDocs.mock.calls[0][0];
    expect(q.__col).toBe('tenants/t1/configAudit');
    expect(q.__clauses).toContainEqual({ __orderBy: ['at', 'desc'] });
    expect(q.__clauses).toContainEqual({ __limit: 50 });
  });

  it('honors a custom limit', async () => {
    hoisted.mockGetDocs.mockResolvedValue({ docs: [] });
    await getConfigAudit('t1', { limit: 10 });
    const q = hoisted.mockGetDocs.mock.calls[0][0];
    expect(q.__clauses).toContainEqual({ __limit: 10 });
  });
});
