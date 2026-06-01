// Track J P5a — scope-filter LOGIC tests (PRIMARY verification).
//
// The control's role-gating + persistence are wired around `applyScope`. A
// wrong filter / re-rank / rescale here propagates silently to every
// leaderboard surface (podium, tail, around-me) — so this is exhaustive.

import { describe, it, expect } from 'vitest';
import { applyScope, unitOptionsFromRanking } from '../scopeFilter';

// ── Fixture: a 6-agent branch ranking with two units (u1, u2) ────────────────
// (Same shape the P5-prep CF writes.)

function mkEntry({ rank, rankWithinUnit, agentId, unitId, periodApi, apps = 1, unitName }) {
  return {
    agentId,
    name: `Agent ${agentId}`,
    unitId,
    unitName: unitName ?? (unitId === 'u1' ? "Lee's Unit" : "Tony's Unit"),
    periodApi,
    apps,
    rank,
    rankWithinUnit,
    previousRank: null,
  };
}

// u1: agents a1 (500), a2 (300), a3 (100) → rankWithinUnit 1/2/3
// u2: agents a4 (400), a5 (200)            → rankWithinUnit 1/2
// solo: a6 with unitId=null (no unit)
const BRANCH = [
  mkEntry({ rank: 1, rankWithinUnit: 1, agentId: 'a1', unitId: 'u1', periodApi: 500 }),
  mkEntry({ rank: 2, rankWithinUnit: 1, agentId: 'a4', unitId: 'u2', periodApi: 400 }),
  mkEntry({ rank: 3, rankWithinUnit: 2, agentId: 'a2', unitId: 'u1', periodApi: 300 }),
  mkEntry({ rank: 4, rankWithinUnit: 2, agentId: 'a5', unitId: 'u2', periodApi: 200 }),
  mkEntry({ rank: 5, rankWithinUnit: 3, agentId: 'a3', unitId: 'u1', periodApi: 100 }),
  { rank: 6, rankWithinUnit: 1, agentId: 'a6', unitId: null, unitName: null, periodApi: 50,
    apps: 0, name: 'Solo', previousRank: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// scope === 'branch' — passthrough
// ─────────────────────────────────────────────────────────────────────────────

describe('applyScope — scope=branch (passthrough)', () => {
  it('returns the entire branch ranking with branch leaderApi + count', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'branch' });
    expect(out.displayedRanking).toHaveLength(6);
    expect(out.displayedRanking).toEqual(BRANCH); // same reference shape
    expect(out.scopedLeaderApi).toBe(500); // a1's branch-leader API
    expect(out.count).toBe(6);
  });

  it('targetUnitId is ignored when scope=branch (no filter)', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'branch', targetUnitId: 'u1' });
    expect(out.displayedRanking).toHaveLength(6);
    expect(out.scopedLeaderApi).toBe(500);
  });

  it('branch entries keep their original `rank` (1..6)', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'branch' });
    expect(out.displayedRanking.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scope === 'unit' — the real proof (THE filter + re-rank + rescale)
// ─────────────────────────────────────────────────────────────────────────────

describe('applyScope — scope=unit (THE PROOF)', () => {
  it('U1 (3 agents) → filters + re-ranks 1/2/3 + rescales leaderApi to u1 max', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'unit', targetUnitId: 'u1' });
    expect(out.displayedRanking).toHaveLength(3);
    expect(out.displayedRanking.map((e) => e.agentId)).toEqual(['a1', 'a2', 'a3']);
    // Critical: rank is now rankWithinUnit (1, 2, 3) — NOT the branch rank (1, 3, 5)
    expect(out.displayedRanking.map((e) => e.rank)).toEqual([1, 2, 3]);
    // leaderApi rescaled to a1 (u1 leader), NOT the branch leader (which is also a1 here)
    expect(out.scopedLeaderApi).toBe(500);
    expect(out.count).toBe(3);
  });

  it('U2 (2 agents) → leaderApi rescales to a4 (NOT branch leader a1)', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'unit', targetUnitId: 'u2' });
    expect(out.displayedRanking).toHaveLength(2);
    expect(out.displayedRanking.map((e) => e.agentId)).toEqual(['a4', 'a5']);
    expect(out.displayedRanking.map((e) => e.rank)).toEqual([1, 2]);
    // a5's %-of-leader bar in My Unit is 200/400 = 50%; in My Branch it would
    // have been 200/500 = 40%. THIS is the rescale-to-unit-leader proof.
    expect(out.scopedLeaderApi).toBe(400);
    expect(out.count).toBe(2);
  });

  it('the SAME agent\'s %-of-leader bar is LONGER under My Unit than My Branch (rescale proof)', () => {
    const branch = applyScope({ ranking: BRANCH, scope: 'branch' });
    const unit2  = applyScope({ ranking: BRANCH, scope: 'unit', targetUnitId: 'u2' });
    const a5Branch = branch.displayedRanking.find((e) => e.agentId === 'a5');
    const a5Unit   = unit2.displayedRanking.find((e) => e.agentId === 'a5');
    const branchPct = (a5Branch.periodApi / branch.scopedLeaderApi) * 100; // 200/500=40%
    const unitPct   = (a5Unit.periodApi   / unit2.scopedLeaderApi)   * 100; // 200/400=50%
    expect(unitPct).toBeGreaterThan(branchPct);
    expect(branchPct).toBe(40);
    expect(unitPct).toBe(50);
  });

  it('empty unit (no agents) → empty array, scopedLeaderApi=0, count=0', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'unit', targetUnitId: 'u-empty' });
    expect(out.displayedRanking).toEqual([]);
    expect(out.scopedLeaderApi).toBe(0);
    expect(out.count).toBe(0);
  });

  it('null targetUnitId → empty (defensive — no entries match a null)', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'unit', targetUnitId: null });
    expect(out.displayedRanking).toEqual([]);
    expect(out.count).toBe(0);
  });

  it('undefined targetUnitId → empty', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'unit' });
    expect(out.displayedRanking).toEqual([]);
    expect(out.count).toBe(0);
  });

  it('entries WITHOUT rankWithinUnit → fallback to 1-indexed position by order', () => {
    // Defensive: pre-P5-prep entries wouldn't have rankWithinUnit. After
    // the fix the source always sets it, but the resolver shouldn't crash
    // — and the fallback (position-by-order) is semantically correct since
    // the source is sorted desc by API.
    const noRWU = [
      { rank: 1, agentId: 'x1', unitId: 'u1', unitName: 'U1', periodApi: 300, apps: 1 },
      { rank: 5, agentId: 'x2', unitId: 'u1', unitName: 'U1', periodApi: 100, apps: 1 },
    ];
    const out = applyScope({ ranking: noRWU, scope: 'unit', targetUnitId: 'u1' });
    expect(out.displayedRanking.map((e) => e.rank)).toEqual([1, 2]);
  });

  it('agents with unitId=null are EXCLUDED from My Unit scope (no false-positive on a null target)', () => {
    // Even if the picker were to pass null, the filter rejects (above test).
    // But also: an agent without a unitId never matches any real unitId.
    const out = applyScope({ ranking: BRANCH, scope: 'unit', targetUnitId: 'u1' });
    expect(out.displayedRanking.map((e) => e.agentId)).not.toContain('a6');
  });

  it('preserves entry shape (unitName, previousRank, apps, periodApi survive the re-map)', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'unit', targetUnitId: 'u1' });
    const a1 = out.displayedRanking[0];
    expect(a1.agentId).toBe('a1');
    expect(a1.unitId).toBe('u1');
    expect(a1.unitName).toBe("Lee's Unit");
    expect(a1.periodApi).toBe(500);
    expect(a1.apps).toBe(1);
    expect(a1.previousRank).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Defensive paths — invalid inputs
// ─────────────────────────────────────────────────────────────────────────────

describe('applyScope — defensive', () => {
  it('null ranking + scope=branch → empty + 0 leaderApi + 0 count', () => {
    const out = applyScope({ ranking: null, scope: 'branch' });
    expect(out.displayedRanking).toEqual([]);
    expect(out.scopedLeaderApi).toBe(0);
    expect(out.count).toBe(0);
  });

  it('null ranking + scope=unit → empty', () => {
    const out = applyScope({ ranking: null, scope: 'unit', targetUnitId: 'u1' });
    expect(out.displayedRanking).toEqual([]);
    expect(out.count).toBe(0);
  });

  it('undefined ranking → empty', () => {
    const out = applyScope({ ranking: undefined, scope: 'branch' });
    expect(out.displayedRanking).toEqual([]);
  });

  it('unknown scope value → treated as branch (no surprise empties)', () => {
    const out = applyScope({ ranking: BRANCH, scope: 'whatever' });
    expect(out.displayedRanking).toHaveLength(6);
    expect(out.scopedLeaderApi).toBe(500);
  });

  it('empty branch ranking + scope=branch → empty + 0 leaderApi', () => {
    const out = applyScope({ ranking: [], scope: 'branch' });
    expect(out.displayedRanking).toEqual([]);
    expect(out.scopedLeaderApi).toBe(0);
    expect(out.count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// unitOptionsFromRanking — distinct (unitId, unitName) pairs for the BM picker
// ─────────────────────────────────────────────────────────────────────────────

describe('unitOptionsFromRanking', () => {
  it('returns distinct (unitId, unitName) sorted by unitName', () => {
    const opts = unitOptionsFromRanking(BRANCH);
    expect(opts).toEqual([
      { unitId: 'u1', unitName: "Lee's Unit" },
      { unitId: 'u2', unitName: "Tony's Unit" },
    ]);
  });

  it('dedupes entries that share a unitId', () => {
    const ranking = [
      { unitId: 'u1', unitName: 'Alpha Unit' },
      { unitId: 'u1', unitName: 'Alpha Unit' },
      { unitId: 'u2', unitName: 'Beta Unit'  },
    ];
    expect(unitOptionsFromRanking(ranking)).toHaveLength(2);
  });

  it('excludes entries with null/undefined unitId', () => {
    const ranking = [
      { unitId: 'u1', unitName: 'Real Unit' },
      { unitId: null, unitName: 'Whatever' },
      { unitId: undefined, unitName: 'Whatever' },
    ];
    expect(unitOptionsFromRanking(ranking)).toEqual([
      { unitId: 'u1', unitName: 'Real Unit' },
    ]);
  });

  it('substitutes "Unnamed unit" when unitName is missing', () => {
    const ranking = [{ unitId: 'u-x', unitName: null }];
    expect(unitOptionsFromRanking(ranking)).toEqual([
      { unitId: 'u-x', unitName: 'Unnamed unit' },
    ]);
  });

  it('null/undefined ranking → empty list', () => {
    expect(unitOptionsFromRanking(null)).toEqual([]);
    expect(unitOptionsFromRanking(undefined)).toEqual([]);
  });
});
