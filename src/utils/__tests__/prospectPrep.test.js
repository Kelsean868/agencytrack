import { describe, it, expect } from 'vitest';
import {
  OBJECTION_TAXONOMY,
  matchObjection,
  computeCountdown,
  deriveReadiness,
  pickNextCall,
  formatDMY,
  todayISO,
  prospectInitials,
} from '../prospectPrep';

const TODAY = '2026-07-09';

describe('computeCountdown — boundaries', () => {
  it('TODAY at inDays 0 (imminent)', () => {
    const r = computeCountdown('2026-07-09', TODAY);
    expect(r.inDays).toBe(0);
    expect(r.label).toBe('TODAY');
    expect(r.tone).toBe('imminent');
    expect(r.overdue).toBe(false);
  });

  it('TOMORROW at inDays 1 (imminent)', () => {
    const r = computeCountdown('2026-07-10', TODAY);
    expect(r.inDays).toBe(1);
    expect(r.label).toBe('TOMORROW');
    expect(r.tone).toBe('imminent');
  });

  it('IN N DAYS for >1 day out (upcoming)', () => {
    const r = computeCountdown('2026-07-14', TODAY);
    expect(r.inDays).toBe(5);
    expect(r.label).toBe('IN 5 DAYS');
    expect(r.tone).toBe('upcoming');
    expect(r.overdue).toBe(false);
  });

  it('YESTERDAY at inDays -1 (overdue)', () => {
    const r = computeCountdown('2026-07-08', TODAY);
    expect(r.inDays).toBe(-1);
    expect(r.label).toBe('YESTERDAY');
    expect(r.tone).toBe('overdue');
    expect(r.overdue).toBe(true);
  });

  it('N DAYS AGO for past dates (overdue)', () => {
    const r = computeCountdown('2026-07-04', TODAY);
    expect(r.inDays).toBe(-5);
    expect(r.label).toBe('5 DAYS AGO');
    expect(r.tone).toBe('overdue');
    expect(r.overdue).toBe(true);
  });

  it('unparseable input yields muted/empty (no crash)', () => {
    expect(computeCountdown('', TODAY)).toEqual({ inDays: null, overdue: false, label: '', tone: 'muted' });
    expect(computeCountdown('2026-07-14', undefined).tone).toBe('muted');
  });
});

describe('deriveReadiness — honest from existing fields', () => {
  it('prepped when policyType present AND objections listed', () => {
    const r = deriveReadiness({ policyType: 'whole-life', objections: ['no-money'] });
    expect(r.prepped).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.present).toEqual(['policyType', 'objections']);
  });

  it('needs prep when policyType missing', () => {
    const r = deriveReadiness({ policyType: '', objections: ['no-money'] });
    expect(r.prepped).toBe(false);
    expect(r.missing).toContain('policyType');
  });

  it('needs prep when no objections listed', () => {
    const r = deriveReadiness({ policyType: 'term-life', objections: [] });
    expect(r.prepped).toBe(false);
    expect(r.missing).toContain('objections');
  });

  it('empty prep is not prepped and reports both missing', () => {
    const r = deriveReadiness({});
    expect(r.prepped).toBe(false);
    expect(r.missing).toEqual(['policyType', 'objections']);
  });
});

describe('matchObjection — taxonomy matching', () => {
  it('exact stored value matches', () => {
    expect(matchObjection('no-money')).toBe(OBJECTION_TAXONOMY['no-money']);
    expect(matchObjection('no-confidence').counter).toMatch(/Tatil/);
  });

  it('case/space-tolerant (human label + spacing variants)', () => {
    expect(matchObjection('No Money')).toBe(OBJECTION_TAXONOMY['no-money']);
    expect(matchObjection('  NO_HURRY  ')).toBe(OBJECTION_TAXONOMY['no-hurry']);
    expect(matchObjection('no need')).toBe(OBJECTION_TAXONOMY['no-need']);
  });

  it('unmatched labels return null (plain-chip fallback)', () => {
    expect(matchObjection('some-legacy-objection')).toBeNull();
    expect(matchObjection('')).toBeNull();
    expect(matchObjection(undefined)).toBeNull();
  });

  it('taxonomy has the four canonical objections with full copy', () => {
    expect(Object.keys(OBJECTION_TAXONOMY)).toEqual(['no-money', 'no-need', 'no-hurry', 'no-confidence']);
    for (const entry of Object.values(OBJECTION_TAXONOMY)) {
      expect(entry.label).toBeTruthy();
      expect(entry.means).toBeTruthy();
      expect(entry.counter).toBeTruthy();
    }
  });
});

describe('pickNextCall — soonest upcoming, not overdue', () => {
  const preps = [
    { id: 'overdue', intendedAppointmentDate: '2026-07-01' },
    { id: 'soonest', intendedAppointmentDate: '2026-07-10' },
    { id: 'later', intendedAppointmentDate: '2026-07-20' },
  ];

  it('picks the soonest upcoming (skips overdue)', () => {
    expect(pickNextCall(preps, TODAY).id).toBe('soonest');
  });

  it('picks today over tomorrow', () => {
    const withToday = [...preps, { id: 'today', intendedAppointmentDate: TODAY }];
    expect(pickNextCall(withToday, TODAY).id).toBe('today');
  });

  it('returns null when every prep is overdue', () => {
    const allPast = [
      { id: 'a', intendedAppointmentDate: '2026-06-01' },
      { id: 'b', intendedAppointmentDate: '2026-07-08' },
    ];
    expect(pickNextCall(allPast, TODAY)).toBeNull();
  });

  it('ignores undated/unparseable preps', () => {
    const mixed = [{ id: 'x', intendedAppointmentDate: '' }, { id: 'y', intendedAppointmentDate: '2026-07-15' }];
    expect(pickNextCall(mixed, TODAY).id).toBe('y');
  });

  it('is order-independent (unsorted input)', () => {
    const shuffled = [preps[2], preps[0], preps[1]];
    expect(pickNextCall(shuffled, TODAY).id).toBe('soonest');
  });
});

describe('display helpers', () => {
  it('formatDMY converts YYYY-MM-DD → DD-MM-YYYY, falls back on bad input', () => {
    expect(formatDMY('2026-07-09')).toBe('09-07-2026');
    expect(formatDMY('not-a-date')).toBe('not-a-date');
    expect(formatDMY('')).toBe('');
  });

  it('todayISO returns local YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 6, 9))).toBe('2026-07-09');
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('prospectInitials takes up to two initials, splitting on & / and', () => {
    expect(prospectInitials('Anil & Reshma Persaud')).toBe('AR');
    expect(prospectInitials('Kevon Baptiste')).toBe('KB');
    expect(prospectInitials('Sangeeta')).toBe('S');
    expect(prospectInitials('')).toBe('');
  });
});
