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
}));

import { createPolicy, getOwnPolicies, transitionPolicyStatus, getPolicyHistory, confirmPolicy, lapsePolicy } from '../policiesService';

const mockProfile = {
  uid: 'uid-1',
  agentNumber: 'A001',
  unitId: 'unit-1',
  branchId: 'branch-1',
};

const today = new Date().toISOString().split('T')[0];

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
  dateSubmitted: today,
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
  it('writes status submitted and denormalized agentId / unitId / branchId', async () => {
    await createPolicy('t1', mockProfile, VALID_DATA);
    expect(hoisted.mockAddDoc).toHaveBeenCalledOnce();
    const [, payload] = hoisted.mockAddDoc.mock.calls[0];
    expect(payload.status).toBe('submitted');
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

  it('postponed → submitted re-entry — no new transition fields', async () => {
    await transitionPolicyStatus('t1', mockProfile, 'p1', 'postponed', 'submitted', {});
    expect(hoisted.mockBatchCommit).toHaveBeenCalledOnce();
    const policyPayload = hoisted.mockBatchUpdate.mock.calls[0][1];
    expect(policyPayload.status).toBe('submitted');
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

  it('tenant_admin can also lapse a policy', async () => {
    const taProfile = { uid: 'ta1', name: 'Tenant Admin', role: 'tenant_admin' };
    await expect(
      lapsePolicy('t1', taProfile, 'p1', mockSettledPolicy, mockFields)
    ).resolves.toBeUndefined();
  });
});
