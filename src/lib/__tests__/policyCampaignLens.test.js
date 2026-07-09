import { describe, it, expect } from 'vitest';
import {
  policyContribution, derivePolicyLens, lensFilterCounts, LENS_FILTERS,
} from '../policyCampaignLens';

const CAMPAIGN = {
  id: 'nov', name: 'November Sprint', scope: { type: 'branch' },
  startDate: '2026-01-01', endDate: '2026-12-31',
  structure: 'qualify', tiers: [{ api: 50000 }, { api: 100000 }],
};

const P = (over) => ({
  id: 'x', productLine: 'life', isSelfOrFamily: false,
  status: 'settled', dateSubmitted: '2026-06-01', settledAPI: 21600, ...over,
});

describe('policyContribution', () => {
  it('COUNTS an eligible, in-window, settled policy (value = settled API)', () => {
    const c = policyContribution(P(), CAMPAIGN);
    expect(c.state).toBe('counts');
    expect(c.value).toBe(21600);
  });

  it('PENDING for eligible, in-window, not-yet-settled', () => {
    expect(policyContribution(P({ status: 'submitted' }), CAMPAIGN).state).toBe('pending');
    expect(policyContribution(P({ status: 'rated' }), CAMPAIGN).state).toBe('pending');
  });

  it('EXCLUDES lapsed / closed policies', () => {
    expect(policyContribution(P({ status: 'lapsed' }), CAMPAIGN).state).toBe('excluded');
  });

  it('EXCLUDES non-Life and self/family policies', () => {
    expect(policyContribution(P({ productLine: 'motor' }), CAMPAIGN).state).toBe('excluded');
    expect(policyContribution(P({ isSelfOrFamily: true }), CAMPAIGN).state).toBe('excluded');
  });

  it('EXCLUDES policies written outside the campaign window', () => {
    expect(policyContribution(P({ dateSubmitted: '2025-06-01' }), CAMPAIGN).state).toBe('excluded');
  });
});

describe('derivePolicyLens', () => {
  it('returns null without a campaign', () => {
    expect(derivePolicyLens([P()], null)).toBeNull();
  });

  it('aggregates covered/tracked counts + settled API, and takes the top tier as target', () => {
    const policies = [
      P({ id: 'a', status: 'settled', settledAPI: 21600 }),
      P({ id: 'b', status: 'settled', settledAPI: 48000 }),
      P({ id: 'c', status: 'submitted' }),           // pending
      P({ id: 'd', status: 'lapsed' }),               // excluded
      P({ id: 'e', productLine: 'motor' }),           // excluded
    ];
    const lens = derivePolicyLens(policies, CAMPAIGN, {});
    expect(lens.counts.covered).toBe(2);
    expect(lens.counts.tracked).toBe(3); // 2 counts + 1 pending
    expect(lens.api.current).toBe(69600);
    expect(lens.api.target).toBe(100000);
    expect(lens.targetDerived).toBe(true);
    expect(lens.progressPct).toBe(70); // 69600 / 100000
  });

  it('falls back to covered/tracked progress when the campaign has no tier target', () => {
    const flat = { ...CAMPAIGN, structure: undefined, tiers: undefined };
    const lens = derivePolicyLens([P({ id: 'a' }), P({ id: 'c', status: 'submitted' })], flat, {});
    expect(lens.api.target).toBeNull();
    expect(lens.targetDerived).toBe(false);
    expect(lens.progressPct).toBe(50); // 1 covered of 2 tracked
  });
});

describe('lensFilterCounts', () => {
  it('counts each state + all', () => {
    const lens = derivePolicyLens(
      [P({ id: 'a' }), P({ id: 'b', status: 'submitted' }), P({ id: 'c', status: 'lapsed' })],
      CAMPAIGN, {},
    );
    const counts = lensFilterCounts(lens.contributions);
    expect(counts).toEqual({ all: 3, counts: 1, pending: 1, excluded: 1 });
    expect(LENS_FILTERS.map((f) => f.key)).toEqual(['all', 'counts', 'pending', 'excluded']);
  });
});
