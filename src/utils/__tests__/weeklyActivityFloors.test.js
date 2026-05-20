import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WEEKLY_ACTIVITY_FLOORS,
  WEEKLY_ACTIVITY_FLOOR_ROWS,
  floorStatus,
  deriveWeeklyFloorActuals,
} from '../weeklyActivityFloors';

describe('DEFAULT_WEEKLY_ACTIVITY_FLOORS', () => {
  it('matches Tatil workshop 2026-05-19 Appendix A (10 floors)', () => {
    expect(DEFAULT_WEEKLY_ACTIVITY_FLOORS).toEqual({
      callsMade:             60,
      contactsMade:          40,
      appointmentsScheduled: 20,
      interviewsKept:        15,
      factFindsCompleted:    10,
      closingInterviewsKept: 10,
      applicationsSubmitted: 1,
      clientsSold:           1,
      api:                   4800,
      referralsNewLeads:     100,
    });
  });

  it('is frozen so seeds cannot be mutated by callers', () => {
    expect(Object.isFrozen(DEFAULT_WEEKLY_ACTIVITY_FLOORS)).toBe(true);
  });
});

describe('WEEKLY_ACTIVITY_FLOOR_ROWS', () => {
  it('has one row per default key in display order', () => {
    expect(WEEKLY_ACTIVITY_FLOOR_ROWS.map((r) => r.key))
      .toEqual(Object.keys(DEFAULT_WEEKLY_ACTIVITY_FLOORS));
  });

  it('marks only the API row as currency', () => {
    const currencyRows = WEEKLY_ACTIVITY_FLOOR_ROWS.filter((r) => r.isCurrency);
    expect(currencyRows).toHaveLength(1);
    expect(currencyRows[0].key).toBe('api');
  });

  it('surfaces the contactsMade proxy footnote', () => {
    const row = WEEKLY_ACTIVITY_FLOOR_ROWS.find((r) => r.key === 'contactsMade');
    expect(row.footnote).toMatch(/qualified approaches/i);
  });
});

describe('floorStatus', () => {
  it('returns green when actual meets or exceeds expected', () => {
    expect(floorStatus(60, 60)).toBe('green');
    expect(floorStatus(60, 75)).toBe('green');
  });

  it('returns amber when actual is between 70% and 100% of expected', () => {
    expect(floorStatus(60, 42)).toBe('amber'); // exactly 70%
    expect(floorStatus(60, 50)).toBe('amber');
    expect(floorStatus(60, 59)).toBe('amber');
  });

  it('returns red when actual is below 70% of expected', () => {
    expect(floorStatus(60, 41)).toBe('red');
    expect(floorStatus(60, 0)).toBe('red');
  });

  it('handles string inputs via parseFloat', () => {
    expect(floorStatus('60', '60')).toBe('green');
    expect(floorStatus('60', '30')).toBe('red');
  });

  it('treats expected ≤ 0 as green (defensive)', () => {
    expect(floorStatus(0, 0)).toBe('green');
    expect(floorStatus(0, 5)).toBe('green');
  });
});

describe('deriveWeeklyFloorActuals', () => {
  it('returns zeros when fields is null', () => {
    const result = deriveWeeklyFloorActuals(null);
    expect(result).toEqual({
      callsMade: 0, contactsMade: 0, appointmentsScheduled: 0,
      interviewsKept: 0, factFindsCompleted: 0, closingInterviewsKept: 0,
      applicationsSubmitted: 0, clientsSold: 0, api: 0, referralsNewLeads: 0,
    });
  });

  it('maps each row to its canonical extractFields key', () => {
    const fields = {
      totalTelAttempts: 72,
      telContacts:      45,
      appointmentsSet:  21,
      ffiConducted:     11,
      ciConducted:      9,
      applicationsSold: 2,
      livesSold:        3,
      apiSold:          5200,
      totalNewNames:    110,
    };
    const result = deriveWeeklyFloorActuals(fields);
    expect(result.callsMade).toBe(72);
    expect(result.contactsMade).toBe(45);
    expect(result.appointmentsScheduled).toBe(21);
    expect(result.interviewsKept).toBe(20); // ffi + ci
    expect(result.factFindsCompleted).toBe(11);
    expect(result.closingInterviewsKept).toBe(9);
    expect(result.applicationsSubmitted).toBe(2);
    expect(result.clientsSold).toBe(3);
    expect(result.api).toBe(5200);
    expect(result.referralsNewLeads).toBe(110);
  });

  it('coerces missing extractFields keys to 0', () => {
    const result = deriveWeeklyFloorActuals({});
    expect(result.callsMade).toBe(0);
    expect(result.interviewsKept).toBe(0);
    expect(result.api).toBe(0);
  });

  it('interviewsKept overlaps factFinds + closingInterviews by design', () => {
    const fields = { ffiConducted: 8, ciConducted: 4 };
    const result = deriveWeeklyFloorActuals(fields);
    expect(result.interviewsKept).toBe(12);
    expect(result.factFindsCompleted).toBe(8);
    expect(result.closingInterviewsKept).toBe(4);
  });
});
