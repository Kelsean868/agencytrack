import { describe, it, expect } from 'vitest';
import {
  buildWeekDates, weekRange, sortByStartTime, groupByDate, groupByAgent,
  formatTime12, dayLabel, deriveFollowups, deriveSeedFromKept,
  PLAN_TO_DAILY_FIELD,
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
