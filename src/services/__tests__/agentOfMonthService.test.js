import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock firebase dependencies before importing the service module
vi.mock('../../firebase', () => ({
  db: {},
  functions: {},
  getTenantId: vi.fn(() => 'tenant1'),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

import {
  getCurrentMonthKey,
  getPrevMonthKey,
  isWithinEditWindow,
} from '../agentOfMonthService';

describe('agentOfMonthService — month key utilities', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('getCurrentMonthKey returns YYYY-MM format', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const key = getCurrentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  it('getCurrentMonthKey returns correct month in Trinidad time (UTC-4)', () => {
    // 2026-05-01T03:00:00Z = 2026-04-30T23:00:00 TT → April in TT
    vi.setSystemTime(new Date('2026-05-01T03:00:00Z'));
    expect(getCurrentMonthKey()).toBe('2026-04');
  });

  it('getCurrentMonthKey returns May when after midnight TT', () => {
    // 2026-05-01T05:00:00Z = 2026-05-01T01:00:00 TT → May in TT
    vi.setSystemTime(new Date('2026-05-01T05:00:00Z'));
    expect(getCurrentMonthKey()).toBe('2026-05');
  });

  it('getPrevMonthKey returns a month before getCurrentMonthKey', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const current = getCurrentMonthKey();
    const prev = getPrevMonthKey();
    const [cy, cm] = current.split('-').map(Number);
    const [py, pm] = prev.split('-').map(Number);
    expect(cy * 12 + cm - 1).toBe(py * 12 + pm);
  });

  it('getPrevMonthKey rolls back across year boundary', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(getPrevMonthKey()).toBe('2025-12');
  });

  it('isWithinEditWindow returns true on day 1 (TT)', () => {
    // 2026-05-01T12:00:00Z = 2026-05-01T08:00 TT (day 1 in TT)
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    expect(isWithinEditWindow()).toBe(true);
  });

  it('isWithinEditWindow returns true on day 7 (TT)', () => {
    // 2026-05-07T16:00:00Z = 2026-05-07T12:00 TT (day 7 in TT)
    vi.setSystemTime(new Date('2026-05-07T16:00:00Z'));
    expect(isWithinEditWindow()).toBe(true);
  });

  it('isWithinEditWindow returns false on day 8 (TT)', () => {
    // 2026-05-08T06:00:00Z = 2026-05-08T02:00 TT (day 8 in TT)
    vi.setSystemTime(new Date('2026-05-08T06:00:00Z'));
    expect(isWithinEditWindow()).toBe(false);
  });

  it('isWithinEditWindow returns false on day 15 (TT)', () => {
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    expect(isWithinEditWindow()).toBe(false);
  });
});
