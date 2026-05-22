import { describe, it, expect } from 'vitest';
import {
  computeMissedActivities,
  STANDARD_LABELS,
} from '../accountabilityFlag';

describe('computeMissedActivities — numeric activities', () => {
  it('returns empty when no standards are resolved', () => {
    const war = { oneOnOnesConducted: 0, namesSourced: 0 };
    expect(computeMissedActivities(war, {})).toEqual([]);
  });

  it('flags a numeric activity when actual < target', () => {
    const war = { namesSourced: 3 };
    const stds = { namesSourced: 5 };
    const missed = computeMissedActivities(war, stds);
    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({
      key:    'namesSourced',
      label:  STANDARD_LABELS.namesSourced,
      actual: 3,
      target: 5,
      type:   'numeric',
    });
  });

  it('does NOT flag a numeric activity when actual === target', () => {
    const war = { namesSourced: 5 };
    expect(computeMissedActivities(war, { namesSourced: 5 })).toEqual([]);
  });

  it('does NOT flag a numeric activity when actual > target', () => {
    const war = { namesSourced: 8 };
    expect(computeMissedActivities(war, { namesSourced: 5 })).toEqual([]);
  });

  it('treats missing/null actual as 0 (so a positive target flags it)', () => {
    const stds = { interviewsConducted: 2 };
    expect(computeMissedActivities({}, stds)).toHaveLength(1);
    expect(computeMissedActivities({ interviewsConducted: null }, stds)).toHaveLength(1);
  });

  it('does NOT flag when target is null/undefined/0 (no-target = not measured)', () => {
    const war = { namesSourced: 0 };
    expect(computeMissedActivities(war, { namesSourced: null })).toEqual([]);
    expect(computeMissedActivities(war, { namesSourced: undefined })).toEqual([]);
    expect(computeMissedActivities(war, { namesSourced: 0 })).toEqual([]);
  });

  it('flags multiple numeric activities at once', () => {
    const war  = { namesSourced: 1, interviewsConducted: 0, jfwCount: 0 };
    const stds = { namesSourced: 5, interviewsConducted: 3, jfwCount: 2 };
    const keys = computeMissedActivities(war, stds).map((m) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining(['namesSourced', 'interviewsConducted', 'jfwCount'])
    );
    expect(keys).toHaveLength(3);
  });

  it('includes jfwCount when target is set and actual is under', () => {
    const missed = computeMissedActivities({ jfwCount: 1 }, { jfwCount: 3 });
    expect(missed).toEqual([{
      key: 'jfwCount', label: STANDARD_LABELS.jfwCount,
      actual: 1, target: 3, type: 'numeric',
    }]);
  });
});

describe('computeMissedActivities — boolean expectations', () => {
  it('flags a boolean expectation when expected=true and actual=false', () => {
    const missed = computeMissedActivities(
      { unitMeetingHeld: false },
      { unitMeetingHeld: true },
    );
    expect(missed).toEqual([{
      key:    'unitMeetingHeld',
      label:  STANDARD_LABELS.unitMeetingHeld,
      actual: false,
      target: true,
      type:   'boolean',
    }]);
  });

  it('does NOT flag when expected=true and actual=true', () => {
    expect(computeMissedActivities(
      { unitMeetingHeld: true },
      { unitMeetingHeld: true },
    )).toEqual([]);
  });

  it('does NOT flag when expected is not true (no expectation set)', () => {
    expect(computeMissedActivities(
      { unitMeetingHeld: false },
      { unitMeetingHeld: false },
    )).toEqual([]);
    expect(computeMissedActivities(
      { unitMeetingHeld: false },
      { unitMeetingHeld: null },
    )).toEqual([]);
    expect(computeMissedActivities(
      { unitMeetingHeld: false },
      {},
    )).toEqual([]);
  });

  it('treats missing actual as false (so an expected=true flags it)', () => {
    expect(computeMissedActivities({}, { dashboardReviewDone: true })).toEqual([{
      key:    'dashboardReviewDone',
      label:  STANDARD_LABELS.dashboardReviewDone,
      actual: false,
      target: true,
      type:   'boolean',
    }]);
  });
});

describe('computeMissedActivities — mixed + defensive', () => {
  it('combines numeric + boolean misses in the same result', () => {
    const war  = { namesSourced: 1, unitMeetingHeld: false };
    const stds = { namesSourced: 5, unitMeetingHeld: true };
    const missed = computeMissedActivities(war, stds);
    expect(missed).toHaveLength(2);
    expect(missed.map((m) => m.key)).toEqual(
      expect.arrayContaining(['namesSourced', 'unitMeetingHeld'])
    );
  });

  it('returns empty array on missing inputs', () => {
    expect(computeMissedActivities(null, {})).toEqual([]);
    expect(computeMissedActivities({}, null)).toEqual([]);
    expect(computeMissedActivities(undefined, undefined)).toEqual([]);
  });

  it('skips numeric fields with non-finite actual (defensive)', () => {
    const war  = { namesSourced: NaN };
    const stds = { namesSourced: 5 };
    expect(computeMissedActivities(war, stds)).toEqual([]);
  });

  it('all-met across mixed standards returns empty', () => {
    const war  = {
      jfwCount: 3, oneOnOnesConducted: 5, namesSourced: 5,
      unitMeetingHeld: true, dashboardReviewDone: true,
    };
    const stds = {
      jfwCount: 3, oneOnOnesConducted: 5, namesSourced: 5,
      unitMeetingHeld: true, dashboardReviewDone: true,
    };
    expect(computeMissedActivities(war, stds)).toEqual([]);
  });
});
