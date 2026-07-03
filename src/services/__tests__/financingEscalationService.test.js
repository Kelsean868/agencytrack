import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockSetDoc:    vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockGetDocs:   vi.fn(),
  mockQuery:     vi.fn((...a) => ({ _q: a })),
  mockWhere:     vi.fn((...a) => ({ _where: a })),
  mockOrderBy:   vi.fn((...a) => ({ _orderBy: a })),
  mockDoc:       vi.fn((_db, path) => ({ _path: path })),
  mockCollection: vi.fn((_db, path) => ({ _path: path })),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => ({
  collection:      (...a) => hoisted.mockCollection(...a),
  doc:             (...a) => hoisted.mockDoc(...a),
  setDoc:          (...a) => hoisted.mockSetDoc(...a),
  updateDoc:       (...a) => hoisted.mockUpdateDoc(...a),
  getDocs:         (...a) => hoisted.mockGetDocs(...a),
  query:           (...a) => hoisted.mockQuery(...a),
  where:           (...a) => hoisted.mockWhere(...a),
  orderBy:         (...a) => hoisted.mockOrderBy(...a),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  ESCALATION_REASONS,
  ESCALATION_REASON_VALUES,
  escalationReasonLabel,
  escalationDocId,
  createFinancingEscalation,
  listBranchEscalations,
  acknowledgeFinancingEscalation,
} from '../financingEscalationService';

const VALID = {
  tenantId: 'tid',
  agentId: 'agentA',
  agentName: 'Agent A',
  agentUnitId: 'umUid',
  branchId: 'branchA',
  raisedByUid: 'umUid',       // == agentUnitId (own-unit)
  raisedByName: 'Unit Mgr',
  raisedByRole: 'unit_manager',
  reason: 'draw_decision',
  note: 'needs a decision',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('reason enum', () => {
  it('exposes the four locked reason values', () => {
    expect(ESCALATION_REASON_VALUES).toEqual(
      ['draw_decision', 'confirm_request', 'notify_5_3', 'termination_risk'],
    );
    expect(ESCALATION_REASONS).toHaveLength(4);
  });
  it('labels a value and falls back to the raw value', () => {
    expect(escalationReasonLabel('draw_decision')).toMatch(/draw/i);
    expect(escalationReasonLabel('unknown_x')).toBe('unknown_x');
  });
});

describe('escalationDocId', () => {
  it('joins agentId_reason_monthKey', () => {
    expect(escalationDocId('agentA', 'draw_decision', '2026_07')).toBe('agentA_draw_decision_2026_07');
  });
});

describe('createFinancingEscalation — validation (fail closed BEFORE any write)', () => {
  it('throws on a missing branchId (would orphan the escalation)', async () => {
    await expect(createFinancingEscalation({ ...VALID, branchId: null })).rejects.toThrow(/branchId/);
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });
  it('throws on an invalid reason', async () => {
    await expect(createFinancingEscalation({ ...VALID, reason: 'bogus' })).rejects.toThrow(/reason/);
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });
  it('throws when the agent is outside the raiser unit (agentUnitId != raisedByUid)', async () => {
    await expect(createFinancingEscalation({ ...VALID, agentUnitId: 'otherUnit' })).rejects.toThrow(/unit/i);
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });
  // K10c 2a: roster-row coherence — a non-string branchId (stale/partial roster row)
  // fails with a clear error rather than reaching the rules and mapping to
  // "already raised". Mirrors the rules' `branchId is string` type guard.
  it('throws on a non-string branchId (stale roster row → clear error, not "already raised")', async () => {
    await expect(createFinancingEscalation({ ...VALID, branchId: 12345 })).rejects.toThrow(/non-empty strings|branchId/i);
    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
  });
});

describe('createFinancingEscalation — write + idempotency', () => {
  it('writes status:open with the full field set and a capped note', async () => {
    hoisted.mockSetDoc.mockResolvedValue(undefined);
    const res = await createFinancingEscalation({ ...VALID, note: 'x'.repeat(2500) });
    expect(res.created).toBe(true);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.status).toBe('open');
    expect(payload.branchId).toBe('branchA');
    expect(payload.note).toHaveLength(2000);            // capped
    expect(payload.createdAt).toEqual({ _type: 'serverTimestamp' });
    // The full locked key set is present (no acknowledged* keys until ack).
    expect(Object.keys(payload).sort()).toEqual([
      'agentId', 'agentName', 'agentUnitId', 'branchId', 'createdAt',
      'note', 'raisedByName', 'raisedByRole', 'raisedByUid', 'reason',
      'status', 'tenantId',
    ]);
    expect(payload).not.toHaveProperty('acknowledgedByUid');
  });

  it('surfaces "already raised" (not overwrite) when the rules reject a same-month re-raise', async () => {
    hoisted.mockSetDoc.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const res = await createFinancingEscalation(VALID);
    expect(res).toEqual({ created: false, alreadyRaised: true, id: expect.any(String) });
  });

  it('re-throws a non-permission error (offline, etc.)', async () => {
    hoisted.mockSetDoc.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));
    await expect(createFinancingEscalation(VALID)).rejects.toThrow(/offline/);
  });
});

describe('listBranchEscalations', () => {
  it('queries branchId== with the index order (status asc, createdAt desc) and maps docs', async () => {
    hoisted.mockGetDocs.mockResolvedValue({
      docs: [{ id: 'e1', data: () => ({ status: 'open', branchId: 'branchA' }) }],
    });
    const out = await listBranchEscalations({ tenantId: 'tid', branchId: 'branchA' });
    expect(hoisted.mockWhere).toHaveBeenCalledWith('branchId', '==', 'branchA');
    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('status', 'asc');
    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(out).toEqual([{ id: 'e1', status: 'open', branchId: 'branchA' }]);
  });
});

describe('acknowledgeFinancingEscalation', () => {
  it('updates ONLY the ack triple (status/acknowledgedByUid/acknowledgedAt)', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue(undefined);
    await acknowledgeFinancingEscalation({ tenantId: 'tid', escalationId: 'e1', acknowledgedByUid: 'bmUid' });
    const [, patch] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(Object.keys(patch).sort()).toEqual(['acknowledgedAt', 'acknowledgedByUid', 'status']);
    expect(patch.status).toBe('acknowledged');
    expect(patch.acknowledgedByUid).toBe('bmUid');
    expect(patch.acknowledgedAt).toEqual({ _type: 'serverTimestamp' });
  });
});
