// F-2 (docs/briefs/fr-round2-followups.md § 4) — characterization of the
// Career level INPUTS: years of service and API. Commit 1 pins today's
// outcomes; commit 2 (the change) may move only the rows the change explains,
// and the PR body lists each row's level before → after.
//
// Clock pinned to 2026-09-30 12:00 UTC. Persistency is fixed at 95 % (mocked)
// so only years and API decide the level.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('../../persistency/calculations', () => ({
  aggregatePersistency: () => ({ aggregatedPersistency: 0.95 }),
}));

import { careerStats, currentLevel, computeQuarterlyAPI, quarterlyAPISeries, yearsOfServiceFrom, submissionAPI } from '../careerModel';

const NOW = new Date('2026-09-30T12:00:00Z');
const PERS = [{ year: 2026, month: 1 }];

// One submitted weekly report in the current (v1, flat) shape.
const v1 = (weekStarting, api, apps = 0) => ({ status: 'submitted', weekStarting, apiSold: api, applicationsSold: apps });
// One submitted weekly report in the v2 wizard shape (API under newBusiness).
const v2 = (weekStarting, api, apps = 0) => ({ status: 'submitted', version: 2, weekStarting, newBusiness: { api, apps } });
// A legacy v1 report that stored API as `api`, not `apiSold`.
const legacyApi = (weekStarting, api, apps = 0) => ({ status: 'submitted', weekStarting, api, applicationsSold: apps });

// 300,000 API in each of 2025 and 2026 (2-yr average 300,000), 42 apps in 2026.
const V1_PRODUCTION = [v1('2025-03-02', 300000), v1('2026-02-01', 300000, 42)];

const ROWS = [
  { name: 'A v1 only · contractStartDate 3.7 y', user: { contractStartDate: '2023-01-15' }, subs: V1_PRODUCTION },
  { name: 'B v1 only · startDate 3.7 y, no contractStartDate', user: { startDate: '2023-01-15T00:00:00.000Z' }, subs: V1_PRODUCTION },
  { name: 'C v2 only (API and apps under newBusiness) · 3.7 y', user: { contractStartDate: '2023-01-15' }, subs: [v2('2025-03-02', 300000, 20), v2('2026-02-01', 300000, 42)] },
  { name: 'D mixed: v2 API + one v1 week with 42 apps · 3.7 y', user: { contractStartDate: '2023-01-15' }, subs: [v2('2025-03-02', 300000), v2('2026-02-01', 300000), v1('2026-02-08', 0, 42)] },
  { name: "E contractStartDate '' (doCreateUser stamp)", user: { contractStartDate: '' }, subs: V1_PRODUCTION },
  { name: 'F contractStartDate not YYYY-MM-DD', user: { contractStartDate: '15/01/2023' }, subs: V1_PRODUCTION },
  { name: 'G contractStartDate 1.9 y', user: { contractStartDate: '2024-11-06' }, subs: V1_PRODUCTION },
  { name: 'H contractStartDate just over 2.0 y', user: { contractStartDate: '2024-09-29' }, subs: V1_PRODUCTION },
  { name: 'I contractStartDate 5.1 y · 600,000 avg, 52 apps', user: { contractStartDate: '2021-09-01' }, subs: [v1('2025-03-02', 600000), v1('2026-02-01', 600000, 52)] },
  { name: 'J legacy `api` field only · 3.7 y', user: { contractStartDate: '2023-01-15' }, subs: [legacyApi('2025-03-02', 300000), legacyApi('2026-02-01', 300000, 42)] },
  { name: 'K no user fields', user: {}, subs: V1_PRODUCTION },
];

function outcome({ user, subs }) {
  const stats = careerStats(subs, PERS, user, 2026);
  return {
    level: currentLevel(stats).level,
    years: stats.yearsOfService == null ? null : Math.round(stats.yearsOfService * 100) / 100,
    ytdAPI: stats.ytdAPI,
    trailing2YrAPI: stats.trailing2YrAPI,
    ytdApps: stats.ytdApps,
    quarters: computeQuarterlyAPI(subs).join(','),
  };
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

describe('Career level inputs — characterization (F-2)', () => {
  it.each(ROWS)('$name', (row) => {
    expect(outcome(row)).toMatchSnapshot();
  });

  it('quarterlyAPISeries prints the same values as computeQuarterlyAPI for every row', () => {
    for (const row of ROWS) {
      expect(quarterlyAPISeries(row.subs).map((q) => q.value)).toEqual(computeQuarterlyAPI(row.subs));
    }
  });
});

describe('F-2 helpers', () => {
  const now = Date.UTC(2026, 8, 30);
  it.each([
    ['', null], [undefined, null], [null, null], ['15/01/2023', null], ['2023-02-30', null], ['2023-1-5', null],
    ['2024-09-30', 2], ['2026-09-30', 0],
  ])('yearsOfServiceFrom(%j)', (input, expected) => {
    const got = yearsOfServiceFrom(input, now);
    if (expected === null) expect(got).toBeNull();
    else expect(Math.round(got * 100) / 100).toBe(expected);
  });

  it('submissionAPI reads v2 newBusiness.api, v1 apiSold and legacy api', () => {
    expect(submissionAPI({ version: 2, newBusiness: { api: 1200 } })).toBe(1200);
    expect(submissionAPI({ apiSold: 900 })).toBe(900);
    expect(submissionAPI({ api: 700 })).toBe(700);
    expect(submissionAPI({})).toBe(0);
  });
});
