import { describe, it, expect } from 'vitest';
import {
  filingDeadline,
  isOnTime,
  classifyWeek,
  onTimeStreak,
} from '../complianceDerive';

// weekStart is the covered week's Sunday. Deadline = following Sun 23:59:59 AST
// = (weekStart + 8d) 03:59:59 UTC. For weekStart '2026-11-22' (a Sunday), the
// covered week is Sun 11-22 … Sat 11-28; deadline = Sun 11-29 23:59:59 AST
// = 2026-11-30T03:59:59Z.
const WEEK = '2026-11-22';
const DEADLINE_UTC = '2026-11-30T03:59:59.000Z';
const sub = (submittedAt, status = 'submitted') => ({ status, submittedAt });

describe('filingDeadline', () => {
  it('is the following Sunday 23:59:59 AST (weekStart + 8d - 1s, UTC)', () => {
    expect(filingDeadline(WEEK).toISOString()).toBe(DEADLINE_UTC);
  });

  it('throws on a missing / malformed weekStart', () => {
    expect(() => filingDeadline(undefined)).toThrow();
    expect(() => filingDeadline('not-a-date')).toThrow();
  });
});

describe('isOnTime — deadline boundary', () => {
  it('on-time exactly at Sunday 23:59:59 AST (the deadline instant)', () => {
    expect(isOnTime(sub(new Date(DEADLINE_UTC)), WEEK)).toBe(true);
  });

  it('late one second later — Monday 00:00:00 AST', () => {
    // 2026-11-30T04:00:00Z === Mon 2026-11-30 00:00:00 AST
    expect(isOnTime(sub(new Date('2026-11-30T04:00:00.000Z')), WEEK)).toBe(false);
  });

  it('on-time well before (filed Saturday evening AST)', () => {
    // Sat 2026-11-28 18:00 AST === 2026-11-28T22:00:00Z
    expect(isOnTime(sub(new Date('2026-11-28T22:00:00.000Z')), WEEK)).toBe(true);
  });

  it('false when submission or weekStart is absent', () => {
    expect(isOnTime(null, WEEK)).toBe(false);
    expect(isOnTime(sub(new Date(DEADLINE_UTC)), undefined)).toBe(false);
  });

  it('false (never throws) when a submitted doc has no usable timestamp', () => {
    expect(isOnTime(sub(undefined), WEEK)).toBe(false);
    expect(isOnTime(sub('garbage'), WEEK)).toBe(false);
  });

  it('accepts Firestore Timestamp (.toDate), {seconds}, millis, and ISO string', () => {
    const onDate = new Date(DEADLINE_UTC);
    expect(isOnTime(sub({ toDate: () => onDate }), WEEK)).toBe(true);
    expect(isOnTime(sub({ seconds: Math.floor(onDate.getTime() / 1000), nanoseconds: 0 }), WEEK)).toBe(true);
    expect(isOnTime(sub(onDate.getTime()), WEEK)).toBe(true);
    expect(isOnTime(sub(DEADLINE_UTC), WEEK)).toBe(true);
  });
});

describe('classifyWeek', () => {
  it("'on-time' for a submitted doc within the deadline", () => {
    expect(classifyWeek(sub(new Date(DEADLINE_UTC)), WEEK)).toBe('on-time');
  });

  it("'late' for a submitted doc after the deadline", () => {
    expect(classifyWeek(sub(new Date('2026-11-30T04:00:00.000Z')), WEEK)).toBe('late');
  });

  it("'late' for a submitted doc with no usable timestamp (conservative)", () => {
    expect(classifyWeek(sub(undefined), WEEK)).toBe('late');
  });

  it("'not-in' for a draft, regardless of submittedAt", () => {
    expect(classifyWeek(sub(new Date(DEADLINE_UTC), 'draft'), WEEK)).toBe('not-in');
  });

  it("'not-in' for a missing submission", () => {
    expect(classifyWeek(null, WEEK)).toBe('not-in');
    expect(classifyWeek(undefined, WEEK)).toBe('not-in');
  });
});

describe('onTimeStreak', () => {
  const onTime = (ws) => ({ weekStart: ws, submission: sub(new Date(`${ws}T00:00:00.000Z`)) });
  // a deliberately-late entry: submitted Monday 00:00 AST for that week
  const late = (ws) => ({ weekStart: ws, submission: sub(new Date('2099-01-01T00:00:00.000Z')) });
  const notIn = (ws) => ({ weekStart: ws, submission: null });

  // 8 most-recent-first Sundays ending at WEEK.
  const weeks = ['2026-11-22', '2026-11-15', '2026-11-08', '2026-11-01',
                 '2026-10-25', '2026-10-18', '2026-10-11', '2026-10-04'];

  it('counts consecutive on-time weeks from the most recent', () => {
    expect(onTimeStreak(weeks.map(onTime))).toBe(8);
  });

  it('breaks at the first late week', () => {
    const arr = [onTime(weeks[0]), onTime(weeks[1]), late(weeks[2]), onTime(weeks[3])];
    expect(onTimeStreak(arr)).toBe(2);
  });

  it('breaks at the first not-in (missing) week', () => {
    const arr = [onTime(weeks[0]), notIn(weeks[1]), onTime(weeks[2])];
    expect(onTimeStreak(arr)).toBe(1);
  });

  it('returns 0 when the most recent week is not on-time', () => {
    expect(onTimeStreak([late(weeks[0]), onTime(weeks[1])])).toBe(0);
    expect(onTimeStreak([notIn(weeks[0]), onTime(weeks[1])])).toBe(0);
  });

  it('caps at the window size (default 8)', () => {
    const ten = ['2026-11-22', '2026-11-15', '2026-11-08', '2026-11-01', '2026-10-25',
                 '2026-10-18', '2026-10-11', '2026-10-04', '2026-09-27', '2026-09-20'];
    expect(onTimeStreak(ten.map(onTime))).toBe(8);
    expect(onTimeStreak(ten.map(onTime), 10)).toBe(10);
  });

  it('honours a custom window smaller than the data', () => {
    expect(onTimeStreak(weeks.map(onTime), 3)).toBe(3);
  });

  it('returns 0 for empty / non-array input', () => {
    expect(onTimeStreak([])).toBe(0);
    expect(onTimeStreak(null)).toBe(0);
    expect(onTimeStreak(undefined)).toBe(0);
  });
});
