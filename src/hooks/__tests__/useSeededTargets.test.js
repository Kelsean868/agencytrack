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
