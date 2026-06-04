/**
 * weeklyPlanAssembly.js — pure plan-assembly logic for the Weekly Planner card.
 *
 * No Firestore, no React: just the deterministic transforms the card's edit
 * state needs, so they can be unit-tested in isolation —
 *   · assembleSuggestion — derived+floor pre-fill merge (decision 2)
 *   · clampValue / stepTarget — floor clamp + provenance→'agent' transition (decisions 2–3)
 *
 * The five metric keys match the shipped weeklyActivityFloors / SuggestedWeekCard
 * FLOOR_METRICS keys. PROVENANCE_VALUES is the rules enum.
 */

export const PLAN_METRIC_KEYS = [
  'callsMade',
  'contactsMade',
  'factFindsCompleted',
  'closingInterviewsKept',
  'applicationsSubmitted',
];

export const PROVENANCE_VALUES = ['derived', 'floor', 'agent'];

// A finite floor for a metric, or null when the floors map doesn't carry it.
function floorOf(floors, key) {
  const v = floors?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function toCount(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Build the pre-filled steppers from the card's resolution + the company floor.
 *
 * Derived state: dials/CIs/apps pre-fill from the derived chain ('derived');
 * contacts + FFIs (not modelled by the engine) pre-fill from the floor ('floor').
 * Floor state (and any non-derived resolution): all five pre-fill from the floor.
 *
 * Honesty clamp: a derived value that lands below its floor is raised to the
 * floor and relabelled 'floor' — never present a floor value as personal.
 *
 * @param {{ mode?:string, weekly?:{dials:number,ci:number,applications:number} }} resolution
 * @param {object|null} floors — resolved weeklyActivityFloors.
 * @returns {{ targets:object, provenance:object }}
 */
export function assembleSuggestion(resolution, floors) {
  const f = floors ?? {};
  const targets = {};
  const provenance = {};

  const derived =
    resolution?.mode === 'derived' && resolution.weekly
      ? {
          callsMade: resolution.weekly.dials,
          closingInterviewsKept: resolution.weekly.ci,
          applicationsSubmitted: resolution.weekly.applications,
        }
      : {};

  for (const key of PLAN_METRIC_KEYS) {
    if (key in derived) {
      targets[key] = toCount(derived[key]);
      provenance[key] = 'derived';
    } else {
      targets[key] = floorOf(f, key) ?? 0;
      provenance[key] = 'floor';
    }
  }

  // Honesty clamp — a derivation below floor is not a personal target.
  for (const key of PLAN_METRIC_KEYS) {
    const min = floorOf(f, key);
    if (min != null && targets[key] < min) {
      targets[key] = min;
      provenance[key] = 'floor';
    }
  }

  return { targets, provenance };
}

/**
 * The floor-clamped value for a metric (stepper minimum = resolved floor).
 */
export function clampValue(value, floors, key) {
  const min = floorOf(floors ?? {}, key) ?? 0;
  return Math.max(min, Math.round(Number(value) || 0));
}

/**
 * Apply a stepper delta to one metric, clamped at the floor. A step that
 * actually changes the value flips that metric's provenance to 'agent'; a
 * clamped no-op (pressing − at the floor) leaves state untouched.
 *
 * @returns {{ targets:object, provenance:object }} new state (inputs untouched)
 */
export function stepTarget({ targets, provenance }, key, delta, floors) {
  const min = floorOf(floors ?? {}, key) ?? 0;
  const prev = Math.round(Number(targets?.[key]) || 0);
  const next = Math.max(min, prev + delta);
  if (next === prev) return { targets, provenance };
  return {
    targets: { ...targets, [key]: next },
    provenance: { ...provenance, [key]: 'agent' },
  };
}
