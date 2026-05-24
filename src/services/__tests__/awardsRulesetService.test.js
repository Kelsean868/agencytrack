import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
}));
const { mockGetDoc, mockSetDoc } = hoisted;

vi.mock('firebase/firestore', () => ({
  doc:             (_db, path) => ({ __ref: path }),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  setDoc:          (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => ({ _type: 'SERVER_TS' }),
}));

import { getAwardsRuleset, setAwardsRuleset } from '../awardsRulesetService';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
  mockSetDoc.mockResolvedValue(undefined);
});

describe('getAwardsRuleset', () => {
  it('returns DEFAULT_RULESET_2026 when no doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getAwardsRuleset('tenant1', 2026);
    expect(result).toBe(DEFAULT_RULESET_2026);
  });

  it('reads from the correct Firestore path', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await getAwardsRuleset('tenant1', 2026);
    expect(mockGetDoc).toHaveBeenCalledOnce();
    const ref = mockGetDoc.mock.calls[0][0];
    expect(ref.__ref).toBe('tenants/tenant1/config/awardsRuleset_2026');
  });

  it('returns the stored doc as-is when it exists', async () => {
    const customRuleset = {
      ...DEFAULT_RULESET_2026,
      advisorMonth: {
        ...DEFAULT_RULESET_2026.advisorMonth,
        api: { threshold: 75000, inContention: 37500, prize: 'Custom Prize' },
      },
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => customRuleset });
    const result = await getAwardsRuleset('tenant1', 2026);
    expect(result).toBe(customRuleset);
    expect(result.advisorMonth.api.threshold).toBe(75000);
  });

  it('stored doc is returned as-is (no deep-merge with defaults)', async () => {
    const minimalRuleset = { advisorMonth: { api: { threshold: 60000 } } };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => minimalRuleset });
    const result = await getAwardsRuleset('tenant1', 2026);
    expect(result).toBe(minimalRuleset);
    expect(result).not.toHaveProperty('quarterlyAward');
  });

  it('year param defaults to 2026', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await getAwardsRuleset('tenant1');
    const ref = mockGetDoc.mock.calls[0][0];
    expect(ref.__ref).toBe('tenants/tenant1/config/awardsRuleset_2026');
  });

  it('uses the provided year in the doc path', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await getAwardsRuleset('tenant1', 2027);
    const ref = mockGetDoc.mock.calls[0][0];
    expect(ref.__ref).toBe('tenants/tenant1/config/awardsRuleset_2027');
  });
});

describe('setAwardsRuleset', () => {
  it('writes to the correct Firestore path', async () => {
    await setAwardsRuleset('tenant1', 2026, { ...DEFAULT_RULESET_2026 }, 'uid1');
    const ref = mockSetDoc.mock.calls[0][0];
    expect(ref.__ref).toBe('tenants/tenant1/config/awardsRuleset_2026');
  });

  it('uses the provided year in the doc path', async () => {
    await setAwardsRuleset('tenant1', 2027, { ...DEFAULT_RULESET_2026 }, 'uid1');
    const ref = mockSetDoc.mock.calls[0][0];
    expect(ref.__ref).toBe('tenants/tenant1/config/awardsRuleset_2027');
  });

  it('calls setDoc with the complete ruleset — all DEFAULT_RULESET_2026 top-level groups present', async () => {
    await setAwardsRuleset('tenant1', 2026, { ...DEFAULT_RULESET_2026 }, 'uid1');
    const [, payload] = mockSetDoc.mock.calls[0];
    for (const key of Object.keys(DEFAULT_RULESET_2026)) {
      expect(payload).toHaveProperty(key);
    }
  });

  it('calls setDoc with no merge option (monolithic replacement)', async () => {
    await setAwardsRuleset('tenant1', 2026, { ...DEFAULT_RULESET_2026 }, 'uid1');
    const options = mockSetDoc.mock.calls[0][2];
    expect(options).toBeUndefined();
  });

  it('includes updatedBy and updatedAt in the payload', async () => {
    await setAwardsRuleset('tenant1', 2026, { ...DEFAULT_RULESET_2026 }, 'uid42');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.updatedBy).toBe('uid42');
    expect(payload.updatedAt).toBeDefined();
  });

  it('carries arrays (club tiers, recruitingAwards, activityAwards) through unchanged', async () => {
    await setAwardsRuleset('tenant1', 2026, { ...DEFAULT_RULESET_2026 }, 'uid1');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.clubAward.tiers).toEqual(DEFAULT_RULESET_2026.clubAward.tiers);
    expect(payload.recruitingAwards).toEqual(DEFAULT_RULESET_2026.recruitingAwards);
    expect(payload.activityAwards).toEqual(DEFAULT_RULESET_2026.activityAwards);
    expect(payload.managerMonthlyBonus.tiers).toEqual(DEFAULT_RULESET_2026.managerMonthlyBonus.tiers);
  });

  it('throws when a top-level group is missing (completeness guard)', async () => {
    const { advisorMonth: _removed, ...partial } = DEFAULT_RULESET_2026;
    await expect(setAwardsRuleset('tenant1', 2026, partial, 'uid1'))
      .rejects.toThrow('advisorMonth');
  });

  it('throws when a numeric scalar is non-finite', async () => {
    const bad = {
      ...DEFAULT_RULESET_2026,
      advisorMonth: { ...DEFAULT_RULESET_2026.advisorMonth, persistGate: NaN },
    };
    await expect(setAwardsRuleset('tenant1', 2026, bad, 'uid1'))
      .rejects.toThrow();
  });

  it('throws when a numeric scalar is negative', async () => {
    const bad = {
      ...DEFAULT_RULESET_2026,
      advisorMonth: { ...DEFAULT_RULESET_2026.advisorMonth, persistGate: -1 },
    };
    await expect(setAwardsRuleset('tenant1', 2026, bad, 'uid1'))
      .rejects.toThrow();
  });

  it('rejects a non-finite nested numeric (e.g. silver.apiThreshold)', async () => {
    const bad = {
      ...DEFAULT_RULESET_2026,
      persistencyAward: {
        ...DEFAULT_RULESET_2026.persistencyAward,
        silver: { ...DEFAULT_RULESET_2026.persistencyAward.silver, apiThreshold: Infinity },
      },
    };
    await expect(setAwardsRuleset('tenant1', 2026, bad, 'uid1'))
      .rejects.toThrow();
  });

  it('does not call setDoc when the completeness guard fires', async () => {
    const { quarterlyAward: _removed, ...partial } = DEFAULT_RULESET_2026;
    await expect(setAwardsRuleset('tenant1', 2026, partial, 'uid1')).rejects.toThrow();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('does not call setDoc when numeric validation fails', async () => {
    const bad = {
      ...DEFAULT_RULESET_2026,
      mdrtAward: { ...DEFAULT_RULESET_2026.mdrtAward, apiThreshold: -500 },
    };
    await expect(setAwardsRuleset('tenant1', 2026, bad, 'uid1')).rejects.toThrow();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── Array-element validation (D2b) ────────────────────────────────────────

  it('rejects NaN inside a clubAward tier element', async () => {
    const bad = {
      ...DEFAULT_RULESET_2026,
      clubAward: {
        ...DEFAULT_RULESET_2026.clubAward,
        tiers: [
          { ...DEFAULT_RULESET_2026.clubAward.tiers[0], apiMin: NaN },
          ...DEFAULT_RULESET_2026.clubAward.tiers.slice(1),
        ],
      },
    };
    await expect(setAwardsRuleset('tenant1', 2026, bad, 'uid1')).rejects.toThrow();
  });

  it('rejects a negative value inside a managerMonthlyBonus tier', async () => {
    const bad = {
      ...DEFAULT_RULESET_2026,
      managerMonthlyBonus: {
        tiers: [
          { minAvgApi: -1, bonusPct: 1.5 },
          ...DEFAULT_RULESET_2026.managerMonthlyBonus.tiers.slice(1),
        ],
      },
    };
    await expect(setAwardsRuleset('tenant1', 2026, bad, 'uid1')).rejects.toThrow();
  });

  it('accepts null for nullable open-ended fields (apiMax / max)', async () => {
    // clubAward.tiers already has apiMax: null on the gold tier — the default ruleset must pass
    await expect(setAwardsRuleset('tenant1', 2026, { ...DEFAULT_RULESET_2026 }, 'uid1'))
      .resolves.not.toThrow();
    // recruitingAwards last tier has max: null — also must pass
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.clubAward.tiers.find((t) => t.id === 'gold_club').apiMax).toBeNull();
    expect(payload.recruitingAwards.find((r) => r.id === 'recruiting_gold').max).toBeNull();
  });

  it('rejects an empty array (e.g. activityAwards = [])', async () => {
    const bad = { ...DEFAULT_RULESET_2026, activityAwards: [] };
    await expect(setAwardsRuleset('tenant1', 2026, bad, 'uid1')).rejects.toThrow();
  });

  it('save with BOTH scalar edits and array edits writes the complete 16-group ruleset', async () => {
    const editedTiers = [
      ...DEFAULT_RULESET_2026.clubAward.tiers.slice(0, 4),
      { ...DEFAULT_RULESET_2026.clubAward.tiers[4], apiInContention: 400000 },
    ];
    const ruleset = {
      ...DEFAULT_RULESET_2026,
      advisorMonth: { ...DEFAULT_RULESET_2026.advisorMonth, persistGate: 91 },
      clubAward: { ...DEFAULT_RULESET_2026.clubAward, tiers: editedTiers },
    };
    await setAwardsRuleset('tenant1', 2026, ruleset, 'uid1');
    const [, payload] = mockSetDoc.mock.calls[0];

    // Scalar edit persisted
    expect(payload.advisorMonth.persistGate).toBe(91);
    // Array edit persisted
    expect(payload.clubAward.tiers[4].apiInContention).toBe(400000);
    // All 16 top-level groups present
    for (const key of Object.keys(DEFAULT_RULESET_2026)) {
      expect(payload).toHaveProperty(key);
    }
  });
});
