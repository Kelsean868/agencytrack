/**
 * Wizard v2 PR2 — compute lib unit tests.
 *
 * Includes the canonical-API parity test (proves decision D: the panel's
 * totalProductionAPI equals the CF's `extractTotalProductionCredit` for
 * identical inputs).
 */
import { describe, it, expect } from 'vitest';
import {
  totalProductionAPI,
  totalApps,
  ciConv,
  totalCalls,
  refFupCold,
  totalNames,
  estCommission,
  deriveLastWeek,
  buildApiSparkline,
} from '../wizardLive.computations.js';
import {
  computeTotalProductionCredit,
  computeLumpsumCredit,
} from '../weeklyReport.computations.js';
import { LMPS_CREDIT_RATE, LMPS_COMMISSION_RATE } from '../wizardLive.config.js';
import { computeTotalNewNames } from '../../../utils/extractFields.js';

// ─── totalProductionAPI + canonical-API parity ──────────────────────────────

describe('totalProductionAPI — canonical-formula reuse (decision D)', () => {
  it('returns 0 for empty / undefined formData', () => {
    expect(totalProductionAPI(undefined)).toBe(0);
    expect(totalProductionAPI({})).toBe(0);
    expect(totalProductionAPI({ newBusiness: {}, pppIncreases: {}, lumpsums: {} })).toBe(0);
  });

  it('sums NB.api + PPP.apiIncrease + (grossAmount * LMPS_CREDIT_RATE)', () => {
    const formData = {
      newBusiness:  { api: 18400 },
      pppIncreases: { apiIncrease: 6000 },
      lumpsums:     { grossAmount: 60000 },
    };
    // 18400 + 6000 + 60000 * 0.10 = 18400 + 6000 + 6000 = 30400
    expect(totalProductionAPI(formData)).toBe(30400);
  });

  it('CANONICAL-API PARITY — panel total == CF / sanitize canonical total', () => {
    // Same input shape; panel derives apiCredit live via canonical helper,
    // sanitize() persists apiCredit on the submission doc. Both flows yield
    // the same total via computeTotalProductionCredit.
    const formData = {
      newBusiness:  { api: 12345 },
      pppIncreases: { apiIncrease: 8000 },
      lumpsums:     { grossAmount: 50000 },
    };
    const panelTotal = totalProductionAPI(formData);

    // Simulate the persisted shape after sanitize() / CF read.
    const persistedShape = {
      newBusiness:  { api: 12345 },
      pppIncreases: { apiIncrease: 8000 },
      lumpsums:     { apiCredit: computeLumpsumCredit(50000) },
    };
    const cfTotal = computeTotalProductionCredit(persistedShape);

    expect(panelTotal).toBe(cfTotal);
    expect(panelTotal).toBeCloseTo(12345 + 8000 + 50000 * LMPS_CREDIT_RATE, 6);
  });

  it('CANONICAL-API PARITY — fuzz across 10 random inputs', () => {
    // Seeded deterministic "fuzz" — keeps test reproducible while exercising
    // wider input space than a single example.
    const cases = [
      { nb: 0,     ppp: 0,     gross: 0     },
      { nb: 100,   ppp: 0,     gross: 0     },
      { nb: 0,     ppp: 2400,  gross: 0     },
      { nb: 0,     ppp: 0,     gross: 10000 },
      { nb: 5000,  ppp: 3000,  gross: 8000  },
      { nb: 25000, ppp: 12500, gross: 90000 },
      { nb: 9999,  ppp: 7777,  gross: 33333 },
      { nb: 0.5,   ppp: 0.5,   gross: 0.5   },
      { nb: 1e6,   ppp: 1e6,   gross: 1e6   },
      { nb: 123.45,ppp: 67.89, gross: 999.99},
    ];
    for (const { nb, ppp, gross } of cases) {
      const formData = {
        newBusiness:  { api: nb },
        pppIncreases: { apiIncrease: ppp },
        lumpsums:     { grossAmount: gross },
      };
      const persistedShape = {
        newBusiness:  { api: nb },
        pppIncreases: { apiIncrease: ppp },
        lumpsums:     { apiCredit: computeLumpsumCredit(gross) },
      };
      expect(totalProductionAPI(formData)).toBe(
        computeTotalProductionCredit(persistedShape),
      );
    }
  });
});

// ─── totalApps ──────────────────────────────────────────────────────────────

describe('totalApps', () => {
  it('returns NB.apps + PPP.apps', () => {
    expect(totalApps({ newBusiness: { apps: 2 }, pppIncreases: { apps: 1 } })).toBe(3);
  });
  it('defaults missing fields to 0', () => {
    expect(totalApps({})).toBe(0);
    expect(totalApps(null)).toBe(0);
    expect(totalApps({ newBusiness: { apps: 5 } })).toBe(5);
  });
});

// ─── ciConv — decision C ────────────────────────────────────────────────────

describe('ciConv — decision C, NB.apps / ciConducted', () => {
  it('returns 0 when ciConducted is 0 (guard)', () => {
    expect(ciConv({ newBusiness: { apps: 5 }, ciConducted: 0 })).toBe(0);
    expect(ciConv({ newBusiness: { apps: 5 } })).toBe(0);
  });

  it('returns the rounded percentage of NB.apps / ciConducted', () => {
    expect(ciConv({ newBusiness: { apps: 2 }, ciConducted: 4 })).toBe(50);
    expect(ciConv({ newBusiness: { apps: 3 }, ciConducted: 4 })).toBe(75);
    expect(ciConv({ newBusiness: { apps: 1 }, ciConducted: 3 })).toBe(33);
  });

  it('returns 100% when all CIs closed', () => {
    expect(ciConv({ newBusiness: { apps: 4 }, ciConducted: 4 })).toBe(100);
  });

  it('does NOT include PPP apps (canonical "CI → App" matches NB.apps only)', () => {
    // If PPP were included, this would be (3+2)/4 = 125%. Decision C =
    // canonical, so PPP excluded → 3/4 = 75%.
    expect(
      ciConv({
        newBusiness: { apps: 3 },
        pppIncreases: { apps: 2 },
        ciConducted: 4,
      }),
    ).toBe(75);
  });
});

// ─── totalCalls + refFupCold ────────────────────────────────────────────────

describe('totalCalls + refFupCold', () => {
  it('totalCalls sums all 5 telephone fields', () => {
    expect(totalCalls({
      referralCalls: 5, followUpCalls: 3, coldCalls: 7,
      seminarTradeshowCalls: 2, serviceCalls: 4,
    })).toBe(21);
  });

  it('refFupCold sums 3 of 5 (excludes seminar/tradeshow and service)', () => {
    expect(refFupCold({
      referralCalls: 5, followUpCalls: 3, coldCalls: 7,
      seminarTradeshowCalls: 2, serviceCalls: 4,
    })).toBe(15);
  });

  it('both default missing fields to 0', () => {
    expect(totalCalls({})).toBe(0);
    expect(refFupCold(null)).toBe(0);
  });
});

// ─── totalNames — canonical reuse ───────────────────────────────────────────

describe('totalNames — canonical totalNewNames reuse (option A, decision)', () => {
  it('delegates to computeTotalNewNames (single source of truth)', () => {
    const formData = {
      namesFromColdCanvass: 5,
      referralsObtained: 3,
      namesFromSeminarsConducted: 1,
      namesFromSeminarsAttended: 2,
      namesFromTradeshowsConducted: 0,
      namesFromTradeshowsAttended: 1,
      namesFromOther: 2,
    };
    expect(totalNames(formData)).toBe(computeTotalNewNames(formData));
    expect(totalNames(formData)).toBe(14); // sum of the 7
  });

  it('INTENTIONALLY EXCLUDES namesFromSocial — pending FU decision', () => {
    // Tests the decision lock (option A from the dispatcher) — wizard NAMES
    // stays in lockstep with the canonical 7-field formula across kiosk /
    // master sheet / awards floors / CF until the social-inclusion FU lands.
    const base = {
      namesFromColdCanvass: 3,
      referralsObtained: 0,
      namesFromSeminarsConducted: 0,
      namesFromSeminarsAttended: 0,
      namesFromTradeshowsConducted: 0,
      namesFromTradeshowsAttended: 0,
      namesFromOther: 0,
    };
    expect(totalNames({ ...base, namesFromSocial: 99 })).toBe(3);
  });
});

// ─── estCommission ──────────────────────────────────────────────────────────

describe('estCommission — NB.api × rate% + lumpsumGross × LMPS_COMMISSION_RATE', () => {
  it('returns 0 for empty / undefined inputs', () => {
    expect(estCommission(undefined, 0)).toBe(0);
    expect(estCommission({}, 35)).toBe(0);
    expect(estCommission({ newBusiness: { api: 10000 } }, 0)).toBe(0);
  });

  it('combines NB commission (at agent rate) + LMPS commission (fixed 0.5%)', () => {
    const formData = {
      newBusiness: { api: 10000 },
      lumpsums: { grossAmount: 20000 },
    };
    // 10000 × 0.35 + 20000 × 0.005 = 3500 + 100 = 3600
    expect(estCommission(formData, 35)).toBe(3600);
  });

  it('PPP does not contribute (zero commission per Tatil rules)', () => {
    const formData = {
      newBusiness: { api: 10000 },
      pppIncreases: { apiIncrease: 9999 }, // would be huge if included
    };
    expect(estCommission(formData, 35)).toBe(3500);
  });

  it('uses LMPS_COMMISSION_RATE from the config module', () => {
    expect(estCommission({ lumpsums: { grossAmount: 100000 } }, 0))
      .toBe(100000 * LMPS_COMMISSION_RATE);
  });
});

// ─── deriveLastWeek — symmetry with live computations ───────────────────────

describe('deriveLastWeek — same compute lib as live, decision C direction preserved', () => {
  it('returns null when input is null', () => {
    expect(deriveLastWeek(null)).toBeNull();
    expect(deriveLastWeek(undefined)).toBeNull();
  });

  it('derives the 5 fields via the same pure-function compute lib', () => {
    const persisted = {
      newBusiness:  { apps: 2, api: 18400 },
      pppIncreases: { apps: 1, apiIncrease: 6000 },
      lumpsums:     { grossAmount: 60000 },
      ciConducted: 4,
      referralCalls: 5, followUpCalls: 3, coldCalls: 7,
      seminarTradeshowCalls: 2, serviceCalls: 4,
      namesFromColdCanvass: 3, referralsObtained: 2,
      namesFromSeminarsConducted: 1, namesFromSeminarsAttended: 0,
      namesFromTradeshowsConducted: 0, namesFromTradeshowsAttended: 0,
      namesFromOther: 0,
    };
    const lw = deriveLastWeek(persisted);
    expect(lw.api).toBe(totalProductionAPI(persisted));
    expect(lw.apps).toBe(totalApps(persisted));
    expect(lw.ciConv).toBe(ciConv(persisted));
    expect(lw.calls).toBe(totalCalls(persisted));
    expect(lw.names).toBe(totalNames(persisted));
    // ciConv direction matches: NB.apps (2) / ciConducted (4) = 50%
    expect(lw.ciConv).toBe(50);
  });
});

// ─── buildApiSparkline ──────────────────────────────────────────────────────

describe('buildApiSparkline — newest-first input → 6-bar oldest→newest output', () => {
  it('returns 6 zeros when input is empty', () => {
    expect(buildApiSparkline([])).toEqual([0, 0, 0, 0, 0, 0]);
    expect(buildApiSparkline(null)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('left-pads when fewer than 6 submissions, oldest-first', () => {
    // 2 submissions newest-first → 4 zeros padded, then oldest, then newest
    const result = buildApiSparkline([
      { newBusiness: { api: 200 } }, // newest
      { newBusiness: { api: 100 } }, // older
    ]);
    expect(result).toEqual([0, 0, 0, 0, 100, 200]);
  });

  it('preserves oldest→newest order for 6 submissions', () => {
    const recent = [600, 500, 400, 300, 200, 100].map((api) => ({
      newBusiness: { api },
    }));
    expect(buildApiSparkline(recent)).toEqual([100, 200, 300, 400, 500, 600]);
  });

  it('truncates input to 6 (slice 0..5)', () => {
    const recent = Array.from({ length: 12 }, (_, i) => ({
      newBusiness: { api: (i + 1) * 1000 },
    }));
    // First 6 newest are 1000, 2000, 3000, 4000, 5000, 6000 → oldest-first
    // gives [6000, 5000, 4000, 3000, 2000, 1000].
    expect(buildApiSparkline(recent)).toEqual([6000, 5000, 4000, 3000, 2000, 1000]);
  });
});
