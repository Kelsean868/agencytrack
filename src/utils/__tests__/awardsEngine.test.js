import { describe, it, expect } from 'vitest';
import { computeAgentAwards, computeManagerAwards, computeAtRiskStatus, getPeriodCtx, nextTierDistance, isPersistencyOnlyBlock } from '../awardsEngine';

// Helper: build a manager settlement doc
function settled(agentId, periodKey, settledAPI, settledApps, persistency = 0) {
  return { agentId, periodKey, settledAPI, settledApps, persistency };
}

// Helper: build a V2 submission doc for a given month
function v2Sub(yearMonth, nb = { apps: 0, api: 0 }, ppp = { apps: 0, apiIncrease: 0 }, lmps = { grossAmount: 0 }) {
  const weekStarting = `${yearMonth}-01`;
  return {
    version: 2,
    status: 'submitted',
    weekStarting,
    newBusiness:  { apps: nb.apps,   api: nb.api },
    pppIncreases: { apps: ppp.apps,  apiIncrease: ppp.apiIncrease },
    lumpsums:     { grossAmount: lmps.grossAmount, apiCredit: lmps.grossAmount * 0.1, commission: lmps.grossAmount * 0.05 },
  };
}

// Helper: build a V1 submission doc (flat schema)
function v1Sub(yearMonth, apiSold = 0, apps = 0) {
  return {
    status: 'submitted',
    weekStarting: `${yearMonth}-01`,
    apiSold,
    applicationsSold: apps,
  };
}

const NO_PROFILE = {};
const DATE_JAN = new Date('2026-01-15');

describe('computeAgentAwards — V2 schema reads', () => {
  it('monthly API uses totalProductionCredit (NB + PPP + LMPS.apiCredit)', () => {
    const sub = v2Sub('2026-01', { apps: 2, api: 20000 }, { apps: 1, apiIncrease: 5000 }, { grossAmount: 30000 });
    const awards = computeAgentAwards([], [sub], NO_PROFILE, DATE_JAN);
    // Expected: 20000 (NB) + 5000 (PPP) + 3000 (LMPS 10%) = 28000
    const mthly = awards.advisor_month_api;
    expect(mthly).toBeDefined();
    const apiCrit = mthly.criteria.find((c) => c.label === 'Monthly API');
    expect(apiCrit).toBeDefined();
    expect(apiCrit.current).toBe(28000);
  });

  it('V1 fallback: monthly API reads apiSold', () => {
    const sub = v1Sub('2026-01', 18000, 2);
    const awards = computeAgentAwards([], [sub], NO_PROFILE, DATE_JAN);
    const mthly = awards.advisor_month_api;
    expect(mthly).toBeDefined();
    const apiCrit = mthly.criteria.find((c) => c.label === 'Monthly API');
    expect(apiCrit.current).toBe(18000);
  });
});

describe('computeAgentAwards — Centurion apps cap', () => {
  it('NB apps only when no PPP → centurionApps = NB.apps', () => {
    // 100 NB apps, no PPP
    const subs = Array.from({ length: 10 }, (_, i) =>
      v2Sub(`2026-${String(i + 1).padStart(2, '0')}`, { apps: 10, api: 10000 })
    );
    const awards = computeAgentAwards([], subs, NO_PROFILE, new Date('2026-11-01'));
    const cent = awards.centurion;
    const appsCrit = cent.criteria.find((c) => c.label === 'Annual Apps');
    expect(appsCrit.current).toBe(100);
    // At 100 apps with no persistency data: estimated source so persistency gate relaxed
    // The key assertion is the apps count itself
  });

  it('PPP apps counted toward Centurion, capped at 20', () => {
    // 80 NB apps + 25 PPP apps → centurionApps = 80 + 20 (cap) = 100
    const subs = Array.from({ length: 10 }, (_, i) =>
      v2Sub(`2026-${String(i + 1).padStart(2, '0')}`,
        { apps: 8, api: 10000 },
        { apps: 2, apiIncrease: 3000 })  // 2 PPP per month × 10 = 20 PPP total
    );
    // Replace last 5 months to push PPP over cap: 8 NB + 3 PPP × 5 = 15 PPP extra
    // Total PPP: 5×2 + 5×3 = 25 PPP, capped at 20 → centurionApps = 80 + 20 = 100
    const subs2 = [
      ...subs.slice(0, 5),
      ...Array.from({ length: 5 }, (_, i) =>
        v2Sub(`2026-${String(i + 6).padStart(2, '0')}`,
          { apps: 8, api: 10000 },
          { apps: 3, apiIncrease: 3000 })
      ),
    ];
    const awards = computeAgentAwards([], subs2, NO_PROFILE, new Date('2026-11-01'));
    const cent = awards.centurion;
    const appsCrit = cent.criteria.find((c) => c.label === 'Annual Apps');
    // NB: 80, PPP: 5×2 + 5×3 = 25 → capped at 20 → total = 100
    expect(appsCrit.current).toBe(100);
  });

  it('PPP apps below cap: all counted', () => {
    // 85 NB apps + 10 PPP apps → centurionApps = 95 (not eligible)
    const subs = Array.from({ length: 10 }, (_, i) =>
      v2Sub(`2026-${String(i + 1).padStart(2, '0')}`,
        { apps: 8, api: 10000 },
        { apps: 1, apiIncrease: 3000 }) // +5 NB from first month
    );
    // adjust first month to have 9 NB (total NB = 9 + 9×8 = 81... let's just do 85 + 10)
    // Simpler: 10 subs, 8 NB + 1 PPP each = 80 NB + 10 PPP → centurionApps = 90
    const awards = computeAgentAwards([], subs, NO_PROFILE, new Date('2026-11-01'));
    const cent = awards.centurion;
    const appsCrit = cent.criteria.find((c) => c.label === 'Annual Apps');
    expect(appsCrit.current).toBe(90); // 80 NB + 10 PPP (under cap)
    expect(cent.eligible).toBe(false); // needs 100
    expect(cent.inContention).toBe(true); // 90 >= 50
  });

  it('exactly 20 PPP apps: all counted (boundary at cap)', () => {
    // 80 NB + 20 PPP → centurionApps = 100
    const subs = Array.from({ length: 10 }, (_, i) =>
      v2Sub(`2026-${String(i + 1).padStart(2, '0')}`,
        { apps: 8, api: 10000 },
        { apps: 2, apiIncrease: 3000 })
    );
    const awards = computeAgentAwards([], subs, NO_PROFILE, new Date('2026-11-01'));
    const cent = awards.centurion;
    const appsCrit = cent.criteria.find((c) => c.label === 'Annual Apps');
    expect(appsCrit.current).toBe(100); // 80 NB + 20 PPP (exactly at cap)
  });

  it('21 PPP apps → capped at 20 (one over boundary)', () => {
    // 80 NB + 21 PPP across 10 months = centurionApps = 100 (not 101)
    // First month: 3 PPP; remaining 9: 2 PPP each → 3 + 18 = 21 PPP
    const subs = [
      v2Sub('2026-01', { apps: 8, api: 10000 }, { apps: 3, apiIncrease: 3000 }),
      ...Array.from({ length: 9 }, (_, i) =>
        v2Sub(`2026-${String(i + 2).padStart(2, '0')}`,
          { apps: 8, api: 10000 },
          { apps: 2, apiIncrease: 3000 })
      ),
    ];
    const awards = computeAgentAwards([], subs, NO_PROFILE, new Date('2026-11-01'));
    const cent = awards.centurion;
    const appsCrit = cent.criteria.find((c) => c.label === 'Annual Apps');
    expect(appsCrit.current).toBe(100); // 80 NB + min(21, 20) = 100
  });

  it('Centurion uses centurionApps, not annualApps — other club awards unaffected', () => {
    // 90 NB apps, 15 PPP apps → centurionApps = 105 but annualApps = 90
    // Club uses annualApps (50 threshold) — should still be met by NB alone
    const subs = Array.from({ length: 10 }, (_, i) =>
      v2Sub(`2026-${String(i + 1).padStart(2, '0')}`,
        { apps: 9, api: 50000 },
        { apps: 1, apiIncrease: 3000 })
    );
    const awards = computeAgentAwards([], subs, NO_PROFILE, new Date('2026-11-01'));
    const cent = awards.centurion;
    const appsCrit = cent.criteria.find((c) => c.label === 'Annual Apps');
    // centurionApps = 90 NB + min(10 PPP, 20) = 100
    expect(appsCrit.current).toBe(100);

    // Bronze club uses annualApps (90 NB) — clubApps = 90 >= 50
    const bronze = awards.bronze_club_l3;
    if (bronze) {
      const bronzeApps = bronze.criteria.find((c) => c.label === 'Annual Apps');
      expect(bronzeApps?.current).toBe(90); // NB apps only, PPP not added
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Manager parity tests — verify each award category against the pre-refactor
// constants from the Phase-1 inventory. All calls use the default 6-arg form
// (consumers unchanged); the 7th ruleset param defaults to DEFAULT_RULESET_2026.
// ─────────────────────────────────────────────────────────────────────────────

describe('computeManagerAwards — monthly bonus tiers', () => {
  const DATE = new Date('2026-06-15');
  const IDS  = ['a1', 'a2'];

  it('bonusPct 1.5 when avgMonthlyAPI >= 30000', () => {
    const data = [settled('a1', '2026-06', 35000, 5), settled('a2', '2026-06', 35000, 5)];
    const m = computeManagerAwards(data, IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.agency_monthly_bonus.bonusPct).toBe(1.5);
    expect(m.agency_monthly_bonus.nextTier).toBeNull();
  });

  it('bonusPct 1.0 when avgMonthlyAPI in [20000, 30000)', () => {
    const data = [settled('a1', '2026-06', 22000, 5), settled('a2', '2026-06', 22000, 5)];
    const m = computeManagerAwards(data, IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.agency_monthly_bonus.bonusPct).toBe(1.0);
    expect(m.agency_monthly_bonus.nextTier).toEqual({ threshold: 30000, pct: 1.5 });
  });

  it('bonusPct 0.75 when avgMonthlyAPI in [15000, 20000)', () => {
    const data = [settled('a1', '2026-06', 16000, 5), settled('a2', '2026-06', 16000, 5)];
    const m = computeManagerAwards(data, IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.agency_monthly_bonus.bonusPct).toBe(0.75);
    expect(m.agency_monthly_bonus.nextTier).toEqual({ threshold: 20000, pct: 1.0 });
  });

  it('bonusPct 0 when avgMonthlyAPI < 15000, nextTier shows lowest threshold', () => {
    const data = [settled('a1', '2026-06', 10000, 5), settled('a2', '2026-06', 10000, 5)];
    const m = computeManagerAwards(data, IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.agency_monthly_bonus.bonusPct).toBe(0);
    expect(m.agency_monthly_bonus.nextTier).toEqual({ threshold: 15000, pct: 0.75 });
  });
});

describe('computeManagerAwards — recruiting awards', () => {
  const DATE = new Date('2026-06-15');
  const IDS  = ['a1'];

  it('gold eligible at newAdvisors=8 (>= 7)', () => {
    const m = computeManagerAwards([], IDS, {}, { newAdvisors: 8 }, DATE, 'unit_manager');
    expect(m.recruiting_gold.eligible).toBe(true);
  });

  it('silver eligible at newAdvisors=5, gold not eligible', () => {
    const m = computeManagerAwards([], IDS, {}, { newAdvisors: 5 }, DATE, 'unit_manager');
    expect(m.recruiting_silver.eligible).toBe(true);
    expect(m.recruiting_gold.eligible).toBe(false);
  });

  it('bronze eligible at newAdvisors=3, silver not eligible', () => {
    const m = computeManagerAwards([], IDS, {}, { newAdvisors: 3 }, DATE, 'unit_manager');
    expect(m.recruiting_bronze.eligible).toBe(true);
    expect(m.recruiting_silver.eligible).toBe(false);
  });

  it('bronze inContention at newAdvisors=2 (== ceil(3/2))', () => {
    const m = computeManagerAwards([], IDS, {}, { newAdvisors: 2 }, DATE, 'unit_manager');
    expect(m.recruiting_bronze.eligible).toBe(false);
    expect(m.recruiting_bronze.inContention).toBe(true);
  });

  it('below all at newAdvisors=1 (< ceil(3/2)=2)', () => {
    const m = computeManagerAwards([], IDS, {}, { newAdvisors: 1 }, DATE, 'unit_manager');
    expect(m.recruiting_bronze.eligible).toBe(false);
    expect(m.recruiting_bronze.inContention).toBe(false);
  });
});

describe('computeManagerAwards — activity awards', () => {
  const IDS = ['a1'];

  function withApps(targetAnnualAvgApps) {
    // 1 agent, 12 monthly settled docs.
    // avgAppsPerAdvisor = totalApps / agentCount = (12 * appsPerMonth) / 1 = 12 * appsPerMonth
    // So appsPerMonth = targetAnnualAvgApps / 12 to get the desired avgAppsPerAdvisor.
    const appsPerMonth = targetAnnualAvgApps / 12;
    const data = Array.from({ length: 12 }, (_, i) =>
      settled('a1', `2026-${String(i + 1).padStart(2, '0')}`, 10000, appsPerMonth)
    );
    return computeManagerAwards(data, IDS, {}, { newAdvisors: 0 }, new Date('2026-12-15'), 'unit_manager');
  }

  it('highest_activity eligible at avgApps=62 (>= 61)', () => {
    const m = withApps(62);
    expect(m.highest_activity.eligible).toBe(true);
  });

  it('activity_gold eligible at avgApps=60, highest_activity inContention', () => {
    const m = withApps(60);
    expect(m.activity_gold.eligible).toBe(true);
    expect(m.highest_activity.eligible).toBe(false);
    expect(m.highest_activity.inContention).toBe(true);
  });

  it('activity_silver eligible at avgApps=55, activity_gold inContention', () => {
    const m = withApps(55);
    expect(m.activity_silver.eligible).toBe(true);
    expect(m.activity_gold.eligible).toBe(false);
    expect(m.activity_gold.inContention).toBe(true);
  });

  it('activity_bronze inContention at avgApps=20 (== 40 * 0.5)', () => {
    const m = withApps(20);
    expect(m.activity_bronze.eligible).toBe(false);
    expect(m.activity_bronze.inContention).toBe(true);
  });
});

describe('computeManagerAwards — production and persistency awards', () => {
  const DATE = new Date('2026-12-15');
  const IDS  = ['a1'];

  function annualData(apiPerMonth, persist) {
    return Array.from({ length: 12 }, (_, i) =>
      settled('a1', `2026-${String(i + 1).padStart(2, '0')}`, apiPerMonth, 5, persist)
    );
  }

  it('production eligible: avgAPI=252000 >= 250000 and persist=91 >= 90', () => {
    const m = computeManagerAwards(annualData(21000, 91), IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.production_award.eligible).toBe(true);
    expect(m.persistency_silver.eligible).toBe(false); // 91 < 92
    expect(m.persistency_gold.eligible).toBe(false);
  });

  it('persistency_silver eligible: avgAPI=252000, persist=93 >= 92', () => {
    const m = computeManagerAwards(annualData(21000, 93), IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.persistency_silver.eligible).toBe(true);
    expect(m.persistency_gold.eligible).toBe(false); // 93 < 95
  });

  it('persistency_gold eligible: avgAPI=252000, persist=96 >= 95', () => {
    const m = computeManagerAwards(annualData(21000, 96), IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.persistency_gold.eligible).toBe(true);
  });

  it('production inContention: avgAPI=132000 in [125000, 250000)', () => {
    const m = computeManagerAwards(annualData(11000, 80), IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.production_award.eligible).toBe(false);
    expect(m.production_award.inContention).toBe(true);
  });

  it('persistency_silver inContention: avgAPI=132000 >= 125000 and persist=86 >= 85', () => {
    const m = computeManagerAwards(annualData(11000, 86), IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.persistency_silver.eligible).toBe(false);
    expect(m.persistency_silver.inContention).toBe(true);
  });

  it('persistency_gold inContention: avgAPI=132000 >= 125000 and persist=91 >= 90', () => {
    const m = computeManagerAwards(annualData(11000, 91), IDS, {}, { newAdvisors: 0 }, DATE, 'unit_manager');
    expect(m.persistency_gold.eligible).toBe(false);
    expect(m.persistency_gold.inContention).toBe(true);
  });
});

describe('computeManagerAwards — unit of year', () => {
  const DATE = new Date('2026-12-15');

  function buildUnit(agentCount, apiPerMonth, persist, newAdvisors) {
    const ids = Array.from({ length: agentCount }, (_, i) => `agent${i}`);
    const data = ids.flatMap((id) =>
      Array.from({ length: 12 }, (_, m) =>
        settled(id, `2026-${String(m + 1).padStart(2, '0')}`, apiPerMonth, 5, persist)
      )
    );
    return computeManagerAwards(data, ids, {}, { newAdvisors }, DATE, 'unit_manager');
  }

  it('eligible: 5 agents, totalAPI=2100000, avgAPI=420000, persist=91, recruits=2', () => {
    // 5 agents × 12 months × 35000/month = 2100000 total, avg=420000>=250000
    const m = buildUnit(5, 35000, 91, 2);
    expect(m.unit_of_year.eligible).toBe(true);
  });

  it('inContention: 3 agents, totalAPI=1080000 in [1M, 2M)', () => {
    // 3 agents × 12 months × 30000/month = 1080000 total >= 1M (inContention threshold)
    // agentCount=3 < 5 so never eligible regardless
    const m = buildUnit(3, 30000, 85, 1);
    expect(m.unit_of_year.eligible).toBe(false);
    expect(m.unit_of_year.inContention).toBe(true);
  });

  it('not computed for branch_manager role (agency_of_year computed instead)', () => {
    const ids = ['a1'];
    const m = computeManagerAwards([], ids, {}, { newAdvisors: 0 }, DATE, 'branch_manager');
    expect(m.unit_of_year).toBeUndefined();
    expect(m.agency_of_year).toBeDefined();
  });
});

describe('computeManagerAwards — agency of year', () => {
  const DATE = new Date('2026-12-15');

  it('eligible: 15 agents, totalAPI=5400000, avgAPI=360000, persist=91, recruits=4', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `a${i}`);
    const data = ids.flatMap((id) =>
      Array.from({ length: 12 }, (_, m) =>
        settled(id, `2026-${String(m + 1).padStart(2, '0')}`, 30000, 5, 91)
      )
    );
    const m = computeManagerAwards(data, ids, {}, { newAdvisors: 4 }, DATE, 'branch_manager');
    expect(m.agency_of_year.eligible).toBe(true);
  });

  it('inContention: totalAPI=2700000 in [2.5M, 5M)', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `a${i}`);
    const data = ids.flatMap((id) =>
      Array.from({ length: 12 }, (_, m) =>
        settled(id, `2026-${String(m + 1).padStart(2, '0')}`, 75000, 5, 91)
      )
    );
    // totalAPI = 3 * 900000 = 2700000 >= 2500000
    const m = computeManagerAwards(data, ids, {}, { newAdvisors: 0 }, DATE, 'branch_manager');
    expect(m.agency_of_year.eligible).toBe(false);
    expect(m.agency_of_year.inContention).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Golden parity — explicit expected values derived from the pre-refactor
// constants. Proves the refactored engine produces identical award outputs.
// ─────────────────────────────────────────────────────────────────────────────

describe('golden parity — computeAgentAwards', () => {
  // 12 monthly confirmed docs: 50000 API, 5 apps, persist=93 each
  // annualAPI=600000, annualApps=60, avgPersist=93
  // currentDate=2026-06-15: month=Jun, Q2(Apr-Jun)
  // monthlyAPI=50000, monthlyApps=5, monthlyPersist=93
  // quarterlyAPI=150000 (3 months × 50000), quarterlyApps=15, quarterlyPersist=93
  const GOLDEN_DATE = new Date('2026-06-15');
  const agentConfirmed = Array.from({ length: 12 }, (_, i) => ({
    periodKey: `2026-${String(i + 1).padStart(2, '0')}`,
    settledAPI: 50000,
    settledApps: 5,
    persistency: 93,
  }));

  it('silver_club eligible (600K in [550K,650K)), gold_club not eligible', () => {
    const a = computeAgentAwards(agentConfirmed, [], {}, GOLDEN_DATE);
    expect(a.silver_club.eligible).toBe(true);
    expect(a.gold_club.eligible).toBe(false);
    expect(a.gold_club.inContention).toBe(true); // 600K >= 325K && < 650K
  });

  it('mdrt eligible (600K >= 500K)', () => {
    const a = computeAgentAwards(agentConfirmed, [], {}, GOLDEN_DATE);
    expect(a.mdrt.eligible).toBe(true);
  });

  it('persistency_silver eligible (600K, 60 apps, 93% >= 92%)', () => {
    const a = computeAgentAwards(agentConfirmed, [], {}, GOLDEN_DATE);
    expect(a.persistency_silver.eligible).toBe(true);
    expect(a.persistency_gold.eligible).toBe(false); // 93 < 95
    expect(a.persistency_gold.inContention).toBe(true); // 600K >= 125K && 93 >= 90
  });

  it('agent_of_year inContention (600K >= 500K), not eligible (< 1M)', () => {
    const a = computeAgentAwards(agentConfirmed, [], {}, GOLDEN_DATE);
    expect(a.agent_of_year.eligible).toBe(false);
    expect(a.agent_of_year.inContention).toBe(true);
  });

  it('quarterly_api eligible (150K >= 125K, persist=93 >= 90)', () => {
    const a = computeAgentAwards(agentConfirmed, [], {}, GOLDEN_DATE);
    expect(a.quarterly_api.eligible).toBe(true);
  });

  it('advisor_month_api eligible (50K >= 50K, persist=93 >= 90)', () => {
    const a = computeAgentAwards(agentConfirmed, [], {}, GOLDEN_DATE);
    expect(a.advisor_month_api.eligible).toBe(true);
  });

  it('advisor_month_apps not eligible (5 < 15), not inContention (5 < 8)', () => {
    const a = computeAgentAwards(agentConfirmed, [], {}, GOLDEN_DATE);
    expect(a.advisor_month_apps.eligible).toBe(false);
    expect(a.advisor_month_apps.inContention).toBe(false);
  });
});

describe('golden parity — computeManagerAwards', () => {
  // 6 agents, 25000 API/month each, 8 apps/month, persist=93
  // totalAPI=1800000, avgAPIPerAdvisor=300000, avgAppsPerAdvisor=96, avgPersist=93
  // monthly: avgMonthlyAPI=25000 → bonusPct=1.0
  // 4 new advisors
  const DATE = new Date('2026-12-15');
  const IDS  = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
  const mgrConfirmed = IDS.flatMap((id) =>
    Array.from({ length: 12 }, (_, i) =>
      settled(id, `2026-${String(i + 1).padStart(2, '0')}`, 25000, 8, 93)
    )
  );

  it('bonusPct=1.0 (avgMonthlyAPI=25000 in [20000,30000))', () => {
    const m = computeManagerAwards(mgrConfirmed, IDS, {}, { newAdvisors: 4 }, DATE, 'unit_manager');
    expect(m.agency_monthly_bonus.bonusPct).toBe(1.0);
    expect(m.agency_monthly_bonus.nextTier).toEqual({ threshold: 30000, pct: 1.5 });
  });

  it('production eligible (avgAPI=300K, persist=93)', () => {
    const m = computeManagerAwards(mgrConfirmed, IDS, {}, { newAdvisors: 4 }, DATE, 'unit_manager');
    expect(m.production_award.eligible).toBe(true);
  });

  it('persistency_silver eligible (avgAPI=300K, persist=93 >= 92), gold not (93 < 95)', () => {
    const m = computeManagerAwards(mgrConfirmed, IDS, {}, { newAdvisors: 4 }, DATE, 'unit_manager');
    expect(m.persistency_silver.eligible).toBe(true);
    expect(m.persistency_gold.eligible).toBe(false);
  });

  it('unit_of_year inContention (totalAPI=1.8M in [1M,2M)), not eligible', () => {
    const m = computeManagerAwards(mgrConfirmed, IDS, {}, { newAdvisors: 4 }, DATE, 'unit_manager');
    expect(m.unit_of_year.eligible).toBe(false);
    expect(m.unit_of_year.inContention).toBe(true);
  });

  it('highest_activity eligible (avgApps=96 >= 61)', () => {
    const m = computeManagerAwards(mgrConfirmed, IDS, {}, { newAdvisors: 4 }, DATE, 'unit_manager');
    expect(m.highest_activity.eligible).toBe(true);
  });

  it('recruiting_bronze eligible (newAdvisors=4 in [3,4]), gold inContention (4 >= ceil(7/2)=4)', () => {
    const m = computeManagerAwards(mgrConfirmed, IDS, {}, { newAdvisors: 4 }, DATE, 'unit_manager');
    expect(m.recruiting_bronze.eligible).toBe(true);
    expect(m.recruiting_gold.eligible).toBe(false);
    expect(m.recruiting_gold.inContention).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeAtRiskStatus — 4-state classification
// ─────────────────────────────────────────────────────────────────────────────

describe('computeAtRiskStatus', () => {
  function award({ eligible = false, inContention = false, criteria = [] } = {}) {
    return { eligible, inContention: inContention ?? false, criteria };
  }
  function crit(current, target, unit = 'TTD') {
    return { current, target, met: current >= target, unit };
  }

  const ANNUAL = { weeksElapsed: 20, periodWeeks: 52 };

  it('"achieved" when eligible is true, regardless of pace', () => {
    const a = award({ eligible: true, criteria: [crit(100000, 50000)] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('achieved');
  });

  it('"on_track" when projection >= target for a single not-met criterion', () => {
    // projected = (20000/20)*52 = 52000 >= 50000
    const a = award({ criteria: [crit(20000, 50000)] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('on_track');
  });

  it('"on_track" at exact boundary: projected === target', () => {
    // target=52000; current = 52000*(20/52) = 20000 exactly
    const a = award({ criteria: [crit(20000, 52000)] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('on_track');
  });

  it('"at_risk" when projection < target and inContention is true', () => {
    // projected = (10000/20)*52 = 26000 < 50000
    const a = award({ inContention: true, criteria: [crit(10000, 50000)] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('at_risk');
  });

  it('"far_off" when projection < target and inContention is false', () => {
    // projected = (2000/20)*52 = 5200 < 50000
    const a = award({ inContention: false, criteria: [crit(2000, 50000)] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('far_off');
  });

  it('weeksElapsed === 0: no NaN/throw; routes via inContention → "at_risk"', () => {
    const a = award({ inContention: true, criteria: [crit(0, 50000)] });
    expect(computeAtRiskStatus(a, { weeksElapsed: 0, periodWeeks: 52 })).toBe('at_risk');
  });

  it('weeksElapsed === 0: no NaN/throw; routes via !inContention → "far_off"', () => {
    const a = award({ inContention: false, criteria: [crit(0, 50000)] });
    expect(computeAtRiskStatus(a, { weeksElapsed: 0, periodWeeks: 52 })).toBe('far_off');
  });

  it('multi-criterion: "on_track" only when ALL not-met criteria project to >= target', () => {
    // crit1: (20000/20)*52=52000 >= 50000 ✓  crit2: (12/20)*52=31.2 >= 30 ✓
    const a = award({ criteria: [crit(20000, 50000), crit(12, 30, 'apps')] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('on_track');
  });

  it('multi-criterion: "at_risk" when any one criterion projects below target (inContention)', () => {
    // crit1 projects OK, crit2 does not: (5/20)*52=13 < 30
    const a = award({ inContention: true, criteria: [crit(20000, 50000), crit(5, 30, 'apps')] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('at_risk');
  });

  it('already-met criteria are excluded from projection (all notMet project OK → on_track)', () => {
    // crit1 already met; crit2 not met but projects OK
    const a = award({
      criteria: [crit(60000, 50000), crit(20000, 52000)], // crit1.met=true, crit2.met=false
    });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('on_track');
  });

  it('empty criteria array (no not-met criteria) → "on_track" when weeksElapsed > 0', () => {
    const a = award({ criteria: [] });
    expect(computeAtRiskStatus(a, ANNUAL)).toBe('on_track');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPeriodCtx — correct weeksElapsed / periodWeeks for each category
// ─────────────────────────────────────────────────────────────────────────────

describe('getPeriodCtx', () => {
  // Use local-noon constructors (year, month0, day, 12) to avoid UTC-midnight
  // ISO strings shifting to the previous calendar day in UTC-4 (Trinidad local time).

  it('monthly: first day of month → weeksElapsed=0, periodWeeks≈days/7', () => {
    // Jan 1 noon local — floor((1-1)/7) = 0
    const ctx = getPeriodCtx('monthly', new Date(2026, 0, 1, 12));
    expect(ctx.weeksElapsed).toBe(0);
    // January has 31 days → periodWeeks = 31/7 ≈ 4.43
    expect(ctx.periodWeeks).toBeCloseTo(31 / 7, 5);
  });

  it('monthly: Jan 15 → weeksElapsed=2', () => {
    // floor((15-1)/7) = floor(14/7) = 2
    const ctx = getPeriodCtx('monthly', new Date(2026, 0, 15, 12));
    expect(ctx.weeksElapsed).toBe(2);
  });

  it('monthly: last day of Feb (non-leap) → weeksElapsed=3, periodWeeks=28/7=4', () => {
    // floor((28-1)/7) = floor(27/7) = 3
    const ctx = getPeriodCtx('monthly', new Date(2026, 1, 28, 12));
    expect(ctx.weeksElapsed).toBe(3);
    expect(ctx.periodWeeks).toBeCloseTo(28 / 7, 5);
  });

  it('quarterly: Q2 start (Apr 1 noon) → weeksElapsed=0', () => {
    // daysElapsed from Apr 1 midnight to Apr 1 noon = 0.5 day → floor(0.5) = 0
    const ctx = getPeriodCtx('quarterly', new Date(2026, 3, 1, 12));
    expect(ctx.weeksElapsed).toBe(0);
    expect(ctx.periodWeeks).toBe(13);
  });

  it('quarterly: mid-Q2 (May 15 noon) → weeksElapsed=6', () => {
    // Q2 starts Apr 1 midnight. daysElapsed = floor(44.5) = 44 → floor(44/7) = 6
    const ctx = getPeriodCtx('quarterly', new Date(2026, 4, 15, 12));
    expect(ctx.weeksElapsed).toBe(6);
    expect(ctx.periodWeeks).toBe(13);
  });

  it('annual: Jan 15 noon → weeksElapsed=2, periodWeeks=52', () => {
    // daysElapsed from Jan 1 midnight = floor(14.5) = 14 → floor(14/7) = 2; max(1,2) = 2
    const ctx = getPeriodCtx('annual', new Date(2026, 0, 15, 12));
    expect(ctx.weeksElapsed).toBe(2);
    expect(ctx.periodWeeks).toBe(52);
  });

  it('annual: Jan 1 noon → weeksElapsed clamped to 1 (max guard)', () => {
    // daysElapsed from Jan 1 midnight = floor(0.5) = 0 → max(1, 0) = 1
    const ctx = getPeriodCtx('annual', new Date(2026, 0, 1, 12));
    expect(ctx.weeksElapsed).toBe(1);
    expect(ctx.periodWeeks).toBe(52);
  });

  it('club category routes to annual path (weeksElapsed clamped, periodWeeks=52)', () => {
    // Jul 1 noon: daysElapsed from Jan 1 midnight = floor(181.5) = 181 → floor(181/7) = 25
    const ctx = getPeriodCtx('club', new Date(2026, 6, 1, 12));
    expect(ctx.periodWeeks).toBe(52);
    expect(ctx.weeksElapsed).toBe(25);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nextTierDistance — correct next-tier and distance
// ─────────────────────────────────────────────────────────────────────────────

describe('nextTierDistance', () => {
  // Club tiers from DEFAULT_RULESET_2026:
  // Bronze L3: 250K–350K, Bronze L2: 350K–450K, Bronze L1: 450K–550K,
  // Silver: 550K–650K, Gold: 650K+
  const TIERS = [
    { id: 'bronze_club_l3', name: 'Bronze Club — Level 3', apiMin: 250000, apiMax: 350000, apiInContention: 125000, prize: '' },
    { id: 'bronze_club_l2', name: 'Bronze Club — Level 2', apiMin: 350000, apiMax: 450000, apiInContention: 175000, prize: '' },
    { id: 'bronze_club_l1', name: 'Bronze Club — Level 1', apiMin: 450000, apiMax: 550000, apiInContention: 225000, prize: '' },
    { id: 'silver_club',    name: 'Silver Club',           apiMin: 550000, apiMax: 650000, apiInContention: 275000, prize: '' },
    { id: 'gold_club',      name: 'Gold Club',             apiMin: 650000, apiMax: null,   apiInContention: 325000, prize: '' },
  ];

  it('below all tiers (100K) → next tier is Bronze L3, distance = 150K', () => {
    const result = nextTierDistance(100000, TIERS);
    expect(result).not.toBeNull();
    expect(result.nextTier.id).toBe('bronze_club_l3');
    expect(result.distance).toBe(150000);
  });

  it('mid-ladder: 300K (in Bronze L3 band) → next tier Bronze L2, distance = 50K', () => {
    const result = nextTierDistance(300000, TIERS);
    expect(result).not.toBeNull();
    expect(result.nextTier.id).toBe('bronze_club_l2');
    expect(result.distance).toBe(50000);
  });

  it('exact boundary: 350K (Bronze L2 apiMin) → next tier Bronze L1, distance = 100K', () => {
    const result = nextTierDistance(350000, TIERS);
    expect(result).not.toBeNull();
    expect(result.nextTier.id).toBe('bronze_club_l1');
    expect(result.distance).toBe(100000);
  });

  it('one below Gold (649999) → next tier Gold, distance = 1', () => {
    const result = nextTierDistance(649999, TIERS);
    expect(result).not.toBeNull();
    expect(result.nextTier.id).toBe('gold_club');
    expect(result.distance).toBe(1);
  });

  it('at Gold apiMin (650K) → null (already at/above top tier)', () => {
    const result = nextTierDistance(650000, TIERS);
    expect(result).toBeNull();
  });

  it('above Gold (800K) → null (already past top tier)', () => {
    const result = nextTierDistance(800000, TIERS);
    expect(result).toBeNull();
  });

  it('distance floored at 0 (never negative)', () => {
    // 700K is above all tier apiMins — no next tier → null
    const result = nextTierDistance(700000, TIERS);
    expect(result).toBeNull();
  });

  it('tiers supplied unsorted → still returns correct result', () => {
    const unsorted = [...TIERS].reverse();
    const result = nextTierDistance(300000, unsorted);
    expect(result).not.toBeNull();
    expect(result.nextTier.id).toBe('bronze_club_l2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isPersistencyOnlyBlock — four key cases
// ─────────────────────────────────────────────────────────────────────────────

describe('isPersistencyOnlyBlock', () => {
  function mkAward({ dataSource, criteria }) {
    return { dataSource, criteria };
  }
  function crit(label, current, target) {
    return { label, current, target, met: current >= target };
  }

  it('confirmed + sole persistency unmet → true', () => {
    const a = mkAward({
      dataSource: 'confirmed',
      criteria: [
        crit('Annual API', 300000, 250000),   // met
        crit('Annual Apps', 50, 45),            // met
        crit('Avg Persistency', 88, 92),        // NOT met
      ],
    });
    expect(isPersistencyOnlyBlock(a)).toBe(true);
  });

  it('estimated + sole persistency unmet → false (gate waived on estimated)', () => {
    const a = mkAward({
      dataSource: 'estimated',
      criteria: [
        crit('Annual API', 300000, 250000),
        crit('Avg Persistency', 0, 92),
      ],
    });
    expect(isPersistencyOnlyBlock(a)).toBe(false);
  });

  it('confirmed + persistency met → false', () => {
    const a = mkAward({
      dataSource: 'confirmed',
      criteria: [
        crit('Annual API', 200000, 250000),    // NOT met
        crit('Avg Persistency', 94, 92),        // met
      ],
    });
    expect(isPersistencyOnlyBlock(a)).toBe(false);
  });

  it('confirmed + multiple unmet (API + persistency) → false', () => {
    const a = mkAward({
      dataSource: 'confirmed',
      criteria: [
        crit('Annual API', 200000, 250000),    // NOT met
        crit('Avg Persistency', 88, 92),        // NOT met
      ],
    });
    expect(isPersistencyOnlyBlock(a)).toBe(false);
  });

  it('confirmed + all criteria met → false (nothing is blocking)', () => {
    const a = mkAward({
      dataSource: 'confirmed',
      criteria: [
        crit('Annual API', 300000, 250000),
        crit('Avg Persistency', 95, 92),
      ],
    });
    expect(isPersistencyOnlyBlock(a)).toBe(false);
  });

  it('case-insensitive label match: "Avg Persistency" and "persistency" both match', () => {
    const a = mkAward({
      dataSource: 'confirmed',
      criteria: [crit('persistency', 85, 90)],
    });
    expect(isPersistencyOnlyBlock(a)).toBe(true);
  });
});
