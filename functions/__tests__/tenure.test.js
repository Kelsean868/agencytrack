'use strict';

const { wholeYearsSince } = require('../utils/tenure');

// Epoch ms for a UTC instant (hour defaults to noon so the -4h T&T shift stays same-day).
const utc = (y, mo, d, h = 12) => Date.UTC(y, mo - 1, d, h, 0, 0);

describe('wholeYearsSince', () => {
  test('anniversary already passed this year → full year count', () => {
    expect(wholeYearsSince('2018-03-01', utc(2026, 7, 5))).toBe(8);
  });

  test('day before the anniversary → one fewer year', () => {
    expect(wholeYearsSince('2020-07-06', utc(2025, 7, 5))).toBe(4);
  });

  test('exactly on the anniversary → inclusive (counts)', () => {
    expect(wholeYearsSince('2020-07-05', utc(2025, 7, 5))).toBe(5);
  });

  test('UTC-4 boundary does not shift the calendar day forward', () => {
    // 2026-01-01T02:00Z is 2025-12-31 22:00 in T&T. Contract 2020-01-01 → 5 whole
    // years in T&T local time; a naive UTC read would wrongly report 6.
    expect(wholeYearsSince('2020-01-01', utc(2026, 1, 1, 2))).toBe(5);
  });

  test('empty string → 0 (safe default: no tenure credit)', () => {
    expect(wholeYearsSince('', utc(2026, 7, 5))).toBe(0);
  });

  test('undefined → 0', () => {
    expect(wholeYearsSince(undefined, utc(2026, 7, 5))).toBe(0);
  });

  test('malformed date → 0', () => {
    expect(wholeYearsSince('not-a-date', utc(2026, 7, 5))).toBe(0);
  });

  test('shape-valid but non-real calendar dates → 0', () => {
    expect(wholeYearsSince('2020-02-31', utc(2026, 7, 5))).toBe(0); // Feb 31 doesn't exist
    expect(wholeYearsSince('2020-99-99', utc(2026, 7, 5))).toBe(0); // month/day out of range
    expect(wholeYearsSince('2021-02-29', utc(2026, 7, 5))).toBe(0); // 2021 is not a leap year
    expect(wholeYearsSince('2020-02-29', utc(2026, 7, 5))).toBe(6); // 2020 IS a leap year — valid
  });

  test('future contract date → 0 (clamped, never negative)', () => {
    expect(wholeYearsSince('2030-01-01', utc(2026, 7, 5))).toBe(0);
  });

  test('ignores a time suffix on the date string', () => {
    expect(wholeYearsSince('2019-05-10T00:00:00Z', utc(2026, 7, 5))).toBe(7);
  });
});
