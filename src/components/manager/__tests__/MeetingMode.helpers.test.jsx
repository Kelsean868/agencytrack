// Value-level tests for the Meeting Mode v2 derivation helpers — scene-sequence
// derivation (with/without campaigns/celebrations), scorecard window math,
// per-agent floor tiles (met/at/below boundaries), flag taxonomy, anniversaries.
import { describe, it, expect } from 'vitest';
import {
  kpiStatus, floorTiles, classifyFlag, flagRank, latestPersistency,
  aggregateLatestPersistency, deriveBranchWindows, deriveUnits, deriveAgentRuns,
  deriveRecognition, deriveAnniversaries, deriveActiveCampaigns,
  deriveAwardsWithinReach, deriveDeck,
  lastNWeekStartings, monthOf, quarterOf, sixWeekSpark,
} from '../MeetingMode.helpers';

const sub = (over = {}) => ({
  agentId: 'a1', status: 'submitted', weekStarting: '2026-06-28',
  callsMade: 60, telContacts: 40, appointmentsSet: 20, ffiConducted: 10,
  ciConducted: 10, applicationsSold: 1, livesSold: 1, apiSold: 5000,
  referralsObtained: 100, ...over,
});

describe('kpiStatus met/at/below boundaries', () => {
  it('>= floor is met', () => expect(kpiStatus(60, 60)).toBe('met'));
  it('exactly 90% is at', () => expect(kpiStatus(54, 60)).toBe('at'));
  it('just under 90% is below', () => expect(kpiStatus(53, 60)).toBe('below'));
  it('floor 0 is always met', () => expect(kpiStatus(0, 0)).toBe('met'));
});

describe('floorTiles', () => {
  it('builds 8 tiles with statuses from actuals', () => {
    const tiles = floorTiles({ callsMade: 60, telContacts: 10, referralsNewLeads: 100 });
    expect(tiles).toHaveLength(8);
    expect(tiles.find((t) => t.key === 'callsMade').status).toBe('met');   // 60/60
    expect(tiles.find((t) => t.key === 'telContacts').status).toBe('below'); // 10/40
    expect(tiles.find((t) => t.key === 'referralsNewLeads').status).toBe('met');
  });
});

describe('classifyFlag taxonomy', () => {
  const okTiles = floorTiles({
    callsMade: 60, telContacts: 40, appointmentsScheduled: 20, interviewsKept: 20,
    factFindsCompleted: 10, closingInterviewsKept: 10, clientsSold: 1, referralsNewLeads: 100,
  });
  it('not submitted → report late', () => {
    expect(classifyFlag({ submitted: false, tiles: okTiles, persistency: 90 }).key).toBe('report');
  });
  it('>=5 floors below → floor (danger)', () => {
    const weak = floorTiles({ callsMade: 5 }); // only calls has a value; 7 below
    expect(classifyFlag({ submitted: true, tiles: weak, persistency: 90 }).key).toBe('floor');
    expect(classifyFlag({ submitted: true, tiles: weak, persistency: 90 }).tone).toBe('danger');
  });
  it('persistency < 80 → persistency flag', () => {
    expect(classifyFlag({ submitted: true, tiles: okTiles, persistency: 72 }).key).toBe('persistency');
  });
  it('all good → on pace (null)', () => {
    expect(classifyFlag({ submitted: true, tiles: okTiles, persistency: 90 }).key).toBeNull();
  });
  it('flagRank orders report < floor < persistency < on-pace', () => {
    expect(flagRank('report')).toBeLessThan(flagRank('floor'));
    expect(flagRank('floor')).toBeLessThan(flagRank('persistency'));
    expect(flagRank('persistency')).toBeLessThan(flagRank(null));
  });
});

// NOTE ON FIXTURES: E3 persistency docs store `persistency` as a DECIMAL
// (netSettled / grossSettled). These fixtures use decimals because that is what
// getPersistencyMapForYear actually returns. The previous versions of these
// tests fed PERCENTAGES (72, 80, 90) — values that never occur in production —
// which is precisely why the decimal-vs-percent defect survived undetected.
describe('persistency helpers', () => {
  it('latestPersistency takes the highest-month record and returns a PERCENTAGE', () => {
    expect(latestPersistency([{ month: 3, persistency: 0.80 }, { month: 6, persistency: 0.72 }])).toBe(72);
    expect(latestPersistency([])).toBeNull();
  });
  // ── ANTI-AVERAGE GUARD ──
  // calculations.js: "NEVER average individual persistency percentages — that
  // produces a different (wrong) number when agents have different gross-settled
  // values." This function previously averaged, and the test that stood here
  // pinned the average (80/90 → 85) as correct — equal-denominator fixtures, so
  // the two methods agreed and the violation was invisible. The fixtures below
  // are deliberately UNEQUAL so the two methods disagree and the test can only
  // pass on the aggregate.
  it('aggregateLatestPersistency SUM-aggregates — it does NOT average percentages', () => {
    // A $200k advisor at 94% and a $2k advisor at 86%.
    //   average of percentages → (94 + 86) / 2               = 90  ← WRONG
    //   aggregate              → 189,720 / 202,000 = 0.9392  = 94  ← the book
    const map = {
      a: [{ month: 6, persistency: 0.94, grossSettled: 200000, netSettled: 188000 }],
      b: [{ month: 6, persistency: 0.86, grossSettled: 2000,   netSettled: 1720 }],
    };
    expect(aggregateLatestPersistency(['a', 'b'], map)).toBe(94);
    expect(aggregateLatestPersistency(['a', 'b'], map)).not.toBe(90); // the average
    expect(aggregateLatestPersistency(['x'], map)).toBeNull();
  });
  it('aggregateLatestPersistency is null when no agent has a usable denominator', () => {
    const map = { a: [{ month: 6, persistency: 0.94, grossSettled: 0, netSettled: 0 }] };
    expect(aggregateLatestPersistency(['a'], map)).toBeNull();
  });
  it('returns null rather than NaN when the stored value is unusable', () => {
    expect(latestPersistency([{ month: 6, persistency: 'n/a' }])).toBeNull();
    expect(latestPersistency([{ month: 6 }])).toBeNull();
  });
});

// ── Regression: decimal-vs-percent scale confusion (fixed 2026-07-26) ──
//
// getPersistencyMapForYear returns E3 docs whose `persistency` is a DECIMAL.
// latestPersistency previously returned that decimal unchanged, while all three
// of its consumers treat the value as a percentage. Consequences on live data:
//   1. classifyFlag — `0.94 < 80` is always true, so EVERY agent holding a
//      persistency record was flagged "Persistency ↓", reading "1% persistency".
//   2. deriveBranchWindows — the branch scorecard rendered `${w.pers}%` from a
//      roll-up of decimals, showing "1%" for a healthy branch.
//   3. CampaignScene — fed decimals into campaignEngine's persistencyByAgent
//      (documented "(percentage 0–100)"), dropping every advisor into the DQ
//      band with a ×0 payout multiplier.
describe('persistency scale regression — decimals must not read as percentages', () => {
  // All eight activity floors met, so the `floor` arm never pre-empts the
  // persistency arm — this isolates the scale behaviour under test.
  const okTiles = floorTiles({
    callsMade: 60, telContacts: 40, appointmentsScheduled: 20, interviewsKept: 20,
    factFindsCompleted: 10, closingInterviewsKept: 10, clientsSold: 1, referralsNewLeads: 100,
  });

  // NEGATIVE CONTROL: a healthy agent, expressed the way production stores it.
  // Revert latestPersistency's `* 100` and this test fails — it is the guard.
  it('a healthy agent (decimal 0.94 on file) is NOT flagged for persistency', () => {
    const records = [{ month: 6, persistency: 0.94 }];
    const pct = latestPersistency(records);

    expect(pct).toBe(94);
    expect(classifyFlag({ submitted: true, tiles: okTiles, persistency: pct }).key).toBeNull();
  });

  it('a genuinely below-floor agent (decimal 0.72) IS still flagged', () => {
    const pct = latestPersistency([{ month: 6, persistency: 0.72 }]);

    expect(pct).toBe(72);
    const flag = classifyFlag({ submitted: true, tiles: okTiles, persistency: pct });
    expect(flag.key).toBe('persistency');
    // The reason line must read as a real percentage, not "1%".
    expect(flag.reason).toContain('72%');
    expect(flag.reason).toContain('80%');
  });

  it('the floor boundary is exact — 0.80 passes, 0.799 fails', () => {
    expect(classifyFlag({
      submitted: true, tiles: okTiles, persistency: latestPersistency([{ month: 1, persistency: 0.80 }]),
    }).key).toBeNull();

    expect(classifyFlag({
      submitted: true, tiles: okTiles, persistency: latestPersistency([{ month: 1, persistency: 0.799 }]),
    }).key).toBe('persistency');
  });

  it('branch scorecard persistency renders as a real percentage, not ~1%', () => {
    // Equal books here on purpose: this test is the SCALE guard, so it isolates
    // decimal-vs-percent. The METHOD guard (aggregate vs average) is the
    // unequal-book test above.
    const map = {
      a: [{ month: 6, persistency: 0.94, grossSettled: 100, netSettled: 94 }],
      b: [{ month: 6, persistency: 0.86, grossSettled: 100, netSettled: 86 }],
    };
    const pct = aggregateLatestPersistency(['a', 'b'], map);

    expect(pct).toBe(90); // (94 + 86) / (100 + 100)
    expect(pct).toBeGreaterThan(1); // the defect produced 0 or 1
  });
});

describe('date windows', () => {
  it('lastNWeekStartings returns n Sundays oldest-first ending at selectedWeek', () => {
    const w = lastNWeekStartings('2026-06-28', 6);
    expect(w).toHaveLength(6);
    expect(w[5]).toBe('2026-06-28');
    expect(w[4]).toBe('2026-06-21');
  });
  it('monthOf / quarterOf', () => {
    expect(monthOf('2026-06-28')).toBe(6);
    expect(quarterOf('2026-06-28')).toBe(2);
    expect(quarterOf('2026-01-04')).toBe(1);
  });
});

describe('deriveBranchWindows', () => {
  it('WTD from this week; MTD/QTD/YTD windowed from ytdSubs; YTD flagged hero', () => {
    const thisWeek = [sub({ apiSold: 5000, applicationsSold: 1 })];
    const ytd = [
      sub({ weekStarting: '2026-06-28', apiSold: 5000, applicationsSold: 1 }),
      sub({ weekStarting: '2026-06-21', apiSold: 3000, applicationsSold: 2 }),
      sub({ weekStarting: '2026-03-01', apiSold: 1000, applicationsSold: 1 }), // Q1 — outside QTD
    ];
    const w = deriveBranchWindows(thisWeek, ytd, {}, '2026-06-28', ['a1']);
    const byK = Object.fromEntries(w.map((r) => [r.k, r]));
    expect(byK.WTD.api).toBe(5000);
    expect(byK.MTD.api).toBe(8000);   // both June subs
    expect(byK.QTD.api).toBe(8000);   // Q2 only
    expect(byK.YTD.api).toBe(9000);   // all three
    expect(byK.YTD.hero).toBe(true);
    expect(byK.WTD.pers).toBeNull();
  });
});

describe('deriveUnits', () => {
  const users = [
    { id: 'a1', role: 'agent', unitId: 'u1' },
    { id: 'a2', role: 'agent', unitId: 'u2' },
  ];
  it('rolls up per unit and ranks by YTD API', () => {
    const ytd = [
      { agentId: 'a1', weekStarting: '2026-06-28', apiSold: 3000, applicationsSold: 1 },
      { agentId: 'a2', weekStarting: '2026-06-28', apiSold: 9000, applicationsSold: 2 },
    ];
    const units = deriveUnits(users, ytd, []);
    expect(units).toHaveLength(2);
    expect(units[0].id).toBe('u2'); // higher YTD ranks first
    expect(units[0].rank).toBe(1);
  });
  it('returns [] when fewer than 2 units (units scene skips)', () => {
    expect(deriveUnits([{ id: 'a1', role: 'agent', unitId: 'u1' }], [], [])).toEqual([]);
  });
});

describe('deriveAgentRuns ordering + spark', () => {
  it('orders exception-first then by week API', () => {
    const subs = [
      sub({ agentId: 'good', apiSold: 20000 }),                       // on pace
      sub({ agentId: 'late', status: 'draft' }),                      // report
      sub({ agentId: 'weak', callsMade: 1, telContacts: 1, appointmentsSet: 0, ffiConducted: 0, ciConducted: 0, applicationsSold: 0, livesSold: 0, referralsObtained: 0, apiSold: 0 }), // floor
    ];
    const runs = deriveAgentRuns(subs, [], [], {}, '2026-06-28');
    expect(runs[0].flag.key).toBe('report');
    expect(runs[1].flag.key).toBe('floor');
    expect(runs[2].flag.key).toBeNull();
  });
  it('sixWeekSpark yields 6 values with the current week last', () => {
    const ytd = [sub({ weekStarting: '2026-06-28', apiSold: 5000 }), sub({ weekStarting: '2026-06-21', apiSold: 3000 })];
    const spark = sixWeekSpark('a1', ytd, '2026-06-28');
    expect(spark).toHaveLength(6);
    expect(spark[5]).toBe(5000);
    expect(spark[4]).toBe(3000);
    expect(spark[0]).toBe(0);
  });
});

describe('deriveRecognition', () => {
  it('podium top-3 by week API; unavailable when no producers', () => {
    const runs = [
      { id: 'a', weekApi: 100, activityScore: 5, flag: { key: null } },
      { id: 'b', weekApi: 300, activityScore: 9, flag: { key: null } },
      { id: 'c', weekApi: 200, activityScore: 7, flag: { key: null } },
    ];
    const rec = deriveRecognition(runs);
    expect(rec.available).toBe(true);
    expect(rec.producers.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(rec.producers[0].rank).toBe(1);
    expect(deriveRecognition([{ id: 'z', weekApi: 0, activityScore: 0, flag: { key: null } }]).available).toBe(false);
  });
});

describe('deriveAnniversaries (contractStartDate; no DOB → birthdays excluded)', () => {
  it('includes an anniversary falling in the meeting week window', () => {
    const users = [
      { id: 'a', name: 'Ann', contractStartDate: '2021-06-30' }, // 30 Jun in the 28 Jun..4 Jul window
      { id: 'b', name: 'Bob', contractStartDate: '2020-12-01' }, // out of window
      { id: 'c', name: 'Cid', contractStartDate: '2026-06-29' }, // 0 years — excluded
    ];
    const anns = deriveAnniversaries(users, '2026-06-28');
    expect(anns).toHaveLength(1);
    expect(anns[0].name).toBe('Ann');
    expect(anns[0].years).toBe(5);
  });
  it('returns [] when nobody has an anniversary this week (scene skips)', () => {
    expect(deriveAnniversaries([{ id: 'a', contractStartDate: '2020-01-01' }], '2026-06-28')).toEqual([]);
  });
});

describe('deriveActiveCampaigns', () => {
  it('keeps campaigns whose window contains today', () => {
    const camps = [
      { id: '1', startDate: '2026-06-01', endDate: '2026-07-31' },
      { id: '2', startDate: '2026-01-01', endDate: '2026-02-01' },
    ];
    const active = deriveActiveCampaigns(camps, '2026-06-28');
    expect(active.map((c) => c.id)).toEqual(['1']);
  });
});

describe('deriveAwardsWithinReach — reuses computeAgentAwards, no new award math', () => {
  const agentSub = (agentId, api) => ({
    agentId, status: 'submitted', weekStarting: '2026-03-01', apiSold: api, applicationsSold: 0,
  });
  const CURRENT = new Date('2026-06-15'); // same year as fixture weeks; unrelated to real wall-clock

  // MDRT reads the real MDRT line (688,800; in-contention 344,400) via
  // mdrtAwardThresholds() — PR #MX, not the ruleset's stale 500k/250k pair.
  it('surfaces a single in-contention, not-yet-eligible award (MDRT: 344.4k inContention, 688.8k threshold)', () => {
    const users = [{ id: 'a1', role: 'agent', name: 'Ann', unitId: 'u1' }];
    const ytd = [agentSub('a1', 500000)]; // 72.6% of MDRT's 688.8k threshold
    const pairs = deriveAwardsWithinReach(users, ytd, CURRENT);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      agentId: 'a1', agentName: 'Ann', awardId: 'mdrt', awardName: 'MDRT',
      valueUnit: 'TTD', current: 500000, target: 688800, gap: 188800,
    });
    expect(pairs[0].progressPercent).toBeCloseTo(72.6, 1);
  });

  it('excludes an agent whose best award is in-contention but under the 60% floor', () => {
    const users = [{ id: 'a2', role: 'agent', name: 'Bea' }];
    const ytd = [agentSub('a2', 380000)]; // inContention (>=344.4k) but only ~55% of 688.8k
    expect(deriveAwardsWithinReach(users, ytd, CURRENT)).toEqual([]);
  });

  it('excludes an award the agent has already qualified for (eligible)', () => {
    const users = [{ id: 'a3', role: 'agent', name: 'Cy' }];
    const ytd = [agentSub('a3', 720000)]; // eligible for MDRT (>= 688.8k threshold)
    expect(deriveAwardsWithinReach(users, ytd, CURRENT)).toEqual([]);
  });

  it('sorts multiple agents by progress desc', () => {
    const users = [
      { id: 'lo', role: 'agent', name: 'Lo' },
      { id: 'hi', role: 'agent', name: 'Hi' },
    ];
    const ytd = [agentSub('lo', 450000), agentSub('hi', 650000)]; // ~65% vs ~94%
    const pairs = deriveAwardsWithinReach(users, ytd, CURRENT);
    expect(pairs.map((p) => p.agentId)).toEqual(['hi', 'lo']);
  });

  it('ignores non-agent users and returns [] when nobody qualifies', () => {
    const users = [{ id: 'm1', role: 'branch_manager', name: 'Mgr' }];
    expect(deriveAwardsWithinReach(users, [agentSub('m1', 320000)], CURRENT)).toEqual([]);
  });
});

describe('deriveDeck — data-driven scene sequence', () => {
  const base = {
    runs: [{ id: 'a', flag: { key: null } }],
    units: [], exceptions: [], recognition: { available: true, producers: [{ id: 'a', rank: 1 }] },
    anniversaries: [], activeCampaigns: [], submissions: [{ agentId: 'a' }], awardsWithinReach: [],
  };
  it('drops units/exceptions/celebrations/awards/campaign when their data is absent', () => {
    const { scenes, skipped } = deriveDeck(base);
    expect(scenes).toEqual(['opening', 'branch', 'activity', 'production', 'funnel', 'agent:a', 'recognition', 'close']);
    const skippedIds = skipped.map((s) => s.id);
    expect(skippedIds).toEqual(expect.arrayContaining(['units', 'exceptions', 'celebrations', 'awards', 'campaign']));
  });
  it('includes campaign + celebrations + awards + exceptions + units when data exists', () => {
    const full = {
      ...base,
      units: [{ id: 'u1' }, { id: 'u2' }],
      exceptions: [{ id: 'a', flag: { key: 'floor' } }],
      anniversaries: [{ id: 'a', years: 3 }],
      activeCampaigns: [{ id: 'c1' }],
      awardsWithinReach: [{ id: 'a:mdrt', agentId: 'a', awardId: 'mdrt' }],
    };
    const { scenes } = deriveDeck(full);
    expect(scenes).toEqual([
      'opening', 'branch', 'units', 'activity', 'production', 'funnel',
      'exceptions', 'agent:a', 'recognition', 'celebrations', 'awards', 'campaign', 'close',
    ]);
    expect(scenes.length).toBe(13);
  });
});
