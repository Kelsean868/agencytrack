import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const mockBatchUpdate  = vi.fn();
  const mockBatchSet     = vi.fn();
  const mockBatchCommit  = vi.fn().mockResolvedValue(undefined);
  const mockBatch        = { update: mockBatchUpdate, set: mockBatchSet, commit: mockBatchCommit };

  return {
    mockAddDoc:          vi.fn(),
    mockGetDocs:         vi.fn(),
    mockQuery:           vi.fn((...args) => args),
    mockWhere:           vi.fn((...args) => args),
    mockOrderBy:         vi.fn((...args) => args),
    mockCollection:      vi.fn(),
    mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
    mockTimestamp:       { fromDate: vi.fn((d) => ({ _type: 'timestamp', ms: d.getTime() })) },
    mockWriteBatch:      vi.fn(() => mockBatch),
    mockDoc:             vi.fn((...args) => ({ _ref: args })),
    mockUpdateDoc:       vi.fn().mockResolvedValue(undefined),
    mockBatchUpdate,
    mockBatchSet,
    mockBatchCommit,
  };
});

vi.mock('firebase/firestore', () => ({
  collection:      (...args) => hoisted.mockCollection(...args),
  addDoc:          (...args) => hoisted.mockAddDoc(...args),
  getDocs:         (...args) => hoisted.mockGetDocs(...args),
  query:           (...args) => hoisted.mockQuery(...args),
  where:           (...args) => hoisted.mockWhere(...args),
  orderBy:         (...args) => hoisted.mockOrderBy(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
  Timestamp:       hoisted.mockTimestamp,
  writeBatch:      (...args) => hoisted.mockWriteBatch(...args),
  doc:             (...args) => hoisted.mockDoc(...args),
  updateDoc:       (...args) => hoisted.mockUpdateDoc(...args),
}));

import { createPolicy, getOwnPolicies, transitionPolicyStatus, getPolicyHistory, confirmPolicy, lapsePolicy, settlementShapeFromPolicies, getDeliverablePolicies, recordPolicyDelivery, getPoliciesForManager, selfConfirmPolicy } from '../policiesService';
import { getTodayTT } from '../../utils/dateInputs';

const mockProfile = {
  uid: 'uid-1',
  agentNumber: 'A001',
  unitId: 'unit-1',
  branchId: 'branch-1',
};

const today = new Date().toISOString().split('T')[0];
const isoDaysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};
const yesterdayISO = isoDaysFromNow(-1);
const twoDaysAgoISO = isoDaysFromNow(-2);
const tomorrowISO = isoDaysFromNow(1);

const VALID_DATA = {
  ownerName: '  Jane Smith  ',
  insuredName: 'Jane Smith',
  policyNumber: '',
  productLine: 'life',
  newBusinessType: 'nb_ordinary',
  policyClass: 'whole_life',
  planId: '',
  planName: '',
  proposedPremium: '416.67',
  proposedFrequency: 'M',
  proposedAPI: '5000.04',
  proposedCoverage: '',
  dateWritten: today,
  // No dateSubmitted — slice 1A / D1: a policy is created at `written` and the
  // submitted date is collected on the written -> submitted transition.
  notes: '',
  isSelfOrFamily: false,
  replacedPolicyAPI: '',
  sourceOfProspect: 'referral',
  cashWithApp: { collected: false, amount: '' },
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockAddDoc.mockResolvedValue({ id: 'new-policy-id' });
  hoisted.mockGetDocs.mockResolvedValue({ docs: [] });
  hoisted.mockBatchCommit.mockResolvedValue(undefined);
});

describe('createPolicy', () => {
  it('writes status WRITTEN (1A/D1) and denormalized agentId / unitId / branchId', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    expect(hoisted.mockAddDoc).toHaveBeenCalledOnce();
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.status).toBe('written');
    expect(payload.tenantId).toBe('t1');
    expect(payload.agentId).toBe('uid-1');
    expect(payload.unitId).toBe('unit-1');
    expect(payload.branchId).toBe('branch-1');
    expect(payload.createdBy).toBe('uid-1');
  });

  it('parseFloat-enforces proposedAPI', async () => {
    await createPolicy('t1', mockProfile, { ...VALID_DATA, proposedAPI: '5000.04' });
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.proposedAPI).toBe(5000.04);
  });

  it('trims ownerName and insuredName', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.ownerName).toBe('Jane Smith');
    expect(payload.insuredName).toBe('Jane Smith');
  });

  it('sets cashWithApp.amount to null when not collected', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.cashWithApp).toEqual({ collected: false, amount: null });
  });

  it('parseFloat-enforces cashWithApp.amount when collected', async () => {
    await createPolicy('t1', mockProfile, {
      ...VALID_DATA,
      cashWithApp: { collected: true, amount: '250.50' },
    });
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.cashWithApp).toEqual({ collected: true, amount: 250.5 });
  });

  it('sets replacedPolicyAPI for replacement type', async () => {
    await createPolicy('t1', mockProfile, {
      ...VALID_DATA,
      newBusinessType: 'replacement',
      replacedPolicyAPI: '3000.50',
    });
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.replacedPolicyAPI).toBe(3000.5);
  });

  it('nulls replacedPolicyAPI for non-replacement type', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.replacedPolicyAPI).toBeNull();
  });

  it('sets dateIssued and policyDeliveryDate to null (H1 deferred milestones)', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.dateIssued).toBeNull();
    expect(payload.policyDeliveryDate).toBeNull();
  });

  // 1A/D1: a policy at `written` has not been submitted, so it carries no
  // submitted date — not even one a caller supplies.
  it('does not require dateSubmitted, and stamps it null', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.dateSubmitted).toBeNull();
  });

  it('ignores a dateSubmitted a caller passes at create', async () => {
    await createPolicy('t1', mockProfile, { ...VALID_DATA, dateSubmitted: today });
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.dateSubmitted).toBeNull();
  });

  it('rejects invalid sourceOfProspect', async () => {
    await expect(createPolicy('t1', mockProfile, { ...VALID_DATA, sourceOfProspect: 'bogus' }))
      .rejects.toThrow('invalid sourceOfProspect');
  });

  it('rejects future dateWritten', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await expect(
      createPolicy('t1', mockProfile, { ...VALID_DATA, dateWritten: tomorrow.toISOString().split('T')[0] })
    ).rejects.toThrow('dateWritten cannot be in the future');
  });

  it('rejects proposedAPI <= 0', async () => {
    await expect(createPolicy('t1', mockProfile, { ...VALID_DATA, proposedAPI: '0' }))
      .rejects.toThrow('proposedAPI must be positive');
  });

  it('rejects blank ownerName', async () => {
    await expect(createPolicy('t1', mockProfile, { ...VALID_DATA, ownerName: '  ' }))
      .rejects.toThrow('ownerName is required');
  });

  it('stores socialPlatform when sourceOfProspect is social-media', async () => {
    await createPolicy('t1', mockProfile, {
      ...VALID_DATA, sourceOfProspect: 'social-media', socialPlatform: 'instagram',
    });
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.socialPlatform).toBe('instagram');
  });

  it('stores null for socialPlatform when sourceOfProspect is not social-media', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.socialPlatform).toBeNull();
  });

  it('rejects social-media source with null socialPlatform', async () => {
    await expect(
      createPolicy('t1', mockProfile, { ...VALID_DATA, sourceOfProspect: 'social-media', socialPlatform: null }),
    ).rejects.toThrow('socialPlatform is required when source is social-media');
  });

  it('rejects invalid socialPlatform value', async () => {
    await expect(
      createPolicy('t1', mockProfile, { ...VALID_DATA, sourceOfProspect: 'social-media', socialPlatform: 'snapchat' }),
    ).rejects.toThrow('invalid socialPlatform');
  });
});

describe('getOwnPolicies', () => {
  it('returns mapped docs with id', async () => {
    hoisted.mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'p1', data: () => ({ proposedAPI: 1000, agentId: 'uid-1' }) }],
    });
    const result = await getOwnPolicies('t1', 'uid-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].proposedAPI).toBe(1000);
  });

  it('queries by agentId and orders by createdAt desc', async () => {
    await getOwnPolicies('t1', 'uid-1');
    expect(hoisted.mockWhere).toHaveBeenCalledWith('agentId', '==', 'uid-1');
    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  // P2b (SEC-08): a manager reading ANOTHER agent's book passes their scope so
  // the query satisfies the branch/unit-scoped policies list rule.
  it('BM scope adds where(branchId == caller branch); UM scope where(unitId == caller uid)', async () => {
    hoisted.mockGetDocs.mockResolvedValue({ docs: [] });
    hoisted.mockWhere.mockClear();
    await getOwnPolicies('t1', 'agent-9', { role: 'branch_manager', uid: 'bm-1', branchId: 'b-1' });
    expect(hoisted.mockWhere.mock.calls).toHaveLength(2);
    expect(hoisted.mockWhere.mock.calls).toEqual(expect.arrayContaining([['agentId', '==', 'agent-9'], ['branchId', '==', 'b-1']]));
    hoisted.mockWhere.mockClear();
    await getOwnPolicies('t1', 'agent-9', { role: 'unit_manager', uid: 'um-1' });
    expect(hoisted.mockWhere.mock.calls).toHaveLength(2);
    expect(hoisted.mockWhere.mock.calls).toEqual(expect.arrayContaining([['agentId', '==', 'agent-9'], ['unitId', '==', 'um-1']]));
  });

  it('SM / TA scope and no scope add no extra clause', async () => {
    hoisted.mockGetDocs.mockResolvedValue({ docs: [] });
    hoisted.mockWhere.mockClear();
    await getOwnPolicies('t1', 'agent-9', { role: 'sales_manager', uid: 'sm-1' });
    await getOwnPolicies('t1', 'agent-9');
    expect(hoisted.mockWhere.mock.calls).toEqual([['agentId', '==', 'agent-9'], ['agentId', '==', 'agent-9']]);
  });
});

describe('transitionPolicyStatus', () => {
  it('throws on illegal transition', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'ntu', 'rated', {})
    ).rejects.toThrow('Illegal status transition');
  });

  it('throws on lapsed target (explicitly denied)', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'lapsed', {})
    ).rejects.toThrow('Illegal status transition');
  });

  it('rated — throws when ratedPremium missing', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'rated', {})
    ).rejects.toThrow('ratedPremium must be a positive number');
  });

  it('rated — throws when ratedPremium <= 0', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'rated', { ratedPremium: '0' })
    ).rejects.toThrow('ratedPremium must be a positive number');
  });

  it('settled — throws when dateIssued missing', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'settled', {
        settledAPI: '5000', issuedCoverage: '100000', initialPremium: '416', earnedCommission: '250',
      })
    ).rejects.toThrow('dateIssued is required');
  });

  it('settled — throws when settledAPI <= 0', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'settled', {
        dateIssued: today, settledAPI: '0', issuedCoverage: '100000', initialPremium: '416', earnedCommission: '250',
      })
    ).rejects.toThrow('settledAPI must be positive');
  });

  it('settled — throws when earnedCommission < 0', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'settled', {
        dateIssued: today, settledAPI: '5000', issuedCoverage: '100000', initialPremium: '416', earnedCommission: '-1',
      })
    ).rejects.toThrow('earnedCommission must be non-negative');
  });

  it('rated — commits writeBatch with both policy update and history doc', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'rated', {
      ratedPremium: '1200', rateReason: 'Health ok',
    });
    expect(hoisted.mockWriteBatch).toHaveBeenCalledOnce();
    expect(hoisted.mockBatchUpdate).toHaveBeenCalledOnce();
    expect(hoisted.mockBatchSet).toHaveBeenCalledOnce();
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();

    // Policy update payload
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('rated');
    expect(policyPayload.ratedPremium).toBe(1200);           // parseFloat
    expect(policyPayload.rateReason).toBe('Health ok');

    // History doc
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('submitted');
    expect(histPayload.toStatus).toBe('rated');
    expect(histPayload.actorUid).toBe('uid-1');
    expect(histPayload.actorRole).toBe('agent');
    expect(histPayload.agentId).toBe('uid-1');
    expect(histPayload.unitId).toBe('unit-1');
    expect(histPayload.changedFields.status).toBe('rated');
    expect(histPayload.changedFields.ratedPremium).toBe(1200);
  });

  it('settled — parseFloat all numeric fields and writes correct history shape', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'settled', {
      dateIssued: today, settledAPI: '5000.50', issuedCoverage: '100000',
      initialPremium: '416.67', earnedCommission: '250.25',
    });
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.settledAPI).toBe(5000.5);
    expect(policyPayload.issuedCoverage).toBe(100000);
    expect(policyPayload.initialPremium).toBe(416.67);
    expect(policyPayload.earnedCommission).toBe(250.25);
    expect(policyPayload.dateIssued).toMatchObject({ _type: 'timestamp' }); // Timestamp.fromDate result

    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('submitted');
    expect(histPayload.toStatus).toBe('settled');
    expect(histPayload.changedFields.settledAPI).toBe(5000.5);
    expect(histPayload.changedFields.earnedCommission).toBe(250.25);
  });

  it('postponed (no required fields) — commits batch with only status fields', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'submitted', 'postponed', {
      pendingReason: 'Medical pending',
    });
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('postponed');
    expect(policyPayload.pendingReason).toBe('Medical pending');
  });

  // ── Slice 1A: the written → submitted edge ──────────────────────────────
  // dateSubmitted is required on THIS EDGE only. dateWritten is passed in from
  // the policy doc purely to run the ordering check; it is never written back.

  it('written → submitted — throws when dateSubmitted is missing', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'submitted', { dateWritten: yesterdayISO })
    ).rejects.toThrow('dateSubmitted is required');
  });

  it('written → submitted — throws when dateWritten is missing', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'submitted', { dateSubmitted: today })
    ).rejects.toThrow('dateWritten is required');
  });

  it('written → submitted — throws when dateSubmitted precedes dateWritten', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'submitted', {
        dateSubmitted: twoDaysAgoISO, dateWritten: yesterdayISO,
      })
    ).rejects.toThrow('dateSubmitted must be on or after dateWritten');
  });

  it('written → submitted — throws on a future dateSubmitted', async () => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'submitted', {
        dateSubmitted: tomorrowISO, dateWritten: yesterdayISO,
      })
    ).rejects.toThrow('dateSubmitted cannot be in the future');
  });

  // Backdating IS allowed — the CRO submits in weekly batches, so the agent
  // learns the date after the fact.
  it('written → submitted — accepts a backdated dateSubmitted and writes it to policy + history', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'submitted', {
      dateSubmitted: yesterdayISO, dateWritten: twoDaysAgoISO,
    });
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('submitted');
    expect(policyPayload.dateSubmitted).toEqual({ _type: 'timestamp', ms: expect.any(Number) });
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('written');
    expect(histPayload.toStatus).toBe('submitted');
    expect(histPayload.changedFields.dateSubmitted).toBe(policyPayload.dateSubmitted);
    // dateWritten is a comparison input only — it must never be written back.
    expect(policyPayload).not.toHaveProperty('dateWritten');
    expect(histPayload.changedFields).not.toHaveProperty('dateWritten');
  });

  it('written → ntu is legal; written → rated and written → denied are not', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'ntu', { reason: 'client did not sign' });
    expect(hoisted.mockBatchUpdate.mock.calls[0][1].status).toBe('ntu');
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'rated', { ratedPremium: '1200' })
    ).rejects.toThrow('Illegal status transition');
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', 'written', 'denied', { reason: 'x' })
    ).rejects.toThrow('Illegal status transition');
  });

  it('postponed → submitted re-entry — no new transition fields', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'postponed', 'submitted', {});
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('submitted');
    // The per-EDGE requirement must not leak onto this edge — it targets
    // `submitted` too, and a per-TARGET encoding would have broken it.
    expect(policyPayload).not.toHaveProperty('dateSubmitted');
  });

  it('rated → settled — valid; records fromStatus=rated in history', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'rated', 'settled', {
      dateIssued: today, settledAPI: '4800', issuedCoverage: '200000',
      initialPremium: '400', earnedCommission: '240',
    });
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('settled');
    expect(policyPayload.settledAPI).toBe(4800);
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('rated');
    expect(histPayload.toStatus).toBe('settled');
  });

  it('rated → ntu — valid with no required fields', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'rated', 'ntu', {});
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('ntu');
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('rated');
    expect(histPayload.toStatus).toBe('ntu');
  });

  it('postponed → denied — valid with optional reason', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'postponed', 'denied', { reason: 'Underwriting' });
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('denied');
    expect(policyPayload.reason).toBe('Underwriting');
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('postponed');
    expect(histPayload.toStatus).toBe('denied');
  });

  it.each([
    ['settled', 'submitted'],
    ['settled', 'rated'],
    ['denied',  'submitted'],
    ['ntu',     'submitted'],
  ])('terminal state %s → %s throws (no outbound transitions)', async (from, to) => {
    await expect(
      transitionPolicyStatus('t1', mockProfile, 'p1', from, to, {})
    ).rejects.toThrow('Illegal status transition');
  });
});

describe('confirmPolicy', () => {
  const mockManagerProfile = {
    uid:  'bm-1',
    name: 'BM Manager',
    role: 'branch_manager',
  };

  const mockPolicy = {
    agentId:    'agent-1',
    unitId:     'unit-1',
    settledAPI: 5000,
    ownerName:  'Jane Smith',
  };

  it('throws when managerSettledAPI <= 0', async () => {
    await expect(
      confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '0', '')
    ).rejects.toThrow('managerSettledAPI must be a positive number');
  });

  it('throws when managerSettledAPI is not a number', async () => {
    await expect(
      confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, 'abc', '')
    ).rejects.toThrow('managerSettledAPI must be a positive number');
  });

  it('parseFloat applied to managerSettledAPI string input', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '5000.50', '');
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.managerSettledAPI).toBe(5000.5);
  });

  it('hasDiscrepancy false when managerSettledAPI === policy.settledAPI', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '5000', '');
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.hasDiscrepancy).toBe(false);
    // No notification when no discrepancy — batch.set called once (history only)
    expect(hoisted.mockBatchSet).toHaveBeenCalledTimes(1);
  });

  it('hasDiscrepancy true when managerSettledAPI !== policy.settledAPI', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '4500', '');
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.hasDiscrepancy).toBe(true);
    // Notification written when discrepancy — batch.set called twice (history + notification)
    expect(hoisted.mockBatchSet).toHaveBeenCalledTimes(2);
  });

  it('writes all 6 confirmation fields on the policy doc', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '5000', 'all good');
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.confirmedByManager).toBe('BM Manager');
    expect(policyPayload.confirmedByUid).toBe('bm-1');
    expect(policyPayload.managerSettledAPI).toBe(5000);
    expect(policyPayload.managerNote).toBe('all good');
    expect(policyPayload.hasDiscrepancy).toBe(false);
    expect(policyPayload).toHaveProperty('confirmedAt');
  });

  it('manager history doc has correct shape (fromStatus == toStatus == settled)', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '5000', '');
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('settled');
    expect(histPayload.toStatus).toBe('settled');
    expect(histPayload.actorUid).toBe('bm-1');
    expect(histPayload.actorRole).toBe('branch_manager');
    expect(histPayload.agentId).toBe('agent-1');
    expect(histPayload.unitId).toBe('unit-1');
    expect(histPayload.changedFields.managerSettledAPI).toBe(5000);
    expect(histPayload.changedFields.hasDiscrepancy).toBe(false);
  });

  it('notification doc has correct schema when discrepancy exists', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '4500', '');
    // batch.set calls: [0] = history, [1] = notification
    const notifPayload = hoisted.mockBatchSet.mock.calls[1][1];
    expect(notifPayload.userId).toBe('agent-1');
    expect(notifPayload.tenantId).toBe('t1');
    expect(notifPayload.type).toBe('policy_discrepancy');
    expect(notifPayload.read).toBe(false);
    expect(typeof notifPayload.title).toBe('string');
    expect(typeof notifPayload.body).toBe('string');
    expect(notifPayload.body).toContain('Jane Smith');
  });

  it('notification NOT written when no discrepancy', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '5000', '');
    // Only one batch.set call (history); no notification
    expect(hoisted.mockBatchSet).toHaveBeenCalledTimes(1);
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('commits a single batch', async () => {
    await confirmPolicy('t1', mockManagerProfile, 'p1', mockPolicy, '5000', '');
    expect(hoisted.mockWriteBatch).toHaveBeenCalledOnce();
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
  });
});

describe('getPolicyHistory', () => {
  it('without agentId — queries ordered by at desc only (manager path)', async () => {
    await getPolicyHistory('t1', 'p1');
    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('at', 'desc');
    expect(hoisted.mockWhere).not.toHaveBeenCalledWith('agentId', '==', expect.anything());
  });

  it('with agentId — adds where(agentId==uid) filter for agent list rule', async () => {
    await getPolicyHistory('t1', 'p1', 'agent-uid-1');
    expect(hoisted.mockWhere).toHaveBeenCalledWith('agentId', '==', 'agent-uid-1');
    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('at', 'desc');
  });

  it('returns mapped docs with id', async () => {
    hoisted.mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'h1', data: () => ({ fromStatus: 'submitted', toStatus: 'rated', actorUid: 'uid-1' }) },
      ],
    });
    const result = await getPolicyHistory('t1', 'p1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('h1');
    expect(result[0].fromStatus).toBe('submitted');
    expect(result[0].toStatus).toBe('rated');
  });
});

describe('lapsePolicy', () => {
  const mockBMProfile = {
    uid:  'bm-uid',
    name: 'Branch Manager',
    role: 'branch_manager',
  };

  const mockSettledPolicy = {
    agentId:   'agent-1',
    unitId:    'unit-1',
    status:    'settled',
    ownerName: 'Jane Smith',
  };

  const mockFields = {
    dateLapsed: { _type: 'timestamp', ms: Date.now() },
    lapseReason: '',
  };

  it('throws when role is not BM+', async () => {
    const agentProfile = { uid: 'a1', name: 'Agent', role: 'agent' };
    await expect(
      lapsePolicy('t1', agentProfile, 'p1', mockSettledPolicy, mockFields)
    ).rejects.toThrow('Only Branch Manager or above can lapse a policy.');
  });

  it('throws when role is unit_manager', async () => {
    const umProfile = { uid: 'um1', name: 'UM', role: 'unit_manager' };
    await expect(
      lapsePolicy('t1', umProfile, 'p1', mockSettledPolicy, mockFields)
    ).rejects.toThrow('Only Branch Manager or above can lapse a policy.');
  });

  it('throws when policy.status is not settled', async () => {
    const ratedPolicy = { ...mockSettledPolicy, status: 'rated' };
    await expect(
      lapsePolicy('t1', mockBMProfile, 'p1', ratedPolicy, mockFields)
    ).rejects.toThrow('Only settled policies can be lapsed.');
  });

  it('throws when dateLapsed is missing', async () => {
    await expect(
      lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, { dateLapsed: null })
    ).rejects.toThrow('dateLapsed is required to lapse a policy.');
  });

  it('writes 3 batch docs atomically: policy update + history + notification', async () => {
    await lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, mockFields);
    expect(hoisted.mockBatchUpdate).toHaveBeenCalledOnce();
    expect(hoisted.mockBatchSet).toHaveBeenCalledTimes(2);    // history + notification
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
  });

  it('policy update payload has status lapsed + dateLapsed', async () => {
    await lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, mockFields);
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('lapsed');
    expect(policyPayload.dateLapsed).toEqual(mockFields.dateLapsed);
    expect(policyPayload).toHaveProperty('statusUpdatedAt');
  });

  it('history doc has fromStatus settled + toStatus lapsed', async () => {
    await lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, mockFields);
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.fromStatus).toBe('settled');
    expect(histPayload.toStatus).toBe('lapsed');
    expect(histPayload.actorUid).toBe('bm-uid');
    expect(histPayload.actorRole).toBe('branch_manager');
    expect(histPayload.agentId).toBe('agent-1');
    expect(histPayload.unitId).toBe('unit-1');
  });

  it('lapseReason written to policy + history when provided', async () => {
    const fields = { ...mockFields, lapseReason: 'Non-payment' };
    await lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, fields);
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.lapseReason).toBe('Non-payment');
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.changedFields.lapseReason).toBe('Non-payment');
  });

  it('lapseReason NOT written to policy or history when absent/empty', async () => {
    await lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, { dateLapsed: mockFields.dateLapsed });
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.lapseReason).toBeUndefined();
    const histPayload = hoisted.mockBatchSet.mock.calls[0][1];
    expect(histPayload.changedFields.lapseReason).toBeUndefined();
  });

  it('notification has type policy_lapsed and userId = agentId', async () => {
    await lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, mockFields);
    const notifPayload = hoisted.mockBatchSet.mock.calls[1][1];
    expect(notifPayload.type).toBe('policy_lapsed');
    expect(notifPayload.userId).toBe('agent-1');
    expect(notifPayload.tenantId).toBe('t1');
    expect(notifPayload.read).toBe(false);
    expect(notifPayload.body).toContain('Jane Smith');
  });

  // F-1 (audit A-1): the EXACT update, provenance included. Rules Arm D denies
  // a lapse without statusSource / statusSetBy unless this same manager set the
  // settled status. tests/rules/policies.rules.test.mjs sends this payload via
  // buildLapseUpdate.
  it('policy update is exactly the lapse fields plus the manager status provenance', async () => {
    await lapsePolicy('t1', mockBMProfile, 'p1', mockSettledPolicy, { ...mockFields, lapseReason: ' Non-payment ' });
    expect(hoisted.mockBatchUpdate.mock.calls[0][1]).toEqual({
      status:          'lapsed',
      statusUpdatedAt: { _type: 'serverTimestamp' },
      dateLapsed:      mockFields.dateLapsed,
      lapseReason:     'Non-payment',
      statusSource:    'manager',
      statusSetBy:     'bm-uid',
      statusAsOf:      getTodayTT(),
    });
    expect(hoisted.mockBatchSet.mock.calls[0][1].changedFields).toEqual({
      dateLapsed:   mockFields.dateLapsed,
      lapseReason:  'Non-payment',
      statusSource: 'manager',
      statusSetBy:  'bm-uid',
    });
  });

  it('tenant_admin can also lapse a policy', async () => {
    const taProfile = { uid: 'ta1', name: 'Tenant Admin', role: 'tenant_admin' };
    await expect(
      lapsePolicy('t1', taProfile, 'p1', mockSettledPolicy, mockFields)
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// settlementShapeFromPolicies — H3 awards ledger path
// ─────────────────────────────────────────────────────────────────────────────

function makeTimestamp(isoDate) {
  const ms = new Date(isoDate).getTime();
  return { toDate: () => new Date(ms) };
}

function makePolicy(status, dateIssued, settledAPI) {
  return { status, dateIssued: makeTimestamp(dateIssued), settledAPI };
}

describe('settlementShapeFromPolicies', () => {
  it('returns empty array for no policies', () => {
    expect(settlementShapeFromPolicies([])).toEqual([]);
  });

  it('excludes non-settled policies (submitted, rated, lapsed, etc.)', () => {
    const policies = [
      makePolicy('submitted',  '2026-03-10', 5000),
      makePolicy('rated',      '2026-03-12', 5000),
      makePolicy('lapsed',     '2026-03-20', 5000),
      makePolicy('postponed',  '2026-03-15', 5000),
    ];
    expect(settlementShapeFromPolicies(policies)).toEqual([]);
  });

  it('groups a single settled policy into YYYY-MM periodKey', () => {
    const policies = [makePolicy('settled', '2026-01-15', 12000)];
    const result = settlementShapeFromPolicies(policies);
    expect(result).toHaveLength(1);
    expect(result[0].periodKey).toBe('2026-01');
    expect(result[0].settledAPI).toBe(12000);
    expect(result[0].settledApps).toBe(1);
  });

  it('accumulates multiple policies in the same month', () => {
    const policies = [
      makePolicy('settled', '2026-05-01', 10000),
      makePolicy('settled', '2026-05-20', 8000),
      makePolicy('settled', '2026-05-31', 5000),
    ];
    const result = settlementShapeFromPolicies(policies);
    expect(result).toHaveLength(1);
    expect(result[0].periodKey).toBe('2026-05');
    expect(result[0].settledAPI).toBe(23000);
    expect(result[0].settledApps).toBe(3);
  });

  it('splits policies across different months into separate rows', () => {
    const policies = [
      makePolicy('settled', '2026-01-10', 10000),
      makePolicy('settled', '2026-02-15', 8000),
      makePolicy('settled', '2026-03-20', 6000),
    ];
    const result = settlementShapeFromPolicies(policies);
    expect(result).toHaveLength(3);
    const byPeriod = Object.fromEntries(result.map((r) => [r.periodKey, r]));
    expect(byPeriod['2026-01'].settledAPI).toBe(10000);
    expect(byPeriod['2026-02'].settledAPI).toBe(8000);
    expect(byPeriod['2026-03'].settledAPI).toBe(6000);
    expect(byPeriod['2026-01'].settledApps).toBe(1);
  });

  it('skips policies with null or missing dateIssued', () => {
    const policies = [
      { status: 'settled', dateIssued: null, settledAPI: 5000 },
      { status: 'settled', dateIssued: undefined, settledAPI: 5000 },
      makePolicy('settled', '2026-04-10', 12000),
    ];
    const result = settlementShapeFromPolicies(policies);
    expect(result).toHaveLength(1);
    expect(result[0].periodKey).toBe('2026-04');
    expect(result[0].settledApps).toBe(1);
  });

  it('defaults persistency to 0 (caller merges from settlement collection)', () => {
    const policies = [makePolicy('settled', '2026-06-01', 15000)];
    const result = settlementShapeFromPolicies(policies);
    expect(result[0].persistency).toBe(0);
  });

  it('parity: produces equivalent confirmed-data shape to a matching settlement doc', () => {
    // Build a policy matching a hand-crafted settlement doc for the same month
    const policy = makePolicy('settled', '2026-03-14', 18500);
    const settlementDoc = { periodKey: '2026-03', settledAPI: 18500, settledApps: 1, persistency: 80 };

    const [ledgerRow] = settlementShapeFromPolicies([policy]);
    // settledAPI and settledApps must match
    expect(ledgerRow.settledAPI).toBe(settlementDoc.settledAPI);
    expect(ledgerRow.settledApps).toBe(settlementDoc.settledApps);
    expect(ledgerRow.periodKey).toBe(settlementDoc.periodKey);
    // persistency starts at 0 — caller responsibility to merge
    expect(ledgerRow.persistency).toBe(0);
  });
});

// ── Tier-3 3.1: CRO Delivery Register ───────────────────────────────────────
describe('getDeliverablePolicies', () => {
  it('queries settled policies with a SINGLE equality filter and NO orderBy (index-safe)', async () => {
    hoisted.mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'p1', data: () => ({ status: 'settled', ownerName: 'A' }) }],
    });
    const res = await getDeliverablePolicies('t1');

    // exactly one where(), on status == 'settled'
    expect(hoisted.mockWhere).toHaveBeenCalledTimes(1);
    expect(hoisted.mockWhere).toHaveBeenCalledWith('status', '==', 'settled');
    // no orderBy → no composite index required
    expect(hoisted.mockOrderBy).not.toHaveBeenCalled();
    expect(res).toEqual([{ id: 'p1', status: 'settled', ownerName: 'A' }]);
  });
});

describe('recordPolicyDelivery', () => {
  it('writes EXACTLY the three delivery contract fields (hasOnly Arm E)', async () => {
    await recordPolicyDelivery('t1', 'p1', { deliveredBy: 'cro-uid', deliveryDate: '2026-05-10' });
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(['deliveredAt', 'deliveredBy', 'policyDeliveryDate']);
    expect(payload.deliveredBy).toBe('cro-uid');
    expect(payload.policyDeliveryDate).toEqual({ _type: 'timestamp', ms: Date.parse('2026-05-10T04:00:00Z') });
    expect(payload.deliveredAt).toEqual({ _type: 'serverTimestamp' });
  });

  it('defaults the delivery date to today (TT) when omitted', async () => {
    await recordPolicyDelivery('t1', 'p1', { deliveredBy: 'cro-uid' });
    const [, payload] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(payload.policyDeliveryDate).toEqual({ _type: 'timestamp', ms: Date.parse(`${getTodayTT()}T04:00:00Z`) });
  });

  it('rejects a future delivery date client-side (never writes)', async () => {
    const future = '2999-12-31';
    await expect(recordPolicyDelivery('t1', 'p1', { deliveredBy: 'cro-uid', deliveryDate: future }))
      .rejects.toThrow(/future/i);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('requires deliveredBy', async () => {
    await expect(recordPolicyDelivery('t1', 'p1', {})).rejects.toThrow(/deliveredBy/i);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rejects a malformed delivery date', async () => {
    await expect(recordPolicyDelivery('t1', 'p1', { deliveredBy: 'cro-uid', deliveryDate: '10/05/2026' }))
      .rejects.toThrow(/YYYY-MM-DD/);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });
});

// ── P2b: imported OIPA policies are excluded from the aggregating readers ────
// Dispatcher ruling 5e. The filter is client-side because a Firestore
// `where('importSource','!=','oipa_import')` would drop every doc that LACKS the
// field -- i.e. every organic policy -- returning the exact inverse with no error.
describe('P2b — excludeImported on the aggregating readers', () => {
  const IMPORTED = { id: 'imp1', data: () => ({ status: 'settled', policyNumber: 'IMP1', importSource: 'oipa_import' }) };
  const ORGANIC  = { id: 'org1', data: () => ({ status: 'settled', policyNumber: 'ORG1' }) };
  const LEGACY   = { id: 'old1', data: () => ({ status: 'settled', policyNumber: 'OLD1' }) };

  it('getDeliverablePolicies keeps organic and legacy docs but drops imported ones', async () => {
    // Without this, the CRO Delivery Register opens to 117 settled OIPA docs
    // that look like they are awaiting delivery.
    hoisted.mockGetDocs.mockResolvedValueOnce({ docs: [IMPORTED, ORGANIC, LEGACY] });
    const res = await getDeliverablePolicies('t1');

    expect(res.map((d) => d.policyNumber)).toEqual(['ORG1', 'OLD1']);
    expect(res.some((d) => d.importSource === 'oipa_import')).toBe(false);
  });

  it('getDeliverablePolicies returns [] when every settled doc is imported', async () => {
    hoisted.mockGetDocs.mockResolvedValueOnce({ docs: [IMPORTED] });
    expect(await getDeliverablePolicies('t1')).toEqual([]);
  });

  it('getPoliciesForManager drops imported docs for a unit manager', async () => {
    hoisted.mockGetDocs.mockResolvedValueOnce({ docs: [IMPORTED, ORGANIC] });
    const res = await getPoliciesForManager('t1', { role: 'unit_manager', uid: 'um-1' });
    expect(res.map((d) => d.policyNumber)).toEqual(['ORG1']);
  });

  it('getPoliciesForManager drops imported docs for a branch manager', async () => {
    hoisted.mockGetDocs.mockResolvedValueOnce({ docs: [IMPORTED, ORGANIC] });
    const res = await getPoliciesForManager('t1', { role: 'branch_manager', branchId: 'b-1' });
    expect(res.map((d) => d.policyNumber)).toEqual(['ORG1']);
  });

  it('getPoliciesForManager drops imported docs on the tenant-wide arm too', async () => {
    hoisted.mockGetDocs.mockResolvedValueOnce({ docs: [IMPORTED, ORGANIC, LEGACY] });
    const res = await getPoliciesForManager('t1', { role: 'tenant_admin' });
    expect(res.map((d) => d.policyNumber)).toEqual(['ORG1', 'OLD1']);
  });

  it('getOwnPolicies is deliberately NOT filtered -- the ledger needs imported docs', async () => {
    // The exclusion lives at the CALLERS of this reader, not in it, because
    // PolicyLedgerPanel legitimately shows the imported book (ruling 5e).
    hoisted.mockGetDocs.mockResolvedValueOnce({ docs: [IMPORTED, ORGANIC] });
    const res = await getOwnPolicies('t1', 'uid-1');
    expect(res.map((d) => d.policyNumber)).toEqual(['IMP1', 'ORG1']);
  });
});

// ── P2d (BUG-01 option B) — selfConfirmPolicy ─────────────────────────────────
describe('selfConfirmPolicy', () => {
  const agent = { uid: 'agent-1', role: 'agent', unitId: 'um-1' };
  // Self-declared: the agent set the status. Head-office policies are refused (ruling, below).
  const policy = { agentId: 'agent-1', status: 'settled', statusSource: 'agent' };
  const fields = { settledAPI: '5200', issuedCoverage: '250000', initialPremium: '433.33', earnedCommission: '1300' };

  beforeEach(() => { vi.clearAllMocks(); hoisted.mockBatchCommit.mockResolvedValue(undefined); });

  it('writes ONLY the four details + self-confirm stamps, never status / dateIssued / statusSource / confirmedAt', async () => {
    await selfConfirmPolicy('t1', agent, 'p1', policy, fields);
    const update = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(Object.keys(update).sort()).toEqual([
      'earnedCommission', 'enteredAt', 'enteredBy', 'initialPremium', 'issuedCoverage',
      'selfConfirmedAt', 'selfConfirmedBy', 'settledAPI',
    ]);
    expect(update).toMatchObject({ settledAPI: 5200, issuedCoverage: 250000, initialPremium: 433.33, earnedCommission: 1300, selfConfirmedBy: 'agent-1', enteredBy: 'agent-1' });
    const history = hoisted.mockBatchSet.mock.calls[0][1];
    expect(history).toMatchObject({ fromStatus: 'settled', toStatus: 'settled', actorUid: 'agent-1', agentId: 'agent-1' });
    expect(hoisted.mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('refuses another agent\'s policy, a non-settled policy, and a manager-confirmed one', async () => {
    await expect(selfConfirmPolicy('t1', agent, 'p1', { ...policy, agentId: 'agent-2' }, fields)).rejects.toThrow(/own policies/);
    await expect(selfConfirmPolicy('t1', agent, 'p1', { ...policy, status: 'submitted' }, fields)).rejects.toThrow(/settled/);
    await expect(selfConfirmPolicy('t1', agent, 'p1', { ...policy, confirmedByUid: 'bm-1' }, fields)).rejects.toThrow(/manager/);
    expect(hoisted.mockBatchCommit).not.toHaveBeenCalled();
  });

  it('RULING (27 Sep 2026, option A): refuses a head-office policy — its figures are locked', async () => {
    await expect(selfConfirmPolicy('t1', agent, 'p1', { ...policy, statusSource: 'oipa_import' }, fields))
      .rejects.toThrow(/head office/);
    expect(hoisted.mockBatchCommit).not.toHaveBeenCalled();
  });

  it('refuses non-positive figures (same guards as the settle transition)', async () => {
    await expect(selfConfirmPolicy('t1', agent, 'p1', policy, { ...fields, settledAPI: '0' })).rejects.toThrow(/settledAPI/);
    await expect(selfConfirmPolicy('t1', agent, 'p1', policy, { ...fields, earnedCommission: '-1' })).rejects.toThrow(/earnedCommission/);
  });
});
