'use strict';

// FR Leaderboard L-1 — one test group per locked decision (brief § 2) plus the
// v3 monotonicity property. Pure: boardMetrics.js has no Firestore.

const {
  periodWindow,
  sundaysBetween,
  ledgerCreditsByAgent,
  weekPointsByAgent,
  weekCountsByAgent,
  metricsFor,
  sortByMetric,
  priorRanksForBranch,
  periodEntries,
  weeklyChampions,
} = require('../leaderboard/boardMetrics');
const { computePoints } = require('../lib/computePoints');
const { computeDayPoints, mapDayToReportFields } = require('../lib/dayPoints');

// Fri 15 May 2026, 06:00 TT. Week = Sun 10 – Sat 16 May. Prior week = 3 – 9 May.
const REF = new Date('2026-05-15T10:00:00Z');

const ts = (iso) => ({ toDate: () => new Date(iso) });

function mkPolicy(id, agentId, dateIssued, api, extra = {}) {
  return {
    id, agentId, dateIssued,
    status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: api,
    ...extra,
  };
}

function mkReport(agentId, weekStarting, fields = {}, status = 'submitted') {
  return { id: `${agentId}_${weekStarting}`, agentId, weekStarting, status, version: 2, ...fields };
}

function mkDay(date, weekStarting, fields = {}) {
  return { date, weekStarting, ...fields };
}

function ctxOf({ policies = [], submissions = [], dailies = new Map() } = {}) {
  return {
    creditsByAgent: ledgerCreditsByAgent(policies),
    weekPointsByAgent: weekPointsByAgent(submissions, dailies),
    weekCountsByAgent: weekCountsByAgent(submissions, dailies),
  };
}

const metrics = (agentId, period, ref, inputs) =>
  metricsFor(agentId, periodWindow(period, ref), ctxOf(inputs));

// ── Period windows (TT) ──────────────────────────────────────────────────────

describe('periodWindow + sundaysBetween', () => {
  test('TT windows at REF', () => {
    expect(periodWindow('week', REF)).toEqual({ from: '2026-05-10', to: '2026-05-16' });
    expect(periodWindow('mtd', REF)).toEqual({ from: '2026-05-01', to: '2026-05-15' });
    expect(periodWindow('quarter', REF)).toEqual({ from: '2026-04-01', to: '2026-05-15' });
    expect(periodWindow('ytd', REF)).toEqual({ from: '2026-01-01', to: '2026-05-15' });
  });

  test('UTC 1 May 03:30 is still TT 30 April — MTD is April', () => {
    expect(periodWindow('mtd', new Date('2026-05-01T03:30:00Z'))).toEqual({ from: '2026-04-01', to: '2026-04-30' });
  });

  test('sundaysBetween starts at the first Sunday on/after the bound and includes the end', () => {
    expect(sundaysBetween('2025-12-18', '2026-01-11')).toEqual(['2025-12-21', '2025-12-28', '2026-01-04', '2026-01-11']);
    expect(sundaysBetween('2026-05-10', '2026-05-10')).toEqual(['2026-05-10']);
  });
});

// ── D2 — API from the ledger, bucketed by dateIssued at TT edges ──────────────

describe('D2 — settled API from the ledger, dated by dateIssued', () => {
  const policies = [
    mkPolicy('wk-before', 'a1', '2026-05-09', 1),       // Sat of prior week
    mkPolicy('wk-first', 'a1', '2026-05-10', 10),       // Sun — first day of week
    mkPolicy('wk-last', 'a1', '2026-05-16', 100),       // Sat — last day of week
    mkPolicy('wk-after', 'a1', '2026-05-17', 1000),     // next week
    mkPolicy('mo-before', 'a1', '2026-04-30', 10000),   // QTD, not MTD
    mkPolicy('q-before', 'a1', '2026-03-31', 100000),   // YTD, not QTD
    mkPolicy('y-before', 'a1', '2025-12-31', 1000000),  // last year
  ];

  test('week / MTD / QTD / YTD each take exactly their dates', () => {
    expect(metrics('a1', 'week', REF, { policies }).periodApi).toBe(110);
    // MTD 1–15 May: 9, 10 (the 16th and 17th are after today)
    expect(metrics('a1', 'mtd', REF, { policies }).periodApi).toBe(11);
    expect(metrics('a1', 'quarter', REF, { policies }).periodApi).toBe(10011);
    expect(metrics('a1', 'ytd', REF, { policies }).periodApi).toBe(110011);
  });

  test('a Timestamp dateIssued at TT midnight counts on its TT day', () => {
    const p = [mkPolicy('ts', 'a1', ts('2026-05-10T04:00:00Z'), 500)];
    expect(metrics('a1', 'week', REF, { policies: p }).periodApi).toBe(500);
  });

  test('head-office, manager-confirmed and agent-confirmed settled policies all count', () => {
    const p = [
      mkPolicy('ho', 'a1', '2026-05-11', 1, { statusSource: 'oipa_import' }),
      mkPolicy('mgr', 'a1', '2026-05-11', 10, { status: 'submitted', confirmedAt: ts('2026-05-12T12:00:00Z') }),
      mkPolicy('agent', 'a1', '2026-05-11', 100, { statusSource: 'agent' }),
      mkPolicy('pending', 'a1', '2026-05-11', 1000, { status: 'submitted' }),
      mkPolicy('motor', 'a1', '2026-05-11', 10000, { productLine: 'motor' }),
      mkPolicy('undated', 'a1', null, 100000),
    ];
    expect(metrics('a1', 'week', REF, { policies: p }).periodApi).toBe(111);
  });

  test('credit goes to the policy agentId only', () => {
    const p = [mkPolicy('x', 'a2', '2026-05-11', 700)];
    expect(metrics('a1', 'week', REF, { policies: p }).periodApi).toBe(0);
    expect(metrics('a2', 'week', REF, { policies: p }).periodApi).toBe(700);
  });

  test('API is rounded to cents (lump sums earn 10%)', () => {
    const p = [mkPolicy('l', 'a1', '2026-05-11', 333.33, { newBusinessType: 'lumpsum' })];
    expect(metrics('a1', 'week', REF, { policies: p })).toEqual({ periodApi: 33.33, apps: 0, points: 0, activity: { names: 0, calls: 0, ffi: 0, ci: 0 } });
  });
});

// ── D3 — Apps from the ledger ────────────────────────────────────────────────

describe('D3 — applications from the ledger', () => {
  test('inc_ppp earns an app at TTD 2,400, not at 2,399; API counts either way', () => {
    const p = [
      mkPolicy('ppp-low', 'a1', '2026-05-11', 2399, { newBusinessType: 'inc_ppp' }),
      mkPolicy('ppp-at', 'a2', '2026-05-11', 2400, { newBusinessType: 'inc_ppp' }),
    ];
    expect(metrics('a1', 'week', REF, { policies: p })).toMatchObject({ periodApi: 2399, apps: 0 });
    expect(metrics('a2', 'week', REF, { policies: p })).toMatchObject({ periodApi: 2400, apps: 1 });
  });

  test('platinum edge = 1 app, 0 API; spia = 0/0; unclassified abstains', () => {
    const p = [
      mkPolicy('pe', 'a1', '2026-05-11', 9000, { newBusinessType: 'platinum_edge' }),
      mkPolicy('sp', 'a1', '2026-05-11', 9000, { newBusinessType: 'spia' }),
      mkPolicy('un', 'a1', '2026-05-11', 9000, { newBusinessType: undefined }),
    ];
    expect(metrics('a1', 'week', REF, { policies: p })).toMatchObject({ periodApi: 0, apps: 1 });
  });

  test('weekly-report apps are NOT used', () => {
    const subs = [mkReport('a1', '2026-05-10', { newBusiness: { apps: 9, api: 9000 } })];
    expect(metrics('a1', 'week', REF, { submissions: subs })).toMatchObject({ periodApi: 0, apps: 0 });
  });
});

// ── D4 — self/family left out ────────────────────────────────────────────────

describe('D4 — self/family policies are left out of API and Apps', () => {
  test('isSelfOrFamily === true is skipped; false counts', () => {
    const p = [
      mkPolicy('fam', 'a1', '2026-05-11', 6000, { isSelfOrFamily: true }),
      mkPolicy('own', 'a1', '2026-05-11', 1000, { isSelfOrFamily: false }),
    ];
    expect(metrics('a1', 'week', REF, { policies: p })).toMatchObject({ periodApi: 1000, apps: 1 });
  });
});

// ── D5 — dispatcher ruling: submitted report, else the sum of the days ───────

describe('D5 — points: submitted report wins its week; other weeks sum the days', () => {
  const reportFields = { ffiConducted: 2, ciConducted: 1 }; // 2×5 + 1×10 = 20
  const dayA = mkDay('2026-05-11', '2026-05-10', { dials: 10, ffiConducted: 1 }); // 10 + 5 = 15
  const dayB = mkDay('2026-05-12', '2026-05-10', { appointmentsSet: 2 });         // 6

  test('fixture sanity: the scores the assertions rely on', () => {
    expect(computePoints(mkReport('a1', '2026-05-10', reportFields))).toBe(20);
    expect(computeDayPoints(dayA)).toBe(15);
    expect(computeDayPoints(dayB)).toBe(6);
  });

  test('week with a submitted report scores the report, not its days', () => {
    const subs = [mkReport('a1', '2026-05-10', reportFields)];
    const dailies = new Map([['a1', [dayA, dayB]]]);
    expect(metrics('a1', 'week', REF, { submissions: subs, dailies }).points).toBe(20);
  });

  test('week without a submitted report scores the sum of its days', () => {
    const dailies = new Map([['a1', [dayA, dayB]]]);
    expect(metrics('a1', 'week', REF, { dailies }).points).toBe(21);
  });

  test('a draft is never read — its week scores the days', () => {
    const subs = [mkReport('a1', '2026-05-10', { ffiConducted: 99 }, 'draft')];
    const dailies = new Map([['a1', [dayA, dayB]]]);
    expect(metrics('a1', 'week', REF, { submissions: subs, dailies }).points).toBe(21);
  });

  test('days are not capped per week: each day caps its own letters at 20 (pace-badge rule)', () => {
    const days = [
      mkDay('2026-05-11', '2026-05-10', { prospectingLettersSent: 20 }),
      mkDay('2026-05-12', '2026-05-10', { prospectingLettersSent: 20 }),
    ];
    expect(metrics('a1', 'week', REF, { dailies: new Map([['a1', days]]) }).points).toBe(40);
  });

  test('a week is placed by weekStarting and never split across months', () => {
    // Week of Sun 26 Apr runs into 1–2 May: it belongs to April, not to May's MTD.
    const days = [mkDay('2026-05-01', '2026-04-26', { ciConducted: 1 })];
    const dailies = new Map([['a1', days]]);
    expect(metrics('a1', 'mtd', REF, { dailies }).points).toBe(0);
    expect(metrics('a1', 'quarter', REF, { dailies }).points).toBe(10);
  });

  test('reports in other weeks do not suppress this week’s days', () => {
    const subs = [mkReport('a1', '2026-05-03', reportFields)];
    const dailies = new Map([['a1', [dayA]]]);
    expect(metrics('a1', 'week', REF, { submissions: subs, dailies }).points).toBe(15);
    expect(metrics('a1', 'mtd', REF, { submissions: subs, dailies }).points).toBe(35);
  });

  test('userId is the fallback owner of a report', () => {
    const subs = [{ ...mkReport(undefined, '2026-05-10', reportFields), agentId: undefined, userId: 'a1' }];
    expect(metrics('a1', 'week', REF, { submissions: subs }).points).toBe(20);
  });
});

// ── A1 — activity counts: the D5 source rule, four integers per week ─────────

describe('A1 — activity counts: submitted report wins its week; other weeks sum the days', () => {
  const act = (agentId, period, inputs) => metrics(agentId, period, REF, inputs).activity;
  const reportFields = {
    namesFromColdCanvass: 2, referralsObtained: 1, namesFromSeminarsAttended: 3, namesFromTradeshowsConducted: 1, namesFromOther: 1,
    coldCalls: 10, referralCalls: 2, followUpCalls: 3, seminarTradeshowCalls: 1,
    ffiConducted: 2, ciConducted: 1,
  };
  const dayA = mkDay('2026-05-11', '2026-05-10', { dials: 10, newNamesAdded: 2, ffiConducted: 1 });
  const dayB = mkDay('2026-05-12', '2026-05-10', { dials: 5, newNamesAdded: 1, ciConducted: 1, serviceCalls: 4 });

  test('report counts come from extractActivityFields (A1-D2), incl. the event-name channels', () => {
    const subs = [mkReport('a1', '2026-05-10', reportFields)];
    // names 2+1+3+1+1 = 8 · calls 10+2+3+1 = 16
    expect(act('a1', 'week', { submissions: subs })).toEqual({ names: 8, calls: 16, ffi: 2, ci: 1 });
  });

  test('daily counts use the computeDayPoints mapping (A1-D3): dials → calls, newNamesAdded → names', () => {
    const dailies = new Map([['a1', [dayA, dayB]]]);
    // serviceCalls is not a prospecting call: it must not leak into calls
    expect(act('a1', 'week', { dailies })).toEqual({ names: 3, calls: 15, ffi: 1, ci: 1 });
  });

  test('week with a submitted report counts the report, not its days (A1-D1)', () => {
    const subs = [mkReport('a1', '2026-05-10', reportFields)];
    const dailies = new Map([['a1', [dayA, dayB]]]);
    expect(act('a1', 'week', { submissions: subs, dailies })).toEqual({ names: 8, calls: 16, ffi: 2, ci: 1 });
  });

  test('a draft is never read — its week counts the days', () => {
    const subs = [mkReport('a1', '2026-05-10', { ffiConducted: 99, coldCalls: 99 }, 'draft')];
    const dailies = new Map([['a1', [dayA, dayB]]]);
    expect(act('a1', 'week', { submissions: subs, dailies })).toEqual({ names: 3, calls: 15, ffi: 1, ci: 1 });
  });

  test('a draft alone yields zero counts', () => {
    const subs = [mkReport('a1', '2026-05-10', { ffiConducted: 99 }, 'draft')];
    expect(act('a1', 'week', { submissions: subs })).toEqual({ names: 0, calls: 0, ffi: 0, ci: 0 });
  });

  test('reports in other weeks do not suppress this week’s days; windows sum weeks', () => {
    const subs = [mkReport('a1', '2026-05-03', { ffiConducted: 2, coldCalls: 4 })];
    const dailies = new Map([['a1', [dayA]]]);
    expect(act('a1', 'week', { submissions: subs, dailies })).toEqual({ names: 2, calls: 10, ffi: 1, ci: 0 });
    expect(act('a1', 'mtd', { submissions: subs, dailies })).toEqual({ names: 2, calls: 14, ffi: 3, ci: 0 });
  });

  test('a week is placed by weekStarting, never split (same rule as points)', () => {
    const days = [mkDay('2026-05-01', '2026-04-26', { ciConducted: 1 })];
    const dailies = new Map([['a1', days]]);
    expect(act('a1', 'mtd', { dailies }).ci).toBe(0);
    expect(act('a1', 'quarter', { dailies }).ci).toBe(1);
  });

  test('integers: each source document is floored before it is summed', () => {
    const subs = [mkReport('a1', '2026-05-03', { coldCalls: 2.9, namesFromOther: 1.5, ffiConducted: 0.9 })];
    const dailies = new Map([['a1', [
      mkDay('2026-05-11', '2026-05-10', { dials: 3.7, ffiConducted: 1.5 }),
      mkDay('2026-05-12', '2026-05-10', { dials: 3.7, ffiConducted: 1.5 }),
    ]]]);
    // report week: calls 2, names 1, ffi 0 · day week: calls 3+3, ffi 1+1
    expect(act('a1', 'mtd', { submissions: subs, dailies })).toEqual({ names: 1, calls: 8, ffi: 2, ci: 0 });
  });

  test('userId is the fallback owner of a report', () => {
    const subs = [{ ...mkReport(undefined, '2026-05-10', { ciConducted: 2 }), agentId: undefined, userId: 'a1' }];
    expect(act('a1', 'week', { submissions: subs }).ci).toBe(2);
  });

  test('an agent with no activity gets zero counts, not undefined', () => {
    expect(act('nobody', 'ytd', {})).toEqual({ names: 0, calls: 0, ffi: 0, ci: 0 });
  });

  test('counts and points share one source rule: a scored day shows counts', () => {
    const day = mkDay('2026-05-11', '2026-05-10', { dials: 10, ffiConducted: 1, newNamesAdded: 2 });
    const m = metrics('a1', 'week', REF, { dailies: new Map([['a1', [day]]]) });
    expect(m.points).toBeGreaterThan(0);
    expect(m.activity).toEqual({ names: 2, calls: 10, ffi: 1, ci: 0 });
  });
});

describe('A1-D4 — every period entry carries activity', () => {
  test('periodEntries writes activity { names, calls, ffi, ci } on week, mtd, quarter and ytd entries', () => {
    const users = [
      { id: 'a1', name: 'Alpha', role: 'agent', unitId: null },
      { id: 'a2', name: 'Beta', role: 'agent', unitId: null },
    ];
    const ctx = ctxOf({
      submissions: [mkReport('a1', '2026-05-10', { coldCalls: 7, ffiConducted: 1 })],
      dailies: new Map([['a2', [mkDay('2026-05-11', '2026-05-10', { dials: 3, newNamesAdded: 1 })]]]),
    });
    const prior = priorRanksForBranch(users, new Date('2026-05-08T10:00:00Z'), ctx);
    for (const period of ['week', 'mtd', 'quarter', 'ytd']) {
      const entries = periodEntries(users, period, REF, ctx, {}, prior);
      expect(entries).toHaveLength(2);
      for (const e of entries) {
        expect(Object.keys(e.activity).sort()).toEqual(['calls', 'ci', 'ffi', 'names']);
        for (const v of Object.values(e.activity)) expect(Number.isInteger(v)).toBe(true);
      }
      expect(entries.find((e) => e.agentId === 'a1').activity).toEqual({ names: 0, calls: 7, ffi: 1, ci: 0 });
      expect(entries.find((e) => e.agentId === 'a2').activity).toEqual({ names: 1, calls: 3, ffi: 0, ci: 0 });
    }
  });

  test('activity is additive: every pre-existing entry key is still there', () => {
    const users = [{ id: 'a1', name: 'Alpha', role: 'agent', unitId: null }];
    const [e] = periodEntries(users, 'week', REF, ctxOf(), {}, new Map());
    expect(Object.keys(e).sort()).toEqual([
      'activity', 'agentId', 'apps', 'name', 'periodApi', 'points', 'previousRank', 'previousRanks',
      'rank', 'rankWithinUnit', 'unitId', 'unitName',
    ]);
  });
});

describe('A1 — mapDayToReportFields and computeDayPoints', () => {
  test('mapDayToReportFields returns the exact report-shaped object', () => {
    const entry = {
      date: '2026-05-11', weekStarting: '2026-05-10', dials: '12', newNamesAdded: '3', serviceCalls: 2.9,
      newBusiness: { apps: '1', api: '1500.5' }, ffiConducted: 2,
    };
    expect(mapDayToReportFields(entry)).toEqual({
      ...entry,
      coldCalls: 12, referralCalls: 0, followUpCalls: 0, seminarTradeshowCalls: 0,
      applicationsSold: 1, apiSold: 1500.5, namesFromOther: 3, serviceCalls: 2, version: 1,
    });
  });

  test('mapDayToReportFields does not mutate the entry', () => {
    const entry = Object.freeze({ dials: 5, newBusiness: Object.freeze({ apps: 1, api: 10 }) });
    expect(() => mapDayToReportFields(entry)).not.toThrow();
  });

  test('computeDayPoints is unchanged: computePoints(mapDayToReportFields(entry)), 0 for no entry', () => {
    expect(computeDayPoints(null)).toBe(0);
    expect(computeDayPoints(undefined)).toBe(0);
    const entries = [
      {},
      { dials: 10, ffiConducted: 1 },
      { appointmentsSet: 2 },
      { prospectingLettersSent: 30 },
      { dials: 4, newNamesAdded: 2, serviceCalls: 3, newBusiness: { apps: 1, api: 2500 }, ciConducted: 1 },
    ];
    for (const e of entries) expect(computeDayPoints(e)).toBe(computePoints(mapDayToReportFields(e)));
    // pinned values (same fixtures the D5 group relies on)
    expect(computeDayPoints({ dials: 10, ffiConducted: 1 })).toBe(15);
    expect(computeDayPoints({ appointmentsSet: 2 })).toBe(6);
    expect(computeDayPoints({ ciConducted: 1 })).toBe(10);
  });
});

// ── D7 — one ranker, fixed tie order ─────────────────────────────────────────

describe('D7 — ranking: metric, then periodApi → apps → points, then name', () => {
  const rows = [
    { agentId: 'z', name: 'Zed',   periodApi: 0,   apps: 0, points: 50 },
    { agentId: 'b', name: 'Bea',   periodApi: 100, apps: 1, points: 10 },
    { agentId: 'a', name: 'Ann',   periodApi: 100, apps: 1, points: 10 },
    { agentId: 'c', name: 'Cal',   periodApi: 100, apps: 2, points: 0 },
    { agentId: 'd', name: 'Dot',   periodApi: 0,   apps: 3, points: 50 },
  ];

  test('API board', () => {
    expect(sortByMetric(rows, 'periodApi').map((r) => r.agentId)).toEqual(['c', 'a', 'b', 'd', 'z']);
  });
  test('Apps board', () => {
    expect(sortByMetric(rows, 'apps').map((r) => r.agentId)).toEqual(['d', 'c', 'a', 'b', 'z']);
  });
  test('Activity board', () => {
    expect(sortByMetric(rows, 'points').map((r) => r.agentId)).toEqual(['d', 'z', 'a', 'b', 'c']);
  });
  test('does not reorder the input array', () => {
    const before = rows.map((r) => r.agentId);
    sortByMetric(rows, 'points');
    expect(rows.map((r) => r.agentId)).toEqual(before);
  });

  test('periodEntries: rank + rankWithinUnit follow the API board; previousRanks on WEEK only', () => {
    const users = [
      { id: 'a1', name: 'Alpha', unitId: 'u1' },
      { id: 'a2', name: 'Beta', unitId: 'u1' },
      { id: 'a3', name: 'Gamma', unitId: 'u2' },
    ];
    const policies = [
      mkPolicy('p1', 'a1', '2026-05-11', 100),
      mkPolicy('p2', 'a2', '2026-05-11', 300),
      mkPolicy('p3', 'a3', '2026-05-11', 200),
      mkPolicy('prev', 'a1', '2026-05-05', 999), // prior week: a1 led API
    ];
    const dailies = new Map([['a3', [mkDay('2026-05-06', '2026-05-03', { ciConducted: 1 })]]]); // prior week: a3 led Activity
    const ctx = ctxOf({ policies, dailies });
    const prior = priorRanksForBranch(users, new Date(REF.getTime() - 7 * 86400000), ctx);
    const week = periodEntries(users, 'week', REF, ctx, { u1: 'Unit One' }, prior);
    expect(week.map((e) => [e.agentId, e.rank, e.rankWithinUnit])).toEqual([['a2', 1, 1], ['a3', 2, 1], ['a1', 3, 2]]);
    const a1 = week.find((e) => e.agentId === 'a1');
    expect(a1.previousRanks).toEqual({ activity: 2, api: 1, apps: 1 });
    expect(a1.previousRank).toBe(1);
    expect(week.find((e) => e.agentId === 'a3').previousRanks.activity).toBe(1);
    expect(a1.unitName).toBe('Unit One');
    const mtd = periodEntries(users, 'mtd', REF, ctx, {}, prior);
    expect(mtd.every((e) => e.previousRank === null && e.previousRanks === null)).toBe(true);
  });
});

// ── D9 — champions ───────────────────────────────────────────────────────────

describe('D9 — champions from the ledger and points (prior week)', () => {
  const PRIOR = new Date(REF.getTime() - 7 * 86400000);
  const users = [
    { id: 'a1', role: 'agent', name: 'Alpha' },
    { id: 'a2', role: 'agent', name: 'Beta' },
    { id: 't', role: 'agent', name: 'Test', isTestAccount: true },
    { id: 'off', role: 'agent', name: 'Gone', active: false },
    { id: 'um', role: 'unit_manager', name: 'UM' },
  ];
  const policies = [
    mkPolicy('p1', 'a1', '2026-05-04', 5000),
    mkPolicy('p2', 'a2', '2026-05-05', 100, { newBusinessType: 'platinum_edge' }),
    mkPolicy('p3', 'a2', '2026-05-06', 100, { newBusinessType: 'platinum_edge' }),
    mkPolicy('bait-t', 't', '2026-05-04', 99999),
    mkPolicy('bait-off', 'off', '2026-05-04', 99999),
    mkPolicy('bait-um', 'um', '2026-05-04', 99999),
    mkPolicy('this-week', 'a2', '2026-05-11', 99999),
  ];
  const dailies = new Map([
    ['a2', [mkDay('2026-05-04', '2026-05-03', { ciConducted: 3 })]],
    ['t', [mkDay('2026-05-04', '2026-05-03', { ciConducted: 99 })]],
  ]);

  test('topAPI / topApps / topActivity, with test, inactive and non-agent users left out', () => {
    const out = weeklyChampions(users, PRIOR, ctxOf({ policies, dailies }), '2026-05-03');
    expect(out).toEqual({
      topAPI: { agentId: 'a1', agentName: 'Alpha', value: 5000 },
      topApps: { agentId: 'a2', agentName: 'Beta', value: 2 },
      topActivity: { agentId: 'a2', agentName: 'Beta', value: 30 },
      weekStarting: '2026-05-03',
    });
  });

  test('nothing positive → all null; ties go to the earlier name', () => {
    expect(weeklyChampions(users, PRIOR, ctxOf(), '2026-05-03'))
      .toEqual({ topAPI: null, topApps: null, topActivity: null, weekStarting: '2026-05-03' });
    const tie = [mkPolicy('x', 'a2', '2026-05-04', 10), mkPolicy('y', 'a1', '2026-05-04', 10)];
    expect(weeklyChampions(users, PRIOR, ctxOf({ policies: tie }), '2026-05-03').topAPI.agentId).toBe('a1');
  });
});

// ── v3 non-negotiable 3 — monotonicity ───────────────────────────────────────
//
// For every period: adding a settled policy never lowers that agent's API or
// Apps, and adding a logged day never lowers that agent's points.
// Two generators: a broad one, and a DENSE one (one agent, dates packed into
// the current week, replacements that would go negative, weeks with reports)
// so the defects the property exists for are actually reachable.
// Mutation-verified — see the PR body for the mutations and counterexamples.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES = ['nb_ordinary', 'inc_ppp', 'replacement', 'spia', 'lumpsum', 'platinum_edge', undefined];
const WEEKS = ['2026-04-26', '2026-05-03', '2026-05-10'];
const WEEK_DAYS = { '2026-04-26': ['2026-04-27', '2026-04-30', '2026-05-01'], '2026-05-03': ['2026-05-04', '2026-05-08'], '2026-05-10': ['2026-05-11', '2026-05-12', '2026-05-15'] };
const DATES = ['2026-03-31', '2026-04-01', '2026-04-30', '2026-05-01', '2026-05-09', '2026-05-10', '2026-05-15', '2026-05-16'];

function genPolicy(r, agents, n) {
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  return {
    id: `p${n}`,
    agentId: pick(agents),
    dateIssued: pick(DATES),
    status: r() < 0.8 ? 'settled' : 'submitted',
    productLine: r() < 0.9 ? 'life' : 'motor',
    isSelfOrFamily: r() < 0.1,
    newBusinessType: pick(TYPES),
    settledAPI: Math.round(r() * 6000),
    replacedPolicyAPI: r() < 0.7 ? Math.round(r() * 8000) : undefined,
  };
}

function genDay(r) {
  const ws = WEEKS[Math.floor(r() * WEEKS.length)];
  const days = WEEK_DAYS[ws];
  return mkDay(days[Math.floor(r() * days.length)], ws, {
    dials: Math.floor(r() * 30),
    ffiConducted: Math.floor(r() * 3),
    ciConducted: Math.floor(r() * 2),
    prospectingLettersSent: Math.floor(r() * 30),
    newBusiness: { apps: Math.floor(r() * 2), api: Math.round(r() * 4000) },
  });
}

function genState(r, agents, dense) {
  const policies = [];
  const nP = dense ? 3 + Math.floor(r() * 4) : Math.floor(r() * 10);
  for (let i = 0; i < nP; i++) policies.push(genPolicy(r, agents, i));
  const submissions = [];
  for (const a of agents) {
    for (const w of WEEKS) if (r() < (dense ? 0.3 : 0.2)) submissions.push(mkReport(a, w, { ciConducted: Math.floor(r() * 3) }));
  }
  const dailies = new Map();
  for (const a of agents) {
    const nD = dense ? 2 + Math.floor(r() * 5) : Math.floor(r() * 6);
    const ds = [];
    for (let i = 0; i < nD; i++) ds.push(genDay(r));
    dailies.set(a, ds);
  }
  return { policies, submissions, dailies };
}

const PERIODS = ['week', 'mtd', 'quarter', 'ytd'];

describe('monotonicity (v3 rule 3)', () => {
  for (const [label, dense, runs] of [['broad', false, 300], ['dense', true, 300]]) {
    test(`${label}: adding a settled policy never lowers API or Apps`, () => {
      const r = rng(dense ? 7 : 3);
      const agents = dense ? ['a1'] : ['a1', 'a2', 'a3'];
      for (let i = 0; i < runs; i++) {
        const state = genState(r, agents, dense);
        const extra = { ...genPolicy(r, agents, 'x'), status: 'settled' };
        const after = { ...state, policies: [...state.policies, extra] };
        for (const period of PERIODS) {
          const b = metrics(extra.agentId, period, REF, state);
          const a = metrics(extra.agentId, period, REF, after);
          if (a.periodApi < b.periodApi || a.apps < b.apps) {
            throw new Error(`${label} run ${i} ${period}: ${JSON.stringify(b)} → ${JSON.stringify(a)} adding ${JSON.stringify(extra)}`);
          }
        }
      }
    });

    test(`${label}: adding a logged day never lowers points`, () => {
      const r = rng(dense ? 11 : 5);
      const agents = dense ? ['a1'] : ['a1', 'a2', 'a3'];
      for (let i = 0; i < runs; i++) {
        const state = genState(r, agents, dense);
        const agent = agents[Math.floor(r() * agents.length)];
        const day = genDay(r);
        const dailies = new Map(state.dailies);
        dailies.set(agent, [...(dailies.get(agent) || []), day]);
        for (const period of PERIODS) {
          const b = metrics(agent, period, REF, state).points;
          const a = metrics(agent, period, REF, { ...state, dailies }).points;
          if (a < b) throw new Error(`${label} run ${i} ${period}: ${b} → ${a} adding ${JSON.stringify(day)}`);
        }
      }
    });
  }
});

describe('A1-D6 — activity counts are monotonic (v3 rule 3)', () => {
  const COUNT_KEYS = ['names', 'calls', 'ffi', 'ci'];
  const genActivityDay = (r) => ({ ...genDay(r), newNamesAdded: Math.floor(r() * 5) });
  const genReport = (r, agent) => mkReport(agent, WEEKS[Math.floor(r() * WEEKS.length)], {
    namesFromColdCanvass: Math.floor(r() * 4), namesFromSeminarsAttended: Math.floor(r() * 3),
    coldCalls: Math.floor(r() * 30), followUpCalls: Math.floor(r() * 10),
    ffiConducted: Math.floor(r() * 3), ciConducted: Math.floor(r() * 2),
  });
  // genDay has no names: give every generated day some so the names count is exercised too.
  const withNames = (r, state) => ({
    ...state,
    dailies: new Map([...state.dailies].map(([a, ds]) => [a, ds.map((d) => ({ ...d, newNamesAdded: Math.floor(r() * 5) }))])),
  });
  const lowered = (b, a) => COUNT_KEYS.some((k) => a[k] < b[k]);

  for (const [label, dense, runs] of [['broad', false, 300], ['dense', true, 300]]) {
    test(`${label}: adding a logged day never lowers any count`, () => {
      const r = rng(dense ? 21 : 17);
      const agents = dense ? ['a1'] : ['a1', 'a2', 'a3'];
      for (let i = 0; i < runs; i++) {
        const state = withNames(r, genState(r, agents, dense));
        const agent = agents[Math.floor(r() * agents.length)];
        const day = genActivityDay(r);
        const dailies = new Map(state.dailies);
        dailies.set(agent, [...(dailies.get(agent) || []), day]);
        for (const period of PERIODS) {
          const b = metrics(agent, period, REF, state).activity;
          const a = metrics(agent, period, REF, { ...state, dailies }).activity;
          if (lowered(b, a)) throw new Error(`${label} run ${i} ${period}: ${JSON.stringify(b)} → ${JSON.stringify(a)} adding ${JSON.stringify(day)}`);
        }
      }
    });

    // D5 says the report WINS its week: a report smaller than that week's days
    // legitimately lowers the figure (the days stop counting). So the report
    // here carries at least the totals of the days it lands on, i.e. it is a
    // report that includes the work already logged day by day.
    test(`${label}: adding a submitted report that covers its week's days never lowers any count`, () => {
      const r = rng(dense ? 31 : 29);
      const agents = dense ? ['a1'] : ['a1', 'a2', 'a3'];
      for (let i = 0; i < runs; i++) {
        const state = withNames(r, genState(r, agents, dense));
        const agent = agents[Math.floor(r() * agents.length)];
        const report = genReport(r, agent);
        const days = (state.dailies.get(agent) || []).filter((d) => d.weekStarting === report.weekStarting);
        const floorSum = (f) => days.reduce((n, d) => n + Math.floor(Number(f(d)) || 0), 0);
        report.coldCalls = Math.max(report.coldCalls, floorSum((d) => d.dials));
        report.namesFromOther = Math.max(report.namesFromOther || 0, floorSum((d) => d.newNamesAdded));
        report.ffiConducted = Math.max(report.ffiConducted, floorSum((d) => d.ffiConducted));
        report.ciConducted = Math.max(report.ciConducted, floorSum((d) => d.ciConducted));
        const after = { ...state, submissions: [...state.submissions, report] };
        for (const period of PERIODS) {
          const b = metrics(agent, period, REF, state).activity;
          const a = metrics(agent, period, REF, after).activity;
          if (lowered(b, a)) throw new Error(`${label} run ${i} ${period}: ${JSON.stringify(b)} → ${JSON.stringify(a)} adding ${JSON.stringify(report)}`);
        }
      }
    });
  }
});
