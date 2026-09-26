import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ setDoc: vi.fn(), doc: vi.fn(() => ({ __ref: true })) }));

vi.mock('firebase/firestore', () => ({
  doc: (...a) => hoisted.doc(...a),
  getDoc: vi.fn(),
  setDoc: (...a) => hoisted.setDoc(...a),
  serverTimestamp: () => '__ts__',
}));

import { setLedgerTargetTier } from '../userPrefsService';

beforeEach(() => { vi.clearAllMocks(); });

describe('setLedgerTargetTier (Policy Ledger L1)', () => {
  it('writes to the agent-private prefs doc users/{uid}/prefs/app', async () => {
    await setLedgerTargetTier('t1', 'u1', 'xmas', 'VIP');
    expect(hoisted.doc).toHaveBeenCalledWith(
      expect.anything(), 'tenants', 't1', 'users', 'u1', 'prefs', 'app',
    );
  });

  it('merge-writes ONLY ledgerTargetTiers.{campaignId} (+ updatedAt) so siblings survive', async () => {
    await setLedgerTargetTier('t1', 'u1', 'xmas', 'VIP');
    const [, payload, options] = hoisted.setDoc.mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(Object.keys(payload).sort()).toEqual(['ledgerTargetTiers', 'updatedAt']);
    expect(payload.ledgerTargetTiers).toEqual({ xmas: 'VIP' });
  });

  it('rejects a missing tenant/uid, campaign or tier without writing', async () => {
    await expect(setLedgerTargetTier('', 'u1', 'xmas', 'VIP')).rejects.toThrow(/tenantId and uid/);
    await expect(setLedgerTargetTier('t1', 'u1', '', 'VIP')).rejects.toThrow(/campaignId/);
    await expect(setLedgerTargetTier('t1', 'u1', 'xmas', '')).rejects.toThrow(/tier name/);
    expect(hoisted.setDoc).not.toHaveBeenCalled();
  });
});
