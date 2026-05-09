import { describe, it, expect } from 'vitest';
import { computeAgentAwards } from '../awardsEngine';

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
