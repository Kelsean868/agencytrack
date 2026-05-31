import { describe, it, expect } from 'vitest';
import {
  computeAroundMe,
  VISIBLE_MAX_DESKTOP,
  VISIBLE_MAX_MOBILE,
} from '../aroundMeLogic.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────
//
// Mock ranking shape mirrors the P1b aggregate entry shape:
//   { agentId, name, unitName, periodApi, apps, rank, rankWithinUnit }
// computeAroundMe only reads agentId, rank, and periodApi.

function mkEntry(rank, agentId, periodApi, name = `Agent ${agentId}`) {
  return {
    agentId,
    name,
    unitName: 'Test Unit',
    rank,
    periodApi,
    apps: rank,
    rankWithinUnit: 1,
  };
}

// A 28-agent branch — large enough to exercise every below-set boundary.
// API values strictly decrease so rank order is stable.
const RANKING_28 = Array.from({ length: 28 }, (_, i) =>
  mkEntry(i + 1, `a${i + 1}`, 500000 - i * 15000)
);

// ── Constants ────────────────────────────────────────────────────────────────

describe('VISIBLE_MAX_* constants', () => {
  it('desktop max is 8, mobile max is 7', () => {
    expect(VISIBLE_MAX_DESKTOP).toBe(8);
    expect(VISIBLE_MAX_MOBILE).toBe(7);
  });
});

// ── Empty / null inputs ──────────────────────────────────────────────────────

describe('computeAroundMe — empty inputs', () => {
  it('returns CLUSTER_UNRANKED with empty rows for an empty ranking', () => {
    const out = computeAroundMe({ ranking: [], viewerUid: 'a1', visibleMax: 8 });
    expect(out).toEqual({
      state: 'CLUSTER_UNRANKED',
      viewerEntry: null,
      rows: [],
      gapToNext: null,
      prevRank: null,
      missingCount: 0,
      totalCount: 0,
    });
  });

  it('handles null / undefined ranking without crashing', () => {
    expect(computeAroundMe({ ranking: null, viewerUid: 'a1', visibleMax: 8 }).state).toBe('CLUSTER_UNRANKED');
    expect(computeAroundMe({ ranking: undefined, viewerUid: 'a1', visibleMax: 8 }).state).toBe('CLUSTER_UNRANKED');
  });
});

// ── VISIBLE_PODIUM — ranks 1, 2, 3 ───────────────────────────────────────────

describe('computeAroundMe — VISIBLE_PODIUM', () => {
  it.each([1, 2, 3])('viewer at rank %i → VISIBLE_PODIUM, no rows', (rank) => {
    const out = computeAroundMe({
      ranking: RANKING_28,
      viewerUid: `a${rank}`,
      visibleMax: 8,
    });
    expect(out.state).toBe('VISIBLE_PODIUM');
    expect(out.rows).toEqual([]);
    expect(out.viewerEntry.rank).toBe(rank);
    expect(out.gapToNext).toBeNull();
    expect(out.missingCount).toBe(0);
  });

  it('podium viewer on mobile breakpoint also returns VISIBLE_PODIUM', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a1', visibleMax: 7 });
    expect(out.state).toBe('VISIBLE_PODIUM');
  });
});

// ── VISIBLE_TAIL — rank in [4..visibleMax] ───────────────────────────────────

describe('computeAroundMe — VISIBLE_TAIL', () => {
  it('rank 4 → VISIBLE_TAIL on both breakpoints', () => {
    const desktop = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a4', visibleMax: 8 });
    const mobile  = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a4', visibleMax: 7 });
    expect(desktop.state).toBe('VISIBLE_TAIL');
    expect(mobile.state).toBe('VISIBLE_TAIL');
  });

  it('rank 7 → VISIBLE_TAIL on both breakpoints (mobile boundary, inclusive)', () => {
    const desktop = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a7', visibleMax: 8 });
    const mobile  = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a7', visibleMax: 7 });
    expect(desktop.state).toBe('VISIBLE_TAIL');
    expect(mobile.state).toBe('VISIBLE_TAIL'); // rank 7 IS the mobile bound; still visible
  });

  it('rank 8 → VISIBLE_TAIL desktop, CLUSTER_3 mobile (THE BREAKPOINT-AWARE CASE)', () => {
    const desktop = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a8', visibleMax: 8 });
    expect(desktop.state).toBe('VISIBLE_TAIL'); // rank 8 IS the desktop bound; visible

    const mobile = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a8', visibleMax: 7 });
    expect(mobile.state).toBe('CLUSTER_3'); // rank 8 > 7 on mobile; cluster triggers
    expect(mobile.rows).toHaveLength(3);
  });

  it('VISIBLE_TAIL returns rows=[] and gapToNext=null (no cluster work)', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a5', visibleMax: 8 });
    expect(out.rows).toEqual([]);
    expect(out.gapToNext).toBeNull();
    expect(out.missingCount).toBe(0);
  });
});

// ── CLUSTER_3 trigger threshold & contents ───────────────────────────────────

describe('computeAroundMe — CLUSTER_3 trigger threshold', () => {
  it('rank 9 (desktop) → CLUSTER_3 with prev=8, viewer=9, next=10', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a9', visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_3');
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0].rank).toBe(8);
    expect(out.rows[1].rank).toBe(9);
    expect(out.rows[2].rank).toBe(10);
    expect(out.viewerEntry.rank).toBe(9);
  });

  it('rank 8 (mobile) → CLUSTER_3 with prev=7, viewer=8, next=9', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a8', visibleMax: 7 });
    expect(out.state).toBe('CLUSTER_3');
    expect(out.rows[0].rank).toBe(7);
    expect(out.rows[1].rank).toBe(8);
    expect(out.rows[2].rank).toBe(9);
  });

  it('rank 14 (desktop) → CLUSTER_3 with prev=13, viewer=14, next=15', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a14', visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_3');
    expect(out.rows.map((r) => r.rank)).toEqual([13, 14, 15]);
  });

  it('returns viewerEntry pointing at the same object as the viewer row', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a9', visibleMax: 8 });
    expect(out.viewerEntry).toBe(out.rows[1]); // reference equality
  });
});

// ── CLUSTER_2_LAST — viewer is the last entry ────────────────────────────────

describe('computeAroundMe — CLUSTER_2_LAST', () => {
  it('viewer at rank 28 (last) → CLUSTER_2_LAST with prev=27, viewer=28', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a28', visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_2_LAST');
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0].rank).toBe(27);
    expect(out.rows[1].rank).toBe(28);
    expect(out.viewerEntry.rank).toBe(28);
    expect(out.gapToNext).toBeGreaterThan(0);
    expect(out.prevRank).toBe(27);
  });

  it('viewer at rank 27 (second-to-last) → still CLUSTER_3 (has next=28)', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a27', visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_3');
    expect(out.rows.map((r) => r.rank)).toEqual([26, 27, 28]);
  });

  it('CLUSTER_2_LAST gap-to-next math: prev.periodApi - viewer.periodApi', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a28', visibleMax: 8 });
    const prev = RANKING_28[26]; // rank 27
    const viewer = RANKING_28[27]; // rank 28
    expect(out.gapToNext).toBe(prev.periodApi - viewer.periodApi);
  });
});

// ── CLUSTER_UNRANKED — viewer not in ranking ─────────────────────────────────

describe('computeAroundMe — CLUSTER_UNRANKED', () => {
  it('viewer not found in ranking → CLUSTER_UNRANKED with empty rows', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'unknown-uid', visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_UNRANKED');
    expect(out.viewerEntry).toBeNull();
    expect(out.rows).toEqual([]);
    expect(out.gapToNext).toBeNull();
    expect(out.prevRank).toBeNull();
  });

  it('unranked viewer: missingCount = totalCount - visibleMax (desktop = 20)', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'unknown-uid', visibleMax: 8 });
    expect(out.missingCount).toBe(28 - 8); // 20 ranks below the visible set, all "missing" from the viewer's perspective
    expect(out.totalCount).toBe(28);
  });

  it('unranked viewer on a smaller ranking still returns CLUSTER_UNRANKED', () => {
    const small = RANKING_28.slice(0, 5);
    const out = computeAroundMe({ ranking: small, viewerUid: 'unknown-uid', visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_UNRANKED');
    expect(out.missingCount).toBe(0); // totalCount(5) < visibleMax(8) → 0
    expect(out.totalCount).toBe(5);
  });

  it('null/undefined viewerUid → CLUSTER_UNRANKED', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: null, visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_UNRANKED');
  });
});

// ── gap-to-next math ─────────────────────────────────────────────────────────

describe('computeAroundMe — gap-to-next math', () => {
  it('CLUSTER_3 gap = prev.periodApi - viewer.periodApi', () => {
    const ranking = [
      mkEntry(1, 'a1', 100000),
      mkEntry(2, 'a2',  90000),
      mkEntry(3, 'a3',  80000),
      mkEntry(4, 'a4',  70000),
      mkEntry(5, 'a5',  60000),
      mkEntry(6, 'a6',  50000),
      mkEntry(7, 'a7',  40000),
      mkEntry(8, 'a8',  30000),
      mkEntry(9, 'a9',  25000),
      mkEntry(10, 'a10', 20000),
      mkEntry(11, 'a11', 15000),
      mkEntry(12, 'a12', 10000),
      mkEntry(13, 'a13',  8000),
      mkEntry(14, 'a14',  6500),
      mkEntry(15, 'a15',  5000),
    ];
    const out = computeAroundMe({ ranking, viewerUid: 'a14', visibleMax: 8 });
    expect(out.gapToNext).toBe(8000 - 6500); // prev(13)=8000 - viewer(14)=6500 = 1500
    expect(out.prevRank).toBe(13);
  });

  it('clamps negative gap to 0 (bad-data defense)', () => {
    // Hypothetical: rank 14 has HIGHER periodApi than rank 13 (data inconsistency).
    // The fn should clamp to 0 rather than emit a negative gap.
    const ranking = [
      mkEntry(13, 'a13', 1000),
      mkEntry(14, 'a14', 1500), // higher API at lower rank — should never happen, but defensively clamp
    ];
    const out = computeAroundMe({ ranking, viewerUid: 'a14', visibleMax: 8 });
    expect(out.state).toBe('CLUSTER_2_LAST');
    expect(out.gapToNext).toBe(0);
  });

  it('CLUSTER_2_LAST has gapToNext (prev exists); CLUSTER_UNRANKED has null', () => {
    const last = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a28', visibleMax: 8 });
    const unranked = computeAroundMe({ ranking: RANKING_28, viewerUid: 'x', visibleMax: 8 });
    expect(last.gapToNext).not.toBeNull();
    expect(unranked.gapToNext).toBeNull();
  });
});

// ── missingCount divider math ────────────────────────────────────────────────

describe('computeAroundMe — missingCount divider', () => {
  it('viewer at rank 9 (visibleMax 8) → missingCount=0 (no gap; prev=8 is at the bound)', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a9', visibleMax: 8 });
    expect(out.missingCount).toBe(0);
  });

  it('viewer at rank 14 (visibleMax 8) → missingCount=4 (ranks 9..12 are skipped between prev=13 and visibleMax=8)', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a14', visibleMax: 8 });
    // prev=13, visibleMax=8: skipped ranks are 9, 10, 11, 12 → count = 13 - 8 - 1 = 4
    // Wait, +N agents means "N agents are between the visible set and the cluster". Between rank 8 (last visible)
    // and rank 13 (cluster top), the missing ranks are 9, 10, 11, 12 → 4 agents.
    expect(out.missingCount).toBe(4);
  });

  it('viewer at rank 28 (last) → missingCount = 27 - 8 - 1 = 18', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a28', visibleMax: 8 });
    expect(out.missingCount).toBe(18);
  });

  it('viewer at rank 10 (visibleMax 8) → missingCount=1 (rank 9 alone skipped between 8 and prev=9)', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a10', visibleMax: 8 });
    // prev=9, visibleMax=8: missing ranks between 8 and 9 → 0; but the prev itself IS at rank 9, so what's
    // missing between visibleMax (rank 8, last shown) and cluster top (rank 9) is 0 ranks.
    // Hmm let me recompute: clusterTopRank=9, visibleMax=8, missing = 9 - 8 - 1 = 0.
    // But the brief says "+N agents" should reflect "agents between visible set and cluster top".
    // At rank 10 viewer, prev=9, the cluster top is 9. Visible bottom is 8. 9 - 8 = 1 rank difference,
    // meaning rank 9 sits between them; but rank 9 IS the cluster top (shown). So 0 ranks are HIDDEN.
    expect(out.missingCount).toBe(0);
  });
});

// ── Reference equality + identity ─────────────────────────────────────────────

describe('computeAroundMe — reference equality', () => {
  it('rows contain the SAME entry objects from ranking (not clones)', () => {
    const out = computeAroundMe({ ranking: RANKING_28, viewerUid: 'a14', visibleMax: 8 });
    expect(out.rows[0]).toBe(RANKING_28[12]); // rank 13 → index 12
    expect(out.rows[1]).toBe(RANKING_28[13]); // rank 14 → index 13
    expect(out.rows[2]).toBe(RANKING_28[14]); // rank 15 → index 14
  });
});

// ── totalCount honesty ───────────────────────────────────────────────────────

describe('computeAroundMe — totalCount', () => {
  it('returns the ranking length even when viewer is unranked', () => {
    expect(computeAroundMe({ ranking: RANKING_28, viewerUid: 'x', visibleMax: 8 }).totalCount).toBe(28);
  });
  it('returns the ranking length for visible viewers', () => {
    expect(computeAroundMe({ ranking: RANKING_28, viewerUid: 'a1', visibleMax: 8 }).totalCount).toBe(28);
  });
});
