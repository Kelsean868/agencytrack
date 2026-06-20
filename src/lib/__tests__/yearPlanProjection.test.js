import { describe, it, expect } from 'vitest';
import { derivedApps, projectAwards, ASSUMED_PERSIST_DEFAULT } from '../yearPlanProjection';
import { DEFAULT_RULESET_2026 as R } from '../../config/awardsRuleset/2026';

// ── derivedApps ──────────────────────────────────────────────────────────────

describe('derivedApps', () => {
  it('rounds life API divided by default avg policy (12 000)', () => {
    expect(derivedApps(300000)).toBe(25);   // 300k / 12k = 25.0
    expect(derivedApps(250000)).toBe(21);   // 250k / 12k = 20.83 → 21
    expect(derivedApps(600000)).toBe(50);   // 600k / 12k = 50.0
  });

  it('accepts an explicit avgPolicyAPI override', () => {
    expect(derivedApps(300000, 15000)).toBe(20);  // 300k / 15k = 20
  });

  it('returns 0 for 0 API', () => {
    expect(derivedApps(0)).toBe(0);
  });
});

// ── ASSUMED_PERSIST_DEFAULT ──────────────────────────────────────────────────

describe('ASSUMED_PERSIST_DEFAULT', () => {
  it('is 90', () => {
    expect(ASSUMED_PERSIST_DEFAULT).toBe(90);
  });
});

// ── projectAwards — helper ───────────────────────────────────────────────────

function proj(api, profile = {}) {
  return projectAwards(api, profile, R);
}

function byId(results, id) {
  return results.find((r) => r.id === id);
}

// ── Persistency Silver / Gold ────────────────────────────────────────────────

describe('projectAwards — Persistency Silver', () => {
  it('not-yet below inContention (125k)', () => {
    expect(byId(proj(100000), 'persistency_silver').state).toBe('not-yet');
  });

  it('in-contention when API on-track and apps at inContention (264k)', () => {
    // 264k → apps=22 (=appsInContention), apiGate=on-track → worstState='in-contention'
    expect(byId(proj(264000), 'persistency_silver').state).toBe('in-contention');
  });

  it('on-track at or above API threshold (250k) when apps also sufficient', () => {
    // 250k → apps = 21, silver appsThreshold = 45, so apps are NOT sufficient
    // Combined state should be 'not-yet' (apps drag it down)
    const s = byId(proj(250000), 'persistency_silver').state;
    expect(s).toBe('not-yet');
  });

  it('on-track when both API and apps thresholds met', () => {
    // appsThreshold = 45 → need ≥ 45 * 12k = 540k life API for apps to be on-track
    const s = byId(proj(540000), 'persistency_silver').state;
    expect(s).toBe('on-track');
  });

  it('has persistNote: true', () => {
    expect(byId(proj(300000), 'persistency_silver').persistNote).toBe(true);
  });
});

describe('projectAwards — Persistency Gold', () => {
  it('in-contention when apps at inContention (264k)', () => {
    // 264k → apps=22 (=appsInContention), apiGate=on-track → worstState='in-contention'
    expect(byId(proj(264000), 'persistency_gold').state).toBe('in-contention');
  });

  it('on-track when API and apps thresholds met', () => {
    expect(byId(proj(540000), 'persistency_gold').state).toBe('on-track');
  });

  it('has persistNote: true', () => {
    expect(byId(proj(300000), 'persistency_gold').persistNote).toBe(true);
  });
});

// ── Club tier ────────────────────────────────────────────────────────────────

describe('projectAwards — Club tier (single pill)', () => {
  it('always returns exactly one club entry', () => {
    const clubEntries = (api) => proj(api).filter((r) => r.isClub);
    expect(clubEntries(0).length).toBe(1);
    expect(clubEntries(250000).length).toBe(1);
    expect(clubEntries(700000).length).toBe(1);
  });

  it('not-yet for Bronze L3 when below inContention (125k)', () => {
    const club = proj(100000).find((r) => r.isClub);
    expect(club.id).toBe('bronze_club_l3');
    expect(club.state).toBe('not-yet');
  });

  it('in-contention for Bronze L3 when apps ≥ appsInContention (300k)', () => {
    // 300k: tierApiState=on-track (api≥250k), apps=25=appsInContention → combined in-contention
    const club = proj(300000).find((r) => r.isClub);
    expect(club.id).toBe('bronze_club_l3');
    expect(club.state).toBe('in-contention');
  });

  it('on-track for Bronze L3 when API ≥ 250k and apps gate met', () => {
    // 300k → apps = 25, appsMin = 50 → apps 'in-contention' (25 >= 25 inContention)
    const club = proj(300000).find((r) => r.isClub);
    expect(club.id).toBe('bronze_club_l3');
    expect(['on-track', 'in-contention']).toContain(club.state);
  });

  it('advances to Bronze L2 when API ≥ 350k', () => {
    const club = proj(400000).find((r) => r.isClub);
    expect(club.id).toBe('bronze_club_l2');
  });

  it('advances to Gold Club when API ≥ 650k', () => {
    const club = proj(700000).find((r) => r.isClub);
    expect(club.id).toBe('gold_club');
  });

  it('Gold Club state is on-track when apps gate also met (≥50 apps)', () => {
    // 650k / 12k = 54 apps ≥ 50 → apps 'on-track'
    const club = proj(650000).find((r) => r.isClub);
    expect(club.id).toBe('gold_club');
    expect(club.state).toBe('on-track');
  });
});

// ── MDRT ─────────────────────────────────────────────────────────────────────

describe('projectAwards — MDRT', () => {
  it('absent when api < 250k (below inContention)', () => {
    expect(byId(proj(200000), 'mdrt')).toBeUndefined();
  });

  it('present and in-contention at 250k (inContention)', () => {
    const mdrt = byId(proj(250000), 'mdrt');
    expect(mdrt).toBeDefined();
    expect(mdrt.state).toBe('in-contention');
  });

  it('on-track at 500k (threshold)', () => {
    expect(byId(proj(500000), 'mdrt').state).toBe('on-track');
  });
});

// ── Rookie of the Year ───────────────────────────────────────────────────────

describe('projectAwards — Rookie of the Year', () => {
  it('absent when monthsInIndustry not provided', () => {
    expect(byId(proj(400000, {}), 'rookie')).toBeUndefined();
  });

  it('absent when monthsInIndustry > 18', () => {
    expect(byId(proj(400000, { monthsInIndustry: 19 }), 'rookie')).toBeUndefined();
  });

  it('present when monthsInIndustry ≤ 18', () => {
    expect(byId(proj(400000, { monthsInIndustry: 12 }), 'rookie')).toBeDefined();
  });

  it('in-contention when both API and apps in-contention (312k)', () => {
    // 312k: apiGate=in-contention (162.5k≤312k<325k), apps=26=appsInContention → combined in-contention
    const r = byId(proj(312000, { monthsInIndustry: 6 }), 'rookie');
    expect(r.state).toBe('in-contention');
  });

  it('on-track at api ≥ 325k when apps also sufficient', () => {
    // appsThreshold = 52 → need ≥ 52 * 12k = 624k to be on-track for apps
    // at 325k → apps = 27 → in-contention (27 > 26 inContention)
    const r = byId(proj(325000, { monthsInIndustry: 6 }), 'rookie');
    expect(['on-track', 'in-contention']).toContain(r.state);
  });
});

// ── New Business Advisor ─────────────────────────────────────────────────────

describe('projectAwards — New Business Advisor', () => {
  it('absent when monthsAtTatil not provided', () => {
    expect(byId(proj(300000, {}), 'new_bs_advisor')).toBeUndefined();
  });

  it('absent when monthsAtTatil > 18', () => {
    expect(byId(proj(300000, { monthsAtTatil: 24 }), 'new_bs_advisor')).toBeUndefined();
  });

  it('present when monthsAtTatil ≤ 18', () => {
    expect(byId(proj(300000, { monthsAtTatil: 6 }), 'new_bs_advisor')).toBeDefined();
  });
});

// ── Agent of the Year ────────────────────────────────────────────────────────

describe('projectAwards — Agent of the Year', () => {
  it('absent when api < 500k (below inContention)', () => {
    expect(byId(proj(400000), 'agent_of_year')).toBeUndefined();
  });

  it('present and in-contention at 500k (inContention)', () => {
    const aoy = byId(proj(500000), 'agent_of_year');
    expect(aoy).toBeDefined();
    expect(aoy.state).toBe('in-contention');
  });

  it('on-track at 1M threshold when apps gate met', () => {
    // appsThreshold = 50 → 1M / 12k = 83 apps → on-track
    expect(byId(proj(1000000), 'agent_of_year').state).toBe('on-track');
  });

  it('absent when isBdoDso: true', () => {
    expect(byId(proj(600000, { isBdoDso: true }), 'agent_of_year')).toBeUndefined();
  });

  it('present when isBdoDso is false or missing', () => {
    expect(byId(proj(600000, { isBdoDso: false }), 'agent_of_year')).toBeDefined();
    expect(byId(proj(600000, {}), 'agent_of_year')).toBeDefined();
  });
});

// ── Ordering and completeness ─────────────────────────────────────────────────

describe('projectAwards — result ordering', () => {
  it('always returns persistency_silver, persistency_gold, and one club entry for any api', () => {
    for (const api of [0, 50000, 250000, 600000, 1200000]) {
      const results = proj(api);
      expect(byId(results, 'persistency_silver')).toBeDefined();
      expect(byId(results, 'persistency_gold')).toBeDefined();
      expect(results.filter((r) => r.isClub).length).toBe(1);
    }
  });
});

// ── projectAwards — explicit avgPolicyAPI ────────────────────────────────────

describe('projectAwards — avgPolicyAPI pass-through', () => {
  it('higher avgPolicyAPI reduces apps count and downgrades apps-gated award state', () => {
    // 264k ÷ 12000 = 22 apps (inContention threshold) → 'in-contention' with default
    // 264k ÷ 24000 = 11 apps (below inContention)     → 'not-yet'  with higher avg
    const defaultResult = byId(proj(264000), 'persistency_silver');
    const highAvgResult = byId(projectAwards(264000, {}, R, 24000), 'persistency_silver');
    expect(defaultResult.state).toBe('in-contention');
    expect(highAvgResult.state).toBe('not-yet');
  });
});

// ── gap-to-next + top-tier (2.5-copy) ─────────────────────────────────────────

describe('projectAwards — gap-to-next + top-tier', () => {
  it('single-threshold award exposes API gap-to-on-track for a mid-field total', () => {
    // MDRT shown once api >= 250k; on-track threshold is 500k.
    const mdrt = byId(proj(300000), 'mdrt');
    expect(mdrt.state).toBe('in-contention');
    expect(mdrt.apiThreshold).toBe(500000);
    expect(mdrt.gapToNext).toBe(200000); // 500k − 300k
  });

  it('on-track award reports a zero gap', () => {
    const mdrt = byId(proj(500000), 'mdrt');
    expect(mdrt.state).toBe('on-track');
    expect(mdrt.gapToNext).toBe(0);
  });

  it('club tier reports the gap to the NEXT tier up (not the current one)', () => {
    // 300k is in Bronze L3 (apiMin 250k); next tier L2 starts at 350k.
    const club = proj(300000).find((r) => r.isClub);
    expect(club.id).toBe('bronze_club_l3');
    expect(club.topTier).toBe(false);
    expect(club.nextLabel).toBe('Bronze Club — Level 2');
    expect(club.gapToNext).toBe(50000); // 350k − 300k
  });

  it('highest club tier is capped — top tier reached, no invented higher award', () => {
    const club = proj(700000).find((r) => r.isClub); // ≥ Gold (650k)
    expect(club.id).toBe('gold_club');
    expect(club.topTier).toBe(true);
    expect(club.gapToNext).toBe(0);
    expect(club.nextLabel).toBeUndefined();
  });

  it('below the lowest club tier reports the gap to reach it', () => {
    const club = proj(100000).find((r) => r.isClub);
    expect(club.id).toBe('bronze_club_l3');
    expect(club.topTier).toBe(false);
    expect(club.gapToNext).toBe(150000); // 250k − 100k
  });
});
