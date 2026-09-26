import { describe, it, expect } from 'vitest';
import {
  policyContribution, derivePolicyLens, lensFilterCounts, LENS_FILTERS,
  buildCampaignProofExport,
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

describe('buildCampaignProofExport', () => {
  it('returns null when there is no lens', () => {
    expect(buildCampaignProofExport(null, [])).toBeNull();
  });

  it('builds one row per contribution, in every state, with raw (non-currency) values', () => {
    const policies = [
      P({ id: 'a', ownerName: 'A. Gopaul', policyClass: 'whole_life', status: 'settled', settledAPI: 21600 }),
      P({ id: 'b', ownerName: 'K. Baksh', policyClass: 'term', status: 'submitted' }),
      P({ id: 'c', ownerName: 'R. Mohammed', policyClass: 'whole_life', status: 'lapsed' }),
    ];
    const lens = derivePolicyLens(policies, CAMPAIGN, {});
    const proof = buildCampaignProofExport(lens, policies);

    expect(proof.campaignName).toBe('November Sprint');
    expect(proof.headers).toEqual(['Policy Owner', 'Plan / Class', 'Qualification', 'API (TTD)']);
    expect(proof.rows).toHaveLength(3);
    expect(proof.rows).toEqual(
      expect.arrayContaining([
        ['A. Gopaul', 'whole_life', 'COUNTS', 21600],
        ['K. Baksh', 'term', 'PENDING', 0],
        ['R. Mohammed', 'whole_life', 'EXCLUDED', 0],
      ]),
    );
  });

  it('prefers planName over policyClass, and falls back to em-dash when neither is set', () => {
    const policies = [P({ id: 'a', ownerName: 'A. Gopaul', planName: 'Premier Whole Life', policyClass: 'whole_life' })];
    const lens = derivePolicyLens(policies, CAMPAIGN, {});
    const [row] = buildCampaignProofExport(lens, policies).rows;
    expect(row[1]).toBe('Premier Whole Life');

    const noClass = [P({ id: 'a', ownerName: 'A. Gopaul', planName: null, policyClass: null })];
    const lensNoClass = derivePolicyLens(noClass, CAMPAIGN, {});
    const [rowNoClass] = buildCampaignProofExport(lensNoClass, noClass).rows;
    expect(rowNoClass[1]).toBe('—');
  });

  it('falls back to "Policy" for the owner label when the policy is missing from the lookup', () => {
    const policies = [P({ id: 'a' })];
    const lens = derivePolicyLens(policies, CAMPAIGN, {});
    // Pass an empty policies array so buildCampaignProofExport can't resolve id "a".
    const proof = buildCampaignProofExport(lens, []);
    expect(proof.rows[0][0]).toBe('Policy');
  });

  it('returns zero rows for an empty policy list (contributions is empty, not absent)', () => {
    const lens = derivePolicyLens([], CAMPAIGN, {});
    const proof = buildCampaignProofExport(lens, []);
    expect(proof.rows).toEqual([]);
  });
});

// L0 — the two-layer ring's "pending" would-be credit, LEGACY (no credit
// table) window path: policyValue(policy) + 1 app, same rule the legacy
// COUNTS branch already uses just below it.
describe('L0 — pendingValue / pendingApps (legacy window path)', () => {
  it('an in-flight policy earns pendingValue = its policy value, pendingApps = 1', () => {
    const c = policyContribution(P({ status: 'submitted', settledAPI: 21600 }), CAMPAIGN);
    expect(c.state).toBe('pending');
    expect(c.pendingValue).toBe(21600);
    expect(c.pendingApps).toBe(1);
    expect(c.value).toBe(0); // unchanged
    expect(c.apps).toBe(0); // unchanged
  });

  it('an excluded policy carries no pendingValue/pendingApps fields', () => {
    const c = policyContribution(P({ status: 'lapsed' }), CAMPAIGN);
    expect(c.state).toBe('excluded');
    expect(c.pendingValue).toBeUndefined();
    expect(c.pendingApps).toBeUndefined();
  });

  it('rolls up into lens.pending without moving lens.api/apps.current', () => {
    const policies = [
      P({ id: 'a', status: 'settled', settledAPI: 21600 }),
      P({ id: 'b', status: 'submitted', settledAPI: 48000 }),
      P({ id: 'c', status: 'rated', settledAPI: 9000 }),
    ];
    const lens = derivePolicyLens(policies, CAMPAIGN, {});
    expect(lens.api.current).toBe(21600);
    expect(lens.apps.current).toBe(1);
    expect(lens.pending).toEqual({ api: 57000, apps: 2, count: 2 });
  });
});
