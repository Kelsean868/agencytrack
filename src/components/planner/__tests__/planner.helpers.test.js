import { describe, it, expect } from 'vitest';
import {
  buildWeekDates, weekRange, sortByStartTime, groupByDate, groupByAgent,
  formatTime12, dayLabel, deriveFollowups, deriveSeedFromKept,
  PLAN_TO_DAILY_FIELD, detectConflicts, findConflictingAppointment,
  shiftDateStr, addMinutesToTime, computeDayGaps,
  readNoteThread, prospectNoteHistory, appointmentIsActive,
  findRunningLate, computeLateCascade,
  dayHeaderParts, weekRangeLabel,
} from '../planner.helpers';

describe('week/day math', () => {
  it('buildWeekDates returns Sun→Sat for the containing week', () => {
    // 2026-06-24 is a Wednesday → week Sun 21 … Sat 27.
    expect(buildWeekDates('2026-06-24')).toEqual([
      '2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24',
      '2026-06-25', '2026-06-26', '2026-06-27',
    ]);
  });
  it('weekRange returns Sunday start + Saturday end', () => {
    expect(weekRange('2026-06-24')).toEqual({ start: '2026-06-21', end: '2026-06-27' });
  });
  it('sortByStartTime orders ascending and does not mutate input', () => {
    const input = [{ startTime: '14:00' }, { startTime: '09:30' }];
    const out = sortByStartTime(input);
    expect(out.map((a) => a.startTime)).toEqual(['09:30', '14:00']);
    expect(input[0].startTime).toBe('14:00');
  });
});

describe('grouping', () => {
  it('groupByDate keys by date with time-sorted values', () => {
    const map = groupByDate([
      { id: 1, date: '2026-06-22', startTime: '15:00' },
      { id: 2, date: '2026-06-22', startTime: '08:00' },
      { id: 3, date: '2026-06-23', startTime: '10:00' },
    ]);
    expect(map.get('2026-06-22').map((a) => a.id)).toEqual([2, 1]);
    expect(map.get('2026-06-23').map((a) => a.id)).toEqual([3]);
  });
  it('groupByAgent buckets by agentId', () => {
    const map = groupByAgent([{ agentId: 'a' }, { agentId: 'b' }, { agentId: 'a' }]);
    expect(map.get('a')).toHaveLength(2);
    expect(map.get('b')).toHaveLength(1);
  });
});

describe('display helpers', () => {
  it('formatTime12 converts 24h to 12h', () => {
    expect(formatTime12('09:00')).toBe('9:00 AM');
    expect(formatTime12('14:30')).toBe('2:30 PM');
    expect(formatTime12('00:15')).toBe('12:15 AM');
    expect(formatTime12('12:00')).toBe('12:00 PM');
    expect(formatTime12('bad')).toBe('bad');
  });
  it('dayLabel renders weekday + day-of-month', () => {
    expect(dayLabel('2026-06-22')).toBe('Mon 22');
  });

  it('dayHeaderParts splits the week-column header into DOW + day number', () => {
    expect(dayHeaderParts('2026-06-22')).toEqual({ dow: 'MON', day: '22' });
    expect(dayHeaderParts('2026-07-05')).toEqual({ dow: 'SUN', day: '5' });
  });

  it('weekRangeLabel omits the repeated month within one month', () => {
    expect(weekRangeLabel('2026-07-19', '2026-07-25')).toBe('Jul 19 – 25');
  });

  it('weekRangeLabel names both months when the week spans a boundary', () => {
    expect(weekRangeLabel('2026-06-28', '2026-07-04')).toBe('Jun 28 – Jul 4');
  });

  it('weekRangeLabel returns empty string on malformed input (never throws)', () => {
    expect(weekRangeLabel('bad', '2026-07-25')).toBe('');
    expect(weekRangeLabel(undefined, undefined)).toBe('');
  });
});

describe('deriveFollowups (client-side, honest signal)', () => {
  const prospects = [
    { id: 'p1', clientName: 'Marsha Singh', intendedAppointmentDate: '2026-06-20' },
    { id: 'p2', clientName: 'Anand Maharaj', intendedAppointmentDate: '2026-06-25' },
    { id: 'p3', clientName: 'No Date' },                                   // no intended date → excluded
    { id: 'p4', clientName: 'Already Booked', intendedAppointmentDate: '2026-06-26' },
  ];
  const appts = [
    { prospectId: 'p4', status: 'scheduled' },       // p4 has an active booking → excluded
    { prospectId: 'p1', status: 'cancelled' },        // cancelled does NOT count as booked → p1 stays
  ];

  it('surfaces prospects with an intended date and no active booking, soonest-first', () => {
    const out = deriveFollowups(prospects, appts, '2026-06-24');
    expect(out.map((f) => f.id)).toEqual(['p1', 'p2']);
  });
  it('flags overdue when the intended date is before today', () => {
    const out = deriveFollowups(prospects, appts, '2026-06-24');
    expect(out.find((f) => f.id === 'p1').overdue).toBe(true);   // 06-20 < 06-24
    expect(out.find((f) => f.id === 'p2').overdue).toBe(false);  // 06-25 >= 06-24
  });
});

describe('deriveSeedFromKept (plan→handoff math)', () => {
  const appts = [
    { date: '2026-06-22', type: 'PC',  status: 'kept' },
    { date: '2026-06-22', type: 'PC',  status: 'kept' },
    { date: '2026-06-22', type: 'FFI', status: 'done' },
    { date: '2026-06-22', type: 'CI',  status: 'kept' },
    { date: '2026-06-22', type: 'SALE', status: 'kept', apiAmount: 1500 },
    { date: '2026-06-22', type: 'CI',  status: 'scheduled' },   // not kept → ignored
    { date: '2026-06-23', type: 'PC',  status: 'kept' },        // other day → ignored
    { date: '2026-06-22', type: 'FREE', status: 'kept' },       // FREE contributes nothing
  ];
  it('maps kept types to daily fields and sums SALE apps+API', () => {
    const seed = deriveSeedFromKept(appts, '2026-06-22');
    expect(seed.counts.dials).toBe(2);          // 2× PC
    expect(seed.counts.ffiConducted).toBe(1);   // 1× FFI
    expect(seed.counts.ciConducted).toBe(1);    // 1× kept CI (scheduled excluded)
    expect(seed.newBusiness).toEqual({ apps: 1, api: 1500 });
    // 6 completed on 06-22: PC,PC,FFI,CI,SALE,FREE (scheduled CI + other-day PC excluded).
    expect(seed.keptCount).toBe(6);
  });
  it('exposes the plan→daily field map', () => {
    expect(PLAN_TO_DAILY_FIELD).toMatchObject({
      PC: 'dials', SC: 'telContacts', AI: 'qualifiedApproaches',
      FFI: 'ffiConducted', CI: 'ciConducted',
    });
  });
});

describe('detectConflicts (Run 9 A3 — R7 warn-only, never blocks)', () => {
  it('flags two overlapping appointments on the same date', () => {
    const appts = [
      { id: 'a1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' },
      { id: 'a2', date: '2026-06-22', startTime: '10:30', durationMin: 30, status: 'scheduled' },
    ];
    expect(detectConflicts(appts)).toEqual(new Set(['a1', 'a2']));
  });

  it('does NOT flag touching-not-overlapping appointments (10:00-11:00 + 11:00-12:00)', () => {
    const appts = [
      { id: 'a1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' },
      { id: 'a2', date: '2026-06-22', startTime: '11:00', durationMin: 60, status: 'scheduled' },
    ];
    expect(detectConflicts(appts)).toEqual(new Set());
  });

  it('flags identical start times as a conflict', () => {
    const appts = [
      { id: 'a1', date: '2026-06-22', startTime: '09:00', durationMin: 30, status: 'scheduled' },
      { id: 'a2', date: '2026-06-22', startTime: '09:00', durationMin: 30, status: 'scheduled' },
    ];
    expect(detectConflicts(appts)).toEqual(new Set(['a1', 'a2']));
  });

  it('excludes RETIRED (cancelled/postponed) appointments from conflict detection', () => {
    const appts = [
      { id: 'a1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' },
      { id: 'a2', date: '2026-06-22', startTime: '10:30', durationMin: 30, status: 'cancelled' },
      { id: 'a3', date: '2026-06-22', startTime: '10:45', durationMin: 15, status: 'postponed' },
    ];
    // a1 no longer overlaps anything active — a2/a3 are retired and excluded entirely.
    expect(detectConflicts(appts)).toEqual(new Set());
  });

  it('FREE blocks participate in conflict detection (booking over your own blocked time warns)', () => {
    const appts = [
      { id: 'a1', date: '2026-06-22', startTime: '10:00', durationMin: 60, type: 'FREE', status: 'scheduled' },
      { id: 'a2', date: '2026-06-22', startTime: '10:15', durationMin: 30, type: 'PC', status: 'scheduled' },
    ];
    expect(detectConflicts(appts)).toEqual(new Set(['a1', 'a2']));
  });

  it('never flags appointments on different dates', () => {
    const appts = [
      { id: 'a1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' },
      { id: 'a2', date: '2026-06-23', startTime: '10:00', durationMin: 60, status: 'scheduled' },
    ];
    expect(detectConflicts(appts)).toEqual(new Set());
  });

  it('clamps cross-midnight duration at 24:00 — same-date only, no next-day spillover', () => {
    const appts = [
      // 23:30 + 90min would run to 25:00 unclamped; clamped to 24:00 (1440).
      { id: 'a1', date: '2026-06-22', startTime: '23:30', durationMin: 90, status: 'scheduled' },
      // Overlaps the clamped 23:30-24:00 window.
      { id: 'a2', date: '2026-06-22', startTime: '23:45', durationMin: 60, status: 'scheduled' },
      // A same-clock-time appointment the NEXT day must never be treated as
      // a continuation of the clamped window.
      { id: 'a3', date: '2026-06-23', startTime: '00:00', durationMin: 30, status: 'scheduled' },
    ];
    expect(detectConflicts(appts)).toEqual(new Set(['a1', 'a2']));
  });

  it('skips appointments with malformed/missing startTime or durationMin, never throws', () => {
    const appts = [
      { id: 'a1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' },
      { id: 'a2', date: '2026-06-22', startTime: null, durationMin: 30, status: 'scheduled' },
      { id: 'a3', date: '2026-06-22', startTime: '10:15', durationMin: undefined, status: 'scheduled' },
      { id: 'a4', date: '2026-06-22', startTime: 'not-a-time', durationMin: 30, status: 'scheduled' },
      { id: 'a5', date: '2026-06-22', startTime: '10:15', durationMin: 0, status: 'scheduled' },
    ];
    expect(() => detectConflicts(appts)).not.toThrow();
    expect(detectConflicts(appts)).toEqual(new Set());
  });

  it('returns an empty Set for an empty/undefined list', () => {
    expect(detectConflicts([])).toEqual(new Set());
    expect(detectConflicts()).toEqual(new Set());
  });
});

describe('findConflictingAppointment (sheet live-candidate check, Run 9 A3)', () => {
  const week = [
    { id: 'a1', date: '2026-06-22', startTime: '10:00', durationMin: 60, status: 'scheduled' },
    { id: 'a2', date: '2026-06-22', startTime: '14:00', durationMin: 30, status: 'cancelled' },
  ];

  it('finds the overlapping appointment for a candidate slot', () => {
    const candidate = { date: '2026-06-22', startTime: '10:30', durationMin: 30 };
    expect(findConflictingAppointment(candidate, week)?.id).toBe('a1');
  });

  it('returns null when the candidate does not overlap anything', () => {
    const candidate = { date: '2026-06-22', startTime: '11:00', durationMin: 30 };
    expect(findConflictingAppointment(candidate, week)).toBeNull();
  });

  it('ignores a RETIRED appointment even if the candidate overlaps its slot', () => {
    const candidate = { date: '2026-06-22', startTime: '14:00', durationMin: 30 };
    expect(findConflictingAppointment(candidate, week)).toBeNull();
  });

  it('excludes the appointment being edited via excludeId (edit-mode self-exclusion)', () => {
    const candidate = { date: '2026-06-22', startTime: '10:00', durationMin: 60 };
    // Without exclusion, a1 would "conflict with itself".
    expect(findConflictingAppointment(candidate, week, 'a1')).toBeNull();
  });

  it('returns null for a candidate with malformed/missing date, startTime, or durationMin', () => {
    expect(findConflictingAppointment({ startTime: '10:00', durationMin: 30 }, week)).toBeNull();
    expect(findConflictingAppointment({ date: '2026-06-22', startTime: 'bad', durationMin: 30 }, week)).toBeNull();
    expect(findConflictingAppointment({ date: '2026-06-22', startTime: '10:00', durationMin: null }, week)).toBeNull();
  });
});

describe('shiftDateStr (Run 9 A5 bulk move ±N days)', () => {
  it('shifts forward and backward within a month', () => {
    expect(shiftDateStr('2026-07-15', 3)).toBe('2026-07-18');
    expect(shiftDateStr('2026-07-15', -3)).toBe('2026-07-12');
  });
  it('crosses month and year boundaries correctly', () => {
    expect(shiftDateStr('2026-07-31', 1)).toBe('2026-08-01');
    expect(shiftDateStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateStr('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('handles leap-day math (2028 is a leap year)', () => {
    expect(shiftDateStr('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftDateStr('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('zero shift returns the same date', () => {
    expect(shiftDateStr('2026-07-15', 0)).toBe('2026-07-15');
  });
  it('returns malformed input unchanged (defensive)', () => {
    expect(shiftDateStr('bad-date', 3)).toBe('bad-date');
    expect(shiftDateStr('', 3)).toBe('');
    expect(shiftDateStr(null, 3)).toBeNull();
  });
});

describe('addMinutesToTime (E2 gap-slot time math)', () => {
  it('adds minutes within the day', () => {
    expect(addMinutesToTime('09:00', 60)).toBe('10:00');
    expect(addMinutesToTime('09:30', 45)).toBe('10:15');
    expect(addMinutesToTime('23:00', 30)).toBe('23:30');
  });
  it('returns null past midnight or on malformed input', () => {
    expect(addMinutesToTime('23:30', 60)).toBeNull(); // 24:30 > 23:59
    expect(addMinutesToTime('bad', 30)).toBeNull();
    expect(addMinutesToTime('', 30)).toBeNull();
  });
  it('treats a non-numeric delta as 0', () => {
    expect(addMinutesToTime('09:00', undefined)).toBe('09:00');
  });
});

describe('computeDayGaps (E2 drop slots)', () => {
  it('empty day → just the top slot', () => {
    expect(computeDayGaps([])).toEqual([{ key: 'gap-top', startTime: '08:00' }]);
  });
  it('one after-slot per card, at that card end time, in time order', () => {
    const appts = [
      { id: 'b', startTime: '13:00', durationMin: 60 },
      { id: 'a', startTime: '09:00', durationMin: 30 },
    ];
    expect(computeDayGaps(appts)).toEqual([
      { key: 'gap-top', startTime: '08:00' },
      { key: 'gap-after-a', startTime: '09:30' },
      { key: 'gap-after-b', startTime: '14:00' },
    ]);
  });
  it('a card whose end has no parseable time contributes no after-slot', () => {
    const appts = [{ id: 'x', startTime: '09:00', durationMin: 30 }, { id: 'y', startTime: 'bad', durationMin: 30 }];
    expect(computeDayGaps(appts)).toEqual([
      { key: 'gap-top', startTime: '08:00' },
      { key: 'gap-after-x', startTime: '09:30' },
    ]);
  });
});

describe('readNoteThread (E4 migrate-read)', () => {
  it('surfaces the legacy note as the first entry when no notes[] yet', () => {
    const t = readNoteThread({ note: 'legacy text', notes: [] });
    expect(t).toEqual([{ at: null, text: 'legacy text', during: false, legacy: true }]);
  });
  it('merges legacy note (first) + notes[] sorted oldest→newest', () => {
    const t = readNoteThread({
      note: 'legacy',
      notes: [
        { at: '2026-07-24T14:00:00.000Z', text: 'second', during: true },
        { at: '2026-07-24T09:00:00.000Z', text: 'first', during: false },
      ],
    });
    expect(t.map((n) => n.text)).toEqual(['legacy', 'first', 'second']);
    expect(t[0].legacy).toBe(true);
    expect(t[2].during).toBe(true);
  });
  it('does NOT duplicate the legacy note once it is also a thread entry', () => {
    const t = readNoteThread({ note: 'dup', notes: [{ at: '2026-07-24T09:00:00.000Z', text: 'dup' }] });
    expect(t).toHaveLength(1);
  });
  it('tolerates missing / malformed notes and empty text', () => {
    expect(readNoteThread({})).toEqual([]);
    expect(readNoteThread({ notes: [{ text: '  ' }, { at: 'x' }] })).toEqual([]);
  });
});

describe('prospectNoteHistory (E4 this-week surfacing)', () => {
  const appts = [
    { id: 'cur', prospectId: 'p1', notes: [{ at: '2026-07-24T09:00:00.000Z', text: 'current appt note' }] },
    { id: 'past', date: '2026-07-20', prospectId: 'p1', note: 'prior FFI note', notes: [] },
    { id: 'other', date: '2026-07-21', prospectId: 'p2', notes: [{ at: 'x', text: 'someone else' }] },
  ];
  it('returns other-appointment notes for the same prospect, excluding the current appt', () => {
    const out = prospectNoteHistory(appts, 'p1', 'cur');
    expect(out).toEqual([{ date: '2026-07-20', text: 'prior FFI note', during: false }]);
  });
  it('returns [] with no prospectId', () => {
    expect(prospectNoteHistory(appts, '', 'cur')).toEqual([]);
  });
  it('never crosses prospects', () => {
    const out = prospectNoteHistory(appts, 'p1', 'cur');
    expect(out.some((n) => n.text === 'someone else')).toBe(false);
  });
});

describe('appointmentIsActive (E4 THIS MEETING gate)', () => {
  const TODAY = '2026-07-24';
  it('true for a non-retired, non-completed appt dated today', () => {
    expect(appointmentIsActive({ date: TODAY, status: 'scheduled' }, TODAY)).toBe(true);
    expect(appointmentIsActive({ date: TODAY, status: 'confirmed' }, TODAY)).toBe(true);
  });
  it('false for other days, retired, or completed', () => {
    expect(appointmentIsActive({ date: '2026-07-23', status: 'scheduled' }, TODAY)).toBe(false);
    expect(appointmentIsActive({ date: TODAY, status: 'cancelled' }, TODAY)).toBe(false);
    expect(appointmentIsActive({ date: TODAY, status: 'kept' }, TODAY)).toBe(false);
  });
});

describe('findRunningLate (E3 overdue signal)', () => {
  const TODAY = '2026-07-24';
  const appts = [
    { id: 'a', date: TODAY, startTime: '09:00', durationMin: 60, status: 'scheduled' }, // ends 10:00
    { id: 'b', date: TODAY, startTime: '11:00', durationMin: 60, status: 'scheduled' }, // ends 12:00
    { id: 'k', date: TODAY, startTime: '08:00', durationMin: 30, status: 'kept' },       // completed → ignored
  ];
  it('returns the earliest un-churned appt whose end is before now', () => {
    // now 10:30 → a ended 10:00 (overdue), b ends 12:00 (not yet)
    expect(findRunningLate(appts, TODAY, '10:30').id).toBe('a');
  });
  it('returns null when nothing has overrun yet', () => {
    expect(findRunningLate(appts, TODAY, '09:30')).toBeNull(); // a still in progress
  });
  it('ignores completed / retired appts and other days', () => {
    expect(findRunningLate(appts, TODAY, '08:45')).toBeNull(); // only kept 'k' ended → ignored
    expect(findRunningLate(appts, '2026-07-25', '23:00')).toBeNull(); // no appts that day
  });
});

describe('computeLateCascade (E3 gap-smart)', () => {
  const TODAY = '2026-07-24';
  // late 'a' 09:00-10:00; next 'b' 10:00-10:30; then 'c' 13:00 (big gap after b)
  const appts = [
    { id: 'a', date: TODAY, startTime: '09:00', durationMin: 60, status: 'scheduled', prospectId: 'pa' },
    { id: 'b', date: TODAY, startTime: '10:00', durationMin: 30, status: 'scheduled', prospectId: 'pb' },
    { id: 'c', date: TODAY, startTime: '13:00', durationMin: 60, status: 'scheduled', prospectId: 'pc' },
  ];
  const late = appts[0];
  it("scope 'next' shifts only the next appt; recommends 'next' when the gap absorbs the push", () => {
    const r = computeLateCascade(appts, late, 20, 'next');
    expect(r.affected).toEqual([{ id: 'b', prospectId: 'pb', type: undefined, oldStartTime: '10:00', newStartTime: '10:20' }]);
    expect(r.unaffected.map((x) => x.id)).toEqual(['c']);
    // gap after b (10:30) to c (13:00) = 150m ≥ 20 → recommend 'next'
    expect(r.gapAfterNextMin).toBe(150);
    expect(r.recommendedScope).toBe('next');
  });
  it("scope 'all' cascades every later appt by the push", () => {
    const r = computeLateCascade(appts, late, 20, 'all');
    expect(r.affected.map((x) => `${x.id}:${x.newStartTime}`)).toEqual(['b:10:20', 'c:13:20']);
    expect(r.unaffected).toEqual([]);
  });
  it("recommends 'all' when the gap after next is smaller than the push", () => {
    const tight = [
      { id: 'a', date: TODAY, startTime: '09:00', durationMin: 60, status: 'scheduled' },
      { id: 'b', date: TODAY, startTime: '10:00', durationMin: 30, status: 'scheduled' }, // ends 10:30
      { id: 'c', date: TODAY, startTime: '10:40', durationMin: 30, status: 'scheduled' }, // gap 10m < 20
    ];
    expect(computeLateCascade(tight, tight[0], 20, 'next').recommendedScope).toBe('all');
  });
  it('excludes retired/completed appts and appts before the late one', () => {
    const mixed = [
      { id: 'before', date: TODAY, startTime: '08:00', durationMin: 30, status: 'scheduled' },
      { id: 'a', date: TODAY, startTime: '09:00', durationMin: 60, status: 'scheduled' },
      { id: 'gone', date: TODAY, startTime: '10:00', durationMin: 30, status: 'cancelled' },
      { id: 'b', date: TODAY, startTime: '11:00', durationMin: 30, status: 'scheduled' },
    ];
    const r = computeLateCascade(mixed, mixed[1], 10, 'all');
    expect(r.affected.map((x) => x.id)).toEqual(['b']); // before + cancelled excluded
  });
});
