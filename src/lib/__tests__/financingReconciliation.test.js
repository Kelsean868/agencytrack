import { describe, it, expect } from 'vitest';
import {
  reconMonthIndex,
  sumFinancingPaid,
  sumFirstWindowFinancingPaid,
  latestRunningBalance,
  computeReconciliation,
  computeGarnishProjection,
  computeWindDownClocks,
  WAIVER_WINDOW_MONTHS,
  WAIVER_SERVICE_MONTHS,
  AGREEMENT_TERM_MONTHS,
} from '../financingReconciliation';

const EFFECTIVE = '2025-12-01'; // month 1 = 2025_12

// A 12-month ledger fixture: month 1 = 2025_12 … month 12 = 2026_11.
// financingPaid 4,000/mo (Σ = 48,000); months 1–3 waiver candidate = 12,000.
// netCommission 6,200/mo, bonusOffset 1,000/mo for the garnish projection basis.
// runningBalance is AUTHORITATIVE per row — the last row carries the closing position.
function ledger({ closingRunningBalance = 18200 } = {}) {
  const months = ['2025_12', '2026_01', '2026_02', '2026_03', '2026_04', '2026_05',
                  '2026_06', '2026_07', '2026_08', '2026_09', '2026_10', '2026_11'];
  return months.map((month, i) => ({
    month,
    financingPaid: 4000,
    netCommission: 6200,
    bonusOffset: 1000,
    // Only the final month's runningBalance matters (latestRunningBalance); set the
    // rest to a placeholder so the "latest" pick is unambiguous.
    runningBalance: i === months.length - 1 ? closingRunningBalance : 1000 * (i + 1),
  }));
}

describe('reconMonthIndex', () => {
  it('1-based month index relative to effectiveDate', () => {
    expect(reconMonthIndex(EFFECTIVE, '2025_12')).toBe(1);
    expect(reconMonthIndex(EFFECTIVE, '2026_02')).toBe(3);
    expect(reconMonthIndex(EFFECTIVE, '2026_11')).toBe(12);
  });
  it('returns null on a malformed input', () => {
    expect(reconMonthIndex(EFFECTIVE, 'nope')).toBeNull();
    expect(reconMonthIndex('bad-date', '2026_01')).toBeNull();
  });
});

describe('sumFinancingPaid', () => {
  it('sums financingPaid across all rows', () => {
    expect(sumFinancingPaid(ledger())).toBe(48000);
  });
  it('tolerates non-arrays and string numerics', () => {
    expect(sumFinancingPaid(null)).toBe(0);
    expect(sumFinancingPaid([{ financingPaid: '500' }, { financingPaid: undefined }])).toBe(500);
  });
});

describe('sumFirstWindowFinancingPaid (months 1–3 waiver candidate)', () => {
  it('sums only months 1–3 relative to effectiveDate', () => {
    expect(sumFirstWindowFinancingPaid(ledger(), EFFECTIVE)).toBe(12000);
    expect(WAIVER_WINDOW_MONTHS).toBe(3);
  });
  it('skips rows with a malformed month', () => {
    const rows = [{ month: 'x', financingPaid: 9999 }, { month: '2025_12', financingPaid: 4000 }];
    expect(sumFirstWindowFinancingPaid(rows, EFFECTIVE)).toBe(4000);
  });
});

describe('latestRunningBalance (Decision 3 — authoritative)', () => {
  it('returns the chronologically latest month runningBalance', () => {
    expect(latestRunningBalance(ledger({ closingRunningBalance: 18200 }))).toBe(18200);
  });
  it('handles a negative (surplus) closing balance', () => {
    expect(latestRunningBalance(ledger({ closingRunningBalance: -3100 }))).toBe(-3100);
  });
  it('returns 0 when no row carries a numeric runningBalance', () => {
    expect(latestRunningBalance([{ month: '2026_01' }])).toBe(0);
    expect(latestRunningBalance([])).toBe(0);
  });
});

describe('computeReconciliation', () => {
  it('service-met month-12 → waiver applied, owing (worked example)', () => {
    // closingBalance 18,200; waiver 12,000 (service-met) → 6,200 owing.
    const r = computeReconciliation({
      rows: ledger({ closingRunningBalance: 18200 }),
      effectiveDate: EFFECTIVE,
      serviceMonths: 12,
      triggeredBy: 'auto_month12',
    });
    expect(r.totalFinancingDrawn).toBe(48000);
    expect(r.closingBalance).toBe(18200);
    expect(r.serviceMet).toBe(true);
    expect(r.waiverApplied).toBe(12000);
    expect(r.reconciledPosition).toBe(6200);
    expect(r.outcome).toBe('owing');
    expect(r.surplusPaid).toBe(0);
    expect(r.garnishStarted).toBe(true);
    expect(r.nextStatus).toBe('post_financing_repayment');
    // totalOffsets derived so the worksheet reconciles: drawn − offsets = closingBalance.
    expect(r.totalOffsets).toBe(48000 - 18200);
    expect(r.totalFinancingDrawn - r.totalOffsets).toBe(r.closingBalance);
  });

  it('early-election (< 12 mo) → waiver REVERSED, owing larger', () => {
    const r = computeReconciliation({
      rows: ledger({ closingRunningBalance: 18200 }),
      effectiveDate: EFFECTIVE,
      serviceMonths: 7,
      triggeredBy: 'manual_election',
    });
    expect(r.serviceMet).toBe(false);
    expect(r.waiverApplied).toBe(0);
    expect(r.reconciledPosition).toBe(18200); // no waiver relief
    expect(r.outcome).toBe('owing');
    expect(r.triggeredBy).toBe('manual_election');
  });

  it('waiver SWINGS the outcome — surplus when applied, owing on early exit', () => {
    // closingBalance 8,000; waiver candidate 12,000.
    const serviceMet = computeReconciliation({
      rows: ledger({ closingRunningBalance: 8000 }),
      effectiveDate: EFFECTIVE,
      serviceMonths: 12,
      triggeredBy: 'auto_month12',
    });
    // 8,000 − 12,000 = −4,000 → surplus, paid out.
    expect(serviceMet.reconciledPosition).toBe(-4000);
    expect(serviceMet.outcome).toBe('surplus');
    expect(serviceMet.surplusPaid).toBe(4000);
    expect(serviceMet.garnishStarted).toBe(false);
    expect(serviceMet.nextStatus).toBe('cleared');

    const earlyExit = computeReconciliation({
      rows: ledger({ closingRunningBalance: 8000 }),
      effectiveDate: EFFECTIVE,
      serviceMonths: 9,
      triggeredBy: 'manual_election',
    });
    // 8,000 − 0 = 8,000 → owing (the waiver swung it).
    expect(earlyExit.reconciledPosition).toBe(8000);
    expect(earlyExit.outcome).toBe('owing');
    expect(earlyExit.surplusPaid).toBe(0);
  });

  it('negative closing balance → surplus paid (worked example)', () => {
    const r = computeReconciliation({
      rows: ledger({ closingRunningBalance: -3100 }),
      effectiveDate: EFFECTIVE,
      serviceMonths: 12,
      triggeredBy: 'auto_month12',
    });
    // −3,100 − 12,000 = −15,100 → surplus.
    expect(r.reconciledPosition).toBe(-15100);
    expect(r.outcome).toBe('surplus');
    expect(r.surplusPaid).toBe(15100);
    expect(r.nextStatus).toBe('cleared');
  });

  it('exactly zero closing position → surplus(0) → cleared, no payment', () => {
    // Choose closingBalance == waiver so reconciledPosition == 0 (mockup "Even" state).
    const r = computeReconciliation({
      rows: ledger({ closingRunningBalance: 12000 }),
      effectiveDate: EFFECTIVE,
      serviceMonths: 12,
      triggeredBy: 'auto_month12',
    });
    expect(r.reconciledPosition).toBe(0);
    expect(r.outcome).toBe('surplus');
    expect(r.surplusPaid).toBe(0);
    expect(r.garnishStarted).toBe(false);
    expect(r.nextStatus).toBe('cleared');
  });

  it('honours an explicit closingBalance override', () => {
    const r = computeReconciliation({
      rows: ledger({ closingRunningBalance: 18200 }),
      effectiveDate: EFFECTIVE,
      serviceMonths: 12,
      triggeredBy: 'auto_month12',
      closingBalance: 5000,
    });
    expect(r.closingBalance).toBe(5000);
    expect(r.reconciledPosition).toBe(5000 - 12000);
    expect(r.outcome).toBe('surplus');
  });

  it('defaults triggeredBy to auto_month12 on a bad value', () => {
    const r = computeReconciliation({ rows: [], effectiveDate: EFFECTIVE, serviceMonths: 12, triggeredBy: 'bogus' });
    expect(r.triggeredBy).toBe('auto_month12');
  });

  it('service threshold boundary — exactly 12 months meets', () => {
    expect(WAIVER_SERVICE_MONTHS).toBe(12);
    const at12 = computeReconciliation({ rows: ledger(), effectiveDate: EFFECTIVE, serviceMonths: 12, triggeredBy: 'auto_month12' });
    const at11 = computeReconciliation({ rows: ledger(), effectiveDate: EFFECTIVE, serviceMonths: 11, triggeredBy: 'manual_election' });
    expect(at12.serviceMet).toBe(true);
    expect(at11.serviceMet).toBe(false);
  });
});

describe('computeGarnishProjection (Decision 6 — display only)', () => {
  it('averages 10% × netCommission + bonusOffset over the basis months', () => {
    // Each month: 0.10 × 6,200 + 1,000 = 1,620. 12 months → avg 1,620.
    const proj = computeGarnishProjection({ rows: ledger(), reconciledPosition: 6200 });
    expect(proj.basisMonths).toBe(12);
    expect(proj.commissionComponent).toBeCloseTo(620, 6);
    expect(proj.bonusComponent).toBeCloseTo(1000, 6);
    expect(proj.monthlyGarnish).toBeCloseTo(1620, 6);
    // 6,200 / 1,620 = 3.83 → ceil 4 months to clear.
    expect(proj.monthsToCleared).toBe(4);
  });

  it('respects a configurable garnishCommissionRate', () => {
    const proj = computeGarnishProjection(
      { rows: ledger(), reconciledPosition: 6200 },
      { garnishCommissionRate: 0.20 },
    );
    // 0.20 × 6,200 + 1,000 = 2,240.
    expect(proj.commissionComponent).toBeCloseTo(1240, 6);
    expect(proj.monthlyGarnish).toBeCloseTo(2240, 6);
  });

  it('returns null monthsToCleared when there is no garnish basis', () => {
    const proj = computeGarnishProjection({ rows: [], reconciledPosition: 6200 });
    expect(proj.basisMonths).toBe(0);
    expect(proj.monthlyGarnish).toBe(0);
    expect(proj.monthsToCleared).toBeNull();
  });

  it('returns null monthsToCleared for a non-owing position', () => {
    const proj = computeGarnishProjection({ rows: ledger(), reconciledPosition: -1000 });
    expect(proj.monthsToCleared).toBeNull();
  });
});

describe('computeWindDownClocks (Decision 7 — display only)', () => {
  it('derives the 24-month term, service, and 6× ceiling', () => {
    const c = computeWindDownClocks({ serviceMonths: 7, currentMonthlyFinancing: 8000 });
    expect(c.agreementTermMonths).toBe(AGREEMENT_TERM_MONTHS);
    expect(c.agreementTermMonths).toBe(24);
    expect(c.serviceMonths).toBe(7);
    expect(c.termMonthsRemaining).toBe(17);
    expect(c.serviceMet).toBe(false);
    expect(c.waiverServiceMonths).toBe(12);
    expect(c.waiverWindowMonths).toBe(3);
    expect(c.ceiling).toBe(48000); // 6 × 8,000
  });

  it('clamps termMonthsRemaining at 0 past the term', () => {
    const c = computeWindDownClocks({ serviceMonths: 30, currentMonthlyFinancing: 8000 });
    expect(c.termMonthsRemaining).toBe(0);
    expect(c.serviceMet).toBe(true);
  });

  it('null ceiling when currentMonthlyFinancing is missing', () => {
    const c = computeWindDownClocks({ serviceMonths: 12 });
    expect(c.ceiling).toBeNull();
  });
});
