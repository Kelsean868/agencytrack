/**
 * FR-6 (Option A) — declareReinstatement / withdrawReinstatement. The payloads
 * must be exactly what firestore.rules Arm G admits (three fields on the policy,
 * a lapsed → lapsed history event), and the JS mirror refuses what Arm G would.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const update = vi.fn();
  const set = vi.fn();
  const commit = vi.fn().mockResolvedValue(undefined);
  return {
    update, set, commit,
    writeBatch: vi.fn(() => ({ update, set, commit })),
    doc: vi.fn((...args) => ({ _ref: args })),
    collection: vi.fn((...args) => ({ _col: args })),
    serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
    deleteField: vi.fn(() => ({ _type: 'deleteField' })),
  };
});

vi.mock('firebase/firestore', () => ({
  collection: (...a) => hoisted.collection(...a),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => hoisted.serverTimestamp(),
  Timestamp: { fromDate: vi.fn() },
  writeBatch: (...a) => hoisted.writeBatch(...a),
  doc: (...a) => hoisted.doc(...a),
  updateDoc: vi.fn(),
  deleteField: () => hoisted.deleteField(),
}));

import { declareReinstatement, withdrawReinstatement } from '../policiesService';

const AGENT = { uid: 'a1', role: 'agent', unitId: 'um1' };
const LAPSED = { agentId: 'a1', status: 'lapsed', statusSource: 'oipa_import', proposedAPI: 5000, settledAPI: 5000 };
const DECLARED = { ...LAPSED, reinstatementDeclaredAt: { seconds: 1 }, reinstatementDeclaredBy: 'a1', reinstatementNote: 'R1' };
const SERVER_TS = { _type: 'serverTimestamp' };
const DELETE = { _type: 'deleteField' };

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.commit.mockResolvedValue(undefined);
});

describe('declareReinstatement', () => {
  it('writes ONLY the three Arm G fields plus a lapsed → lapsed declared event, in one batch', async () => {
    await declareReinstatement('t1', AGENT, 'p1', LAPSED, { note: '  Receipt 4471  ' });
    expect(hoisted.writeBatch).toHaveBeenCalledTimes(1);
    const [ref, update] = hoisted.update.mock.calls[0];
    expect(ref._ref.slice(1)).toEqual(['tenants', 't1', 'policies', 'p1']);
    expect(update).toEqual({
      reinstatementDeclaredAt: SERVER_TS,
      reinstatementDeclaredBy: 'a1',
      reinstatementNote: 'Receipt 4471',
    });
    // Nothing that decides status or money.
    for (const k of ['status', 'statusSource', 'statusSetBy', 'proposedAPI', 'settledAPI', 'earnedCommission']) {
      expect(update).not.toHaveProperty(k);
    }
    const [, event] = hoisted.set.mock.calls[0];
    expect(event).toEqual({
      fromStatus: 'lapsed', toStatus: 'lapsed', event: 'reinstatement_declared',
      changedFields: { reinstatementDeclaredBy: 'a1', reinstatementNote: 'Receipt 4471' },
      actorUid: 'a1', actorRole: 'agent', agentId: 'a1', unitId: 'um1', at: SERVER_TS,
    });
    expect(hoisted.commit).toHaveBeenCalledTimes(1);
  });

  it('an empty note is deleted, not stored as ""', async () => {
    await declareReinstatement('t1', AGENT, 'p1', LAPSED, { note: '   ' });
    expect(hoisted.update.mock.calls[0][1].reinstatementNote).toEqual(DELETE);
    expect(hoisted.set.mock.calls[0][1].changedFields).toEqual({ reinstatementDeclaredBy: 'a1' });
  });

  it('a producing manager may declare on their own lapsed policy', async () => {
    await declareReinstatement('t1', { uid: 'um1', role: 'unit_manager' }, 'p2', { ...LAPSED, agentId: 'um1' });
    expect(hoisted.commit).toHaveBeenCalledTimes(1);
  });

  it('refuses what Arm G refuses, before any write', async () => {
    await expect(declareReinstatement('t1', AGENT, 'p1', { ...LAPSED, agentId: 'a2' })).rejects.toThrow(/own policies/);
    await expect(declareReinstatement('t1', AGENT, 'p1', { ...LAPSED, status: 'settled' })).rejects.toThrow(/lapsed/);
    await expect(declareReinstatement('t1', { uid: 'ta1', role: 'tenant_admin' }, 'p1', { ...LAPSED, agentId: 'ta1' })).rejects.toThrow(/role/);
    await expect(declareReinstatement('t1', AGENT, 'p1', LAPSED, { note: 'x'.repeat(201) })).rejects.toThrow(/200/);
    expect(hoisted.writeBatch).not.toHaveBeenCalled();
  });

  it('a 200-character note is accepted', async () => {
    await declareReinstatement('t1', AGENT, 'p1', LAPSED, { note: 'x'.repeat(200) });
    expect(hoisted.update.mock.calls[0][1].reinstatementNote).toHaveLength(200);
  });
});

describe('withdrawReinstatement', () => {
  it('deletes all three fields and writes a withdrawn event, in one batch', async () => {
    await withdrawReinstatement('t1', AGENT, 'p1', DECLARED);
    expect(hoisted.update.mock.calls[0][1]).toEqual({
      reinstatementDeclaredAt: DELETE, reinstatementDeclaredBy: DELETE, reinstatementNote: DELETE,
    });
    expect(hoisted.set.mock.calls[0][1]).toMatchObject({
      fromStatus: 'lapsed', toStatus: 'lapsed', event: 'reinstatement_withdrawn', actorUid: 'a1', agentId: 'a1',
    });
  });

  it('refuses a policy that is not own, not lapsed, or not declared', async () => {
    await expect(withdrawReinstatement('t1', AGENT, 'p1', { ...DECLARED, agentId: 'a2' })).rejects.toThrow(/own/);
    await expect(withdrawReinstatement('t1', AGENT, 'p1', { ...DECLARED, status: 'settled' })).rejects.toThrow(/lapsed/);
    await expect(withdrawReinstatement('t1', AGENT, 'p1', LAPSED)).rejects.toThrow(/not marked/);
    expect(hoisted.writeBatch).not.toHaveBeenCalled();
  });
});
