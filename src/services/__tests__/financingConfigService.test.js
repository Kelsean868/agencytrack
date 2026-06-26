import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc:             (db, path) => ({ __ref: path }),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

import {
  getFinancingConfig,
  setFinancingConfig,
  FINANCING_CONFIG_DEFAULT,
} from '../financingConfigService';

const { mockGetDoc, mockSetDoc } = hoisted;

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
});

describe('FINANCING_CONFIG_DEFAULT', () => {
  it('defaults notifyRecipientUid to null', () => {
    expect(FINANCING_CONFIG_DEFAULT).toEqual({ notifyRecipientUid: null });
  });
});

describe('getFinancingConfig', () => {
  it('reads from the correct Firestore path', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await getFinancingConfig('tenant1');
    const [docRef] = mockGetDoc.mock.calls[0];
    expect(docRef.__ref).toBe('tenants/tenant1/config/financingConfig');
  });

  it('returns the default (null recipient) when the doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getFinancingConfig('tenant1');
    expect(result).toEqual({ notifyRecipientUid: null });
  });

  it('returns the stored recipient when present', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ notifyRecipientUid: 'cro-uid', updatedBy: 'ta1' }) });
    const result = await getFinancingConfig('tenant1');
    expect(result).toEqual({ notifyRecipientUid: 'cro-uid' });
  });

  it('falls back to null when the stored doc omits the field', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ updatedBy: 'ta1' }) });
    const result = await getFinancingConfig('tenant1');
    expect(result.notifyRecipientUid).toBeNull();
  });

  it('throws without a tenantId', async () => {
    await expect(getFinancingConfig()).rejects.toThrow('tenantId required');
  });
});

describe('setFinancingConfig', () => {
  const actor = { uid: 'ta1', name: 'Ty TA' };

  it('writes the recipient + audit metadata to the correct path with merge', async () => {
    mockSetDoc.mockResolvedValue();
    const res = await setFinancingConfig('tenant1', { notifyRecipientUid: 'cro-uid' }, actor);
    expect(res).toEqual({ notifyRecipientUid: 'cro-uid' });
    const [ref, payload, opts] = mockSetDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/tenant1/config/financingConfig');
    expect(payload).toEqual({
      notifyRecipientUid: 'cro-uid',
      updatedBy: 'ta1',
      updatedByName: 'Ty TA',
      updatedAt: '__SERVER_TIMESTAMP__',
    });
    expect(opts).toEqual({ merge: true });
  });

  it('clears the recipient (null) when passed null / "" / undefined', async () => {
    mockSetDoc.mockResolvedValue();
    for (const val of [null, '', undefined]) {
      mockSetDoc.mockClear();
      const res = await setFinancingConfig('tenant1', { notifyRecipientUid: val }, actor);
      expect(res).toEqual({ notifyRecipientUid: null });
      expect(mockSetDoc.mock.calls[0][1].notifyRecipientUid).toBeNull();
    }
  });

  it('defaults updatedByName to "" when actor has no name', async () => {
    mockSetDoc.mockResolvedValue();
    await setFinancingConfig('tenant1', { notifyRecipientUid: 'x' }, { uid: 'ta1' });
    expect(mockSetDoc.mock.calls[0][1].updatedByName).toBe('');
  });

  it('rejects a non-string recipient', async () => {
    await expect(setFinancingConfig('tenant1', { notifyRecipientUid: 123 }, actor)).rejects.toThrow('must be a string uid or null');
  });

  it('throws without a tenantId', async () => {
    await expect(setFinancingConfig(undefined, { notifyRecipientUid: 'x' }, actor)).rejects.toThrow('tenantId required');
  });

  it('throws without an actor uid', async () => {
    await expect(setFinancingConfig('tenant1', { notifyRecipientUid: 'x' }, {})).rejects.toThrow('actor.uid required');
  });
});
