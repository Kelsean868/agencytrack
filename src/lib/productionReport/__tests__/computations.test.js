import { describe, it, expect } from 'vitest';
import {
  getPeriodBoundaries,
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
  computeUnitAggregates,
  computeBranchAggregates,
  computeComplianceStats,
} from '../computations.js';

// Trinidad = UTC-4.  Reference: Friday 2026-05-15 10:00 UTC = 06:00 TT.
// Most recent TT Sunday = 2026-05-10.
const REF_MAY_15_UTC = new Date('2026-05-15T10:00:00Z'); // Fri, TT = 06:00 Fri

// Helper to build a minimal V2 submission
function mkSub(agentId, weekStarting, api, apps = 1, status = 'submitted') {
  return {
    agentId,
    weekStarting,
    status,
    version: 2,
    newBusiness: { api, apps },
    pppIncreases: { apiIncrease: 0, apps: 0 },
    lumpsums: { apiCredit: 0, commission: 0 },
    totalProductionCredit: api,
  };
}

function mkV2Sub(agentId, weekStarting, nb, ppp, lmps) {
  const total = nb.api + ppp.apiIncrease + lmps.apiCredit;
  return {
    agentId,
    weekStarting,
    status: 'submitted',
    version: 2,
    newBusiness: nb,
    pppIncreases: ppp,
    lumpsums: lmps,
    totalProductionCredit: total,
  };
}

// ── getPeriodBoundaries ───────────────────────────────────────────────────────

describe('getPeriodBoundaries', () => {
  it('week: start is most-recent TT Sunday, end is Saturday', () => {
    const { start, end } = getPeriodBoundaries('week', REF_MAY_15_UTC);
    // TT Sunday before 2026-05-15 06:00 TT = 2026-05-10
    // start = 2026-05-10 00:00 TT = 2026-05-10 04:00 UTC
    expect(start.toISOString()).toBe('2026-05-10T04:00:00.000Z');
    // end = 2026-05-16 23:59:59.999 TT = 2026-05-17 03:59:59.999 UTC
    expect(end.getUTCFullYear()).toBe(2026);
    expect(end.getUTCMonth()).toBe(4); // May
    expect(end.getUTCDate()).toBe(17);
  });

  it('week: when referenceDate is a Sunday (TT), start is that same Sunday', () => {
    // 2026-05-10 12:00 UTC = 08:00 TT Sunday
    const refSunday = new Date('2026-05-10T12:00:00Z');
    const { start } = getPeriodBoundaries('week', refSunday);
    expect(start.toISOString()).toBe('2026-05-10T04:00:00.000Z');
  });

  it('mtd: start is 1st of TT month, end is end of today (TT)', () => {
    const { start, end } = getPeriodBoundaries('mtd', REF_MAY_15_UTC);
    // start = 2026-05-01 00:00 TT = 2026-05-01 04:00 UTC
    expect(start.toISOString()).toBe('2026-05-01T04:00:00.000Z');
    // end = 2026-05-15 23:59:59.999 TT = 2026-05-16 03:59:59.999 UTC
    expect(end.getUTCDate()).toBe(16);
    expect(end.getUTCMonth()).toBe(4);
  });

  it('quarter: Q2 start is Apr 1 (month 0-idx: 3)', () => {
    // May is month index 4 → quarter 1 (0-indexed: Q2) → starts Apr (month 3)
    const { start } = getPeriodBoundaries('quarter', REF_MAY_15_UTC);
    // start = 2026-04-01 00:00 TT = 2026-04-01 04:00 UTC
    expect(start.toISOString()).toBe('2026-04-01T04:00:00.000Z');
  });

  it('quarter: Jan produces Q1 start Jan 1', () => {
    const refJan = new Date('2026-01-15T12:00:00Z');
    const { start } = getPeriodBoundaries('quarter', refJan);
    expect(start.toISOString()).toBe('2026-01-01T04:00:00.000Z');
  });

  it('quarter: Oct produces Q4 start Oct 1', () => {
    const refOct = new Date('2026-10-10T12:00:00Z');
    const { start } = getPeriodBoundaries('quarter', refOct);
    expect(start.toISOString()).toBe('2026-10-01T04:00:00.000Z');
  });

  it('ytd: start is Jan 1 of TT year', () => {
    const { start } = getPeriodBoundaries('ytd', REF_MAY_15_UTC);
    expect(start.toISOString()).toBe('2026-01-01T04:00:00.000Z');
  });

  it('throws on unknown period', () => {
    expect(() => getPeriodBoundaries('unknown', REF_MAY_15_UTC)).toThrow();
  });
});

// ── filterSubmissionsByPeriod ─────────────────────────────────────────────────

describe('filterSubmissionsByPeriod', () => {
  const subs = [
    mkSub('a1', '2026-05-10', 5000), // week of May 10 — in week/mtd/q2/ytd
    mkSub('a1', '2026-05-03', 4000), // week of May 3 — in mtd/q2/ytd, NOT in week
    mkSub('a1', '2026-04-27', 3000), // week of Apr 27 — in q2/ytd, NOT mtd/week
    mkSub('a1', '2026-01-05', 2000), // week of Jan 5 — in ytd only
    mkSub('a1', '2025-12-28', 1000), // 2025 week — not in ytd (2026)
  ];

  it('week: returns only the current week', () => {
    const result = filterSubmissionsByPeriod(subs, 'week', REF_MAY_15_UTC);
    expect(result).toHaveLength(1);
    expect(result[0].weekStarting).toBe('2026-05-10');
  });

  it('mtd: returns weeks whose Sunday falls in May', () => {
    const result = filterSubmissionsByPeriod(subs, 'mtd', REF_MAY_15_UTC);
    const weeks = result.map((s) => s.weekStarting).sort();
    expect(weeks).toEqual(['2026-05-03', '2026-05-10']);
  });

  it('quarter: Q2 includes Apr 27 and May weeks', () => {
    const result = filterSubmissionsByPeriod(subs, 'quarter', REF_MAY_15_UTC);
    const weeks = result.map((s) => s.weekStarting).sort();
    expect(weeks).toEqual(['2026-04-27', '2026-05-03', '2026-05-10']);
  });

  it('ytd: includes all 2026 weeks', () => {
    const result = filterSubmissionsByPeriod(subs, 'ytd', REF_MAY_15_UTC);
    const weeks = result.map((s) => s.weekStarting).sort();
    expect(weeks).toEqual(['2026-01-05', '2026-04-27', '2026-05-03', '2026-05-10']);
  });

  it('includes submissions exactly at boundaries', () => {
    // weekStarting = '2026-05-10' should be included in MTD (May 1 boundary)
    const result = filterSubmissionsByPeriod(subs, 'mtd', REF_MAY_15_UTC);
    expect(result.some((s) => s.weekStarting === '2026-05-10')).toBe(true);
  });

  it('returns empty array for null/undefined input', () => {
    expect(filterSubmissionsByPeriod(null, 'week', REF_MAY_15_UTC)).toEqual([]);
    expect(filterSubmissionsByPeriod(undefined, 'week', REF_MAY_15_UTC)).toEqual([]);
  });
});

// ── computeAgentTotals ────────────────────────────────────────────────────────

describe('computeAgentTotals', () => {
  it('V2 schema: sums NB + PPP + LMPS correctly', () => {
    const subs = [
      mkV2Sub('a1', '2026-05-10',
        { api: 10000, apps: 2 },
        { apiIncrease: 3000, apps: 1 },
        { apiCredit: 5000 }
      ),
      mkV2Sub('a1', '2026-05-03',
        { api: 8000, apps: 1 },
        { apiIncrease: 0, apps: 0 },
        { apiCredit: 0 }
      ),
    ];
    const totals = computeAgentTotals(subs);
    expect(totals.totalApi).toBe(26000); // 10000+3000+5000+8000
    expect(totals.nb.api).toBe(18000);
    expect(totals.ppp.api).toBe(3000);
    expect(totals.lmps.api).toBe(5000);
    expect(totals.nb.apps).toBe(3);
    expect(totals.ppp.apps).toBe(1);
    expect(totals.totalApps).toBe(4); // nb.apps + ppp.apps
  });

  it('returns zero totals for empty array', () => {
    const t = computeAgentTotals([]);
    expect(t.totalApi).toBe(0);
    expect(t.totalApps).toBe(0);
  });

  it('returns zero totals for null input', () => {
    const t = computeAgentTotals(null);
    expect(t.totalApi).toBe(0);
  });

  it('V1 schema: uses apiSold for NB', () => {
    const v1Sub = {
      agentId: 'a1', weekStarting: '2026-05-10', status: 'submitted',
      apiSold: 15000, applicationsSold: 3,
    };
    const t = computeAgentTotals([v1Sub]);
    expect(t.totalApi).toBe(15000);
    expect(t.nb.api).toBe(15000);
    expect(t.nb.apps).toBe(3);
  });
});

// ── rankAgentsByApi ───────────────────────────────────────────────────────────

describe('rankAgentsByApi', () => {
  it('returns empty array for empty input', () => {
    expect(rankAgentsByApi([])).toEqual([]);
    expect(rankAgentsByApi(null)).toEqual([]);
  });

  it('ranks by totalApi descending', () => {
    const agents = [
      { agentId: 'a1', agentName: 'Alice', unitId: 'u1', totals: { totalApi: 30000, totalApps: 5 } },
      { agentId: 'a2', agentName: 'Bob',   unitId: 'u1', totals: { totalApi: 50000, totalApps: 8 } },
      { agentId: 'a3', agentName: 'Carol', unitId: 'u2', totals: { totalApi: 20000, totalApps: 3 } },
    ];
    const ranked = rankAgentsByApi(agents);
    expect(ranked[0].agentId).toBe('a2');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].agentId).toBe('a1');
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].agentId).toBe('a3');
    expect(ranked[2].rank).toBe(3);
  });

  it('tie-breaks by apps count desc', () => {
    const agents = [
      { agentId: 'a1', agentName: 'Alice', unitId: 'u1', totals: { totalApi: 10000, totalApps: 3 } },
      { agentId: 'a2', agentName: 'Bob',   unitId: 'u1', totals: { totalApi: 10000, totalApps: 5 } },
    ];
    const ranked = rankAgentsByApi(agents);
    expect(ranked[0].agentId).toBe('a2'); // more apps wins
  });

  it('tie-breaks by name asc when apps also tied', () => {
    const agents = [
      { agentId: 'a2', agentName: 'Zara',  unitId: 'u1', totals: { totalApi: 10000, totalApps: 3 } },
      { agentId: 'a1', agentName: 'Alice', unitId: 'u1', totals: { totalApi: 10000, totalApps: 3 } },
    ];
    const ranked = rankAgentsByApi(agents);
    expect(ranked[0].agentId).toBe('a1'); // Alice < Zara alphabetically
  });

  it('assigns rankWithinUnit separately per unit', () => {
    const agents = [
      { agentId: 'a1', agentName: 'Alice', unitId: 'u1', totals: { totalApi: 50000, totalApps: 5 } },
      { agentId: 'a2', agentName: 'Bob',   unitId: 'u2', totals: { totalApi: 40000, totalApps: 4 } },
      { agentId: 'a3', agentName: 'Carol', unitId: 'u1', totals: { totalApi: 30000, totalApps: 3 } },
    ];
    const ranked = rankAgentsByApi(agents);
    const alice = ranked.find((r) => r.agentId === 'a1');
    const carol = ranked.find((r) => r.agentId === 'a3');
    expect(alice.rank).toBe(1);
    expect(alice.rankWithinUnit).toBe(1);
    expect(carol.rank).toBe(3);
    expect(carol.rankWithinUnit).toBe(2); // second in u1
  });

  it('sentinel __branch_direct__ maps to "none" bucket — no phantom unit (Slice 2.1b)', () => {
    // BM's submission has unitId === '__branch_direct__' (sentinel).
    // It must land in the same 'none' group as null-unitId agents, not create
    // a phantom '__branch_direct__' bucket that would give it an isolated rankWithinUnit.
    const SENTINEL = '__branch_direct__';
    const agents = [
      { agentId: 'bm1', agentName: 'Branch Mgr', unitId: SENTINEL, totals: { totalApi: 500, totalApps: 3 } },
      { agentId: 'a1',  agentName: 'Agent One',  unitId: null,     totals: { totalApi: 300, totalApps: 2 } },
      { agentId: 'a2',  agentName: 'Agent Two',  unitId: 'unit-1', totals: { totalApi: 200, totalApps: 1 } },
    ];
    const ranked = rankAgentsByApi(agents);
    const bm = ranked.find((e) => e.agentId === 'bm1');
    const a1 = ranked.find((e) => e.agentId === 'a1');
    const a2 = ranked.find((e) => e.agentId === 'a2');

    // bm1 has highest API overall
    expect(bm.rank).toBe(1);
    // bm1 and a1 share the 'none' bucket — bm1 ranks first, a1 second
    expect(bm.rankWithinUnit).toBe(1);
    expect(a1.rankWithinUnit).toBe(2); // would be 1 if they were in separate buckets
    // a2 in its own real unit
    expect(a2.rankWithinUnit).toBe(1);
  });
});

// ── computeUnitAggregates ─────────────────────────────────────────────────────

describe('computeUnitAggregates', () => {
  const agents = [
    { id: 'a1', unitId: 'u1' },
    { id: 'a2', unitId: 'u1' },
    { id: 'a3', unitId: 'u2' },
  ];
  const subs = [
    mkSub('a1', '2026-05-10', 20000, 2),
    mkSub('a2', '2026-05-10', 30000, 3),
    mkSub('a3', '2026-05-10', 15000, 1), // different unit
  ];

  it('sums only agents in the given unit', () => {
    const agg = computeUnitAggregates('u1', subs, agents);
    expect(agg.totalApi).toBe(50000);
    expect(agg.agentCount).toBe(2);
    expect(agg.avgApiPerAgent).toBe(25000);
  });

  it('handles 0-agent unit gracefully', () => {
    const agg = computeUnitAggregates('u-empty', subs, agents);
    expect(agg.agentCount).toBe(0);
    expect(agg.avgApiPerAgent).toBe(0);
    expect(agg.totalApi).toBe(0);
  });

  it('excludes provisioning agents from agentCount', () => {
    const agentsWithProvisioning = [
      { id: 'a1', unitId: 'u1' },
      { id: 'a2', unitId: 'u1', provisioning: true },
    ];
    const agg = computeUnitAggregates('u1', subs, agentsWithProvisioning);
    expect(agg.agentCount).toBe(1); // a2 excluded
  });
});

// ── computeBranchAggregates ───────────────────────────────────────────────────

describe('computeBranchAggregates', () => {
  const agents = [
    { id: 'a1', unitId: 'u1' },
    { id: 'a2', unitId: 'u1' },
    { id: 'a3', unitId: 'u2' },
  ];
  const subs = [
    mkSub('a1', '2026-05-10', 20000, 2),
    mkSub('a2', '2026-05-10', 30000, 3),
    mkSub('a3', '2026-05-10', 15000, 1),
  ];

  it('includes unit breakdown sorted by avgApiPerAgent desc', () => {
    const agg = computeBranchAggregates(subs, agents, ['u1', 'u2']);
    expect(agg.totalApi).toBe(65000);
    expect(agg.agentCount).toBe(3);
    expect(agg.unitBreakdown).toHaveLength(2);
    // u1 avgApi = 25000, u2 avgApi = 15000 → u1 first
    expect(agg.unitBreakdown[0].unitId).toBe('u1');
    expect(agg.unitBreakdown[1].unitId).toBe('u2');
  });

  it('avgApiPerAgent at branch level', () => {
    const agg = computeBranchAggregates(subs, agents, ['u1', 'u2']);
    expect(agg.avgApiPerAgent).toBeCloseTo(65000 / 3);
  });
});

// ── computeComplianceStats ────────────────────────────────────────────────────

describe('computeComplianceStats', () => {
  const agents = [
    { id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4', provisioning: true },
  ];
  const subs = [
    { agentId: 'a1', weekStarting: '2026-05-10', status: 'submitted' },
    { agentId: 'a2', weekStarting: '2026-05-10', status: 'submitted' },
    { agentId: 'a3', weekStarting: '2026-05-10', status: 'draft' }, // not submitted
  ];

  it('counts submitted agents for the given week', () => {
    const stats = computeComplianceStats(subs, agents, '2026-05-10');
    expect(stats.submitted).toBe(2);
    expect(stats.total).toBe(3); // a4 excluded (provisioning)
    expect(stats.percent).toBe(67);
  });

  it('excludes provisioning agents from total', () => {
    const stats = computeComplianceStats(subs, agents, '2026-05-10');
    expect(stats.total).toBe(3);
  });

  it('returns 0 percent when no agents', () => {
    const stats = computeComplianceStats([], [], '2026-05-10');
    expect(stats.percent).toBe(0);
  });

  it('ignores submissions from other weeks', () => {
    const stats = computeComplianceStats(subs, agents, '2026-05-03');
    expect(stats.submitted).toBe(0);
  });
});
