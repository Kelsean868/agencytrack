// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  mapFloorToPoints,
  elapsedWorkingDays,
  deriveWeekStripDays,
  computePaceState,
  computeWeekToDatePoints,
} from '../DailyCaptureV2.helpers';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../utils/weeklyActivityFloors';

// ─── helpers for building minimal daily docs ─────────────────────────────────

// 2 FFIs + 1 app = 2×5 + 25 = 35 pts
const makeDoc35 = (date) => ({ date, ffiConducted: 2, newBusiness: { apps: 1 } });
// 5 FFIs + 1 app = 5×5 + 25 = 50 pts
const makeDoc50 = (date) => ({ date, ffiConducted: 5, newBusiness: { apps: 1 } });
// 1 app only = 25 pts
const makeDoc25 = (date) => ({ date, newBusiness: { apps: 1 } });

const TODAY = '2026-06-19';
const OTHER = '2026-06-18';

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

describe('elapsedWorkingDays — wd=5 (default)', () => {
  const WEEK = '2026-06-15'; // Sunday 2026-06-15

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

  it('Saturday → 5 (Saturday is off at wd=5; all 5 work days have passed)', () => {
    expect(elapsedWorkingDays('2026-06-21', WEEK)).toBe(5);
  });
});

describe('elapsedWorkingDays — wd=6 (Mon–Sat)', () => {
  const WEEK = '2026-06-15'; // Sunday 2026-06-15

  it('Sunday → 0', () => {
    expect(elapsedWorkingDays('2026-06-15', WEEK, 6)).toBe(0);
  });

  it('Friday → 5', () => {
    expect(elapsedWorkingDays('2026-06-20', WEEK, 6)).toBe(5);
  });

  it('Saturday → 6 (Saturday is a working day at wd=6)', () => {
    expect(elapsedWorkingDays('2026-06-21', WEEK, 6)).toBe(6);
  });
});

describe('elapsedWorkingDays — invalid wd falls back to 5', () => {
  const WEEK = '2026-06-15';

  it('wd=undefined → same as wd=5', () => {
    expect(elapsedWorkingDays('2026-06-21', WEEK, undefined)).toBe(5);
  });

  it('wd=7 (out of model) → treated as 5', () => {
    expect(elapsedWorkingDays('2026-06-21', WEEK, 7)).toBe(5);
  });

  it('wd=NaN → treated as 5', () => {
    expect(elapsedWorkingDays('2026-06-21', WEEK, NaN)).toBe(5);
  });

  it('wd=0 → treated as 5 (never divide-by-zero)', () => {
    // elapsedWorkingDays with invalid wd falls back to 5; pace denominator gets a real number
    expect(elapsedWorkingDays('2026-06-21', WEEK, 0)).toBe(5);
  });
});

describe('deriveWeekStripDays — Sunday opening cell', () => {
  const WEEK  = '2026-06-14'; // Sunday June 14
  const TODAY = '2026-06-15'; // Monday — strip is visible Mon-onward

  it('returns 7 cells (Sun–Sat)', () => {
    expect(deriveWeekStripDays([], TODAY, WEEK)).toHaveLength(7);
  });

  it('first cell is the opening Sunday: date === weekStarting, label === "S"', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK);
    expect(days[0].date).toBe(WEEK);
    expect(days[0].label).toBe('S');
  });

  it('Sunday cell isOff=true regardless of wd', () => {
    expect(deriveWeekStripDays([], TODAY, WEEK, 5)[0].isOff).toBe(true);
    expect(deriveWeekStripDays([], TODAY, WEEK, 6)[0].isOff).toBe(true);
  });

  it('Sunday cell isPast=true and isFuture=false when today is Mon-onward', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK);
    expect(days[0].isPast).toBe(true);
    expect(days[0].isFuture).toBe(false);
  });

  it('Sunday cell isLogged=true when a doc with weekStarting date exists', () => {
    const sundayDoc = { date: WEEK };
    const days = deriveWeekStripDays([sundayDoc], TODAY, WEEK);
    expect(days[0].isLogged).toBe(true);
  });

  it('Mon (index 1) is still Monday, not Sunday', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK);
    expect(days[1].date).toBe('2026-06-15'); // June 14 + 1 = June 15 (Mon)
    expect(days[1].label).toBe('M');
  });
});

describe('deriveWeekStripDays — Saturday isOff per wd', () => {
  // June 14, 2026 is Sunday. June 15 = Mon anchor.
  const WEEK    = '2026-06-14'; // Sunday
  const TODAY   = '2026-06-15'; // Monday (safe non-Sunday anchor)
  const SAT_IDX = 6;             // i=6 → Sat = weekStart+6 = June 20

  it('wd=5 → Saturday cell isOff=true', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK, 5);
    expect(days[SAT_IDX].date).toBe('2026-06-20'); // Saturday June 20
    expect(days[SAT_IDX].isOff).toBe(true);
  });

  it('wd=6 → Saturday cell isOff=false', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK, 6);
    expect(days[SAT_IDX].date).toBe('2026-06-20');
    expect(days[SAT_IDX].isOff).toBe(false);
  });

  it('Mon–Fri cells are never isOff regardless of wd', () => {
    [5, 6].forEach((wd) => {
      const days = deriveWeekStripDays([], TODAY, WEEK, wd);
      days.slice(1, 6).forEach((d) => expect(d.isOff).toBe(false)); // indices 1-5 = Mon-Fri
    });
  });

  it('invalid wd falls back to 5 (Saturday isOff=true)', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK, 99);
    expect(days[SAT_IDX].isOff).toBe(true);
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

// ─── computeWeekToDatePoints ─────────────────────────────────────────────────

describe('computeWeekToDatePoints — Gemini-#1 live-edit cases', () => {
  it('no saved doc for selectedDate → otherDays + liveDayData', () => {
    // other day has 25 pts; today not in weekDocs; live data yields 35 pts
    const weekDocs = [makeDoc25(OTHER)];
    expect(computeWeekToDatePoints(weekDocs, TODAY, makeDoc35(TODAY))).toBe(60);
  });

  it('selectedDate doc EXISTS (35 pts) and live is UNCHANGED (35 pts) → 35, not 70', () => {
    // savedDoc for TODAY is excluded; live 35 replaces it — total = 35, no double-count
    const weekDocs = [makeDoc35(TODAY)];
    expect(computeWeekToDatePoints(weekDocs, TODAY, makeDoc35(TODAY))).toBe(35);
  });

  it('selectedDate doc EXISTS (35 pts) and live is EDITED to 50 pts → 50, not 35', () => {
    // live data takes precedence over the saved doc for the selected date
    const weekDocs = [makeDoc35(TODAY)];
    expect(computeWeekToDatePoints(weekDocs, TODAY, makeDoc50(TODAY))).toBe(50);
  });

  it('multiple other days + selectedDate doc + live edit', () => {
    // other days: 25 + 35 = 60 pts; saved today 35 excluded; live today 50 pts → 110
    const weekDocs = [makeDoc25(OTHER), makeDoc35('2026-06-17'), makeDoc35(TODAY)];
    expect(computeWeekToDatePoints(weekDocs, TODAY, makeDoc50(TODAY))).toBe(110);
  });

  it('empty weekDocs + live data', () => {
    expect(computeWeekToDatePoints([], TODAY, makeDoc25(TODAY))).toBe(25);
  });

  it('null weekDocs treated as empty', () => {
    expect(computeWeekToDatePoints(null, TODAY, makeDoc25(TODAY))).toBe(25);
  });

  it('null liveDayData contributes 0', () => {
    const weekDocs = [makeDoc25(OTHER)];
    expect(computeWeekToDatePoints(weekDocs, TODAY, null)).toBe(25);
  });
});
