import { describe, it, expect } from 'vitest';
import {
  PLAN_METRIC_KEYS,
  PACE_WORKING_DAYS,
  PACE_METRIC_META,
  SOURCE_CHIP,
  computeProspectingCallsActual,
  elapsedWorkingDays,
  computeWeeklyActuals,
  aggregateDailyActuals,
  varianceState,
  buildPaceRows,
} from '../planVariance';

// Consciously evolved from the S3b 5-sum block: ratified 2026-06-04, serviceCalls
// excluded from effort/floor/plan surfaces. The 4-sum is now the single definition.
describe('computeProspectingCallsActual — 4-sum (no serviceCalls, ratified 2026-06-04)', () => {
  it('sums the four prospecting call components, excluding serviceCalls', () => {
    const fields = { referralCalls: 10, followUpCalls: 5, coldCalls: 3, seminarTradeshowCalls: 2, serviceCalls: 4 };
    expect(computeProspectingCallsActual(fields)).toBe(20); // 10+5+3+2; NOT 24
  });
  it('explicitly excludes serviceCalls (the 5-vs-4 discrimination case)', () => {
    const fields = { referralCalls: 10, followUpCalls: 5, coldCalls: 3, seminarTradeshowCalls: 2, serviceCalls: 4 };
    expect(computeProspectingCallsActual(fields)).toBe(20);
    expect(computeProspectingCallsActual(fields)).not.toBe(24); // 24 would include serviceCalls
  });
  it('treats absent components as 0', () => {
    expect(computeProspectingCallsActual({ referralCalls: 10 })).toBe(10);
    expect(computeProspectingCallsActual({})).toBe(0);
  });
  it('handles null/undefined gracefully', () => {
    expect(computeProspectingCallsActual(null)).toBe(0);
    expect(computeProspectingCallsActual(undefined)).toBe(0);
  });
});

// 2026-06-07 is a Sunday (the weekStart used in the S2 committed-plan fixtures).
const WEEK_START = '2026-06-07';

const FLOORS = {
  callsMade: 60, telContacts: 40, factFindsCompleted: 10,
  closingInterviewsKept: 10, applicationsSubmitted: 1,
};

// A committed plan mirroring the annotation's worked example
// (FLOOR/PLAN: apps 1/2, CIs 10/6, FFI 10/12, calls 60/50, contacts 40/40).
const PLAN = {
  targets: { callsMade: 50, telContacts: 40, factFindsCompleted: 12, closingInterviewsKept: 6, applicationsSubmitted: 2 },
  provenance: { callsMade: 'agent', telContacts: 'floor', factFindsCompleted: 'agent', closingInterviewsKept: 'derived', applicationsSubmitted: 'derived' },
};

// A v2 flat submission (extractFields flat arm; version 2 → newBusiness.apps).
function v2Submission(over = {}) {
  return {
    version: 2,
    referralCalls: 10, followUpCalls: 5, coldCalls: 3, seminarTradeshowCalls: 2, serviceCalls: 4,
    qualifiedApproaches: 40, ffiConducted: 8, ciConducted: 5,
    newBusiness: { apps: 3, api: 36000 },
    ...over,
  };
}

describe('planVariance — constants', () => {
  it('pace denominator is Mon–Sat = 6 (brief D2, not the annotation mock "of 5")', () => {
    expect(PACE_WORKING_DAYS).toBe(6);
  });
  it('exposes the five plan metric keys in order', () => {
    expect(PLAN_METRIC_KEYS).toEqual([
      'callsMade', 'telContacts', 'factFindsCompleted', 'closingInterviewsKept', 'applicationsSubmitted',
    ]);
  });
  it('only callsMade lacks a daily source', () => {
    expect(PACE_METRIC_META.callsMade.hasDailySource).toBe(false);
    expect(PACE_METRIC_META.telContacts.hasDailySource).toBe(true);
    expect(PACE_METRIC_META.factFindsCompleted.hasDailySource).toBe(true);
    expect(PACE_METRIC_META.closingInterviewsKept.hasDailySource).toBe(true);
    expect(PACE_METRIC_META.applicationsSubmitted.hasDailySource).toBe(true);
  });
  it('telContacts has no clarifier (real field as of v2 Phase 1b, not a proxy)', () => {
    expect(PACE_METRIC_META.telContacts.clarifier).toBeNull();
  });
});

describe('elapsedWorkingDays — TT-safe Mon–Sat, Sunday excluded', () => {
  it('Sunday (week start) is 0 elapsed working days', () => {
    expect(elapsedWorkingDays(WEEK_START, '2026-06-07')).toBe(0);
  });
  it('Mon…Sat map to 1…6', () => {
    expect(elapsedWorkingDays(WEEK_START, '2026-06-08')).toBe(1); // Mon
    expect(elapsedWorkingDays(WEEK_START, '2026-06-09')).toBe(2); // Tue
    expect(elapsedWorkingDays(WEEK_START, '2026-06-10')).toBe(3); // Wed
    expect(elapsedWorkingDays(WEEK_START, '2026-06-11')).toBe(4); // Thu
    expect(elapsedWorkingDays(WEEK_START, '2026-06-12')).toBe(5); // Fri
    expect(elapsedWorkingDays(WEEK_START, '2026-06-13')).toBe(6); // Sat
  });
  it('the following Sunday and beyond cap at 6 (week complete)', () => {
    expect(elapsedWorkingDays(WEEK_START, '2026-06-14')).toBe(6); // next Sun
    expect(elapsedWorkingDays(WEEK_START, '2026-06-20')).toBe(6); // following Sat
  });
  it('a date before the week start is 0', () => {
    expect(elapsedWorkingDays(WEEK_START, '2026-06-06')).toBe(0); // prev Sat
  });
  it('returns 0 for missing inputs (defensive)', () => {
    expect(elapsedWorkingDays(null, '2026-06-10')).toBe(0);
    expect(elapsedWorkingDays(WEEK_START, null)).toBe(0);
  });
});

// Consciously evolved: callsMade switches to 4-sum (ratified 2026-06-04).
describe('computeWeeklyActuals — prospecting calls 4-sum (no serviceCalls)', () => {
  it('uses the 4-sum for callsMade, excluding serviceCalls', () => {
    const a = computeWeeklyActuals(v2Submission());
    expect(a.callsMade).toBe(20); // 10+5+3+2; serviceCalls(4) EXCLUDED
  });
  it('ignores serviceCalls even when present', () => {
    const a = computeWeeklyActuals({ version: 2, referralCalls: 10, serviceCalls: 4 });
    expect(a.callsMade).toBe(10); // serviceCalls excluded; only referralCalls counted
  });
  it('maps contacts→qualifiedApproaches, FFI→ffiConducted, CI→ciConducted, apps→newBusiness.apps', () => {
    const a = computeWeeklyActuals(v2Submission());
    expect(a.telContacts).toBe(40);
    expect(a.factFindsCompleted).toBe(8);
    expect(a.closingInterviewsKept).toBe(5);
    expect(a.applicationsSubmitted).toBe(3); // v2 nested newBusiness.apps via extractFields
  });
  it('handles a null/empty submission without throwing', () => {
    const a = computeWeeklyActuals(null);
    expect(a).toEqual({
      callsMade: 0, telContacts: 0, factFindsCompleted: 0, closingInterviewsKept: 0, applicationsSubmitted: 0,
    });
  });
});

describe('aggregateDailyActuals — sums daily-sourced metrics, calls is null', () => {
  it('sums telContacts/ffiConducted/ciConducted/newBusiness.apps across docs', () => {
    const docs = [
      { telContacts: 10, ffiConducted: 2, ciConducted: 1, newBusiness: { apps: 1 } },
      { telContacts: 15, ffiConducted: 3, ciConducted: 2, newBusiness: { apps: 0 } },
    ];
    const a = aggregateDailyActuals(docs);
    expect(a.telContacts).toBe(25);
    expect(a.factFindsCompleted).toBe(5);
    expect(a.closingInterviewsKept).toBe(3);
    expect(a.applicationsSubmitted).toBe(1);
  });
  it('callsMade is null (Daily Capture has no calls source)', () => {
    expect(aggregateDailyActuals([{ qualifiedApproaches: 5 }]).callsMade).toBeNull();
  });
  it('empty / non-array input yields zeros and null calls', () => {
    expect(aggregateDailyActuals([])).toEqual({
      callsMade: null, telContacts: 0, factFindsCompleted: 0, closingInterviewsKept: 0, applicationsSubmitted: 0,
    });
    expect(aggregateDailyActuals(undefined).telContacts).toBe(0);
  });
  it('tolerates docs missing newBusiness', () => {
    expect(aggregateDailyActuals([{ qualifiedApproaches: 4 }]).applicationsSubmitted).toBe(0);
  });
});

describe('varianceState — Ahead / On-track / Behind at the 90%-of-pace boundary', () => {
  // plan 12, daily, elapsed 4 (Thu) → pace = 12·4/6 = 8; 90% of pace = 7.2.
  const base = { plan: 12, elapsed: 4, source: 'daily' };
  it('Ahead when actual ≥ plan', () => {
    expect(varianceState({ ...base, actual: 12 })).toBe('ahead');
    expect(varianceState({ ...base, actual: 13 })).toBe('ahead');
  });
  it('On-track at exactly 90% of pace', () => {
    expect(varianceState({ ...base, actual: 7.2 })).toBe('on-track');
  });
  it('On-track above the threshold, Behind below it', () => {
    expect(varianceState({ ...base, actual: 8 })).toBe('on-track');
    expect(varianceState({ ...base, actual: 7.19 })).toBe('behind');
    expect(varianceState({ ...base, actual: 6 })).toBe('behind'); // annotation FFI example
  });
  it('plan of 0 is never Behind', () => {
    expect(varianceState({ plan: 0, actual: 0, elapsed: 4, source: 'daily' })).toBe('ahead');
    expect(varianceState({ plan: 0, actual: 3, elapsed: 4, source: 'daily' })).toBe('ahead');
  });
});

describe('varianceState — Day-1 suppression (mid-week only)', () => {
  it('no Behind on the 1st working day (Monday, elapsed 1)', () => {
    // pace = 12·1/6 = 2; 90% = 1.8; actual 0 < 1.8 would be Behind but is suppressed.
    expect(varianceState({ plan: 12, actual: 0, elapsed: 1, source: 'daily' })).toBe('on-track');
  });
  it('Behind allowed from the 2nd working day (Tuesday, elapsed 2)', () => {
    // pace = 12·2/6 = 4; 90% = 3.6; actual 0 < 3.6 → Behind.
    expect(varianceState({ plan: 12, actual: 0, elapsed: 2, source: 'daily' })).toBe('behind');
  });
  it('suppression does not apply to a final source (whole week, nothing to suppress)', () => {
    // final → pace = plan = 12; actual 0 < 10.8 → Behind regardless of elapsed.
    expect(varianceState({ plan: 12, actual: 0, elapsed: 1, source: 'final' })).toBe('behind');
  });
});

describe('varianceState — final source measures against the full plan (pace = plan)', () => {
  it('Ahead when actual ≥ the whole-week plan', () => {
    expect(varianceState({ plan: 6, actual: 6, elapsed: 6, source: 'final' })).toBe('ahead');
  });
  it('On-track at exactly 90% of the full plan (6 × 0.9 = 5.4)', () => {
    expect(varianceState({ plan: 6, actual: 5.4, elapsed: 6, source: 'final' })).toBe('on-track');
  });
  it('Behind below 90% of the full plan', () => {
    expect(varianceState({ plan: 6, actual: 5, elapsed: 6, source: 'final' })).toBe('behind');
  });
});

describe('buildPaceRows — source switch + provenance chip', () => {
  it('returns null when there is no committed plan', () => {
    expect(buildPaceRows({ committedPlan: null, weekStart: WEEK_START, todayTT: '2026-06-10' })).toBeNull();
    expect(buildPaceRows({ committedPlan: {}, weekStart: WEEK_START, todayTT: '2026-06-10' })).toBeNull();
  });

  it('final source: a submitted report drives actuals + the "final · submitted" chip', () => {
    const result = buildPaceRows({
      committedPlan: PLAN, weekSubmission: v2Submission(), dailyDocs: [],
      floors: FLOORS, weekStart: WEEK_START, todayTT: '2026-06-10',
    });
    expect(result.source).toBe('final');
    expect(result.chip).toEqual(SOURCE_CHIP.final);
    expect(result.paceFraction).toBe(1);
    const calls = result.rows.find((r) => r.key === 'callsMade');
    expect(calls.actual).toBe(20);          // 4-sum prospecting calls (serviceCalls excluded)
    expect(calls.noDailySource).toBe(false);
    expect(calls.showPace).toBe(false);     // no live pace marker on a final report
  });

  it('daily source: no submission → daily aggregate + "mid-week · daily capture" chip', () => {
    const result = buildPaceRows({
      committedPlan: PLAN, weekSubmission: null,
      dailyDocs: [{ telContacts: 20, ffiConducted: 6, ciConducted: 5, newBusiness: { apps: 2 } }],
      floors: FLOORS, weekStart: WEEK_START, todayTT: '2026-06-11', // Thu → elapsed 4
    });
    expect(result.source).toBe('daily');
    expect(result.chip).toEqual(SOURCE_CHIP.daily);
    expect(result.elapsed).toBe(4);
    expect(result.paceFraction).toBeCloseTo(4 / 6, 5);
  });
});

describe('buildPaceRows — no-daily-source (hatched calls) state', () => {
  const result = buildPaceRows({
    committedPlan: PLAN, weekSubmission: null,
    dailyDocs: [{ telContacts: 20, ffiConducted: 6, ciConducted: 5, newBusiness: { apps: 2 } }],
    floors: FLOORS, weekStart: WEEK_START, todayTT: '2026-06-11',
  });
  it('callsMade mid-week is hatched: null actual, null variance, no pace marker', () => {
    const calls = result.rows.find((r) => r.key === 'callsMade');
    expect(calls.noDailySource).toBe(true);
    expect(calls.actual).toBeNull();
    expect(calls.variance).toBeNull();
    expect(calls.showPace).toBe(false);
    expect(calls.fillPct).toBe(0);
  });
  it('telContacts mid-week resolves from the daily aggregate (telContacts real field)', () => {
    const contacts = result.rows.find((r) => r.key === 'telContacts');
    expect(contacts.noDailySource).toBe(false);
    expect(contacts.actual).toBe(20);
    expect(contacts.showPace).toBe(true);
  });
});

describe('buildPaceRows — track render percentages', () => {
  // Thu (elapsed 4) mid-week, daily aggregate matching the annotation worked example.
  const result = buildPaceRows({
    committedPlan: PLAN, weekSubmission: null,
    dailyDocs: [{ telContacts: 40, ffiConducted: 6, ciConducted: 5, newBusiness: { apps: 2 } }],
    floors: FLOORS, weekStart: WEEK_START, todayTT: '2026-06-11',
  });
  const row = (k) => result.rows.find((r) => r.key === k);

  it('fill clamps actual to the plan-cap scale (apps 2/2 → 100%, FFI 6/12 → 50%)', () => {
    expect(row('applicationsSubmitted').fillPct).toBe(100);
    expect(row('factFindsCompleted').fillPct).toBe(50);
    expect(row('closingInterviewsKept').fillPct).toBeCloseTo((5 / 6) * 100, 5);
  });
  it('pace marker sits at elapsed ÷ 6 of the plan scale (Thu → 66.7%)', () => {
    expect(row('factFindsCompleted').pacePct).toBeCloseTo((4 / 6) * 100, 5);
  });
  it('variance states match the annotation example (apps ahead, FFI behind, CI on-track)', () => {
    expect(row('applicationsSubmitted').variance).toBe('ahead');
    expect(row('factFindsCompleted').variance).toBe('behind');   // 6 vs pace 8, 90%=7.2
    expect(row('closingInterviewsKept').variance).toBe('on-track'); // 5 vs pace 4 → ≥90%
  });
});

describe('buildPaceRows — floor-above-plan renders clamped, no special state', () => {
  const result = buildPaceRows({
    committedPlan: PLAN, weekSubmission: null,
    dailyDocs: [], floors: FLOORS, weekStart: WEEK_START, todayTT: '2026-06-11',
  });
  const row = (k) => result.rows.find((r) => r.key === k);

  it('floor below plan renders proportionally (apps floor 1 / plan 2 → 50%)', () => {
    expect(row('applicationsSubmitted').floorPct).toBe(50);
  });
  it('floor below plan renders proportionally (FFI floor 10 / plan 12 → 83.3%)', () => {
    expect(row('factFindsCompleted').floorPct).toBeCloseTo((10 / 12) * 100, 5);
  });
  it('floor at or above plan clamps to the cap (CIs floor 10 / plan 6 → 100%)', () => {
    expect(row('closingInterviewsKept').floorPct).toBe(100);
    expect(row('telContacts').floorPct).toBe(100); // floor 40 / plan 40 → 100%
  });
  it('carries plan, floor and provenance through for each row', () => {
    expect(row('callsMade').plan).toBe(50);
    expect(row('callsMade').floor).toBe(60);
    expect(row('callsMade').provenance).toBe('agent');
    expect(row('closingInterviewsKept').provenance).toBe('derived');
  });
});
