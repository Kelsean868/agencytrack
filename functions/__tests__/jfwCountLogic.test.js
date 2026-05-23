'use strict';

const { computeWeekEnd, computeJfwCount, shouldWriteBack } = require('../war/jfwCountLogic');

describe('computeWeekEnd', () => {
  test('returns 7 days after weekStart', () => {
    expect(computeWeekEnd('2026-05-18')).toBe('2026-05-25');
  });

  test('handles month-end rollover', () => {
    expect(computeWeekEnd('2026-05-31')).toBe('2026-06-07');
  });

  test('handles year-end rollover', () => {
    expect(computeWeekEnd('2025-12-28')).toBe('2026-01-04');
  });

  test('uses UTC noon anchor so DST-adjacent dates stay in the right calendar day', () => {
    // 2026-03-08 is DST changeover Sunday in the US — noon anchor avoids ambiguity
    expect(computeWeekEnd('2026-03-08')).toBe('2026-03-15');
  });
});

describe('computeJfwCount', () => {
  test('counts only docs where appointmentKept === true', () => {
    const docs = [
      { data: () => ({ appointmentKept: true }) },
      { data: () => ({ appointmentKept: false }) },
      { data: () => ({ appointmentKept: true }) },
      { data: () => ({}) },
    ];
    expect(computeJfwCount(docs)).toBe(2);
  });

  test('returns 0 for an empty array', () => {
    expect(computeJfwCount([])).toBe(0);
  });

  test('ignores truthy-but-not-strictly-true values', () => {
    const docs = [
      { data: () => ({ appointmentKept: 1 }) },
      { data: () => ({ appointmentKept: 'yes' }) },
      { data: () => ({ appointmentKept: true }) },
    ];
    expect(computeJfwCount(docs)).toBe(1);
  });
});

describe('shouldWriteBack', () => {
  test('returns true when stored !== computed (write needed)', () => {
    expect(shouldWriteBack(0, 1)).toBe(true);
    expect(shouldWriteBack(3, 2)).toBe(true);
  });

  test('returns false when stored === computed — loop-guard', () => {
    expect(shouldWriteBack(2, 2)).toBe(false);
    expect(shouldWriteBack(0, 0)).toBe(false);
  });
});
