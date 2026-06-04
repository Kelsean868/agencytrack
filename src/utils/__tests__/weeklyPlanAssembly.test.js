import { describe, it, expect } from 'vitest';
import {
  PLAN_METRIC_KEYS,
  assembleSuggestion,
  clampValue,
  stepTarget,
} from '../weeklyPlanAssembly';

const FLOORS = {
  callsMade: 100,
  contactsMade: 40,
  factFindsCompleted: 8,
  closingInterviewsKept: 5,
  applicationsSubmitted: 3,
};

describe('weeklyPlanAssembly — assembleSuggestion', () => {
  it('derived mode: dials/CIs/apps from the chain, contacts/FFIs from the floor', () => {
    const resolution = { mode: 'derived', weekly: { dials: 150, ci: 12, applications: 6, prospects: 300 } };
    const { targets, provenance } = assembleSuggestion(resolution, FLOORS);

    expect(targets).toEqual({
      callsMade: 150,
      contactsMade: 40,            // floor
      factFindsCompleted: 8,       // floor
      closingInterviewsKept: 12,
      applicationsSubmitted: 6,
    });
    expect(provenance).toEqual({
      callsMade: 'derived',
      contactsMade: 'floor',
      factFindsCompleted: 'floor',
      closingInterviewsKept: 'derived',
      applicationsSubmitted: 'derived',
    });
  });

  it('floor mode: all five pre-fill from the floor', () => {
    const { targets, provenance } = assembleSuggestion({ mode: 'floor', weeksUsed: 3 }, FLOORS);
    expect(targets).toEqual(FLOORS);
    PLAN_METRIC_KEYS.forEach((k) => expect(provenance[k]).toBe('floor'));
  });

  it('honesty clamp: a derived value below its floor is raised AND relabelled floor', () => {
    // dials derives to 60 but the floor is 100 → never present a floor value as personal.
    const resolution = { mode: 'derived', weekly: { dials: 60, ci: 12, applications: 6, prospects: 100 } };
    const { targets, provenance } = assembleSuggestion(resolution, FLOORS);
    expect(targets.callsMade).toBe(100);
    expect(provenance.callsMade).toBe('floor');
    // A derived value above floor keeps its 'derived' label.
    expect(provenance.closingInterviewsKept).toBe('derived');
  });

  it('rounds derived values to whole counts', () => {
    const resolution = { mode: 'derived', weekly: { dials: 150.6, ci: 11.4, applications: 6.5, prospects: 1 } };
    const { targets } = assembleSuggestion(resolution, FLOORS);
    expect(targets.callsMade).toBe(151);
    expect(targets.closingInterviewsKept).toBe(11);
    expect(targets.applicationsSubmitted).toBe(7);
  });

  it('missing floor keys fall back to 0 (no NaN)', () => {
    const { targets } = assembleSuggestion({ mode: 'floor' }, { callsMade: 100 });
    expect(targets.callsMade).toBe(100);
    expect(targets.contactsMade).toBe(0);
    PLAN_METRIC_KEYS.forEach((k) => expect(Number.isFinite(targets[k])).toBe(true));
  });
});

describe('weeklyPlanAssembly — clampValue', () => {
  it('clamps to the floor minimum and rounds', () => {
    expect(clampValue(3, FLOORS, 'callsMade')).toBe(100);
    expect(clampValue(150.4, FLOORS, 'callsMade')).toBe(150);
    expect(clampValue(50, { callsMade: 0 }, 'callsMade')).toBe(50);
  });
});

describe('weeklyPlanAssembly — stepTarget', () => {
  const base = {
    targets: { ...FLOORS, callsMade: 120 },
    provenance: { ...Object.fromEntries(PLAN_METRIC_KEYS.map((k) => [k, 'floor'])), callsMade: 'derived' },
  };

  it('increments and flips provenance to agent', () => {
    const next = stepTarget(base, 'callsMade', 1, FLOORS);
    expect(next.targets.callsMade).toBe(121);
    expect(next.provenance.callsMade).toBe('agent');
    // other keys untouched
    expect(next.targets.contactsMade).toBe(40);
    expect(next.provenance.contactsMade).toBe('floor');
  });

  it('decrements above the floor and flips to agent', () => {
    const next = stepTarget(base, 'callsMade', -1, FLOORS);
    expect(next.targets.callsMade).toBe(119);
    expect(next.provenance.callsMade).toBe('agent');
  });

  it('clamps at the floor: a no-op step leaves state (incl. provenance) untouched', () => {
    const atFloor = {
      targets: { ...FLOORS },
      provenance: Object.fromEntries(PLAN_METRIC_KEYS.map((k) => [k, 'floor'])),
    };
    const next = stepTarget(atFloor, 'callsMade', -1, FLOORS);
    expect(next.targets.callsMade).toBe(100);
    expect(next.provenance.callsMade).toBe('floor'); // not flipped to agent on a clamped no-op
    // No new state allocated — the same targets/provenance refs flow through.
    expect(next.targets).toBe(atFloor.targets);
    expect(next.provenance).toBe(atFloor.provenance);
  });

  it('does not mutate the input state', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    stepTarget(base, 'callsMade', 5, FLOORS);
    expect(base).toEqual(snapshot);
  });
});
