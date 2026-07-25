import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ setDoc: vi.fn(), doc: vi.fn(() => ({ __ref: true })) }));

vi.mock('firebase/firestore', () => ({
  doc: (...a) => hoisted.doc(...a),
  getDoc: vi.fn(),
  setDoc: (...a) => hoisted.setDoc(...a),
  serverTimestamp: () => '__ts__',
}));

import { setCommissionScenarios, COMMISSION_SCENARIO_CAP } from '../userPrefsService';

const scenario = (i) => ({
  id: `sc-${i}`, label: `S${i}`, savedAt: '2026-07-25T10:00:00.000Z',
  inputs: { incomeGoal: 300000 }, freqKey: 'annual',
});

beforeEach(() => { vi.clearAllMocks(); });

describe('setCommissionScenarios (R-06)', () => {
  it('writes to the AGENT-PRIVATE prefs doc path users/{uid}/prefs/app', async () => {
    await setCommissionScenarios('t1', 'u1', [scenario(0)]);
    // doc(db, 'tenants', tenantId, 'users', uid, 'prefs', 'app')
    expect(hoisted.doc).toHaveBeenCalledWith(
      expect.anything(), 'tenants', 't1', 'users', 'u1', 'prefs', 'app',
    );
  });

  it('MERGE-writes so sibling prefs (pinnedNav / menuLayout / settings) are never clobbered', async () => {
    await setCommissionScenarios('t1', 'u1', [scenario(0)]);
    const [, payload, options] = hoisted.setDoc.mock.calls[0];
    expect(options).toEqual({ merge: true });
    // Only the scenarios key (+ updatedAt) is written — no sibling pref keys.
    expect(Object.keys(payload).sort()).toEqual(['commissionScenarios', 'updatedAt']);
  });

  it('persists the full scenario shape (inputs + cadence round-trip)', async () => {
    await setCommissionScenarios('t1', 'u1', [scenario(0)]);
    const [, payload] = hoisted.setDoc.mock.calls[0];
    expect(payload.commissionScenarios[0]).toMatchObject({
      id: 'sc-0', label: 'S0', freqKey: 'annual', inputs: { incomeGoal: 300000 },
    });
    // savedAt is a client ISO string — never a serverTimestamp sentinel, which
    // Firestore rejects inside array elements (banked).
    expect(typeof payload.commissionScenarios[0].savedAt).toBe('string');
    expect(payload.commissionScenarios[0].savedAt).not.toBe('__ts__');
  });

  it(`enforces the ${COMMISSION_SCENARIO_CAP}-scenario cap at the service layer`, async () => {
    const tooMany = Array.from({ length: COMMISSION_SCENARIO_CAP + 4 }, (_, i) => scenario(i));
    await setCommissionScenarios('t1', 'u1', tooMany);
    const [, payload] = hoisted.setDoc.mock.calls[0];
    expect(payload.commissionScenarios).toHaveLength(COMMISSION_SCENARIO_CAP);
  });

  it('coerces a non-array to an empty list rather than writing garbage', async () => {
    await setCommissionScenarios('t1', 'u1', null);
    const [, payload] = hoisted.setDoc.mock.calls[0];
    expect(payload.commissionScenarios).toEqual([]);
  });

  it('throws (never writes) without tenantId / uid', async () => {
    await expect(setCommissionScenarios(null, 'u1', [])).rejects.toThrow(/tenantId and uid/);
    await expect(setCommissionScenarios('t1', null, [])).rejects.toThrow(/tenantId and uid/);
    expect(hoisted.setDoc).not.toHaveBeenCalled();
  });
});
