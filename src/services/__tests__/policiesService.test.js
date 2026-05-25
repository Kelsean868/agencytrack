import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockAddDoc:          vi.fn(),
  mockGetDocs:         vi.fn(),
  mockQuery:           vi.fn((...args) => args),
  mockWhere:           vi.fn((...args) => args),
  mockOrderBy:         vi.fn((...args) => args),
  mockCollection:      vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  mockTimestamp:       { fromDate: vi.fn((d) => ({ _type: 'timestamp', ms: d.getTime() })) },
}));

vi.mock('firebase/firestore', () => ({
  collection:      (...args) => hoisted.mockCollection(...args),
  addDoc:          (...args) => hoisted.mockAddDoc(...args),
  getDocs:         (...args) => hoisted.mockGetDocs(...args),
  query:           (...args) => hoisted.mockQuery(...args),
  where:           (...args) => hoisted.mockWhere(...args),
  orderBy:         (...args) => hoisted.mockOrderBy(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
  Timestamp:       hoisted.mockTimestamp,
}));

import { createPolicy, getOwnPolicies } from '../policiesService';

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
