// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  mapFloorToPoints,
  elapsedWorkingDays,
  computePaceState,
  WORKING_DAYS,
} from '../DailyCaptureV2.helpers';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../utils/weeklyActivityFloors';

// ─── mapFloorToPoints ────────────────────────────────────────────────────────

describe('mapFloorToPoints — default floors → 399', () => {
  it('returns 399 for the live south defaults', () => {
    expect(mapFloorToPoints(DEFAULT_WEEKLY_ACTIVITY_FLOORS)).toBe(399);
  });

  it('returns 0 for null / undefined', () => {
    expect(mapFloorToPoints(null)).toBe(0);
    expect(mapFloorToPoints(undefined)).toBe(0);
  });
});

describe('mapFloorToPoints — per-key contributions', () => {
  it('callsMade=60 → 60 × dials(1) = 60', () => {
    expect(mapFloorToPoints({ callsMade: 60 })).toBe(60);
  });

  it('appointmentsScheduled=20 → 20 × appointmentsSet(3) = 60', () => {
    expect(mapFloorToPoints({ appointmentsScheduled: 20 })).toBe(60);
  });

  it('factFindsCompleted=10 → 10 × ffiConducted(5) = 50', () => {
    expect(mapFloorToPoints({ factFindsCompleted: 10 })).toBe(50);
  });

  it('closingInterviewsKept=10 → 10 × ciConducted(10) = 100', () => {
    expect(mapFloorToPoints({ closingInterviewsKept: 10 })).toBe(100);
  });

  it('applicationsSubmitted=1 → 1 × applicationsSold(25) = 25', () => {
    expect(mapFloorToPoints({ applicationsSubmitted: 1 })).toBe(25);
  });

  it('api=4800 → floor(4800/1000) × apiPerThousand(1) = 4', () => {
    expect(mapFloorToPoints({ api: 4800 })).toBe(4);
  });

  it('referralsNewLeads=100 → 100 × otherNewNames(1) = 100 (confirmed @1pt)', () => {
    expect(mapFloorToPoints({ referralsNewLeads: 100 })).toBe(100);
  });

  it('referralsNewLeads earns at the 1pt rate, not the 3pt referralsObtained rate', () => {
    // 100 × 1 = 100, not 300
    expect(mapFloorToPoints({ referralsNewLeads: 100 })).toBe(100);
    expect(mapFloorToPoints({ referralsNewLeads: 100 })).not.toBe(300);
  });
});

describe('mapFloorToPoints — excluded keys', () => {
  it('interviewsKept is excluded (double-count guard)', () => {
    // Without interviewsKept
    const base = mapFloorToPoints({ factFindsCompleted: 10, closingInterviewsKept: 10 });
    // Adding interviewsKept must not change the total
    const withDouble = mapFloorToPoints({ factFindsCompleted: 10, closingInterviewsKept: 10, interviewsKept: 15 });
    expect(withDouble).toBe(base);
  });

  it('telContacts is excluded (unscored)', () => {
    expect(mapFloorToPoints({ telContacts: 40 })).toBe(0);
  });

  it('clientsSold is excluded (unscored)', () => {
    expect(mapFloorToPoints({ clientsSold: 1 })).toBe(0);
  });

  it('full default floors with interviewsKept + telContacts + clientsSold still equals 399', () => {
    const allFloors = {
      ...DEFAULT_WEEKLY_ACTIVITY_FLOORS,
      interviewsKept: 15,   // already in defaults; ensure no double-count
      telContacts:    40,
      clientsSold:    1,
    };
    expect(mapFloorToPoints(allFloors)).toBe(399);
  });
});

// ─── elapsedWorkingDays ──────────────────────────────────────────────────────

describe('elapsedWorkingDays', () => {
  const WEEK = '2026-06-15'; // Sunday 2026-06-15

  it('WORKING_DAYS constant is 5', () => {
    expect(WORKING_DAYS).toBe(5);
  });

  it('Sunday (= week start) → 0', () => {
    expect(elapsedWorkingDays('2026-06-15', WEEK)).toBe(0);
  });

  it('Monday → 1', () => {
    expect(elapsedWorkingDays('2026-06-16', WEEK)).toBe(1);
  });

  it('Tuesday → 2', () => {
    expect(elapsedWorkingDays('2026-06-17', WEEK)).toBe(2);
  });

  it('Wednesday → 3', () => {
    expect(elapsedWorkingDays('2026-06-18', WEEK)).toBe(3);
  });

  it('Thursday → 4', () => {
    expect(elapsedWorkingDays('2026-06-19', WEEK)).toBe(4);
  });

  it('Friday → 5', () => {
    expect(elapsedWorkingDays('2026-06-20', WEEK)).toBe(5);
  });

  it('Saturday → 5 (Saturday is off; all 5 work days have passed)', () => {
    expect(elapsedWorkingDays('2026-06-21', WEEK)).toBe(5);
  });
});

// ─── computePaceState ────────────────────────────────────────────────────────

describe('computePaceState', () => {
  it('returns on-pace when target is 0 (defensive)', () => {
    expect(computePaceState(0, 0)).toBe('on-pace');
    expect(computePaceState(100, 0)).toBe('on-pace');
  });

  it('returns behind when weekPoints < 95% of target', () => {
    expect(computePaceState(94, 100)).toBe('behind');
    expect(computePaceState(0,  100)).toBe('behind');
  });

  it('returns on-pace at exactly 95% boundary', () => {
    expect(computePaceState(95, 100)).toBe('on-pace');
  });

  it('returns on-pace within the ±5% band', () => {
    expect(computePaceState(100, 100)).toBe('on-pace');
    expect(computePaceState(105, 100)).toBe('on-pace');
  });

  it('returns ahead when weekPoints > 105% of target', () => {
    expect(computePaceState(106, 100)).toBe('ahead');
    expect(computePaceState(200, 100)).toBe('ahead');
  });

  it('pro-rated target: end of Mon with full-week floor 399 → target ≈ 79.8', () => {
    // Mon: elapsedDays=1, target = 399 × (1/5) = 79.8
    const target = 399 * (1 / 5); // 79.8
    expect(computePaceState(0,      target)).toBe('behind');   // 0 pts
    expect(computePaceState(75,     target)).toBe('behind');   // < 95% of 79.8
    expect(computePaceState(79,     target)).toBe('on-pace');  // ≈ 99%
    expect(computePaceState(84,     target)).toBe('ahead');    // > 105%
  });

  it('end of week (all 5 days): target = weeklyPointsFloor', () => {
    const floor = 399;
    const target = floor * (5 / 5); // = 399
    expect(computePaceState(350,  target)).toBe('behind');
    expect(computePaceState(399,  target)).toBe('on-pace');
    expect(computePaceState(420,  target)).toBe('ahead');
  });
});
