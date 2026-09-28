import { describe, it, expect } from 'vitest';
import {
  focusCalls, paperwork, funnel, board, yearActuals, numbersTiles, daysBetween, activityMeta, FUNNEL_KEYS,
} from '../workModel';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../utils/weeklyActivityFloors';
import { PIPELINE_STAGES } from '../../policyLedgerDerivation';

describe('focusCalls', () => {
  const PROSPECTS = [
    { id: 'p1', clientName: '[Client A]', phone: '+1 (868) 555-0101' },
    { id: 'p2', clientName: '[Client B]' }, // no phone on file
  ];
  const APPTS = [
    { id: 'a3', type: 'AI', prospectId: 'p2', startTime: '11:00', status: 'scheduled' },
    { id: 'a1', type: 'PC', startTime: '09:00', durationMin: 60, status: 'scheduled' }, // capacity block
    { id: 'a2', type: 'SC', prospectId: 'p1', startTime: '10:00', status: 'kept' },
    { id: 'a4', type: 'FFI', prospectId: 'p1', startTime: '14:00', status: 'cancelled' },
    { id: 'a5', type: 'MTG', startTime: '08:00', status: 'scheduled' }, // meeting, no prospect: not a call block
  ];

  it('a call block is capacity (listed, never counted); a call is a prospect item with a tel: link', () => {
    const f = focusCalls({ appointments: APPTS, prospects: PROSPECTS, dailyEntry: null });
    expect(f.blocks.map((b) => b.id)).toEqual(['a1']);
    expect(f.calls.map((c) => c.id)).toEqual(['a2', 'a3']); // time order; cancelled dropped
    expect(f.calls[0].tel).toBe('tel:+18685550101');
    expect(f.calls[0].done).toBe(true);
    expect(f.calls[1].tel).toBeNull();
  });

  it('counts come only from the daily entry; no entry = unknown, never 0', () => {
    expect(focusCalls({ appointments: APPTS, prospects: PROSPECTS, dailyEntry: null }).counts).toEqual({ dials: null, contacts: null });
    const f = focusCalls({ appointments: APPTS, prospects: PROSPECTS, dailyEntry: { dials: 12, telContacts: 4 } });
    expect(f.counts).toEqual({ dials: 12, contacts: 4 });
    expect(f.logged).toBe(true);
  });

  it('an unknown activity code throws in development (v3 rule 11)', () => {
    expect(() => focusCalls({ appointments: [{ id: 'x', type: 'NOPE', startTime: '09:00' }] })).toThrow(/unknown activity code/);
    expect(activityMeta('PC').family).toBe('call');
  });
});

describe('paperwork', () => {
  const P = [
    { id: '1', status: 'submitted', dateSubmitted: '2026-09-01', proposedAPI: 5000, ownerName: '[A]' },
    { id: '2', status: 'written', dateWritten: '2026-09-15', proposedAPI: 3000 },
    { id: '3', status: 'settled', dateSubmitted: '2026-08-01' },
    { id: '4', status: 'rated', dateSubmitted: '2026-08-20' },
    { id: '5', status: 'postponed', dateWritten: '2026-07-30' },
    { id: '6', status: 'submitted', dateSubmitted: '2026-09-10', replacedBy: 'x' },
  ];
  it('in-pipeline only, oldest first, with age in days', () => {
    const rows = paperwork({ policies: P, todayTT: '2026-09-20' });
    expect(rows.map((r) => [r.id, r.ageDays])).toEqual([['5', 52], ['4', 31], ['1', 19], ['2', 5]]);
  });
});

describe('funnel', () => {
  const floors = { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS };
  it('count, conversion from the stage before, target and shortfall', () => {
    const f = funnel({ values: { callsMade: 50, telContacts: 20, appointmentsScheduled: 10, factFindsCompleted: 5, closingInterviewsKept: 4, applicationsSubmitted: 1, clientsSold: 1 }, floors, weeks: 1 });
    expect(f.map((s) => s.key)).toEqual([...FUNNEL_KEYS]);
    expect(f[0]).toMatchObject({ count: 50, target: 60, short: 10, conversion: null });
    expect(f[1]).toMatchObject({ count: 20, conversion: 40 });
    expect(f[6]).toMatchObject({ count: 1, short: 0, conversion: 100 });
  });

  it('an unknown stage is null and breaks the chain on both sides — never a fake 0 %', () => {
    const f = funnel({ values: { callsMade: null, telContacts: 20, appointmentsScheduled: 10 }, floors });
    expect(f[0]).toMatchObject({ count: null, short: null });
    expect(f[1].conversion).toBeNull();
    expect(f[2].conversion).toBe(50);
  });

  it('targets scale with the weeks in the period', () => {
    expect(funnel({ values: { callsMade: 0 }, floors, weeks: 13 })[0].target).toBe(780);
  });
});

describe('yearActuals / numbersTiles', () => {
  const sub = (weekStarting, over = {}) => ({
    status: 'submitted', weekStarting, version: 2,
    telContacts: 20, ffiConducted: 4, ciConducted: 2, applicationsSold: 1, livesSold: 1, appointmentsSet: 8,
    referralCalls: 10, followUpCalls: 10, coldCalls: 10, seminarTradeshowCalls: 10, ...over,
  });
  const SUBS = [sub('2026-09-06'), sub('2026-09-13'), sub('2025-12-28'), { ...sub('2026-09-20'), status: 'draft' }];

  it('sums only this year’s SUBMITTED reports', () => {
    const y = yearActuals(SUBS, 2026);
    expect(y.weeks).toBe(2);
    expect(y.values.telContacts).toBe(40);
    expect(y.values.factFindsCompleted).toBe(8);
  });

  it('monotonic: another submitted week never lowers a year total', () => {
    const a = yearActuals(SUBS, 2026).values;
    const b = yearActuals([...SUBS, sub('2026-09-27')], 2026).values;
    for (const k of FUNNEL_KEYS) expect(b[k]).toBeGreaterThanOrEqual(a[k]);
  });

  it('ratios are null (not 0 %) with no denominator', () => {
    const t = numbersTiles({ submissions: [], year: 2026 });
    expect(t.find((x) => x.id === 'weeks').value).toBe(0);
    expect(t.filter((x) => x.unit === 'pct').every((x) => x.value === null)).toBe(true);
  });
});

describe('board', () => {
  it('every policy lands in exactly one ledger stage; API per column; oldest first', () => {
    const P = [
      { id: '1', status: 'submitted', proposedAPI: 1000, dateSubmitted: '2026-09-01' },
      { id: '2', status: 'submitted', proposedAPI: 2000, dateSubmitted: '2026-08-01' },
      { id: '3', status: 'settled', proposedAPI: 5000, dateIssued: '2026-07-01' },
      { id: '4', status: 'lapsed', proposedAPI: 700 },
      { id: '5', status: 'postponed', proposedAPI: 300, dateSubmitted: '2026-09-10' },
    ];
    const cols = board({ policies: P, todayTT: '2026-09-20' });
    expect(cols.map((c) => c.key)).toEqual(PIPELINE_STAGES.map((s) => s.key));
    const sub = cols.find((c) => c.key === 'submitted');
    expect(sub.cards.map((c) => c.id)).toEqual(['2', '1', '5']);
    expect(sub.api).toBe(3300);
    expect(cols.reduce((n, c) => n + c.cards.length, 0)).toBe(P.length);
  });
});

describe('daysBetween', () => {
  it('whole days, null for junk', () => {
    expect(daysBetween('2026-09-01', '2026-09-20')).toBe(19);
    expect(daysBetween(null, '2026-09-20')).toBeNull();
  });
});
