// R2 block 5 — the Campaign screen's "what if" slider maths.
//
// Fixture from docs/briefs/home-campaign-redesign.md § R2 Tests: 73,946 of
// 275,000, 20K a week → Champion around 6 Dec (96 days left to 31 Dec 2026,
// same "today" as the R1 pace fixture: 26 Sep 2026).

import { describe, it, expect } from 'vitest';
import { whatIfProjection, reachableTiers, clampToWhatIfStep, WHAT_IF_MIN, WHAT_IF_MAX } from '../campaignWhatIf';

const TIERS = [
  { name: 'Champion', api: 275_000, cash: 7_000 },
  { name: 'VIP', api: 375_000, cash: 20_000 },
  { name: 'Premier', api: 475_000, cash: 30_000 },
  { name: 'Elite', api: 675_000, cash: 52_000 },
  { name: 'Pioneer', api: 825_000, cash: 70_000 },
];

const TODAY = '2026-09-26';
const END = '2026-12-31';

describe('reachableTiers', () => {
  it('returns tiers above current API, ascending', () => {
    const out = reachableTiers(TIERS, 73_946);
    expect(out.map((t) => t.name)).toEqual(['Champion', 'VIP', 'Premier', 'Elite', 'Pioneer']);
  });

  it('excludes a tier already cleared', () => {
    const out = reachableTiers(TIERS, 300_000);
    expect(out.map((t) => t.name)).toEqual(['VIP', 'Premier', 'Elite', 'Pioneer']);
  });

  it('empty above the top tier', () => {
    expect(reachableTiers(TIERS, 900_000)).toEqual([]);
  });
});

describe('whatIfProjection', () => {
  it('73,946 of 275,000 at 20K a week → Champion around 6 Dec 2026', () => {
    const out = whatIfProjection({ apiCurrent: 73_946, tiers: TIERS, weeklyRate: 20_000, today: TODAY, endDate: END });
    expect(out.reaches).toHaveLength(1);
    expect(out.reaches[0].name).toBe('Champion');
    expect(out.reaches[0].date).toBe('2026-12-06');
    // VIP needs 751,054 more at 20K/week ≈ 263 days — past the campaign end.
    expect(out.notReachedTier.name).toBe('VIP');
  });

  it('a faster pace reaches both the next tier and the one after it', () => {
    const out = whatIfProjection({ apiCurrent: 73_946, tiers: TIERS, weeklyRate: 40_000, today: TODAY, endDate: END });
    expect(out.reaches.map((t) => t.name)).toEqual(['Champion', 'VIP']);
    expect(out.notReachedTier).toBeNull();
  });

  it('a rate of 0 or negative projects nothing', () => {
    expect(whatIfProjection({ apiCurrent: 73_946, tiers: TIERS, weeklyRate: 0, today: TODAY, endDate: END }))
      .toEqual({ reaches: [], notReachedTier: null });
    expect(whatIfProjection({ apiCurrent: 73_946, tiers: TIERS, weeklyRate: -5, today: TODAY, endDate: END }))
      .toEqual({ reaches: [], notReachedTier: null });
  });

  it('already at the top tier projects nothing', () => {
    expect(whatIfProjection({ apiCurrent: 900_000, tiers: TIERS, weeklyRate: 20_000, today: TODAY, endDate: END }))
      .toEqual({ reaches: [], notReachedTier: null });
  });

  it('with no endDate, a slow pace still eventually reaches every tier', () => {
    const out = whatIfProjection({ apiCurrent: 73_946, tiers: TIERS, weeklyRate: 5_000, today: TODAY, endDate: null });
    expect(out.reaches).toHaveLength(2);
    expect(out.notReachedTier).toBeNull();
  });
});

describe('clampToWhatIfStep', () => {
  it('rounds onto the 1,000 grid and clamps to 5,000–40,000', () => {
    expect(clampToWhatIfStep(14_660)).toBe(15_000);
    expect(clampToWhatIfStep(1_000)).toBe(WHAT_IF_MIN);
    expect(clampToWhatIfStep(100_000)).toBe(WHAT_IF_MAX);
    expect(clampToWhatIfStep(null)).toBe(WHAT_IF_MIN);
  });
});
