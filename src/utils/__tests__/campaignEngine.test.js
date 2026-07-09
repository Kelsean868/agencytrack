import { describe, it, expect } from 'vitest';
import {
  PERSISTENCY_GATE_BANDS,
  GATE_BAND_RANGE_LABELS,
  gateBandFor,
  resolveTier,
  isTieredCampaign,
  persistencyPctForPeriod,
  computeStandings,
} from '../campaignEngine';

// Bronze/Silver/Gold ladder (matches the builder mockup default).
const TIERS = [
  { level: 3, name: 'Gold',   api: 250_000, apps: 20, cash: 10_000, voucher: 1_000 },
  { level: 2, name: 'Silver', api: 150_000, apps: 15, cash: 5_000,  voucher: 0 },
  { level: 1, name: 'Bronze', api: 75_000,  apps: 8,  cash: 2_000,  voucher: 0 },
];

const sub = (agentId, apiSold, applicationsSold) => ({ agentId, apiSold, applicationsSold });

describe('PERSISTENCY_GATE_BANDS', () => {
  it('is the ≥90/85-89/80-84/<80 multiplier ladder, high→low', () => {
    expect(PERSISTENCY_GATE_BANDS.map((b) => b.min)).toEqual([90, 85, 80, 0]);
    expect(PERSISTENCY_GATE_BANDS.map((b) => b.payout)).toEqual([1.0, 0.5, 0.25, 0]);
    expect(GATE_BAND_RANGE_LABELS).toEqual(['≥90%', '85–89%', '80–84%', '<80%']);
  });
});

describe('gateBandFor — band boundaries', () => {
  it('90 → full payout (100%)', () => {
    expect(gateBandFor(90).payout).toBe(1.0);
    expect(gateBandFor(95).payout).toBe(1.0);
  });
  it('85 → half payout; 89.99 stays in the half band', () => {
    expect(gateBandFor(85).payout).toBe(0.5);
    expect(gateBandFor(89.9).payout).toBe(0.5);
  });
  it('84.9 and 84 and 80 → quarter payout', () => {
    expect(gateBandFor(84.9).payout).toBe(0.25);
    expect(gateBandFor(84).payout).toBe(0.25);
    expect(gateBandFor(80).payout).toBe(0.25);
  });
  it('79 and below → disqualified (0 payout)', () => {
    expect(gateBandFor(79).payout).toBe(0);
    expect(gateBandFor(0).payout).toBe(0);
    expect(gateBandFor(79).label).toBe('DQ');
  });
  it('unknown persistency → null (renders "no data", never a silent DQ)', () => {
    expect(gateBandFor(null)).toBeNull();
    expect(gateBandFor(undefined)).toBeNull();
    expect(gateBandFor(NaN)).toBeNull();
  });
});

describe('resolveTier', () => {
  it('returns the highest tier cleared by BOTH api and apps', () => {
    expect(resolveTier(300_000, 22, TIERS).name).toBe('Gold');
    expect(resolveTier(200_000, 16, TIERS).name).toBe('Silver');
    expect(resolveTier(100_000, 10, TIERS).name).toBe('Bronze');
  });
  it('apps minimum gates the tier (high API but low apps drops a level)', () => {
    // 300k API clears Gold's API but only 15 apps → Gold apps=20 fails, Silver apps=15 clears
    expect(resolveTier(300_000, 15, TIERS).name).toBe('Silver');
    // 300k API but 7 apps → below Bronze's 8-apps floor entirely
    expect(resolveTier(300_000, 7, TIERS)).toBeNull();
  });
  it('below the lowest tier → null', () => {
    expect(resolveTier(50_000, 5, TIERS)).toBeNull();
  });
  it('empty / missing tiers → null', () => {
    expect(resolveTier(999_999, 99, [])).toBeNull();
    expect(resolveTier(999_999, 99, undefined)).toBeNull();
  });
});

describe('isTieredCampaign', () => {
  it('true for a qualify campaign with tiers', () => {
    expect(isTieredCampaign({ structure: 'qualify', tiers: TIERS })).toBe(true);
  });
  it('true for a placement campaign with placements', () => {
    expect(isTieredCampaign({ structure: 'placement', placements: [{ rank: 1, prize: 1000 }] })).toBe(true);
  });
  it('false for legacy flat campaigns (no structure)', () => {
    expect(isTieredCampaign({ targets: [{ metric: 'apiSold', threshold: 100000 }], prize: 'Trip' })).toBe(false);
    expect(isTieredCampaign({ structure: 'qualify', tiers: [] })).toBe(false);
    expect(isTieredCampaign(null)).toBe(false);
  });
});

describe('persistencyPctForPeriod', () => {
  const recs = [
    { monthKey: '2025-08', grossSettled: 100, netSettled: 91 },
    { monthKey: '2025-09', grossSettled: 100, netSettled: 89 },
  ];
  it('SUM-aggregates in-range records → whole-number percent', () => {
    // (91+89)/(100+100) = 0.90 → 90
    expect(persistencyPctForPeriod(recs, '2025-08-01', '2025-11-30')).toBe(90);
  });
  it('falls back to all records when none fall in range', () => {
    expect(persistencyPctForPeriod(recs, '2026-01-01', '2026-03-31')).toBe(90);
  });
  it('empty records → null', () => {
    expect(persistencyPctForPeriod([], '2025-08-01', '2025-11-30')).toBeNull();
    expect(persistencyPctForPeriod(undefined, '2025-08-01', '2025-11-30')).toBeNull();
  });
  it('zero gross settled → null (no usable persistency)', () => {
    expect(persistencyPctForPeriod([{ monthKey: '2025-08', grossSettled: 0, netSettled: 0 }], '2025-08-01', '2025-08-31')).toBeNull();
  });
});

describe('computeStandings — qualify structure', () => {
  const campaign = { structure: 'qualify', standingsMetric: 'apiSold', tiers: TIERS, persistencyGateEnabled: true };
  const participants = [
    { id: 'a', name: 'Ana Green', unit: 'S·01' },
    { id: 'b', name: 'Bob Blue',  unit: 'S·02' },
    { id: 'c', name: 'Cal Red',   unit: 'S·02' },
  ];
  const submissions = [
    sub('a', 300_000, 22), // Gold
    sub('b', 200_000, 16), // Silver
    sub('c', 60_000, 5),   // below L1
  ];

  it('ranks by API descending and assigns rank', () => {
    const s = computeStandings(campaign, submissions, participants, { a: 91, b: 91, c: 91 });
    expect(s.map((r) => [r.name, r.rank])).toEqual([['Ana Green', 1], ['Bob Blue', 2], ['Cal Red', 3]]);
  });

  it('resolves tier and projects payout = gross prize × gate multiplier', () => {
    const s = computeStandings(campaign, submissions, participants, { a: 91, b: 87, c: 91 });
    const ana = s.find((r) => r.agentId === 'a');
    const bob = s.find((r) => r.agentId === 'b');
    // Ana: Gold (10000 cash + 1000 voucher) at 91% → full → 11000
    expect(ana.tier.name).toBe('Gold');
    expect(ana.multiplier).toBe(1.0);
    expect(ana.projectedCash).toBe(10_000);
    expect(ana.projectedVoucher).toBe(1_000);
    expect(ana.qualified).toBe(true);
    // Bob: Silver (5000 cash) at 87% → half → 2500
    expect(bob.tier.name).toBe('Silver');
    expect(bob.multiplier).toBe(0.5);
    expect(bob.projectedCash).toBe(2_500);
  });

  it('persistency < 80 disqualifies — projected payout 0', () => {
    const s = computeStandings(campaign, submissions, participants, { a: 79, b: 91, c: 91 });
    const ana = s.find((r) => r.agentId === 'a');
    expect(ana.tier.name).toBe('Gold');    // reached the tier on production
    expect(ana.multiplier).toBe(0);        // but gate zeroes it
    expect(ana.projectedCash).toBe(0);
    expect(ana.disqualified).toBe(true);
    expect(ana.qualified).toBe(false);
  });

  it('below the lowest tier → no payout, not disqualified', () => {
    const s = computeStandings(campaign, submissions, participants, { c: 91 });
    const cal = s.find((r) => r.agentId === 'c');
    expect(cal.tier).toBeNull();
    expect(cal.projectedCash).toBe(0);
    expect(cal.disqualified).toBe(false);
  });

  it('null persistency → ungated (multiplier 1), band null, no DQ', () => {
    const s = computeStandings(campaign, submissions, participants, {});
    const ana = s.find((r) => r.agentId === 'a');
    expect(ana.band).toBeNull();
    expect(ana.multiplier).toBe(1);
    expect(ana.projectedCash).toBe(10_000);
    expect(ana.disqualified).toBe(false);
  });

  it('gate disabled → multiplier 1 regardless of low persistency', () => {
    const s = computeStandings({ ...campaign, persistencyGateEnabled: false }, submissions, participants, { a: 50 });
    const ana = s.find((r) => r.agentId === 'a');
    expect(ana.band).toBeNull();
    expect(ana.multiplier).toBe(1);
    expect(ana.projectedCash).toBe(10_000);
  });

  it('ranks by apps when standingsMetric is applicationsSold', () => {
    const s = computeStandings({ ...campaign, standingsMetric: 'applicationsSold' }, submissions, participants, {});
    // apps: a=22, b=16, c=5
    expect(s.map((r) => r.agentId)).toEqual(['a', 'b', 'c']);
    expect(s[0].metricValue).toBe(22);
  });

  it('backward compat — qualify structure with no tiers array never crashes; all below tier', () => {
    const s = computeStandings({ structure: 'qualify' }, submissions, participants, { a: 91 });
    expect(s).toHaveLength(3);
    expect(s.every((r) => r.tier === null && r.projectedCash === 0)).toBe(true);
  });
});

describe('computeStandings — placement structure', () => {
  const campaign = {
    structure: 'placement',
    standingsMetric: 'applicationsSold',
    persistencyGateEnabled: true,
    placements: [
      { rank: 1, prize: 2_000 },
      { rank: 2, prize: 1_000 },
      { rank: 3, prize: 500 },
    ],
  };
  const participants = [
    { id: 'a', name: 'Ana Green', unit: 'S·02' },
    { id: 'b', name: 'Bob Blue',  unit: 'S·02' },
    { id: 'c', name: 'Cal Red',   unit: 'S·02' },
    { id: 'd', name: 'Dee Gray',  unit: 'S·02' },
  ];
  const submissions = [sub('a', 0, 8), sub('b', 0, 6), sub('c', 0, 5), sub('d', 0, 3)];

  it('maps placements to the top ranks and gates the prize', () => {
    const s = computeStandings(campaign, submissions, participants, { a: 91, b: 87, c: 76, d: 91 });
    const [first, second, third, fourth] = s;
    expect(first.rank).toBe(1);
    expect(first.projectedCash).toBe(2_000); // 91% → full
    expect(second.projectedCash).toBe(500);  // 2nd prize 1000 at 87% → half → 500
    expect(third.disqualified).toBe(true);   // 3rd, 76% → DQ
    expect(third.projectedCash).toBe(0);
    expect(fourth.place).toBeNull();         // 4th → no placement
    expect(fourth.projectedCash).toBe(0);
  });

  it('podium order helper: rank 1 is the leader by metric', () => {
    const s = computeStandings(campaign, submissions, participants, {});
    expect(s[0].agentId).toBe('a');
    expect(s[0].appsTotal).toBe(8);
  });
});
