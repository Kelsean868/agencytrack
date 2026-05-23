import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
}));
const { mockGetDoc } = hoisted;

vi.mock('firebase/firestore', () => ({
  doc: (_db, path) => ({ __ref: path }),
  getDoc: (...args) => hoisted.mockGetDoc(...args),
}));

import { getAwardsRuleset } from '../awardsRulesetService';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';

beforeEach(() => {
  mockGetDoc.mockReset();
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
