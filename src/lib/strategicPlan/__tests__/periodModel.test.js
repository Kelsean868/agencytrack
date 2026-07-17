import { describe, it, expect } from 'vitest';
import {
  defaultPeriod, yearWindow, periodWindows, ymdInWindow, sumProductionWindow,
  prorateQuota, periodElapsedFraction, monthsElapsedInYear,
} from '../periodModel';

describe('periodModel — window keying', () => {
  it('defaults to current-year quarter granularity', () => {
    const p = defaultPeriod(new Date('2026-05-01T00:00:00Z'));
    expect(p).toEqual({ year: 2026, granularity: 'quarter' });
  });

  it('yearWindow spans the full calendar year', () => {
    expect(yearWindow(2026)).toMatchObject({ startYMD: '2026-01-01', endYMD: '2026-12-31', months: 12 });
  });

  it('quarter granularity yields Q1–Q4', () => {
    const w = periodWindows({ year: 2026, granularity: 'quarter' });
    expect(w.map((x) => x.key)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(w[2]).toMatchObject({ startYMD: '2026-07-01', endYMD: '2026-09-30', months: 3 });
  });

  it('half granularity yields H1/H2', () => {
    const w = periodWindows({ year: 2026, granularity: 'half' });
    expect(w.map((x) => x.key)).toEqual(['H1', 'H2']);
    expect(w[1]).toMatchObject({ startYMD: '2026-07-01', endYMD: '2026-12-31', months: 6 });
  });

  it('ymdInWindow is an inclusive string comparison', () => {
    const q1 = periodWindows({ year: 2026, granularity: 'quarter' })[0];
    expect(ymdInWindow('2026-01-01', q1)).toBe(true);
    expect(ymdInWindow('2026-03-31', q1)).toBe(true);
    expect(ymdInWindow('2026-04-01', q1)).toBe(false);
    expect(ymdInWindow(undefined, q1)).toBe(false);
  });
});

describe('periodModel — sumProductionWindow (RULING 1)', () => {
  const v1 = {
    status: 'submitted', weekStarting: '2026-02-01', apiSold: 1000, applicationsSold: 2,
    telContacts: 5, ffiConducted: 3, ciConducted: 1,
    referralCalls: 1, coldCalls: 1, followUpCalls: 1, seminarTradeshowCalls: 1,
  };
  // V2 doc carrying PPP + lumpsum credit: extractTotalProductionCredit = 1000+200+50,
  // while extractFields.apiSold would be only newBusiness.api (1000). Proves the
  // window sums via the credit accessor, NOT apiSold.
  const v2 = {
    status: 'submitted', weekStarting: '2026-02-08', version: 2,
    newBusiness: { api: 1000, apps: 1 },
    pppIncreases: { apiIncrease: 200 },
    lumpsums: { apiCredit: 50 },
  };

  it('sums API via extractTotalProductionCredit (includes PPP + lumpsum)', () => {
    const q1 = periodWindows({ year: 2026, granularity: 'quarter' })[0];
    const r = sumProductionWindow([v1, v2], q1);
    expect(r.api).toBe(2250); // 1000 + (1000+200+50)
    expect(r.apps).toBe(3);   // 2 + 1
    expect(r.contacts).toBe(5);
    expect(r.factFinds).toBe(3);
    expect(r.closingInterviews).toBe(1);
    expect(r.calls).toBe(4);  // totalTelAttempts = 1+1+1+1
    expect(r.count).toBe(2);
  });

  it('returns a TRUE empty state for an empty window — no substitution', () => {
    const q3 = periodWindows({ year: 2026, granularity: 'quarter' })[2];
    const r = sumProductionWindow([v1, v2], q3); // both are in Q1, none in Q3
    expect(r).toEqual({ api: 0, apps: 0, calls: 0, contacts: 0, factFinds: 0, closingInterviews: 0, count: 0 });
  });

  it('ignores non-submitted docs', () => {
    const q1 = periodWindows({ year: 2026, granularity: 'quarter' })[0];
    const draft = { ...v1, status: 'draft' };
    expect(sumProductionWindow([draft], q1).count).toBe(0);
  });
});

describe('periodModel — proration + projection', () => {
  it('prorateQuota scales by month span', () => {
    expect(prorateQuota(1200000, 3)).toBe(300000);
    expect(prorateQuota(1200000, 12)).toBe(1200000);
    expect(prorateQuota(null, 3)).toBe(0);
  });

  it('periodElapsedFraction clamps to [0,1]; past year → 1', () => {
    const fy = yearWindow(2025);
    expect(periodElapsedFraction(fy, new Date('2026-06-01T00:00:00Z'))).toBe(1);
    const fy2026 = yearWindow(2026);
    expect(periodElapsedFraction(fy2026, new Date('2025-06-01T00:00:00Z'))).toBe(0);
    const mid = periodElapsedFraction(fy2026, new Date('2026-07-02T12:00:00Z'));
    expect(mid).toBeGreaterThan(0.45);
    expect(mid).toBeLessThan(0.55);
  });

  it('monthsElapsedInYear: current year → month-of-year, past → 12, future → 0', () => {
    expect(monthsElapsedInYear(2026, new Date('2026-04-15T00:00:00Z'))).toBe(4);
    expect(monthsElapsedInYear(2025, new Date('2026-04-15T00:00:00Z'))).toBe(12);
    expect(monthsElapsedInYear(2027, new Date('2026-04-15T00:00:00Z'))).toBe(0);
  });
});
