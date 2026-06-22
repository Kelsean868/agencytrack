import { useMemo } from 'react';
import {
  decomposeFromAPI,
  DEFAULT_DECOMPOSITION_INPUTS,
  WEEKLY_DIVISOR,
  roundToWhole,
  roundTo10,
} from '../utils/goalDecomposition';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../utils/weeklyActivityFloors';

/**
 * useSeededTargets — derives next-week target suggestions for step 11.
 *
 * Seed per metric = max(floor, thisWeekActual[, decomp-derived if annual goal set]).
 * API suggestion is blank (0) when no annual goal is set (honest-blank).
 *
 * @param {{ data: object, goal: object|null, floors: object|null }} params
 *   data   — current wizard formData (carries this week's actuals from earlier steps)
 *   goal   — agent's personal goal record (needs personalAnnualAPI)
 *   floors — resolved weekly activity floors (falls back to DEFAULT_WEEKLY_ACTIVITY_FLOORS)
 * @returns {{ targetDials, targetFFI, targetCI, targetAPI, hasGoal }}
 */
export function useSeededTargets({ data, goal, floors }) {
  return useMemo(() => {
    const f = { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, ...(floors ?? {}) };
    const annualAPI = parseFloat(goal?.personalAnnualAPI) || 0;
    const hasGoal   = annualAPI > 0;

    // Fast path: the daily-aggregated draft carries `dials`. Full path: weekly
    // INITIAL_DATA has no `dials` — it uses `coldCalls`. `??` reads dials when
    // present (fast path unchanged) and falls back to coldCalls otherwise so the
    // full-path actuals-seed isn't dead (canonical daily-dials ↔ weekly-coldCalls).
    const thisWeekDials = parseFloat(data?.dials ?? data?.coldCalls) || 0;
    const thisWeekFFI   = parseFloat(data?.ffiConducted) || 0;
    const thisWeekCI    = parseFloat(data?.ciConducted)  || 0;

    let targetDials = Math.max(f.callsMade,             thisWeekDials);
    let targetFFI   = Math.max(f.factFindsCompleted,    thisWeekFFI);
    let targetCI    = Math.max(f.closingInterviewsKept, thisWeekCI);
    let targetAPI   = 0;

    if (hasGoal) {
      const weeklyAPI = annualAPI / WEEKLY_DIVISOR;
      const decomp = decomposeFromAPI({
        apiToWrite:    weeklyAPI,
        avgPolicyAPI:  DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI,
        ciToSaleRatio: DEFAULT_DECOMPOSITION_INPUTS.ciToSaleRatio,
        dialsToCIRatio: DEFAULT_DECOMPOSITION_INPUTS.dialsToCIRatio,
        prospectRatio: DEFAULT_DECOMPOSITION_INPUTS.prospectRatio,
      });
      targetDials = Math.max(targetDials, roundToWhole(decomp.dials));
      targetCI    = Math.max(targetCI,    roundToWhole(decomp.ci));
      targetAPI   = Math.max(f.api,       roundTo10(weeklyAPI));
    }

    return { targetDials, targetFFI, targetCI, targetAPI, hasGoal };
  }, [
    data?.dials,
    data?.coldCalls,
    data?.ffiConducted,
    data?.ciConducted,
    goal?.personalAnnualAPI,
    floors,
  ]);
}
