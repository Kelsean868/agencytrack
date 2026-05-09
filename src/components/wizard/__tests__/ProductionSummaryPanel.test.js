import { describe, it, expect } from 'vitest';
import {
  computeTotalProductionCredit,
  computeTotalCommission,
  computeLumpsumCredit,
  computeLumpsumCommission,
} from '../../../lib/schema/weeklyReport.computations';

// These tests verify the production summary panel computation logic in isolation.
// The panel itself derives values from the same computation helpers, so testing
// the helpers with the panel's input → output expectations validates the panel.

function panelCalc(data, commissionRate) {
  const nb   = data.newBusiness  ?? {};
  const ppp  = data.pppIncreases ?? {};
  const lmps = data.lumpsums     ?? {};
  const nbApi      = parseFloat(nb.api) || 0;
  const pppInc     = parseFloat(ppp.apiIncrease) || 0;
  const lmpsGross  = parseFloat(lmps.grossAmount) || 0;
  const lmpsCredit = computeLumpsumCredit(lmpsGross);
  const lmpsComm   = computeLumpsumCommission(lmpsGross);
  const productionShape = {
    newBusiness:  { api: nbApi },
    pppIncreases: { apiIncrease: pppInc },
    lumpsums:     { apiCredit: lmpsCredit, commission: lmpsComm },
  };
  const rateDecimal = (parseFloat(commissionRate) || 0) / 100;
  return {
    totalCredit: computeTotalProductionCredit(productionShape),
    totalComm:   computeTotalCommission(productionShape, rateDecimal),
    lmpsCredit,
    lmpsComm,
    nbApi,
  };
}

describe('ProductionSummaryPanel — computation logic', () => {
  it('all three sources → total = NB + PPP + LMPS.apiCredit', () => {
    const data = {
      newBusiness:  { apps: 3, api: 25000 },
      pppIncreases: { apps: 1, apiIncrease: 4800 },
      lumpsums:     { grossAmount: 25000 },
    };
    const { totalCredit, lmpsCredit } = panelCalc(data, 35);
    expect(lmpsCredit).toBe(2500);
    expect(totalCredit).toBe(25000 + 4800 + 2500);
  });

  it('NB only → total = NB.api, PPP row absent', () => {
    const data = {
      newBusiness:  { apps: 2, api: 20000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0 },
    };
    const { totalCredit } = panelCalc(data, 35);
    expect(totalCredit).toBe(20000);
  });

  it('NB + LMPS, no PPP → total = NB + LMPS.apiCredit', () => {
    const data = {
      newBusiness:  { apps: 2, api: 20000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 50000 },
    };
    const { totalCredit, lmpsCredit } = panelCalc(data, 35);
    expect(lmpsCredit).toBe(5000);
    expect(totalCredit).toBe(25000);
  });

  it('commission rate as percentage (35 not 0.35) — NB commission correct', () => {
    const data = {
      newBusiness:  { apps: 2, api: 20000 },
      pppIncreases: { apps: 0, apiIncrease: 0 },
      lumpsums:     { grossAmount: 0 },
    };
    const { totalComm } = panelCalc(data, 35);
    expect(totalComm).toBeCloseTo(7000);
  });

  it('PPP excluded from commission — only NB + LMPS commission counted', () => {
    const data = {
      newBusiness:  { apps: 2, api: 20000 },
      pppIncreases: { apps: 1, apiIncrease: 5000 },
      lumpsums:     { grossAmount: 25000 },
    };
    const { totalComm, lmpsComm } = panelCalc(data, 35);
    const expectedNbComm   = 20000 * 0.35;
    const expectedLmpsComm = computeLumpsumCommission(25000);
    expect(lmpsComm).toBeCloseTo(expectedLmpsComm);
    expect(totalComm).toBeCloseTo(expectedNbComm + expectedLmpsComm);
  });

  it('zero commissionRate → totalComm = 0', () => {
    const data = { newBusiness: { apps: 2, api: 20000 }, pppIncreases: {}, lumpsums: {} };
    expect(panelCalc(data, 0).totalComm).toBe(0);
  });
});
