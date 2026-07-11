import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fresh batch per test; a mutable holder so the firebase mock can hand back the
// same spy object the service mutated.
const hoisted = vi.hoisted(() => ({
  batch: null,
  mockGetDoc: vi.fn(),
  autoId: 0,
}));

vi.mock('firebase/firestore', () => ({
  // doc(db, path) → 2 args → fixed ref; doc(collectionRef) → 1 arg → auto-id ref.
  doc: (a, b) =>
    b === undefined
      ? { __ref: `${a.__col}/auto${(hoisted.autoId += 1)}`, __col: a.__col, __auto: true }
      : { __ref: b },
  collection: (_db, path) => ({ __col: path }),
  writeBatch: () => hoisted.batch,
  getDoc: (...args) => hoisted.mockGetDoc(...args),
  serverTimestamp: () => ({ _type: 'SERVER_TS' }),
  deleteField: () => ({ _type: 'DELETE_FIELD' }),
}));

import {
  ALLOWED_FLAG_KEYS,
  getConfigDoc,
  saveConfigValues,
  resetConfigValues,
  savePlainValues,
  resetPlainValues,
  setFeatureFlagOn,
  setFeatureFlagOff,
} from '../configService';

const ACTOR = { uid: 'u1', name: 'Admin One' };

beforeEach(() => {
  hoisted.batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  hoisted.mockGetDoc.mockReset();
  hoisted.autoId = 0;
});

// Helpers to partition batch.set calls into the config write vs the audit writes.
const configSetCalls = () => hoisted.batch.set.mock.calls.filter((c) => !c[0].__ref.includes('/configAudit/'));
const auditSetCalls = () => hoisted.batch.set.mock.calls.filter((c) => c[0].__ref.includes('/configAudit/'));
const isEnvelope = (v) =>
  v && typeof v === 'object' && 'value' in v && 'who' in v && 'whoName' in v && 'date' in v;
const isDeleteSentinel = (v) => v && typeof v === 'object' && v._type === 'DELETE_FIELD';

describe('getConfigDoc (fail-closed read — shared by all modes)', () => {
  it('absent doc → {}', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect(await getConfigDoc('t1', 'settings')).toEqual({});
  });

  it('missing tenantId → {} (no read attempted)', async () => {
    expect(await getConfigDoc('', 'settings')).toEqual({});
    expect(hoisted.mockGetDoc).not.toHaveBeenCalled();
  });

  it('read error → {}', async () => {
    hoisted.mockGetDoc.mockRejectedValue(new Error('boom'));
    expect(await getConfigDoc('t1', 'settings')).toEqual({});
  });

  it('existing doc → raw stored map, read from the right path', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ a: 1 }) });
    const out = await getConfigDoc('t1', 'settings');
    expect(out).toEqual({ a: 1 });
    expect(hoisted.mockGetDoc.mock.calls[0][0].__ref).toBe('tenants/t1/config/settings');
  });
});

describe('saveConfigValues (envelope mode)', () => {
  it('writes ONLY the passed keys, each as a {value,who,whoName,date} envelope, merge-set', async () => {
    await saveConfigValues('t1', 'grouped', { alpha: 10, beta: 'x' }, ACTOR);
    expect(configSetCalls()).toHaveLength(1);
    const [ref, payload, opts] = configSetCalls()[0];
    expect(ref.__ref).toBe('tenants/t1/config/grouped');
    expect(opts).toEqual({ merge: true });
    expect(Object.keys(payload)).toEqual(['alpha', 'beta']); // no other keys materialized
    expect(isEnvelope(payload.alpha)).toBe(true);
    expect(payload.alpha).toMatchObject({ value: 10, who: 'u1', whoName: 'Admin One' });
    expect(payload.beta).toMatchObject({ value: 'x', who: 'u1', whoName: 'Admin One' });
  });

  it('batches one audit entry per key on the SAME batch, and commits once', async () => {
    await saveConfigValues('t1', 'grouped', { alpha: 10, beta: 'x' }, ACTOR);
    const audits = auditSetCalls();
    expect(audits).toHaveLength(2);
    expect(audits.map((c) => c[1].settingId).sort()).toEqual(['alpha', 'beta']);
    audits.forEach((c) => {
      expect(c[1].section).toBe('grouped');
      expect(c[1].to).not.toBe(null); // save records the new value
      expect(c[1].who).toBe('u1');
    });
    expect(hoisted.batch.commit).toHaveBeenCalledOnce();
  });
});

describe('resetConfigValues (envelope mode — diff-only reset)', () => {
  it('deletes each key (NEVER writes a default value back); audit to=DEFAULT', async () => {
    await resetConfigValues('t1', 'grouped', ['alpha', 'beta'], ACTOR, { alpha: 10, beta: 'x' });
    const [ref, payload, opts] = configSetCalls()[0];
    expect(ref.__ref).toBe('tenants/t1/config/grouped');
    expect(opts).toEqual({ merge: true });
    expect(isDeleteSentinel(payload.alpha)).toBe(true);
    expect(isDeleteSentinel(payload.beta)).toBe(true);
    // No payload value is ever a concrete/default value — only delete sentinels.
    Object.values(payload).forEach((v) => expect(isDeleteSentinel(v)).toBe(true));

    const audits = auditSetCalls();
    expect(audits).toHaveLength(2);
    audits.forEach((c) => expect(c[1].to).toBe('DEFAULT'));
    // from carries the prior display value
    const byKey = Object.fromEntries(audits.map((c) => [c[1].settingId, c[1].from]));
    expect(byKey.alpha).toBe('10');
    expect(byKey.beta).toBe('x');
  });
});

describe('savePlainValues (plain-legacy mode)', () => {
  it('expands dot-paths to NESTED plain values + root updatedBy/updatedAt, no envelopes anywhere', async () => {
    await savePlainValues(
      't1',
      'managerActivityStandards',
      { 'unit_manager.jfwCount': 5, 'unit_manager.namesSourced': 3, 'branch_manager.jfwCount': 8 },
      ACTOR,
    );
    const [ref, payload, opts] = configSetCalls()[0];
    expect(ref.__ref).toBe('tenants/t1/config/managerActivityStandards');
    expect(opts).toEqual({ merge: true });
    // Nested plain shape (CF reader contract: orgDefault[role][key])
    expect(payload.unit_manager).toEqual({ jfwCount: 5, namesSourced: 3 });
    expect(payload.branch_manager).toEqual({ jfwCount: 8 });
    // Root metadata
    expect(payload.updatedBy).toBe('u1');
    expect(payload.updatedAt).toBeDefined();
    // No literal dotted keys leaked (array form treats the whole string as one key),
    // and no envelope wrapper anywhere.
    expect(Object.keys(payload)).not.toContain('unit_manager.jfwCount');
    const deepHasEnvelope = (o) =>
      o && typeof o === 'object' && (isEnvelope(o) || Object.values(o).some(deepHasEnvelope));
    expect(deepHasEnvelope(payload.unit_manager)).toBe(false);
    // Plain scalar, not { value: 5, ... }
    expect(payload.unit_manager.jfwCount).toBe(5);

    expect(auditSetCalls()).toHaveLength(3);
  });
});

describe('resetPlainValues (plain-legacy mode — diff-only reset)', () => {
  it('deletes at dot-paths via batch.update when the doc exists', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    await resetPlainValues('t1', 'managerActivityStandards', ['unit_manager.jfwCount'], ACTOR, {
      'unit_manager.jfwCount': 5,
    });
    expect(hoisted.batch.update).toHaveBeenCalledOnce();
    const [ref, payload] = hoisted.batch.update.mock.calls[0];
    expect(ref.__ref).toBe('tenants/t1/config/managerActivityStandards');
    expect(isDeleteSentinel(payload['unit_manager.jfwCount'])).toBe(true);
    expect(payload.updatedBy).toBe('u1');
    const audits = auditSetCalls();
    expect(audits[0][1].to).toBe('DEFAULT');
    expect(audits[0][1].from).toBe('5');
  });

  it('no-ops (no update, no commit) when the doc does not exist', async () => {
    hoisted.mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await resetPlainValues('t1', 'managerActivityStandards', ['unit_manager.jfwCount'], ACTOR);
    expect(hoisted.batch.update).not.toHaveBeenCalled();
    expect(hoisted.batch.commit).not.toHaveBeenCalled();
  });
});

describe('setFeatureFlagOn (flag mode)', () => {
  it('sets featureFlags.<key>=true + sibling featureFlagsMeta.<key>, merge-set', async () => {
    await setFeatureFlagOn('t1', 'persistencyV2', ACTOR);
    const [ref, payload, opts] = configSetCalls()[0];
    expect(ref.__ref).toBe('tenants/t1/config/settings');
    expect(opts).toEqual({ merge: true });
    expect(payload.featureFlags.persistencyV2).toBe(true); // literal true (=== true contract)
    expect(payload.featureFlagsMeta.persistencyV2).toMatchObject({ who: 'u1', whoName: 'Admin One' });
    const audit = auditSetCalls()[0][1];
    expect(audit).toMatchObject({ settingId: 'persistencyV2', from: 'OFF', to: 'ON' });
  });

  it('throws on a non-allowlisted key (and writes nothing)', async () => {
    await expect(setFeatureFlagOn('t1', 'notAFlag', ACTOR)).rejects.toThrow(/ALLOWED_FLAG_KEYS/);
    expect(hoisted.batch.commit).not.toHaveBeenCalled();
  });
});

describe('setFeatureFlagOff (flag mode)', () => {
  it('deletes BOTH featureFlags.<key> and featureFlagsMeta.<key>; NEVER writes false', async () => {
    await setFeatureFlagOff('t1', 'awardsProvenance', ACTOR);
    const [, payload] = configSetCalls()[0];
    expect(isDeleteSentinel(payload.featureFlags.awardsProvenance)).toBe(true);
    expect(isDeleteSentinel(payload.featureFlagsMeta.awardsProvenance)).toBe(true);
    // Assert no `false` is ever written anywhere in the payload.
    const flat = JSON.stringify(payload);
    expect(flat).not.toContain('false');
    expect(payload.featureFlags.awardsProvenance).not.toBe(false);
    const audit = auditSetCalls()[0][1];
    expect(audit).toMatchObject({ settingId: 'awardsProvenance', from: 'ON', to: 'OFF' });
  });

  it('throws on a non-allowlisted key', async () => {
    await expect(setFeatureFlagOff('t1', 'nope', ACTOR)).rejects.toThrow(/ALLOWED_FLAG_KEYS/);
  });
});

describe('ALLOWED_FLAG_KEYS', () => {
  it('mirrors the three item-3.4 flags exactly', () => {
    expect(ALLOWED_FLAG_KEYS).toEqual(['persistencyV2', 'policyLedgerCampaignLens', 'awardsProvenance']);
  });
});
