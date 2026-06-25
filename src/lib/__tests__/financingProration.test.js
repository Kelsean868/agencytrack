import { describe, it, expect } from 'vitest';
import {
  tsToMonthKey,
  resolveProrationBasis,
  monthlyGross,
  computeSuggestedFinancing,
  computeAdjustmentPct,
  computeProration,
} from '../financingProration';

// Policy dates are stored at TT-midnight (04:00Z) — see dateInputs.parseDateOnlyTT.
// Fixtures use that instant so tsToMonthKey's UTC extraction matches the TT month.
const ttDate = (ymd) => new Date(`${ymd}T04:00:00Z`);
// A Firestore-Timestamp-like wrapper (has .toDate()).
const ts = (ymd) => ({ toDate: () => ttDate(ymd) });

const EFFECTIVE = '2026-01-15'; // month 1 = 2026_01

describe('tsToMonthKey', () => {
  it('extracts YYYY_MM from a Firestore Timestamp at TT-midnight', () => {
    expect(tsToMonthKey(ts('2026-02-28'))).toBe('2026_02');
  });
  it('handles a Date and an ISO string', () => {
    expect(tsToMonthKey(ttDate('2026-03-01'))).toBe('2026_03');
    expect(tsToMonthKey('2026-04-10T04:00:00Z')).toBe('2026_04');
  });
  it('returns null for missing / invalid input', () => {
    expect(tsToMonthKey(null)).toBeNull();
    expect(tsToMonthKey(undefined)).toBeNull();
    expect(tsToMonthKey({ toDate: () => new Date('nope') })).toBeNull();
  });
});

describe('resolveProrationBasis (Decision 2 / lock c)', () => {
  it('months 1–3 → submitted-final', () => {
    expect(resolveProrationBasis(EFFECTIVE, '2026_01', '2026_06')).toBe('submitted-final');
    expect(resolveProrationBasis(EFFECTIVE, '2026_02', '2026_06')).toBe('submitted-final');
    expect(resolveProrationBasis(EFFECTIVE, '2026_03', '2026_06')).toBe('submitted-final');
  });
  it('month 4+ PAST/closed → settled-confirmed', () => {
    // month 4 = 2026_04; current is 2026_06 → 04 is past → confirmed.
    expect(resolveProrationBasis(EFFECTIVE, '2026_04', '2026_06')).toBe('settled-confirmed');
    expect(resolveProrationBasis(EFFECTIVE, '2026_05', '2026_06')).toBe('settled-confirmed');
  });
  it('month 4+ CURRENT in-flight → submitted-provisional', () => {
    // month 6 = 2026_06 == current → provisional (live projection, display only).
    expect(resolveProrationBasis(EFFECTIVE, '2026_06', '2026_06')).toBe('submitted-provisional');
  });
  it('month 4+ FUTURE → submitted-provisional', () => {
    expect(resolveProrationBasis(EFFECTIVE, '2026_07', '2026_06')).toBe('submitted-provisional');
  });
  it('malformed effectiveDate falls back to submitted-final', () => {
    expect(resolveProrationBasis('not-a-date', '2026_04', '2026_06')).toBe('submitted-final');
  });
});

describe('monthlyGross (Decision 1 — reuses K3 credit filter)', () => {
  it('submitted basis: sums proposedAPI × creditWeight for dateSubmitted ∈ month', () => {
    const policies = [
      { newBusinessType: 'nb_ordinary', proposedAPI: 10000, dateSubmitted: ts('2026-02-03') },
      { newBusinessType: 'nb_ordinary', proposedAPI: 20000, dateSubmitted: ts('2026-02-20') },
      { newBusinessType: 'inc_ppp',     proposedAPI: 5000,  dateSubmitted: ts('2026-02-10') }, // ×0.10 = 500
      { newBusinessType: 'nb_ordinary', proposedAPI: 99999, dateSubmitted: ts('2026-03-01') }, // other month — excluded
    ];
    // 10000 + 20000 + 500 = 30500
    expect(monthlyGross(policies, '2026_02', 'submitted-final')).toBe(30500);
  });

  it('submitted basis: provisional reads proposedAPI the same as submitted-final', () => {
    const policies = [{ newBusinessType: 'nb_ordinary', proposedAPI: 12000, dateSubmitted: ts('2026-06-05') }];
    expect(monthlyGross(policies, '2026_06', 'submitted-provisional')).toBe(12000);
  });

  it('settled basis: counts only status===settled with dateIssued ∈ month, using settledAPI', () => {
    const policies = [
      { newBusinessType: 'nb_ordinary', status: 'settled',   settledAPI: 15000, dateIssued: ts('2026-04-12') },
      { newBusinessType: 'nb_ordinary', status: 'submitted', settledAPI: 99999, dateIssued: null },            // not settled
      { newBusinessType: 'nb_ordinary', status: 'settled',   settledAPI: 99999, dateIssued: ts('2026-05-01') },// other month
    ];
    expect(monthlyGross(policies, '2026_04', 'settled-confirmed')).toBe(15000);
  });

  it('settled basis uses RAW settledAPI, NOT managerSettledAPI (lock c)', () => {
    const policies = [
      { newBusinessType: 'nb_ordinary', status: 'settled', settledAPI: 10000, managerSettledAPI: 99999, dateIssued: ts('2026-04-12') },
    ];
    expect(monthlyGross(policies, '2026_04', 'settled-confirmed')).toBe(10000);
  });

  it('self-or-family policies contribute 0 (credit filter)', () => {
    const policies = [
      { newBusinessType: 'nb_ordinary', proposedAPI: 10000, isSelfOrFamily: true, dateSubmitted: ts('2026-02-03') },
    ];
    expect(monthlyGross(policies, '2026_02', 'submitted-final')).toBe(0);
  });

  it('empty / non-array input → 0', () => {
    expect(monthlyGross([], '2026_02', 'submitted-final')).toBe(0);
    expect(monthlyGross(null, '2026_02', 'submitted-final')).toBe(0);
  });
});

describe('computeSuggestedFinancing (Decision 3 — capped at 100%)', () => {
  it('prorates agreed by actual ÷ validating', () => {
    const { prorationRatio, suggestedFinancing } = computeSuggestedFinancing(8000, 15000, 30000);
    expect(prorationRatio).toBe(0.5);
    expect(suggestedFinancing).toBe(4000);
  });
  it('caps at 100% when actualAPI exceeds validatingAPI', () => {
    const { prorationRatio, suggestedFinancing } = computeSuggestedFinancing(8000, 40000, 30000);
    expect(prorationRatio).toBe(1);
    expect(suggestedFinancing).toBe(8000); // capped at agreed
  });
  it('non-positive validatingAPI → ratio 0 (no draw off a bad denominator)', () => {
    expect(computeSuggestedFinancing(8000, 15000, 0)).toEqual({ prorationRatio: 0, suggestedFinancing: 0 });
  });
});

describe('computeAdjustmentPct (Decision 7 / lock b — confirmed figure only)', () => {
  it('= (current − managerFinancing) ÷ current', () => {
    expect(computeAdjustmentPct(8000, 4000)).toBe(0.5);
  });
  it('returns null until managerFinancing is confirmed', () => {
    expect(computeAdjustmentPct(8000, null)).toBeNull();
    expect(computeAdjustmentPct(8000, undefined)).toBeNull();
    expect(computeAdjustmentPct(8000, '')).toBeNull();
  });
  it('returns null on a non-positive denominator', () => {
    expect(computeAdjustmentPct(0, 4000)).toBeNull();
  });
  it('can be negative when managerFinancing exceeds current', () => {
    expect(computeAdjustmentPct(8000, 9000)).toBeCloseTo(-0.125, 10);
  });
});

describe('computeProration (full readout)', () => {
  const policies = [
    { newBusinessType: 'nb_ordinary', proposedAPI: 15000, dateSubmitted: ts('2026-02-03') },
  ];

  it('resolves basis + actualAPI + suggestion; adjustmentPct null without managerFinancing', () => {
    const out = computeProration({
      policies,
      effectiveDate: EFFECTIVE,
      statementMonth: '2026_02',
      currentMonthKey: '2026_06',
      validatingAPI: 30000,
      agreedMonthlyFinancing: 8000,
      currentMonthlyFinancing: 8000,
    });
    expect(out.basisSource).toBe('submitted-final');
    expect(out.actualAPI).toBe(15000);
    expect(out.validatingAPI).toBe(30000);
    expect(out.prorationRatio).toBe(0.5);
    expect(out.suggestedFinancing).toBe(4000);
    expect(out.adjustmentPct).toBeNull();
  });

  it('computes adjustmentPct once managerFinancing is supplied', () => {
    const out = computeProration({
      policies,
      effectiveDate: EFFECTIVE,
      statementMonth: '2026_02',
      currentMonthKey: '2026_06',
      validatingAPI: 30000,
      agreedMonthlyFinancing: 8000,
      currentMonthlyFinancing: 8000,
      managerFinancing: 4000,
    });
    expect(out.adjustmentPct).toBe(0.5);
  });
});
