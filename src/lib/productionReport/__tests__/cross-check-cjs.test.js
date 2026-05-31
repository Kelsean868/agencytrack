import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM source under test
import {
  getPeriodBoundaries as srcGetPeriodBoundaries,
  filterSubmissionsByPeriod as srcFilterSubmissionsByPeriod,
  computeAgentTotals as srcComputeAgentTotals,
  rankAgentsByApi as srcRankAgentsByApi,
} from '../computations.js';
import { extractTotalProductionCredit as srcExtract } from '../../../utils/extractFields.js';

// CJS twin under test — loaded via createRequire so vitest interops the CJS module
const require = createRequire(import.meta.url);
const cjs = require('../../../../functions/leaderboard/rankingLogic');

// ── Shared fixtures (used identically through both modules) ──────────────────
//
// Reference covers a Friday in May 2026 so all four period windows have
// non-trivial boundaries that prune at least one submission.

const REF = new Date('2026-05-15T10:00:00Z');

function mkSubV2(agentId, weekStarting, api, apps = 1) {
  return {
    agentId,
    weekStarting,
    status: 'submitted',
    version: 2,
    newBusiness:  { api, apps },
    pppIncreases: { apiIncrease: 0, apps: 0 },
    lumpsums:     { apiCredit: 0, commission: 0 },
    totalProductionCredit: api,
  };
}

function mkSubMixed(agentId, weekStarting, nb, ppp, lmps) {
  const total = nb.api + ppp.apiIncrease + lmps.apiCredit;
  return {
    agentId,
    weekStarting,
    status: 'submitted',
    version: 2,
    newBusiness:  nb,
    pppIncreases: ppp,
    lumpsums:     lmps,
    totalProductionCredit: total,
  };
}

function mkSubV1(agentId, weekStarting, apiSold, appsSold = 1) {
  return { agentId, weekStarting, status: 'submitted', apiSold, applicationsSold: appsSold };
}

const FIXTURE_SUBS = [
  mkSubV2('a1', '2026-05-10', 1000, 2),   // current WK
  mkSubV2('a2', '2026-05-10',  500, 1),   // current WK
  mkSubV2('a1', '2026-05-03',  800, 2),   // prior WK, in MTD
  mkSubV2('a2', '2026-04-26',  700, 3),   // prior month (Q2)
  mkSubV2('a3', '2026-04-05',  600, 1),   // Q2, before May
  mkSubV2('a1', '2026-03-29',  900, 4),   // Q1 (YTD only)
  mkSubV2('a3', '2026-01-04',  400, 1),   // first Sun of year
  mkSubV2('a2', '2025-12-28', 9999, 9),   // prior year — must be excluded by YTD
  mkSubMixed('a4', '2026-05-10',
    { api: 200, apps: 2 },
    { apiIncrease: 50, apps: 1 },
    { apiCredit: 25 }
  ),
  mkSubV1('a5', '2026-05-10', 700, 2),     // V1 schema path
  { agentId: 'a6', weekStarting: null, totalProductionCredit: 9999 }, // null ws — must filter out
];

const FIXTURE_USERS = [
  { id: 'a1', role: 'agent',         name: 'Alpha',  unitId: 'u1', provisioning: false },
  { id: 'a2', role: 'agent',         name: 'Beta',   unitId: 'u1', provisioning: false },
  { id: 'a3', role: 'agent',         name: 'Gamma',  unitId: 'u2', provisioning: false },
  { id: 'a4', role: 'agent',         name: 'Delta',  unitId: 'u2', provisioning: false },
  { id: 'a5', role: 'agent',         name: 'Epsilon', unitId: null, provisioning: false },
  { id: 'm1', role: 'unit_manager',  name: 'UM',     unitId: 'm1' }, // ignored
  { id: 'a9', role: 'agent',         name: 'Stub',   unitId: 'u1', provisioning: true }, // ignored
];

// Tie-fixtures for ranking parity
const TIE_AGENT_TOTALS = [
  { agentId: 'a1', agentName: 'Zara',  unitId: 'u1', totals: { totalApi: 100, totalApps: 3, totalCommission: 0, nb: { api: 100, apps: 3 }, ppp: { api: 0, apps: 0 }, lmps: { api: 0 } } },
  { agentId: 'a2', agentName: 'Alice', unitId: 'u1', totals: { totalApi: 100, totalApps: 3, totalCommission: 0, nb: { api: 100, apps: 3 }, ppp: { api: 0, apps: 0 }, lmps: { api: 0 } } },
  { agentId: 'a3', agentName: 'Carol', unitId: 'u2', totals: { totalApi: 200, totalApps: 1, totalCommission: 0, nb: { api: 200, apps: 1 }, ppp: { api: 0, apps: 0 }, lmps: { api: 0 } } },
  { agentId: 'a4', agentName: 'Dave',  unitId: 'u2', totals: { totalApi: 100, totalApps: 5, totalCommission: 0, nb: { api: 100, apps: 5 }, ppp: { api: 0, apps: 0 }, lmps: { api: 0 } } },
];

// ── ESM ≡ CJS — getPeriodBoundaries ──────────────────────────────────────────

describe('ESM ≡ CJS — getPeriodBoundaries', () => {
  ['week', 'mtd', 'quarter', 'ytd'].forEach((period) => {
    it(`identical { start, end } for ${period}`, () => {
      const esm = srcGetPeriodBoundaries(period, REF);
      const c   = cjs.getPeriodBoundaries(period, REF);
      expect(c.start.toISOString()).toBe(esm.start.toISOString());
      expect(c.end.toISOString()).toBe(esm.end.toISOString());
    });
  });
});

// ── ESM ≡ CJS — boundary REFs (defense-in-depth against subtler TZ drifts) ───
//
// Adds edge REFs that exercise the mirrored internals where the default
// `REF` (mid-week, mid-month, mid-quarter, mid-year, UTC=TT-day-agreement)
// can't. Each REF is annotated with the edge it targets.

const EDGE_REFS = [
  // Sunday at TT-midnight — exercises triniSundayBefore at the week roll
  { label: 'Sun 00:00 TT (= Sun 04:00 UTC)',     ref: new Date('2026-05-10T04:00:00Z') },
  // 1 second before Sunday TT-midnight — Saturday late evening TT
  { label: 'Sat 23:59:59.999 TT (= Sun 03:59:59.999 UTC)', ref: new Date('2026-05-10T03:59:59.999Z') },
  // Month rollover: 1st of month at TT-midnight
  { label: 'May 1 00:00 TT (= May 1 04:00 UTC)', ref: new Date('2026-05-01T04:00:00Z') },
  // Quarter rollover: Q1→Q2 at TT-midnight
  { label: 'Apr 1 00:00 TT (Q2 start)',          ref: new Date('2026-04-01T04:00:00Z') },
  // Year rollover: Jan 1 at TT-midnight + Dec 31 at TT-late-evening
  { label: 'Jan 1 00:00 TT (YTD start)',         ref: new Date('2026-01-01T04:00:00Z') },
  { label: 'Dec 31 23:59 TT 2025',               ref: new Date('2026-01-01T03:59:00Z') },
  // AST-offset edge — UTC says one calendar day, TT says the prior day
  // `2026-05-15T02:00:00Z` = `2026-05-14T22:00:00 TT` (UTC=Fri, TT=Thu)
  { label: 'UTC Fri vs TT Thu (UTC 02:00 = TT 22:00 prior day)', ref: new Date('2026-05-15T02:00:00Z') },
  // Reverse direction: TT says one day, UTC says the next
  // `2026-05-14T23:00:00Z` = `2026-05-14T19:00 TT` (both Thu) — control case
  // `2026-05-15T05:00:00Z` = `2026-05-15T01:00 TT` (both Fri) — control case
  // The AST edge above is the one that actually disagrees.
];

describe('ESM ≡ CJS — getPeriodBoundaries (edge REFs)', () => {
  EDGE_REFS.forEach(({ label, ref }) => {
    ['week', 'mtd', 'quarter', 'ytd'].forEach((period) => {
      it(`identical { start, end } for ${period} @ ${label}`, () => {
        const esm = srcGetPeriodBoundaries(period, ref);
        const c   = cjs.getPeriodBoundaries(period, ref);
        expect(c.start.toISOString()).toBe(esm.start.toISOString());
        expect(c.end.toISOString()).toBe(esm.end.toISOString());
      });
    });
  });
});

describe('ESM ≡ CJS — filterSubmissionsByPeriod (edge REFs)', () => {
  // Spread weekStarting dates across the year and across boundaries so
  // the filter exercises each edge REF non-trivially.
  const BOUNDARY_SUBS = [
    mkSubV2('e1', '2025-12-28', 100),  // last Sun of 2025
    mkSubV2('e1', '2026-01-04', 100),  // first Sun of 2026
    mkSubV2('e2', '2026-03-29', 100),  // last Sun of Q1
    mkSubV2('e2', '2026-04-05', 100),  // first Sun of Q2
    mkSubV2('e3', '2026-04-26', 100),  // last Sun of April
    mkSubV2('e3', '2026-05-03', 100),  // first Sun of May
    mkSubV2('e4', '2026-05-10', 100),  // mid-May Sun
  ];
  EDGE_REFS.forEach(({ label, ref }) => {
    ['week', 'mtd', 'quarter', 'ytd'].forEach((period) => {
      it(`identical filtered set for ${period} @ ${label}`, () => {
        const esm = srcFilterSubmissionsByPeriod(BOUNDARY_SUBS, period, ref);
        const c   = cjs.filterSubmissionsByPeriod(BOUNDARY_SUBS, period, ref);
        expect(c.map((s) => `${s.agentId}|${s.weekStarting}`))
          .toEqual(esm.map((s) => `${s.agentId}|${s.weekStarting}`));
      });
    });
  });
});

// ── ESM ≡ CJS — filterSubmissionsByPeriod ────────────────────────────────────

describe('ESM ≡ CJS — filterSubmissionsByPeriod', () => {
  ['week', 'mtd', 'quarter', 'ytd'].forEach((period) => {
    it(`identical filtered output for ${period}`, () => {
      const esm = srcFilterSubmissionsByPeriod(FIXTURE_SUBS, period, REF);
      const c   = cjs.filterSubmissionsByPeriod(FIXTURE_SUBS, period, REF);
      // Same length + same weekStarting + agentId sets in same order
      expect(c.length).toBe(esm.length);
      expect(c.map((s) => `${s.agentId}|${s.weekStarting}`))
        .toEqual(esm.map((s) => `${s.agentId}|${s.weekStarting}`));
    });
  });

  it('null/undefined submissions input — both return []', () => {
    expect(cjs.filterSubmissionsByPeriod(null, 'week', REF))
      .toEqual(srcFilterSubmissionsByPeriod(null, 'week', REF));
    expect(cjs.filterSubmissionsByPeriod(undefined, 'ytd', REF))
      .toEqual(srcFilterSubmissionsByPeriod(undefined, 'ytd', REF));
  });
});

// ── ESM ≡ CJS — extractTotalProductionCredit ─────────────────────────────────

describe('ESM ≡ CJS — extractTotalProductionCredit', () => {
  const cases = [
    { name: 'V2 with totalProductionCredit', sub: { totalProductionCredit: 12345 } },
    { name: 'V2 sub-objects (no stored total)', sub: { newBusiness: { api: 100 }, pppIncreases: { apiIncrease: 50 }, lumpsums: { apiCredit: 25 } } },
    { name: 'V1 apiSold path',     sub: { apiSold: 500 } },
    { name: 'V1 annualPremium fallback', sub: { annualPremium: 222 } },
    { name: 'empty object → 0',    sub: {} },
    { name: 'null → 0',            sub: null },
  ];
  cases.forEach(({ name, sub }) => {
    it(`identical for ${name}`, () => {
      expect(cjs.extractTotalProductionCredit(sub))
        .toBe(srcExtract(sub));
    });
  });
});

// ── ESM ≡ CJS — computeAgentTotals ───────────────────────────────────────────

describe('ESM ≡ CJS — computeAgentTotals', () => {
  it('identical aggregation on the full fixture set', () => {
    const allSubs = FIXTURE_SUBS.filter((s) => s.weekStarting);
    const esm = srcComputeAgentTotals(allSubs);
    const c   = cjs.computeAgentTotals(allSubs);
    expect(c).toEqual(esm);
  });

  it('identical on empty + null inputs', () => {
    expect(cjs.computeAgentTotals([])).toEqual(srcComputeAgentTotals([]));
    expect(cjs.computeAgentTotals(null)).toEqual(srcComputeAgentTotals(null));
  });

  ['week', 'mtd', 'quarter', 'ytd'].forEach((period) => {
    it(`identical when fed through ${period} filter`, () => {
      const filtered = srcFilterSubmissionsByPeriod(FIXTURE_SUBS, period, REF);
      expect(cjs.computeAgentTotals(filtered))
        .toEqual(srcComputeAgentTotals(filtered));
    });
  });
});

// ── ESM ≡ CJS — rankAgentsByApi ──────────────────────────────────────────────

describe('ESM ≡ CJS — rankAgentsByApi', () => {
  it('identical ordering + rank + rankWithinUnit on tie fixtures', () => {
    const esm = srcRankAgentsByApi(TIE_AGENT_TOTALS);
    const c   = cjs.rankAgentsByApi(TIE_AGENT_TOTALS);
    // Build a deterministic projection for comparison (the ranking adds
    // `rank` + `rankWithinUnit` onto each entry)
    const project = (arr) => arr.map((r) => ({
      agentId: r.agentId, name: r.agentName, rank: r.rank, rankWithinUnit: r.rankWithinUnit,
    }));
    expect(project(c)).toEqual(project(esm));
  });

  it('identical on empty + null', () => {
    expect(cjs.rankAgentsByApi([])).toEqual(srcRankAgentsByApi([]));
    expect(cjs.rankAgentsByApi(null)).toEqual(srcRankAgentsByApi(null));
  });
});

// ── ESM ≡ CJS — full rankForLeaderboard pipeline parity ──────────────────────
//
// The end-to-end check: run the same fixture through src ESM pipeline (manual
// composition, since there is no src-side rankForLeaderboard export on main)
// and CJS rankForLeaderboard, assert identical ranked output for all periods.

function runSrcPipeline(allSubmissions, allUsers, period, refDate) {
  const agents = (allUsers || []).filter(
    (u) => u.role === 'agent' && u.provisioning !== true
  );
  const agentTotals = agents.map((u) => {
    const ownSubs = (allSubmissions || []).filter(
      (s) => (s.agentId == null ? s.userId : s.agentId) === u.id
    );
    const periodSubs = srcFilterSubmissionsByPeriod(ownSubs, period, refDate);
    return {
      agentId:   u.id,
      agentName: u.name || u.email || u.id,
      unitId:    u.unitId == null ? null : u.unitId,
      totals:    srcComputeAgentTotals(periodSubs),
    };
  });
  const rawRanked = srcRankAgentsByApi(agentTotals);
  return rawRanked.map((entry) => ({
    agentId:        entry.agentId,
    name:           entry.agentName,
    unitId:         entry.unitId,
    periodApi:      entry.totals.totalApi,
    apps:           entry.totals.totalApps,
    rank:           entry.rank,
    rankWithinUnit: entry.rankWithinUnit,
  }));
}

describe('ESM ≡ CJS — full pipeline parity (rankForLeaderboard)', () => {
  ['week', 'mtd', 'quarter', 'ytd'].forEach((period) => {
    it(`identical ranked output for ${period}`, () => {
      const esmResult = runSrcPipeline(FIXTURE_SUBS, FIXTURE_USERS, period, REF);
      const cjsResult = cjs.rankForLeaderboard(FIXTURE_SUBS, FIXTURE_USERS, period, REF);
      expect(cjsResult).toEqual(esmResult);
    });
  });

  it('identical zero-API ranking (no submissions)', () => {
    const esmResult = runSrcPipeline([], FIXTURE_USERS, 'week', REF);
    const cjsResult = cjs.rankForLeaderboard([], FIXTURE_USERS, 'week', REF);
    expect(cjsResult).toEqual(esmResult);
  });

  it('identical empty result (no users)', () => {
    expect(cjs.rankForLeaderboard(FIXTURE_SUBS, [], 'ytd', REF))
      .toEqual(runSrcPipeline(FIXTURE_SUBS, [], 'ytd', REF));
  });
});
