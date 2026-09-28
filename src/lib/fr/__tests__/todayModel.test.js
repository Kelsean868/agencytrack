/**
 * todayModel — value-level tests for the FR Today view model (FR-2).
 * FR-D10: unknown is null ("—"), never a confident 0.
 */
import { describe, it, expect } from 'vitest';
import {
  buildTodayModel,
  greetingFor,
  weeksToYearEnd,
  settledByMonthFrom,
  latestPersistencyPct,
  ddmmyyyy,
} from '../todayModel';
import { deriveYearProduction } from '../../ledgerProduction';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../utils/weeklyActivityFloors';
import { firstBehindStandardRow } from '../../../components/dashboard/HomeV2/homeDerivations';
import { MDRT_THRESHOLDS_2026 } from '../../../config/mdrtThresholds/2026';

const TODAY = '2026-09-27'; // Sunday, week 40
const WEEK_START = '2026-09-27';

const PRODUCTION = {
  year: 2026,
  settled: { api: 87146.28, apps: 5, count: 5, fromHeadOffice: 3, selfConfirmed: 2 },
  submitted: { api: 123146.28, apps: 6, count: 6, datedByIssue: true, weekApi: 0 },
  pending: { api: 36000, apps: 1, count: 1 },
  weekly: { ytdApi: 0, weekApi: 0 },
  mismatch: { ytd: 0, week: 0 },
};

function base(over = {}) {
  return {
    production: PRODUCTION,
    pending: false,
    error: false,
    personalGoalAPI: null,
    floors: { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS },
    actuals: { source: 'daily', values: {} },
    weekLoading: false,
    weekStart: WEEK_START,
    doNextItems: [],
    currentWeekSub: null,
    persistencyLatestPct: 86.6,
    settledByMonth: [],
    todayTT: TODAY,
    hourTT: 9,
    displayName: 'Kyron Marchan',
    ...over,
  };
}

const tile = (m, id) => m.tiles.find((t) => t.id === id);

describe('greeting and date line', () => {
  it.each([
    [0, 'Morning'], [11, 'Morning'], [12, 'Afternoon'], [16, 'Afternoon'], [17, 'Evening'], [23, 'Evening'],
  ])('hour %i → %s', (h, word) => {
    expect(greetingFor(h, 'Kyron Marchan')).toBe(`${word}, Kyron`);
  });

  it('no name → just the word; a bad hour → "Hello"', () => {
    expect(greetingFor(9, '')).toBe('Morning');
    expect(greetingFor(null, 'Kyron')).toBe('Hello, Kyron');
    expect(greetingFor(24, 'Kyron')).toBe('Hello, Kyron');
  });

  it('date line is DD-MM-YYYY with the week number; week title says the week', () => {
    const m = buildTodayModel(base());
    expect(m.dateLine).toBe('Sunday 27-09-2026 · week 40');
    expect(m.weekTitle).toBe('Week 40 so far');
    expect(ddmmyyyy('2026-01-05')).toBe('05-01-2026');
    expect(ddmmyyyy('bad')).toBeNull();
  });
});

describe('hero — goal vs MDRT and pace', () => {
  it('no personal goal → MDRT, 13%, 14 weeks left, per-week rounded UP', () => {
    const { hero } = buildTodayModel(base());
    expect(hero.isMdrt).toBe(true);
    expect(hero.goal).toBe(MDRT_THRESHOLDS_2026.mdrt);
    expect(hero.pct).toBe(13);
    expect(hero.weeksLeft).toBe(14);
    // (688,800 − 87,146.28) / 14 = 42,975.27 → 42,976 (always enough)
    expect(hero.perWeekNeeded).toBe(42976);
    expect(hero.title).toBe('TTD 87,146 settled — 13% of MDRT');
    expect(hero.pending).toBe(36000);
    expect(hero.provenance).toBe('3 from head office · 2 self-confirmed');
    expect(hero.datedByIssue).toBe(true);
  });

  it('a personal goal replaces MDRT, and the labels follow', () => {
    const m = buildTodayModel(base({ personalGoalAPI: 200000 }));
    expect(m.hero.isMdrt).toBe(false);
    expect(m.hero.goal).toBe(200000);
    expect(m.hero.pct).toBe(44);
    expect(m.hero.title).toBe('TTD 87,146 settled — 44% of your goal');
    expect(tile(m, 'goal').qualifier).toBe('of goal');
    expect(tile(m, 'goal').label).toBe('Goal progress');
    expect(m.coach.find((c) => c.id === 'pace').text).toBe('TTD 8,061 a week gets you to your goal by 31-12-2026');
  });

  it('goal met → per-week is null and the pace line says so', () => {
    const m = buildTodayModel(base({ personalGoalAPI: 50000 }));
    expect(m.hero.met).toBe(true);
    expect(m.hero.perWeekNeeded).toBeNull();
    expect(m.hero.title).toBe('TTD 87,146 settled — your goal reached');
    expect(m.coach.find((c) => c.id === 'pace').text).toMatch(/passed your goal for 2026 — TTD 37,146 over/);
  });

  it('99.6% of goal is shown as 99, never a premature 100', () => {
    const m = buildTodayModel(base({ personalGoalAPI: 87500 }));
    expect(m.hero.met).toBe(false);
    expect(m.hero.pct).toBe(99);
  });

  it('weeksToYearEnd counts whole weeks to 31 Dec', () => {
    expect(weeksToYearEnd('2026-09-27')).toBe(14);
    expect(weeksToYearEnd('2026-12-31')).toBe(0);
    expect(weeksToYearEnd('2026-12-30')).toBe(1);
    expect(weeksToYearEnd('nope')).toBeNull();
  });
});

describe('unknown is never zero', () => {
  it('ledger loading → every ledger figure null, no monthly chart, no pace line', () => {
    const m = buildTodayModel(base({ production: null, pending: true }));
    expect(tile(m, 'settled').value).toBeNull();
    expect(tile(m, 'waiting').value).toBeNull();
    expect(tile(m, 'goal').value).toBeNull();
    expect(m.hero.settled).toBeNull();
    expect(m.hero.pct).toBeNull();
    expect(m.hero.perWeekNeeded).toBeNull();
    expect(m.hero.title).toMatch(/Loading/);
    expect(m.monthly).toBeNull();
    expect(m.coach.find((c) => c.id === 'pace')).toBeUndefined();
  });

  it('ledger error → null figures and the waiting list is flagged incomplete', () => {
    const m = buildTodayModel(base({ production: null, error: true }));
    expect(tile(m, 'settled').value).toBeNull();
    expect(m.hero.title).toMatch(/did not load/);
    expect(m.waitingIncomplete).toBe(true);
  });

  it('a real zero stays a zero when the ledger HAS loaded', () => {
    const zero = { ...PRODUCTION, settled: { api: 0, apps: 0, count: 0, fromHeadOffice: 0, selfConfirmed: 0 }, pending: { api: 0, apps: 0, count: 0 } };
    const m = buildTodayModel(base({ production: zero }));
    expect(tile(m, 'settled').value).toBe(0);
    expect(tile(m, 'settled').note).toBe('Nothing settled yet this year');
    expect(tile(m, 'waiting').value).toBe(0);
    expect(tile(m, 'waiting').note).toBe('Nothing waiting to settle');
  });

  it('week meters: a key with no source is null, not 0; loading → all null', () => {
    const m = buildTodayModel(base({ actuals: { source: 'daily', values: { callsMade: null, factFindsCompleted: 2 } } }));
    const byKey = Object.fromEntries(m.meters.map((x) => [x.key, x]));
    expect(byKey.callsMade.value).toBeNull();
    expect(byKey.factFindsCompleted.value).toBe(2);
    const loading = buildTodayModel(base({ weekLoading: true, actuals: { source: 'daily', values: { factFindsCompleted: 2 } } }));
    expect(loading.meters.every((x) => x.value === null)).toBe(true);
    expect(loading.meters.every((x) => x.behind === false)).toBe(true);
  });

  it('persistency tile is hidden when unknown, warm below the gate', () => {
    expect(tile(buildTodayModel(base({ persistencyLatestPct: null })), 'persistency')).toBeUndefined();
    const low = tile(buildTodayModel(base()), 'persistency');
    expect(low.value).toBe(86.6);
    expect(low.tone).toBe('warm');
    expect(low.note).toBe('Below the 90% gate');
    expect(tile(buildTodayModel(base({ persistencyLatestPct: 92 })), 'persistency').tone).toBe('neutral');
  });
});

describe('meters and behind detection', () => {
  it('one meter per non-currency floor with a positive floor; API is not a meter', () => {
    const m = buildTodayModel(base({ floors: { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, clientsSold: 0 } }));
    const keys = m.meters.map((x) => x.key);
    expect(keys).not.toContain('api');
    expect(keys).not.toContain('clientsSold');
    expect(keys[0]).toBe('callsMade');
    expect(m.meters[0]).toMatchObject({ label: 'Prospecting calls', target: 60 });
  });

  it('behind follows the pace rule, and the first behind meter is the row firstBehindStandardRow picks', () => {
    const floors = { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS };
    const actuals = { source: 'daily', values: { telContacts: 40, factFindsCompleted: 3, closingInterviewsKept: 1, applicationsSubmitted: 0 } };
    // Thursday of the week → 4 working days elapsed.
    const m = buildTodayModel(base({ floors, actuals, todayTT: '2026-10-01', weekStart: WEEK_START }));
    const behind = m.meters.filter((x) => x.behind).map((x) => x.key);
    expect(behind).toEqual(['factFindsCompleted', 'closingInterviewsKept', 'applicationsSubmitted']);
    const pick = firstBehindStandardRow({ floors, actuals, elapsed: 4 });
    expect(behind[0]).toBe(pick.key);
    const line = m.coach.find((c) => c.id === 'behind');
    expect(line.text).toBe('7 fact-finds behind the weekly minimum — 2 working days left');
    expect(line.tone).toBe('warm');
    expect(line.action).toEqual({ label: 'Log today', target: 'daily-log' });
  });

  it('day one is never behind (same suppression as the drawer)', () => {
    const actuals = { source: 'daily', values: { factFindsCompleted: 0 } };
    const m = buildTodayModel(base({ actuals, todayTT: '2026-09-28', weekStart: WEEK_START }));
    expect(m.meters.some((x) => x.behind)).toBe(false);
    expect(m.coach.find((c) => c.id === 'behind')).toBeUndefined();
  });

  it('a submitted (final) week says "short", not "days left"', () => {
    const actuals = { source: 'final', values: { factFindsCompleted: 8 } };
    const m = buildTodayModel(base({ actuals }));
    expect(m.coach.find((c) => c.id === 'behind').text).toBe('2 fact-finds short of the weekly minimum this week');
  });
});

describe('coach', () => {
  it('up to three lines: behind, pace, persistency — with the existing routes as targets', () => {
    const actuals = { source: 'final', values: { factFindsCompleted: 8 } };
    const m = buildTodayModel(base({ actuals }));
    expect(m.coach.map((c) => c.id)).toEqual(['behind', 'pace', 'persistency']);
    expect(m.coach.find((c) => c.id === 'pace').text).toBe('TTD 42,976 a week gets you to MDRT by 31-12-2026');
    expect(m.coach.find((c) => c.id === 'persistency')).toMatchObject({
      text: 'Persistency 86.6% — below the 90% gate', tone: 'warm', action: { target: 'persistency' },
    });
    for (const c of m.coach) expect(['daily-log', 'game-plan', 'persistency']).toContain(c.action.target);
  });

  it('empty when there is nothing to say', () => {
    const m = buildTodayModel(base({ production: null, pending: true, persistencyLatestPct: 95 }));
    expect(m.coach).toEqual([]);
  });
});

describe('waiting on you', () => {
  const doNext = [
    { id: 'confirm', title: 'Confirm settled policies', sub: '2 waiting', tone: 'teal', target: 'ledger-confirm' },
    { id: 'standard', title: 'Log 7 more fact-finds', sub: "To meet this week's standard", tone: 'neutral', target: 'daily-log' },
  ];

  it('report not submitted → "Submit your weekly report" first, then Do-next in order', () => {
    const m = buildTodayModel(base({ doNextItems: doNext, currentWeekSub: null }));
    expect(m.waiting.map((w) => w.target)).toEqual(['submit', 'ledger-confirm', 'daily-log']);
    expect(m.waiting[0].title).toBe('Submit your weekly report');
    expect(m.waiting[1]).toMatchObject({ id: 'confirm', title: 'Confirm settled policies', sub: '2 waiting' });
  });

  it('a draft says so', () => {
    const m = buildTodayModel(base({ currentWeekSub: { status: 'draft' } }));
    expect(m.waiting[0].sub).toMatch(/draft is saved/);
  });

  it('report submitted → no submit item', () => {
    const m = buildTodayModel(base({ doNextItems: doNext, currentWeekSub: { status: 'submitted' } }));
    expect(m.waiting.map((w) => w.target)).toEqual(['ledger-confirm', 'daily-log']);
    expect(m.reportSubmitted).toBe(true);
  });
});

describe('monthly settled API', () => {
  const imported = (over) => ({ importSource: 'oipa_import', newBusinessType: 'nb_ordinary', productLine: 'life', settledAPI: null, ...over });
  const FIXTURE = [
    imported({ status: 'settled', dateIssued: '2026-02-10', proposedAPI: 6000 }),
    imported({ status: 'settled', dateIssued: '2026-07-01', proposedAPI: 21600 }),
    imported({ status: 'confirmed', dateIssued: '2026-08-20', proposedAPI: 22346.28 }),
    imported({ status: 'settled', dateIssued: '2026-09-03', proposedAPI: 18000, statusSource: 'oipa_import' }),
    imported({ status: 'settled', dateIssued: '2026-09-15', proposedAPI: 12000, isSelfOrFamily: true }),
    imported({ status: 'settled', dateIssued: '2025-11-02', proposedAPI: 99999 }), // other year
    imported({ status: 'settled', dateIssued: '2019-08-15', proposedAPI: 55555 }), // other year
    imported({ status: 'submitted', dateSubmitted: '2026-09-20', proposedAPI: 36000 }), // not settled
    imported({ status: 'settled', dateIssued: '2026-05-05', proposedAPI: 5000, productLine: 'health' }), // non-life
  ];

  it('months sum to the hero settled figure (same credit list)', () => {
    const hero = deriveYearProduction(FIXTURE, { year: 2026 });
    const months = settledByMonthFrom(FIXTURE, 2026);
    const sum = months.reduce((s, m) => s + m.api, 0);
    expect(sum).toBeCloseTo(hero.settled.api, 2);
    expect(hero.settled.api).toBeCloseTo(79946.28, 2);
  });

  it('policies settled in other years are excluded', () => {
    const months = settledByMonthFrom(FIXTURE, 2026);
    expect(months.map((m) => m.month)).toEqual(['2026-02', '2026-07', '2026-08', '2026-09']);
    expect(months.find((m) => m.month === '2026-09').api).toBe(30000);
  });

  it('buckets Jan..this month, current month highlighted, other-year rows dropped', () => {
    const settledByMonth = [...settledByMonthFrom(FIXTURE, 2026), { month: '2025-11', api: 99999 }];
    const m = buildTodayModel(base({ settledByMonth }));
    expect(m.monthly.data.map((d) => d.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']);
    expect(m.monthly.data.map((d) => d.value)).toEqual([0, 6000, 0, 0, 0, 0, 21600, 22346.28, 30000]);
    expect(m.monthly.data.filter((d) => d.highlight).map((d) => d.label)).toEqual(['Sep']);
    expect(m.monthly.title).toBe('September is your best month so far');
    expect(tile(m, 'settled').spark.values.at(-1)).toBeCloseTo(79946.28, 2);
  });

  it('a best month in the past is named with its figure, and carries the emphasis while this month is empty', () => {
    const m = buildTodayModel(base({ settledByMonth: [{ month: '2026-07', api: 21600 }] }));
    expect(m.monthly.title).toBe('Best month so far: July, TTD 21,600');
    expect(m.monthly.data.filter((d) => d.highlight).map((d) => d.label)).toEqual(['Jul']);
    expect(buildTodayModel(base({ settledByMonth: [] })).monthly.data.some((d) => d.highlight)).toBe(false);
  });

  it('no data → says so', () => {
    expect(buildTodayModel(base({ settledByMonth: [] })).monthly.title).toBe('No settled API yet in 2026');
  });

  it('null while the ledger is unknown', () => {
    expect(buildTodayModel(base({ production: null, pending: true })).monthly).toBeNull();
  });
});

describe('latestPersistencyPct', () => {
  it('latest by monthKey, fraction → percent, one decimal', () => {
    expect(latestPersistencyPct([
      { monthKey: '2026-08', persistency: 0.871, grossSettled: 100 },
      { monthKey: '2026-09', persistency: 0.8661, grossSettled: 100 },
      { monthKey: '2026-07', persistency: 0.9, grossSettled: 100 },
    ])).toBe(86.6);
  });

  it('a month with no settled business is no reading; empty → null', () => {
    expect(latestPersistencyPct([
      { monthKey: '2026-08', persistency: 0.9, grossSettled: 100 },
      { monthKey: '2026-09', persistency: 0, grossSettled: 0 },
    ])).toBe(90);
    expect(latestPersistencyPct([])).toBeNull();
    expect(latestPersistencyPct(null)).toBeNull();
  });

  it('falls back to year/month when monthKey is absent', () => {
    expect(latestPersistencyPct([
      { year: 2026, month: 9, persistency: 0.8 },
      { year: 2026, month: 10, persistency: 0.85 },
    ])).toBe(85);
  });
});
