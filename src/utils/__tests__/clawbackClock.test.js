import { describe, it, expect } from 'vitest';
import { deriveClawback, toTTDayString, daysBetweenTT, CLAWBACK_DAYS, AT_RISK_DAYS } from '../clawbackClock';

describe('clawbackClock — constants', () => {
  it('deadline is 30 days, at-risk window is 7 days', () => {
    expect(CLAWBACK_DAYS).toBe(30);
    expect(AT_RISK_DAYS).toBe(7);
  });
});

describe('toTTDayString', () => {
  it('slices a YYYY-MM-DD string', () => {
    expect(toTTDayString('2026-05-10')).toBe('2026-05-10');
    expect(toTTDayString('2026-05-10T04:00:00Z')).toBe('2026-05-10');
  });
  it('reads a Firestore Timestamp (.toDate)', () => {
    const ts = { toDate: () => new Date('2026-05-10T04:00:00Z') };
    expect(toTTDayString(ts)).toBe('2026-05-10');
  });
  it('reads a serialized { seconds } timestamp', () => {
    const ts = { seconds: Math.floor(Date.parse('2026-05-10T12:00:00Z') / 1000) };
    expect(toTTDayString(ts)).toBe('2026-05-10');
  });
  it('returns null for null / garbage', () => {
    expect(toTTDayString(null)).toBeNull();
    expect(toTTDayString({})).toBeNull();
    expect(toTTDayString('not-a-date')).toBeNull();
  });
});

describe('daysBetweenTT', () => {
  it('counts whole calendar days', () => {
    expect(daysBetweenTT('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetweenTT('2026-01-02', '2026-01-31')).toBe(29);
    expect(daysBetweenTT('2025-12-31', '2026-01-31')).toBe(31);
  });
});

describe('deriveClawback — tone boundaries (day 29 / 30 / 31)', () => {
  const today = '2026-01-31';

  it('day 29 → at-risk (1 day left)', () => {
    const c = deriveClawback('2026-01-02', { today });
    expect(c.daysSinceIssue).toBe(29);
    expect(c.daysLeft).toBe(1);
    expect(c.tone).toBe('at-risk');
    expect(c.atRisk).toBe(true);
    expect(c.overdue).toBe(false);
  });

  it('day 30 → at-risk (0 days left, still on the deadline, not yet over)', () => {
    const c = deriveClawback('2026-01-01', { today });
    expect(c.daysSinceIssue).toBe(30);
    expect(c.daysLeft).toBe(0);
    expect(c.tone).toBe('at-risk');
    expect(c.overdue).toBe(false);
  });

  it('day 31 → overdue (past the 30-day deadline)', () => {
    const c = deriveClawback('2025-12-31', { today });
    expect(c.daysSinceIssue).toBe(31);
    expect(c.daysLeft).toBe(-1);
    expect(c.tone).toBe('overdue');
    expect(c.overdue).toBe(true);
    expect(c.atRisk).toBe(false);
  });
});

describe('deriveClawback — within window + at-risk edge', () => {
  const today = '2026-01-31';
  it('freshly issued (day 0) → within, 30 days left', () => {
    const c = deriveClawback('2026-01-31', { today });
    expect(c.daysLeft).toBe(30);
    expect(c.tone).toBe('within');
  });
  it('day 22 → within (8 days left, one outside the at-risk window)', () => {
    const c = deriveClawback('2026-01-09', { today });
    expect(c.daysLeft).toBe(8);
    expect(c.tone).toBe('within');
  });
  it('day 23 → at-risk (exactly 7 days left)', () => {
    const c = deriveClawback('2026-01-08', { today });
    expect(c.daysLeft).toBe(7);
    expect(c.tone).toBe('at-risk');
  });
});

describe('deriveClawback — delivered + invalid', () => {
  it('delivered → tone delivered, clock closed, regardless of days', () => {
    const c = deriveClawback('2025-01-01', { delivered: true, today: '2026-01-31' });
    expect(c.delivered).toBe(true);
    expect(c.tone).toBe('delivered');
    expect(c.overdue).toBe(false);
    expect(c.daysLeft).toBeNull();
  });
  it('missing issue date (undelivered) → invalid, tone unknown', () => {
    const c = deriveClawback(null, { today: '2026-01-31' });
    expect(c.valid).toBe(false);
    expect(c.tone).toBe('unknown');
  });
  it('delivered with missing issue date still reports delivered', () => {
    const c = deriveClawback(null, { delivered: true, today: '2026-01-31' });
    expect(c.delivered).toBe(true);
    expect(c.tone).toBe('delivered');
  });
});
