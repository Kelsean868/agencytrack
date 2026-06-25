/**
 * Tests for the PR-U1 yearPlan 3-line migration's PURE transforms
 * (functions/scripts/migrate-yearplan-3line.cjs). Requiring the script loads
 * firebase-admin but does NOT initialize it (main() is guarded by
 * require.main === module), so these run admin-free under Jest.
 *
 * Asserts the §4 award-safety contract: Arm A is total-preserving + award-
 * neutral; Arm B mirrors the live allocationToYearPlan adapter; both idempotent.
 */
const {
  foldYearPlanLinesTo3Key,
  allocationToYearPlanLines,
  sumEnabledTargetAPI,
} = require('../scripts/migrate-yearplan-3line.cjs');

const line = (targetAPI, extra = {}) => ({
  targetAPI, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true, ...extra,
});

describe('ARM A — foldYearPlanLinesTo3Key', () => {
  test('folds property+motor into general; drops property/motor; carries life/ah', () => {
    const lines = {
      life: line(600000), ah: line(300000), property: line(180000), motor: line(120000),
    };
    const { lines: out, changed } = foldYearPlanLinesTo3Key(lines);
    expect(changed).toBe(true);
    expect(Object.keys(out)).toEqual(['life', 'ah', 'general']);
    expect(out.general.targetAPI).toBe(300000); // 180000 + 120000
    expect(out.life.targetAPI).toBe(600000);    // life untouched (award-driving line)
    expect(out.ah.targetAPI).toBe(300000);
    expect(out).not.toHaveProperty('property');
    expect(out).not.toHaveProperty('motor');
  });

  test('TOTAL-PRESERVING — Σ enabled targetAPI identical before/after', () => {
    const lines = {
      life: line(600000), ah: line(300000), property: line(180000), motor: line(120000),
    };
    const before = sumEnabledTargetAPI(lines);
    const { lines: out } = foldYearPlanLinesTo3Key(lines);
    expect(sumEnabledTargetAPI(out)).toBe(before);
    expect(before).toBe(1200000);
  });

  test('TOTAL-PRESERVING with a DISABLED source line — disabled motor adds nothing', () => {
    const lines = {
      life: line(600000), ah: line(300000),
      property: line(180000, { enabled: true }),
      motor: line(120000, { enabled: false }), // disabled → excluded from total
    };
    const before = sumEnabledTargetAPI(lines); // 600000+300000+180000 = 1080000
    const { lines: out } = foldYearPlanLinesTo3Key(lines);
    expect(before).toBe(1080000);
    expect(out.general.targetAPI).toBe(180000); // only the enabled property contributes
    expect(out.general.enabled).toBe(true);     // enabled because property was
    expect(sumEnabledTargetAPI(out)).toBe(before);
  });

  test('both general sources disabled → general disabled, contributes 0 (still preserving)', () => {
    const lines = {
      life: line(600000), ah: line(300000),
      property: line(180000, { enabled: false }),
      motor: line(120000, { enabled: false }),
    };
    const before = sumEnabledTargetAPI(lines); // 900000
    const { lines: out } = foldYearPlanLinesTo3Key(lines);
    expect(out.general.enabled).toBe(false);
    expect(out.general.targetAPI).toBe(0);
    expect(sumEnabledTargetAPI(out)).toBe(before);
  });

  test('AWARD-NEUTRAL — the Life line (award-driving) is byte-identical through the fold', () => {
    const lines = { life: line(555555), ah: line(1), property: line(2), motor: line(3) };
    const { lines: out } = foldYearPlanLinesTo3Key(lines);
    expect(out.life.targetAPI).toBe(555555);
  });

  test('IDEMPOTENT — an already-3-key doc is unchanged (changed=false)', () => {
    const lines = { life: line(600000), ah: line(300000), general: line(300000) };
    const { lines: out, changed } = foldYearPlanLinesTo3Key(lines);
    expect(changed).toBe(false);
    expect(out).toBe(lines); // returned as-is
  });

  test('additive shape — folded lines carry rate + products (≤4, life/general only)', () => {
    const lines = { life: line(100000), ah: line(40000), property: line(10000), motor: line(10000) };
    const { lines: out } = foldYearPlanLinesTo3Key(lines);
    expect(out.life).toHaveProperty('rate');
    expect(out.life).toHaveProperty('products');
    expect(out.ah.products).toEqual([]); // A&H never a product line
    expect(out.general.products).toEqual([]);
  });
});

describe('ARM B — allocationToYearPlanLines (mirrors the live adapter)', () => {
  const composite = {
    licenseClass: 'composite',
    lines: {
      life: { commission: 35000, rate: 0.35 },   // api 100000
      ah: { commission: 10000, rate: 0.25 },      // api 40000
      general: { commission: 20000, rate: 0.10 }, // api 200000
    },
  };

  test('maps commission → targetAPI (commission ÷ rate); general carried', () => {
    const out = allocationToYearPlanLines(composite);
    expect(Object.keys(out)).toEqual(['life', 'ah', 'general']);
    expect(out.life.targetAPI).toBeCloseTo(100000);
    expect(out.ah.targetAPI).toBeCloseTo(40000);
    expect(out.general.targetAPI).toBeCloseTo(200000);
    expect(out.life.derivedCommission).toBe(35000);
  });

  test('round-trip — Σ enabled targetAPI === 340000 (general 200k present)', () => {
    const out = allocationToYearPlanLines(composite);
    expect(sumEnabledTargetAPI(out)).toBeCloseTo(340000);
  });

  test('license gating — life_only disables general (enabled:false, targetAPI:0)', () => {
    const out = allocationToYearPlanLines({ ...composite, licenseClass: 'life_only' });
    expect(out.general.enabled).toBe(false);
    expect(out.general.targetAPI).toBe(0);
    expect(sumEnabledTargetAPI(out)).toBeCloseTo(140000); // life + ah only
  });

  test('drilled line — products carried as {name, api, rate}; targetAPI = Σ productAPI', () => {
    const drilled = {
      licenseClass: 'composite',
      lines: {
        life: {
          commission: 0, rate: 0.35, drilled: true,
          products: [
            { name: 'Whole Life', commission: 21000, rate: 0.35 }, // api 60000
            { name: 'Term', commission: 8000, rate: 0.20 },        // api 40000
          ],
        },
        ah: { commission: 0, rate: 0.25 },
        general: { commission: 0, rate: 0.10 },
      },
    };
    const out = allocationToYearPlanLines(drilled);
    expect(out.life.targetAPI).toBeCloseTo(100000);
    expect(out.life.products).toHaveLength(2);
    expect(out.life.products[0].name).toBe('Whole Life');
    expect(out.life.products[0].api).toBeCloseTo(60000);
  });

  test('empty allocation → zeroed 3-key lines, no throw', () => {
    const out = allocationToYearPlanLines({});
    expect(Object.keys(out)).toEqual(['life', 'ah', 'general']);
    expect(LINE_KEYS_ZEROED(out)).toBe(true);
  });
});

function LINE_KEYS_ZEROED(out) {
  return ['life', 'ah', 'general'].every((k) => out[k].targetAPI === 0);
}
