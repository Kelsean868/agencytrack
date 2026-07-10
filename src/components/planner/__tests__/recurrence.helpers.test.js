import { describe, it, expect } from 'vitest';
import {
  expandSeriesDates, cadenceLabel, seriesRowLabel,
  buildSeriesPreview, nextOccurrenceDate, MAX_SERIES_INSTANCES,
} from '../recurrence.helpers';

describe('expandSeriesDates', () => {
  it('returns just the start date for a non-repeating rule', () => {
    expect(expandSeriesDates({ startDate: '2026-07-14', repeatRule: 'none' })).toEqual(['2026-07-14']);
    expect(expandSeriesDates({ startDate: '2026-07-14' })).toEqual(['2026-07-14']);
  });

  it('weekly by count expands to N same-weekday dates 7 days apart', () => {
    const out = expandSeriesDates({
      startDate: '2026-07-14', repeatRule: 'weekly', endCondition: { type: 'count', count: 4 },
    });
    expect(out).toEqual(['2026-07-14', '2026-07-21', '2026-07-28', '2026-08-04']);
  });

  it('daily by count expands to N consecutive days', () => {
    const out = expandSeriesDates({
      startDate: '2026-07-14', repeatRule: 'daily', endCondition: { type: 'count', count: 3 },
    });
    expect(out).toEqual(['2026-07-14', '2026-07-15', '2026-07-16']);
  });

  it('weekly by on-date includes occurrences through the end date (inclusive) and stops after', () => {
    const out = expandSeriesDates({
      startDate: '2026-07-14', repeatRule: 'weekly', endCondition: { type: 'date', onDate: '2026-08-04' },
    });
    expect(out).toEqual(['2026-07-14', '2026-07-21', '2026-07-28', '2026-08-04']);
    // A day before the 4th occurrence excludes it.
    const out2 = expandSeriesDates({
      startDate: '2026-07-14', repeatRule: 'weekly', endCondition: { type: 'date', onDate: '2026-08-03' },
    });
    expect(out2).toEqual(['2026-07-14', '2026-07-21', '2026-07-28']);
  });

  it('custom days expands only the selected weekdays (2026-07-14 is a Tuesday)', () => {
    // Tue & Thu, 3 occurrences: Tue 14, Thu 16, Tue 21.
    const out = expandSeriesDates({
      startDate: '2026-07-14', repeatRule: 'custom', daysOfWeek: ['TUE', 'THU'],
      endCondition: { type: 'count', count: 3 },
    });
    expect(out).toEqual(['2026-07-14', '2026-07-16', '2026-07-21']);
  });

  it('custom with no days selected falls back to the start weekday (behaves weekly)', () => {
    const out = expandSeriesDates({
      startDate: '2026-07-14', repeatRule: 'custom', daysOfWeek: [],
      endCondition: { type: 'count', count: 2 },
    });
    expect(out).toEqual(['2026-07-14', '2026-07-21']);
  });

  it('hard-caps at MAX_SERIES_INSTANCES even when the count asks for more', () => {
    const out = expandSeriesDates({
      startDate: '2026-01-01', repeatRule: 'daily', endCondition: { type: 'count', count: 999 },
    });
    expect(out).toHaveLength(MAX_SERIES_INSTANCES);
  });

  it('returns [] for a missing start date', () => {
    expect(expandSeriesDates({ repeatRule: 'weekly', endCondition: { type: 'count', count: 4 } })).toEqual([]);
  });
});

describe('cadenceLabel', () => {
  it('labels each cadence', () => {
    expect(cadenceLabel({ repeatRule: 'daily' })).toBe('every day');
    expect(cadenceLabel({ repeatRule: 'weekly', startDate: '2026-07-14' })).toBe('every Tue');
    expect(cadenceLabel({ repeatRule: 'custom', daysOfWeek: ['THU', 'TUE'], startDate: '2026-07-14' }))
      .toBe('Tue & Thu'); // DOW-ordered (Sun-first), not selection order
  });
});

describe('seriesRowLabel', () => {
  it('capitalizes the cadence and appends position', () => {
    expect(seriesRowLabel({ repeatRule: 'weekly', startDate: '2026-07-14', seriesPos: 4, seriesTotal: 12 }))
      .toBe('Every Tue · 4 of 12');
  });
  it('omits position when unknown', () => {
    expect(seriesRowLabel({ repeatRule: 'daily' })).toBe('Every day');
  });
});

describe('buildSeriesPreview', () => {
  it('builds the count-variant preview string', () => {
    const s = buildSeriesPreview({
      startDate: '2026-07-14', startTime: '17:00', repeatRule: 'weekly',
      endCondition: { type: 'count', count: 4 },
    });
    expect(s).toBe('Books 4 appointments · every Tue, 5:00 PM · through Aug 4');
  });

  it('builds the on-date-variant preview string with custom days', () => {
    const s = buildSeriesPreview({
      startDate: '2026-07-14', startTime: '17:00', repeatRule: 'custom', daysOfWeek: ['TUE', 'THU'],
      endCondition: { type: 'date', onDate: '2026-07-30' },
    });
    expect(s).toMatch(/^Books \d+ appointments · Tue & Thu, 5:00 PM · until Jul 30$/);
  });

  it('returns empty string for a non-repeating rule', () => {
    expect(buildSeriesPreview({ startDate: '2026-07-14', startTime: '09:00', repeatRule: 'none' })).toBe('');
  });

  it('uses singular "appointment" for a single-occurrence series', () => {
    const s = buildSeriesPreview({
      startDate: '2026-07-14', startTime: '09:00', repeatRule: 'weekly',
      endCondition: { type: 'count', count: 1 },
    });
    expect(s).toMatch(/^Books 1 appointment · /);
  });
});

describe('nextOccurrenceDate', () => {
  it('advances weekly / daily / custom past the given date', () => {
    expect(nextOccurrenceDate({ date: '2026-07-14', repeatRule: 'weekly' })).toBe('2026-07-21');
    expect(nextOccurrenceDate({ date: '2026-07-14', repeatRule: 'daily' })).toBe('2026-07-15');
    expect(nextOccurrenceDate({ date: '2026-07-14', repeatRule: 'custom', daysOfWeek: ['TUE', 'THU'] }))
      .toBe('2026-07-16');
  });
});
