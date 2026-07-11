// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getDailyStreakCelebratedMax,
  setDailyStreakCelebratedMax,
  getGoalsCelebrated,
  setGoalsAnnualCelebrated,
  setGoalsStreakCelebratedMax,
  getFilingStreakCelebratedMax,
  setFilingStreakCelebratedMax,
} from '../celebrationPrefs';

beforeEach(() => {
  window.localStorage.clear();
});

describe('celebrationPrefs — daily streak', () => {
  it('defaults to 0 when unset', () => {
    expect(getDailyStreakCelebratedMax('agentA')).toBe(0);
  });

  it('round-trips a value per uid', () => {
    setDailyStreakCelebratedMax('agentA', 5);
    setDailyStreakCelebratedMax('agentB', 10);
    expect(getDailyStreakCelebratedMax('agentA')).toBe(5);
    expect(getDailyStreakCelebratedMax('agentB')).toBe(10);
  });
});

describe('celebrationPrefs — goals (per year)', () => {
  it('defaults to not-celebrated / 0', () => {
    expect(getGoalsCelebrated('agentA', 2026)).toEqual({ annual: false, streakMax: 0 });
  });

  it('records annual + streak markers scoped per year', () => {
    setGoalsAnnualCelebrated('agentA', 2026);
    setGoalsStreakCelebratedMax('agentA', 2026, 8);
    expect(getGoalsCelebrated('agentA', 2026)).toEqual({ annual: true, streakMax: 8 });
    // Different year is independent.
    expect(getGoalsCelebrated('agentA', 2027)).toEqual({ annual: false, streakMax: 0 });
  });
});

describe('celebrationPrefs — filing streak (per year)', () => {
  it('defaults to 0 when unset', () => {
    expect(getFilingStreakCelebratedMax('agentA', 2026)).toBe(0);
  });

  it('round-trips a value scoped per uid + year', () => {
    setFilingStreakCelebratedMax('agentA', 2026, 5);
    expect(getFilingStreakCelebratedMax('agentA', 2026)).toBe(5);
    // Different year is independent.
    expect(getFilingStreakCelebratedMax('agentA', 2027)).toBe(0);
    // Different uid is independent.
    expect(getFilingStreakCelebratedMax('agentB', 2026)).toBe(0);
  });
});

describe('celebrationPrefs — storage failure is swallowed', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the safe default when getItem throws', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getDailyStreakCelebratedMax('agentA')).toBe(0);
    expect(getGoalsCelebrated('agentA', 2026)).toEqual({ annual: false, streakMax: 0 });
  });

  it('does not throw when setItem throws', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => setDailyStreakCelebratedMax('agentA', 5)).not.toThrow();
    expect(() => setGoalsAnnualCelebrated('agentA', 2026)).not.toThrow();
  });
});
