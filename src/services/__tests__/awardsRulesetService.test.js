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

import {
  getAwardsRuleset, setAwardsRuleset, deepMergeRuleset, getMergedAwardsRuleset,
} from '../awardsRulesetService';
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

  // ── CONTRACT-LOCK: getAwardsRuleset stays RAW (admin-editor fidelity) ────────
  it('CONTRACT-LOCK — a PARTIAL stored doc is returned unchanged (NOT backfilled)', async () => {
    const partial = { advisorMonth: { api: { threshold: 60000 } } }; // missing most groups
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => partial });
    const result = await getAwardsRuleset('tenant1', 2026);
    // Same reference, no default backfill — the admin editor must see exactly
    // what is stored (Option A). If this ever fails, deep-merge leaked into the
    // raw accessor and the editor would silently normalize partial docs on save.
    expect(result).toBe(partial);
    expect(result).not.toHaveProperty('clubAward');
    expect(result).not.toHaveProperty('persistencyAward');
    expect(result.advisorMonth).not.toHaveProperty('persistGate');
  });
});

// ── deepMergeRuleset (crash-prevention helper) ────────────────────────────────
describe('deepMergeRuleset', () => {
  it('missing / empty / non-object loaded → fallback', () => {
    expect(deepMergeRuleset(null, DEFAULT_RULESET_2026)).toBe(DEFAULT_RULESET_2026);
    expect(deepMergeRuleset(undefined, DEFAULT_RULESET_2026)).toBe(DEFAULT_RULESET_2026);
    expect(deepMergeRuleset('nope', DEFAULT_RULESET_2026)).toBe(DEFAULT_RULESET_2026);
    expect(deepMergeRuleset({}, DEFAULT_RULESET_2026)).toEqual(DEFAULT_RULESET_2026);
  });

  it('complete custom doc → custom values intact (defaults do NOT clobber present values)', () => {
    const custom = {
      ...DEFAULT_RULESET_2026,
      mdrtAward: { ...DEFAULT_RULESET_2026.mdrtAward, apiThreshold: 999999 },
    };
    const merged = deepMergeRuleset(custom, DEFAULT_RULESET_2026);
    expect(merged.mdrtAward.apiThreshold).toBe(999999); // doc wins
  });

  it('partial doc → gaps backfilled from DEFAULT, present values preserved (crash-prevention)', () => {
    const partial = { mdrtAward: { apiThreshold: 123456, apiInContention: 250000, prize: 'X' } };
    const merged = deepMergeRuleset(partial, DEFAULT_RULESET_2026);
    expect(merged.mdrtAward.apiThreshold).toBe(123456);                  // present preserved
    expect(merged.clubAward).toEqual(DEFAULT_RULESET_2026.clubAward);    // gap backfilled
    expect(merged.persistencyAward).toEqual(DEFAULT_RULESET_2026.persistencyAward);
  });

  it('nested-partial → missing sub-field backfilled from DEFAULT (proves recurse)', () => {
    const partial = {
      persistencyAward: { silver: { ...DEFAULT_RULESET_2026.persistencyAward.silver, apiThreshold: 200000 } },
    };
    const merged = deepMergeRuleset(partial, DEFAULT_RULESET_2026);
    expect(merged.persistencyAward.silver.apiThreshold).toBe(200000);                       // present preserved
    expect(merged.persistencyAward.gold).toEqual(DEFAULT_RULESET_2026.persistencyAward.gold); // recursed backfill
  });

  it('arrays are taken wholesale from the loaded doc when present (not element-merged)', () => {
    const customTiers = [{ id: 'only', name: 'Only', apiMin: 1 }];
    const merged = deepMergeRuleset({ clubAward: { tiers: customTiers } }, DEFAULT_RULESET_2026);
    expect(merged.clubAward.tiers).toBe(customTiers);
  });

  it('a key explicitly null/undefined in the doc falls back to DEFAULT (Gemini #709)', () => {
    const partial = { clubAward: null, persistencyAward: undefined, mdrtAward: { apiThreshold: 5 } };
    const merged = deepMergeRuleset(partial, DEFAULT_RULESET_2026);
    expect(merged.clubAward).toEqual(DEFAULT_RULESET_2026.clubAward);                 // null → default
    expect(merged.persistencyAward).toEqual(DEFAULT_RULESET_2026.persistencyAward);   // undefined → default
    expect(merged.mdrtAward.apiThreshold).toBe(5);                                    // real value preserved
  });
});

// ── getMergedAwardsRuleset (render-only accessor) ──────────────────────────────
describe('getMergedAwardsRuleset', () => {
  it('missing doc → DEFAULT (unchanged behavior for the no-doc case)', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getMergedAwardsRuleset('tenant1', 2026);
    expect(result).toEqual(DEFAULT_RULESET_2026);
  });

  it('partial stored doc → returns a COMPLETE ruleset (every DEFAULT group present)', async () => {
    const partial = { mdrtAward: { apiThreshold: 123456 } };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => partial });
    const result = await getMergedAwardsRuleset('tenant1', 2026);
    expect(result.mdrtAward.apiThreshold).toBe(123456);
    for (const key of Object.keys(DEFAULT_RULESET_2026)) {
      expect(result).toHaveProperty(key); // no missing group → no destructure crash downstream
    }
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
