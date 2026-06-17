import { describe, it, expect } from 'vitest';
import {
  containingMonth,
  filterSubmissionsByPeriod,
  computePctOfGoal,
  assembleRosterRow,
  assembleRoster,
  sortRows,
  SORT_COLUMNS,
} from '../teamRoster';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW_APR = new Date('2025-04-15T12:00:00Z');

// Flat-schema (V1/current) submissions — apiSold + applicationsSold at root
function makeSub(agentId, weekStarting, apiSold, applicationsSold) {
  return { agentId, weekStarting, apiSold, applicationsSold, status: 'submitted' };
}

const SUB_JAN   = makeSub('agent1', '2025-01-05', 10000, 2);
const SUB_MAR   = makeSub('agent1', '2025-03-02', 15000, 3);
const SUB_APR   = makeSub('agent1', '2025-04-06', 20000, 4);
const SUB2_APR  = makeSub('agent2', '2025-04-06',  8000, 1);

const ALL_SUBS  = [SUB_JAN, SUB_MAR, SUB_APR, SUB2_APR];

const MEMBER1 = { id: 'agent1', displayName: 'Alice A', contractStartDate: '2022-01-15' };
const MEMBER2 = { id: 'agent2', name: 'Bob B',          contractStartDate: '2023-06-01' };
const MEMBER3 = { id: 'agent3', email: 'charlie@test.com' }; // no displayName or name

const SETTLEMENT_APR    = { agentId: 'agent1', periodKey: '2025-04', settledAPI: 80000, settledApps: 16, year: 2025 };
const PERSISTENCY_APR   = { agentId: 'agent1', persistency: 0.94, monthKey: '2025-04' };
const GOALS_WITH_TARGET = { personalAnnualAPI: 200000 };

// ─── containingMonth ─────────────────────────────────────────────────────────

describe('containingMonth', () => {
  it('week grain → month of that Sunday', () => {
    expect(containingMonth({ grain: 'week', value: '2025-04-06' })).toBe('2025-04');
  });

  it('week grain at month boundary returns the Sunday\'s month', () => {
    expect(containingMonth({ grain: 'week', value: '2025-01-26' })).toBe('2025-01');
  });

  it('month grain → that month directly', () => {
    expect(containingMonth({ grain: 'month', value: '2025-03' })).toBe('2025-03');
  });

  it('year grain — current year → current calendar month', () => {
    expect(containingMonth({ grain: 'year', value: '2025' }, NOW_APR)).toBe('2025-04');
  });

  it('year grain — past year → December of that year', () => {
    expect(containingMonth({ grain: 'year', value: '2024' }, NOW_APR)).toBe('2024-12');
  });

  it('year grain — month pads to 2 digits', () => {
    const nowJan = new Date('2025-01-10T12:00:00Z');
    expect(containingMonth({ grain: 'year', value: '2025' }, nowJan)).toBe('2025-01');
  });
});

// ─── filterSubmissionsByPeriod ────────────────────────────────────────────────

describe('filterSubmissionsByPeriod', () => {
  it('year grain includes all submissions for that year', () => {
    const result = filterSubmissionsByPeriod(ALL_SUBS, { grain: 'year', value: '2025' });
    expect(result).toHaveLength(4);
  });

  it('year grain excludes a different year', () => {
    const result = filterSubmissionsByPeriod(ALL_SUBS, { grain: 'year', value: '2024' });
    expect(result).toHaveLength(0);
  });

  it('month grain includes only submissions starting in that month', () => {
    const result = filterSubmissionsByPeriod(ALL_SUBS, { grain: 'month', value: '2025-04' });
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.weekStarting.startsWith('2025-04'))).toBe(true);
  });

  it('month grain excludes other months', () => {
    const result = filterSubmissionsByPeriod(ALL_SUBS, { grain: 'month', value: '2025-03' });
    expect(result).toHaveLength(1);
    expect(result[0].weekStarting).toBe('2025-03-02');
  });

  it('week grain matches only the exact weekStarting date', () => {
    const result = filterSubmissionsByPeriod(ALL_SUBS, { grain: 'week', value: '2025-04-06' });
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.weekStarting === '2025-04-06')).toBe(true);
  });

  it('week grain returns empty when no submissions match', () => {
    const result = filterSubmissionsByPeriod(ALL_SUBS, { grain: 'week', value: '2025-05-04' });
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(filterSubmissionsByPeriod([], { grain: 'year', value: '2025' })).toHaveLength(0);
  });
});

// ─── computePctOfGoal ────────────────────────────────────────────────────────

describe('computePctOfGoal', () => {
  it('returns a fraction, not a percentage integer', () => {
    expect(computePctOfGoal(100000, 200000)).toBeCloseTo(0.5);
  });

  it('returns > 1 when ytd exceeds target', () => {
    expect(computePctOfGoal(250000, 200000)).toBeCloseTo(1.25);
  });

  it('returns 0 when ytd is 0 and target is set', () => {
    expect(computePctOfGoal(0, 200000)).toBe(0);
  });

  it('returns null for null target', () => {
    expect(computePctOfGoal(50000, null)).toBeNull();
  });

  it('returns null for 0 target', () => {
    expect(computePctOfGoal(50000, 0)).toBeNull();
  });
});

// ─── assembleRosterRow ───────────────────────────────────────────────────────

describe('assembleRosterRow', () => {
  const noData = { settlement: null, persistencyRecord: null, goals: null };

  it('sums submittedAPI and submittedApps across periodSubs', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [SUB_JAN, SUB_MAR], ytdSubs: [SUB_JAN, SUB_MAR], ...noData });
    expect(row.submittedAPI).toBe(25000);
    expect(row.submittedApps).toBe(5);
  });

  it('pctOfAnnualGoal uses full YTD, not just period subs', () => {
    // Period = April only (20k), but YTD = Jan+Mar+Apr = 45k
    const row = assembleRosterRow({
      member: MEMBER1,
      periodSubs: [SUB_APR],
      ytdSubs:    [SUB_JAN, SUB_MAR, SUB_APR],
      settlement: null,
      persistencyRecord: null,
      goals: GOALS_WITH_TARGET,
    });
    expect(row.submittedAPI).toBe(20000);          // period only
    expect(row.pctOfAnnualGoal).toBeCloseTo(0.225); // 45000 / 200000
  });

  it('reads issuedAPI and issuedApps from settlement', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [], ytdSubs: [], settlement: SETTLEMENT_APR, persistencyRecord: null, goals: null });
    expect(row.issuedAPI).toBe(80000);
    expect(row.issuedApps).toBe(16);
  });

  it('nulls issuedAPI and issuedApps when no settlement', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [], ytdSubs: [], ...noData });
    expect(row.issuedAPI).toBeNull();
    expect(row.issuedApps).toBeNull();
  });

  it('reads persistency from persistency record', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [], ytdSubs: [], settlement: null, persistencyRecord: PERSISTENCY_APR, goals: null });
    expect(row.persistency).toBeCloseTo(0.94);
  });

  it('nulls persistency when no record', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [], ytdSubs: [], ...noData });
    expect(row.persistency).toBeNull();
  });

  it('nulls pctOfAnnualGoal when no goals doc', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [SUB_APR], ytdSubs: [SUB_APR], ...noData });
    expect(row.pctOfAnnualGoal).toBeNull();
  });

  it('name resolution: displayName > name > email > id', () => {
    const r1 = assembleRosterRow({ member: MEMBER1, periodSubs: [], ytdSubs: [], ...noData });
    expect(r1.name).toBe('Alice A');

    const r2 = assembleRosterRow({ member: MEMBER2, periodSubs: [], ytdSubs: [], ...noData });
    expect(r2.name).toBe('Bob B');

    const r3 = assembleRosterRow({ member: MEMBER3, periodSubs: [], ytdSubs: [], ...noData });
    expect(r3.name).toBe('charlie@test.com');

    const r4 = assembleRosterRow({ member: { id: 'uid-only' }, periodSubs: [], ytdSubs: [], ...noData });
    expect(r4.name).toBe('uid-only');
  });

  it('passes contractDate through from user doc', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [], ytdSubs: [], ...noData });
    expect(row.contractDate).toBe('2022-01-15');
  });

  it('nulls contractDate when absent on user doc', () => {
    const row = assembleRosterRow({ member: MEMBER3, periodSubs: [], ytdSubs: [], ...noData });
    expect(row.contractDate).toBeNull();
  });

  it('zero-submission member gets 0 for submitted fields', () => {
    const row = assembleRosterRow({ member: MEMBER1, periodSubs: [], ytdSubs: [], ...noData });
    expect(row.submittedAPI).toBe(0);
    expect(row.submittedApps).toBe(0);
  });
});

// ─── assembleRoster ──────────────────────────────────────────────────────────

describe('assembleRoster', () => {
  const PERIOD_APR = { grain: 'month', value: '2025-04' };

  const settlementsByAgent = new Map([['agent1', [SETTLEMENT_APR]]]);
  const persistencyByAgent = new Map([['agent1', PERSISTENCY_APR]]);
  const goalsByAgent       = new Map([['agent1', GOALS_WITH_TARGET], ['agent2', null], ['agent3', null]]);

  function callAssemble(members, allSubs = ALL_SUBS) {
    return assembleRoster({ members, allSubmissions: allSubs, period: PERIOD_APR, settlementsByAgent, persistencyByAgent, goalsByAgent });
  }

  it('returns one row per member', () => {
    expect(callAssemble([MEMBER1, MEMBER2, MEMBER3])).toHaveLength(3);
  });

  it('member with period submissions gets correct totals', () => {
    const [row] = callAssemble([MEMBER1]);
    expect(row.submittedAPI).toBe(20000);
    expect(row.submittedApps).toBe(4);
  });

  it('member with no period submissions gets 0 production', () => {
    const [row] = callAssemble([MEMBER3]);
    expect(row.submittedAPI).toBe(0);
    expect(row.submittedApps).toBe(0);
  });

  it('settlement lookup matches by containing month (YYYY-MM)', () => {
    const [row] = callAssemble([MEMBER1]);
    expect(row.issuedAPI).toBe(80000);
    expect(row.issuedApps).toBe(16);
  });

  it('member with no settlement gets null issued fields', () => {
    const [row] = callAssemble([MEMBER2]);
    expect(row.issuedAPI).toBeNull();
    expect(row.issuedApps).toBeNull();
  });

  it('pctOfAnnualGoal uses full YTD even when period is a month', () => {
    // YTD for agent1: SUB_JAN(10k) + SUB_MAR(15k) + SUB_APR(20k) = 45k
    const [row] = callAssemble([MEMBER1], [SUB_JAN, SUB_MAR, SUB_APR]);
    expect(row.pctOfAnnualGoal).toBeCloseTo(0.225); // 45000 / 200000
  });

  it('member without goal gets null pctOfAnnualGoal', () => {
    const [row] = callAssemble([MEMBER2]);
    expect(row.pctOfAnnualGoal).toBeNull();
  });

  it('persistency mapped from persistency record', () => {
    const [row] = callAssemble([MEMBER1]);
    expect(row.persistency).toBeCloseTo(0.94);
  });

  it('member without persistency record gets null', () => {
    const [row] = callAssemble([MEMBER2]);
    expect(row.persistency).toBeNull();
  });
});

// ─── sortRows ────────────────────────────────────────────────────────────────

const BASE_ROWS = [
  {
    memberId: 'a', name: 'Charlie', contractDate: '2022-01-01',
    submittedAPI: 30000, submittedApps: 6,
    issuedAPI: 50000, issuedApps: 10,
    persistency: 0.88, pctOfAnnualGoal: 0.30,
  },
  {
    memberId: 'b', name: 'Alice', contractDate: '2020-06-15',
    submittedAPI: 50000, submittedApps: 10,
    issuedAPI: 80000, issuedApps: 16,
    persistency: 0.95, pctOfAnnualGoal: 0.50,
  },
  {
    memberId: 'c', name: 'Bob', contractDate: '2021-03-10',
    submittedAPI: 40000, submittedApps: 8,
    issuedAPI: null, issuedApps: null,
    persistency: null, pctOfAnnualGoal: null,
  },
];

describe('sortRows', () => {
  it('does not mutate the input array', () => {
    const original = [...BASE_ROWS];
    sortRows(BASE_ROWS, 'name', 'asc');
    expect(BASE_ROWS).toEqual(original);
  });

  it('name asc → alphabetical A→Z', () => {
    const result = sortRows(BASE_ROWS, 'name', 'asc');
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('name desc → reverse alphabetical Z→A', () => {
    const result = sortRows(BASE_ROWS, 'name', 'desc');
    expect(result.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('contractDate asc → oldest contract first', () => {
    const result = sortRows(BASE_ROWS, 'contractDate', 'asc');
    expect(result.map((r) => r.contractDate)).toEqual(['2020-06-15', '2021-03-10', '2022-01-01']);
  });

  it('contractDate desc → newest contract first', () => {
    const result = sortRows(BASE_ROWS, 'contractDate', 'desc');
    expect(result.map((r) => r.contractDate)).toEqual(['2022-01-01', '2021-03-10', '2020-06-15']);
  });

  it('submittedAPI asc → lowest first', () => {
    expect(sortRows(BASE_ROWS, 'submittedAPI', 'asc').map((r) => r.submittedAPI)).toEqual([30000, 40000, 50000]);
  });

  it('submittedAPI desc → highest first', () => {
    expect(sortRows(BASE_ROWS, 'submittedAPI', 'desc').map((r) => r.submittedAPI)).toEqual([50000, 40000, 30000]);
  });

  it('submittedApps asc → lowest first', () => {
    expect(sortRows(BASE_ROWS, 'submittedApps', 'asc').map((r) => r.submittedApps)).toEqual([6, 8, 10]);
  });

  it('issuedAPI desc — null floats to bottom regardless of direction', () => {
    const result = sortRows(BASE_ROWS, 'issuedAPI', 'desc');
    expect(result[result.length - 1].memberId).toBe('c'); // null last
    expect(result[0].issuedAPI).toBe(80000);
  });

  it('issuedAPI asc — null still floats to bottom', () => {
    const result = sortRows(BASE_ROWS, 'issuedAPI', 'asc');
    expect(result[result.length - 1].memberId).toBe('c');
    expect(result[0].issuedAPI).toBe(50000);
  });

  it('persistency asc — null floats to bottom', () => {
    const result = sortRows(BASE_ROWS, 'persistency', 'asc');
    expect(result[result.length - 1].persistency).toBeNull();
    expect(result[0].persistency).toBeCloseTo(0.88);
  });

  it('persistency desc — null floats to bottom', () => {
    const result = sortRows(BASE_ROWS, 'persistency', 'desc');
    expect(result[result.length - 1].persistency).toBeNull();
    expect(result[0].persistency).toBeCloseTo(0.95);
  });

  it('pctOfAnnualGoal asc — null floats to bottom', () => {
    const result = sortRows(BASE_ROWS, 'pctOfAnnualGoal', 'asc');
    expect(result[result.length - 1].pctOfAnnualGoal).toBeNull();
    expect(result[0].pctOfAnnualGoal).toBeCloseTo(0.30);
  });

  it('pctOfAnnualGoal desc — null floats to bottom', () => {
    const result = sortRows(BASE_ROWS, 'pctOfAnnualGoal', 'desc');
    expect(result[result.length - 1].pctOfAnnualGoal).toBeNull();
    expect(result[0].pctOfAnnualGoal).toBeCloseTo(0.50);
  });

  it('numeric ties produce stable output (both values equal)', () => {
    const tied = [
      { memberId: 'x', name: 'X', contractDate: null, submittedAPI: 40000, submittedApps: 0, issuedAPI: null, issuedApps: null, persistency: null, pctOfAnnualGoal: null },
      { memberId: 'y', name: 'Y', contractDate: null, submittedAPI: 40000, submittedApps: 0, issuedAPI: null, issuedApps: null, persistency: null, pctOfAnnualGoal: null },
    ];
    const result = sortRows(tied, 'submittedAPI', 'asc');
    expect(result.map((r) => r.submittedAPI)).toEqual([40000, 40000]);
  });

  it('two nulls maintain relative order', () => {
    const twoNulls = [
      { memberId: 'p', name: 'P', contractDate: null, submittedAPI: 10000, submittedApps: 0, issuedAPI: null, issuedApps: null, persistency: null, pctOfAnnualGoal: null },
      { memberId: 'q', name: 'Q', contractDate: null, submittedAPI: 20000, submittedApps: 0, issuedAPI: null, issuedApps: null, persistency: null, pctOfAnnualGoal: null },
    ];
    const result = sortRows(twoNulls, 'issuedAPI', 'asc');
    // Both null — relative order preserved
    expect(result.map((r) => r.memberId)).toEqual(['p', 'q']);
  });

  it('SORT_COLUMNS covers all 8 fields', () => {
    expect(SORT_COLUMNS).toHaveLength(8);
    const expected = ['name', 'contractDate', 'submittedAPI', 'submittedApps', 'issuedAPI', 'issuedApps', 'persistency', 'pctOfAnnualGoal'];
    expected.forEach((col) => expect(SORT_COLUMNS).toContain(col));
  });
});
