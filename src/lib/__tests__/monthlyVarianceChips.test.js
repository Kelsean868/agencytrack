import { describe, it, expect } from 'vitest';
import { monthlyVarianceChips } from '../monthlyPlanMath';

describe('monthlyPlanMath — monthlyVarianceChips', () => {
  it('emits to-finish api + apps when behind on the current month', () => {
    const chips = monthlyVarianceChips({
      currentPace: { toFinishAPI: 25000, toFinishApps: 2.5, state: 'behind' },
      recovery: null,
      ytd: 0,
    });
    expect(chips.map((c) => c.kind)).toEqual(['to-finish-api', 'to-finish-apps']);
    expect(chips[0].value).toBe(25000);
    expect(chips[1].value).toBeCloseTo(2.5);
  });

  it('omits the apps chip when apps to finish is zero', () => {
    const chips = monthlyVarianceChips({
      currentPace: { toFinishAPI: 5000, toFinishApps: 0 },
    });
    expect(chips.map((c) => c.kind)).toEqual(['to-finish-api']);
  });

  it('emits ytd-behind only when YTD is negative', () => {
    expect(monthlyVarianceChips({ currentPace: null, ytd: -12000 }).map((c) => c.kind))
      .toEqual(['ytd-behind']);
    expect(monthlyVarianceChips({ currentPace: null, ytd: 12000 })).toEqual([]);
  });

  it('emits recovery-stretch only when recovery is a stretch with a positive pace', () => {
    expect(monthlyVarianceChips({ recovery: { isStretch: true, pacePerMonth: 30000 } }).map((c) => c.kind))
      .toEqual(['recovery-stretch']);
    expect(monthlyVarianceChips({ recovery: { isStretch: false, pacePerMonth: 30000 } })).toEqual([]);
    expect(monthlyVarianceChips({ recovery: { isStretch: true, pacePerMonth: 0 } })).toEqual([]);
  });

  it('composes multiple honest chips together', () => {
    const chips = monthlyVarianceChips({
      currentPace: { toFinishAPI: 8000, toFinishApps: 1.2 },
      recovery: { isStretch: true, pacePerMonth: 40000 },
      ytd: -5000,
    });
    expect(chips.map((c) => c.kind)).toEqual([
      'to-finish-api', 'to-finish-apps', 'ytd-behind', 'recovery-stretch',
    ]);
  });

  it('returns nothing when there is no variance to surface', () => {
    expect(monthlyVarianceChips({ currentPace: { toFinishAPI: 0, toFinishApps: 0 }, ytd: 3000, recovery: null }))
      .toEqual([]);
    expect(monthlyVarianceChips({})).toEqual([]);
  });
});
