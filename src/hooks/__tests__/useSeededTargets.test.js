import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeededTargets } from '../useSeededTargets';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';
import { WEEKLY_DIVISOR } from '../../utils/goalDecomposition';

const ANNUAL_API = 200000; // round number for predictable decomp

describe('useSeededTargets', () => {
  describe('no annual goal (honest-blank)', () => {
    it('returns hasGoal=false and targetAPI=0 when goal is null', () => {
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal: null, floors: null })
      );
      expect(result.current.hasGoal).toBe(false);
      expect(result.current.targetAPI).toBe(0);
    });

    it('returns hasGoal=false when personalAnnualAPI is 0', () => {
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal: { personalAnnualAPI: 0 }, floors: null })
      );
      expect(result.current.hasGoal).toBe(false);
      expect(result.current.targetAPI).toBe(0);
    });

    it('returns floor for dials/FFI/CI when no goal and no actuals', () => {
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal: null, floors: null })
      );
      expect(result.current.targetDials).toBe(DEFAULT_WEEKLY_ACTIVITY_FLOORS.callsMade);
      expect(result.current.targetFFI).toBe(DEFAULT_WEEKLY_ACTIVITY_FLOORS.factFindsCompleted);
      expect(result.current.targetCI).toBe(DEFAULT_WEEKLY_ACTIVITY_FLOORS.closingInterviewsKept);
    });

    it('returns thisWeekActual when it exceeds the floor (no goal)', () => {
      const data = { dials: 120, ffiConducted: 20, ciConducted: 18 };
      const { result } = renderHook(() =>
        useSeededTargets({ data, goal: null, floors: null })
      );
      expect(result.current.targetDials).toBe(120);
      expect(result.current.targetFFI).toBe(20);
      expect(result.current.targetCI).toBe(18);
    });

    // Full path (weekly wizard): INITIAL_DATA has no `dials` field — it uses
    // `coldCalls`. The dials seed reads coldCalls when dials is absent so the
    // actuals-seed path isn't dead for full-path agents. (Fast path, which
    // carries `dials` on the daily-aggregated draft, is unchanged — covered above.)
    it('seeds targetDials from coldCalls when dials is absent (full path)', () => {
      const data = { coldCalls: 130, ffiConducted: 20, ciConducted: 18 };
      const { result } = renderHook(() =>
        useSeededTargets({ data, goal: null, floors: null })
      );
      expect(result.current.targetDials).toBe(130);
    });

    it('prefers dials over coldCalls when both are present', () => {
      const data = { dials: 120, coldCalls: 55 };
      const { result } = renderHook(() =>
        useSeededTargets({ data, goal: null, floors: null })
      );
      expect(result.current.targetDials).toBe(120);
    });
  });

  describe('with annual goal', () => {
    const goal = { personalAnnualAPI: ANNUAL_API };

    it('returns hasGoal=true', () => {
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal, floors: null })
      );
      expect(result.current.hasGoal).toBe(true);
    });

    it('targetAPI is at least the floor', () => {
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal, floors: null })
      );
      expect(result.current.targetAPI).toBeGreaterThanOrEqual(DEFAULT_WEEKLY_ACTIVITY_FLOORS.api);
    });

    it('targetAPI is rounded to nearest 10', () => {
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal, floors: null })
      );
      expect(result.current.targetAPI % 10).toBe(0);
    });

    it('targetDials is at least the floor', () => {
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal, floors: null })
      );
      expect(result.current.targetDials).toBeGreaterThanOrEqual(DEFAULT_WEEKLY_ACTIVITY_FLOORS.callsMade);
    });

    it('thisWeekActual beats floor + decomp when higher', () => {
      const data = { dials: 9999, ffiConducted: 0, ciConducted: 9999 };
      const { result } = renderHook(() =>
        useSeededTargets({ data, goal, floors: null })
      );
      expect(result.current.targetDials).toBe(9999);
      expect(result.current.targetCI).toBe(9999);
    });

    it('uses custom floors when provided', () => {
      const customFloors = { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, callsMade: 200, api: 10000 };
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal, floors: customFloors })
      );
      expect(result.current.targetDials).toBeGreaterThanOrEqual(200);
      expect(result.current.targetAPI).toBeGreaterThanOrEqual(10000);
    });

    it('annual goal of 200000 over 43 weeks gives targetAPI >= 4651', () => {
      const weeklyTarget = ANNUAL_API / WEEKLY_DIVISOR;
      const { result } = renderHook(() =>
        useSeededTargets({ data: {}, goal, floors: null })
      );
      // targetAPI = max(floor.api=4800, roundTo10(weeklyTarget≈4651)) = 4800
      expect(result.current.targetAPI).toBe(
        Math.max(DEFAULT_WEEKLY_ACTIVITY_FLOORS.api, Math.round(weeklyTarget / 10) * 10)
      );
    });
  });
});

// ─── D-TD (26 Aug 2026): "Target Dials" means the 4-sum ──────────────────────
// Before this ruling the full path read `coldCalls` alone, so an agent whose
// week was mostly referral / follow-up calls got seeded from the cold bucket
// only and their target silently under-counted their own actuals.

describe('D-TD — full-path dials seed is the 4-sum', () => {
  it('sums all four call types, not coldCalls alone', () => {
    const data = {
      coldCalls: 40, referralCalls: 30, followUpCalls: 20, seminarTradeshowCalls: 10,
    };
    const { result } = renderHook(() =>
      useSeededTargets({ data, goal: null, floors: null })
    );
    expect(result.current.targetDials).toBe(100);
  });

  it('seeds from referral/follow-up calls even when coldCalls is 0', () => {
    const data = { coldCalls: 0, referralCalls: 120, followUpCalls: 30 };
    const { result } = renderHook(() =>
      useSeededTargets({ data, goal: null, floors: null })
    );
    expect(result.current.targetDials).toBe(150);
  });

  it('EXCLUDES serviceCalls from the sum', () => {
    const withService    = { coldCalls: 100, serviceCalls: 50 };
    const withoutService = { coldCalls: 100 };
    const a = renderHook(() => useSeededTargets({ data: withService,    goal: null, floors: null }));
    const b = renderHook(() => useSeededTargets({ data: withoutService, goal: null, floors: null }));
    expect(a.result.current.targetDials).toBe(b.result.current.targetDials);
    expect(a.result.current.targetDials).toBe(100);
  });

  it('fast path is unchanged: an explicit `dials` wins over the 4-sum', () => {
    // The daily-aggregated draft carries BOTH; `dials` is authoritative.
    const data = { dials: 210, coldCalls: 100, referralCalls: 50 };
    const { result } = renderHook(() =>
      useSeededTargets({ data, goal: null, floors: null })
    );
    expect(result.current.targetDials).toBe(210);
  });

  it('dials = 0 is "present" and wins (falls back to the floor, not the 4-sum)', () => {
    const data = { dials: 0, coldCalls: 999 };
    const { result } = renderHook(() =>
      useSeededTargets({ data, goal: null, floors: null })
    );
    expect(result.current.targetDials).toBe(DEFAULT_WEEKLY_ACTIVITY_FLOORS.callsMade);
  });
});
