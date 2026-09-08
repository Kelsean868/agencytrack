import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ mockGetDoc: vi.fn() }));

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (db, path) => ({ __ref: path }),
  getDoc: (...args) => hoisted.mockGetDoc(...args),
}));

import { getFeatureFlags, isFlagOn, FEATURE_FLAG_KEYS } from '../featureFlagsService';

const snap = (exists, data) => ({ exists: () => exists, data: () => data });

beforeEach(() => { vi.clearAllMocks(); });

describe('featureFlagsService.getFeatureFlags', () => {
  it('returns {} for an ABSENT config doc (all flags OFF)', async () => {
    hoisted.mockGetDoc.mockResolvedValue(snap(false, undefined));
    expect(await getFeatureFlags('t1')).toEqual({});
  });

  it('returns {} when the doc exists but has no featureFlags field', async () => {
    hoisted.mockGetDoc.mockResolvedValue(snap(true, { annualAPI: 200000 }));
    expect(await getFeatureFlags('t1')).toEqual({});
  });

  it('returns the featureFlags map when present', async () => {
    hoisted.mockGetDoc.mockResolvedValue(snap(true, { featureFlags: { awardsProvenance: true } }));
    expect(await getFeatureFlags('t1')).toEqual({ awardsProvenance: true });
  });

  it('reads tenants/{tid}/config/settings', async () => {
    hoisted.mockGetDoc.mockResolvedValue(snap(false));
    await getFeatureFlags('south');
    expect(hoisted.mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ __ref: 'tenants/south/config/settings' }));
  });

  it('returns {} on a read failure (fail-closed)', async () => {
    hoisted.mockGetDoc.mockRejectedValue(new Error('permission denied'));
    expect(await getFeatureFlags('t1')).toEqual({});
  });

  it('returns {} for a missing tenantId without touching Firestore', async () => {
    expect(await getFeatureFlags(null)).toEqual({});
    expect(hoisted.mockGetDoc).not.toHaveBeenCalled();
  });
});

describe('featureFlagsService.isFlagOn', () => {
  it('is true only for an explicit true value', () => {
    expect(isFlagOn({ a: true }, 'a')).toBe(true);
    expect(isFlagOn({ a: 'true' }, 'a')).toBe(false);
    expect(isFlagOn({ a: 1 }, 'a')).toBe(false);
    expect(isFlagOn({}, 'a')).toBe(false);
    expect(isFlagOn(null, 'a')).toBe(false);
  });

  it('exposes the remaining 3.4 flag keys (persistencyV2 retired — P-D6)', () => {
    expect(FEATURE_FLAG_KEYS).toEqual({
      policyLedgerCampaignLens: 'policyLedgerCampaignLens',
      awardsProvenance: 'awardsProvenance',
    });
  });
});
