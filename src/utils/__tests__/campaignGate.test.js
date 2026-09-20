import { describe, it, expect } from 'vitest';
import {
  PERSISTENCY_GATE_BANDS,
  GATE_BAND_RANGE_LABELS,
  gateBandFor,
  gateBands,
  gateBandRangeLabels,
  normalizeGate,
  persistencyPctForPeriod,
  persistencyPctAtFinalMonth,
  persistencyPctForGate,
  computeStandings,
} from '../campaignEngine';

// ─── C1 · the per-campaign persistency gate (mode + basis) ───────────────────
//
// Rule 5 of the signed Christmas Campaign and Retreat 2026 document has exactly
// two rows: ≥90% pays 100% of the prize, <90% is Disqualified. It reads the
// FINAL MONTH (December 2026) — not an average over the six-month period. The
// four bands in PERSISTENCY_GATE_BANDS come from LAST year's campaign and must
// not be applied to this one, which is why the gate became per-campaign config
// (C-D1) rather than a rewrite of the shared constant.
//
// THE FIXTURE BELOW IS THE WHOLE POINT. One agent, records 2026-07..2026-12,
// whose December persistency is 0.89 and whose six-month SUM aggregate is 0.91.
// The two bases land on opposite sides of a 90% cliff, so a surface reading the
// wrong basis either pays an advisor who should be disqualified, or disqualifies
// one who should be paid in full. That is a money difference, not a cosmetic one.

// gross 600,000 across six months; net 546,000 → 0.91 aggregate.
// December alone: 89,000 / 100,000 → 0.89.
const FIXTURE_RECORDS = [
  { monthKey: '2026-07', grossSettled: 100_000, netSettled: 92_000, persistency: 0.92 },
  { monthKey: '2026-08', grossSettled: 100_000, netSettled: 92_000, persistency: 0.92 },
  { monthKey: '2026-09', grossSettled: 100_000, netSettled: 91_000, persistency: 0.91 },
  { monthKey: '2026-10', grossSettled: 100_000, netSettled: 91_000, persistency: 0.91 },
  { monthKey: '2026-11', grossSettled: 100_000, netSettled: 91_000, persistency: 0.91 },
  { monthKey: '2026-12', grossSettled: 100_000, netSettled: 89_000, persistency: 0.89 },
];

const TIERS = [
  { level: 3, name: 'Gold',   api: 250_000, apps: 20, cash: 10_000, voucher: 1_000 },
  { level: 2, name: 'Silver', api: 150_000, apps: 15, cash: 5_000,  voucher: 0 },
  { level: 1, name: 'Bronze', api: 75_000,  apps: 8,  cash: 2_000,  voucher: 0 },
];

const sub = (agentId, apiSold, applicationsSold) => ({ agentId, apiSold, applicationsSold });

const gated = (mode, basis) => ({
  structure: 'qualify',
  tiers: TIERS,
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  persistencyGate: { mode, threshold: 90, basis },
});

describe('C1 — normalizeGate', () => {
  it('defaults to the legacy four-band period-aggregate gate when absent', () => {
    expect(normalizeGate({})).toEqual({ mode: 'bands', threshold: 90, basis: 'periodAggregate' });
    expect(normalizeGate(null)).toEqual({ mode: 'bands', threshold: 90, basis: 'periodAggregate' });
    expect(normalizeGate(undefined)).toEqual({ mode: 'bands', threshold: 90, basis: 'periodAggregate' });
  });

  it('reads a null persistencyGate exactly as absent (the cleared-on-edit case)', () => {
    expect(normalizeGate({ persistencyGate: null })).toEqual(normalizeGate({}));
  });

  it('rejects unknown mode/basis values rather than passing them through', () => {
    const g = normalizeGate({ persistencyGate: { mode: 'sliding', basis: 'lastQuarter' } });
    expect(g.mode).toBe('bands');
    expect(g.basis).toBe('periodAggregate');
  });

  it('coerces a string threshold and falls back to 90 when unparseable', () => {
    expect(normalizeGate({ persistencyGate: { mode: 'binary', threshold: '85' } }).threshold).toBe(85);
    expect(normalizeGate({ persistencyGate: { mode: 'binary', threshold: 'x' } }).threshold).toBe(90);
  });
});

describe('C1 — persistencyPctAtFinalMonth (C-D2)', () => {
  it('reads the single record whose monthKey is the campaign end month', () => {
    expect(persistencyPctAtFinalMonth(FIXTURE_RECORDS, '2026-12-31')).toBe(89);
  });

  it('abstains with null when the final month has no record — it never falls back', () => {
    const withoutDecember = FIXTURE_RECORDS.filter((r) => r.monthKey !== '2026-12');
    expect(persistencyPctAtFinalMonth(withoutDecember, '2026-12-31')).toBeNull();
    // and specifically does NOT return the aggregate of whatever remains
    expect(persistencyPctForPeriod(withoutDecember, '2026-07-01', '2026-12-31')).toBe(91);
  });

  it('abstains on an unusable end date, an empty set, or a non-numeric persistency', () => {
    expect(persistencyPctAtFinalMonth(FIXTURE_RECORDS, '')).toBeNull();
    expect(persistencyPctAtFinalMonth(FIXTURE_RECORDS, null)).toBeNull();
    expect(persistencyPctAtFinalMonth([{ monthKey: '2026-12', persistency: null }], '2026-12-31')).toBeNull();
    expect(persistencyPctAtFinalMonth([], '2026-12-31')).toBeNull();
  });
});

describe('C1 — the four-combination gate table (the C1 deliverable)', () => {
  // [mode, basis, expected pct, expected band label, expected multiplier]
  const TABLE = [
    ['bands',  'periodAggregate', 91, '100%', 1],
    ['bands',  'finalMonth',      89, '50%',  0.5],
    ['binary', 'periodAggregate', 91, '100%', 1],
    ['binary', 'finalMonth',      89, 'DQ',   0],
  ];

  it.each(TABLE)('%s / %s → %i%% → band %s (×%s)', (mode, basis, pct, label, payout) => {
    const campaign = gated(mode, basis);
    const resolved = persistencyPctForGate(FIXTURE_RECORDS, campaign);
    expect(resolved).toBe(pct);
    const band = gateBandFor(resolved, normalizeGate(campaign));
    expect(band.label).toBe(label);
    expect(band.payout).toBe(payout);
  });

  it('the two bases DISAGREE on this fixture — that disagreement is the point', () => {
    const agg = persistencyPctForGate(FIXTURE_RECORDS, gated('binary', 'periodAggregate'));
    const fin = persistencyPctForGate(FIXTURE_RECORDS, gated('binary', 'finalMonth'));
    expect(agg).toBe(91);
    expect(fin).toBe(89);
    expect(agg).not.toBe(fin);
    expect(gateBandFor(agg, normalizeGate(gated('binary', 'periodAggregate'))).payout).toBe(1);
    expect(gateBandFor(fin, normalizeGate(gated('binary', 'finalMonth'))).payout).toBe(0);
  });

  it('carries all the way through computeStandings to the projected cash', () => {
    const participants = [{ id: 'a', name: 'Ada' }];
    const submissions = [sub('a', 300_000, 25)]; // clears Gold: 250k API / 20 apps

    const run = (mode, basis) => computeStandings(
      gated(mode, basis),
      submissions,
      participants,
      { a: persistencyPctForGate(FIXTURE_RECORDS, gated(mode, basis)) },
    )[0];

    expect(run('bands',  'periodAggregate').projectedCash).toBe(10_000);
    expect(run('bands',  'finalMonth').projectedCash).toBe(5_000);
    expect(run('binary', 'periodAggregate').projectedCash).toBe(10_000);

    const dq = run('binary', 'finalMonth');
    expect(dq.projectedCash).toBe(0);
    expect(dq.disqualified).toBe(true);
    // Still ranked and still shown to have reached Gold — disqualified from the
    // prize is not the same as erased from the standings.
    expect(dq.tier.name).toBe('Gold');
    expect(dq.rank).toBe(1);
  });

  it('exposes the resolved gate on every standings row, so no surface re-derives it', () => {
    const rows = computeStandings(gated('binary', 'finalMonth'), [], [{ id: 'a', name: 'Ada' }], {});
    expect(rows[0].gate).toEqual({ mode: 'binary', threshold: 90, basis: 'finalMonth' });
  });
});

describe('C1 — binary gate bands and labels', () => {
  const binary = normalizeGate({ persistencyGate: { mode: 'binary', threshold: 90 } });

  it('renders exactly two rows, not four', () => {
    expect(gateBands(binary)).toHaveLength(2);
    expect(gateBandRangeLabels(binary)).toEqual(['≥90%', '<90%']);
  });

  it('honours a non-default threshold in both the band and the label', () => {
    const g85 = normalizeGate({ persistencyGate: { mode: 'binary', threshold: 85 } });
    expect(gateBandRangeLabels(g85)).toEqual(['≥85%', '<85%']);
    expect(gateBandFor(85, g85).payout).toBe(1);
    expect(gateBandFor(84, g85).payout).toBe(0);
  });

  it('is inclusive at the threshold and disqualifies one point below', () => {
    expect(gateBandFor(90, binary).label).toBe('100%');
    expect(gateBandFor(89, binary).label).toBe('DQ');
    expect(gateBandFor(100, binary).payout).toBe(1);
    expect(gateBandFor(0, binary).payout).toBe(0);
  });

  it('has no half or quarter band — Rule 5 has exactly two rows', () => {
    const payouts = gateBands(binary).map((b) => b.payout);
    expect(payouts).toEqual([1, 0]);
  });

  it('abstains on null in BOTH modes', () => {
    expect(gateBandFor(null, binary)).toBeNull();
    expect(gateBandFor(null, normalizeGate({}))).toBeNull();
    expect(gateBandFor(NaN, binary)).toBeNull();
  });
});

describe('C1 — legacy campaigns are byte-for-byte unchanged', () => {
  it('gateBandFor with no gate argument resolves the original four bands', () => {
    expect(gateBandFor(95)).toBe(PERSISTENCY_GATE_BANDS[0]);
    expect(gateBandFor(87)).toBe(PERSISTENCY_GATE_BANDS[1]);
    expect(gateBandFor(82)).toBe(PERSISTENCY_GATE_BANDS[2]);
    expect(gateBandFor(10)).toBe(PERSISTENCY_GATE_BANDS[3]);
  });

  it('gateBands/gateBandRangeLabels with no gate return the module constants', () => {
    expect(gateBands()).toBe(PERSISTENCY_GATE_BANDS);
    expect(gateBandRangeLabels()).toBe(GATE_BAND_RANGE_LABELS);
  });

  it('a campaign with no persistencyGate key grades on the period aggregate', () => {
    const legacy = { structure: 'qualify', tiers: TIERS, startDate: '2026-07-01', endDate: '2026-12-31' };
    expect(persistencyPctForGate(FIXTURE_RECORDS, legacy))
      .toBe(persistencyPctForPeriod(FIXTURE_RECORDS, '2026-07-01', '2026-12-31'));
  });

  it('a legacy campaign still resolves the four-band multipliers through computeStandings', () => {
    const legacy = { structure: 'qualify', tiers: TIERS, startDate: '2026-01-01', endDate: '2026-12-31' };
    const rows = computeStandings(legacy, [sub('a', 300_000, 25)], [{ id: 'a', name: 'Ada' }], { a: 87 });
    expect(rows[0].multiplier).toBe(0.5);
    expect(rows[0].projectedCash).toBe(5_000);
  });
});
