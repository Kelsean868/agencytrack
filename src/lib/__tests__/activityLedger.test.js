/**
 * activityLedger — the monotonicity property, plus the fixtures that pin the two
 * bugs it exists to prevent.
 *
 * The invariant, stated as a promise to the agent in 04-DECISIONS.md §12:
 *   "Working the dialer can only ever raise the number."
 *
 *   for any state S and any new record r:   f(S + r) >= f(S)
 *
 * It is a PROPERTY, not a handful of examples, because it was violated twice in
 * the source build and both times the failure surfaced to a manager as an
 * accusation about a named agent. Examples did not catch it; the generators
 * below do, because the per-day scoping bug only appears when a block has
 * `dials` AND an itemised call inside its window.
 *
 * BUDGET: numRuns is pinned at 200 with a fixed seed. This suite adds the
 * heaviest CPU work in the repo, CI here flakes under contention at roughly one
 * episode in two, and an unbounded property run would turn the one gate that
 * proves an invariant into noise. See the wall-clock note in the PR body.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  pcBreakdown, loggedFor, declaredFor, weekTotals,
  LEDGER_ROW_KEYS, ROW_CALLS,
} from '../activityLedger';
import { CALL_ATTRIBUTED_CODES, COUNTED_LIVE_CODES } from '../../constants/activityMetadata';

const SEED = 20260730;
const NUM_RUNS = 200;

// A Sunday-anchored week: 2026-07-26 (Sun) .. 2026-08-01 (Sat).
const WEEK = ['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29',
  '2026-07-30', '2026-07-31', '2026-08-01'];
const ANCHOR = '2026-07-29'; // a Wednesday inside it

// ── Generators ───────────────────────────────────────────────────────────────
// Deliberately produce: overlapping blocks, blocks with and without `dials`,
// calls inside and outside every window, cancelled/postponed blocks, empty days.

const dayArb = fc.constantFrom(...WEEK);
const statusArb = fc.constantFrom(
  'scheduled', 'confirmed', 'kept', 'done', 'postponed', 'cancelled',
);
const typeArb = fc.constantFrom(...COUNTED_LIVE_CODES);

const rawBlockArb = fc.record({
  date: dayArb,
  type: typeArb,
  startHour: fc.integer({ min: 8, max: 18 }),
  span: fc.integer({ min: 1, max: 4 }),          // overlaps are common by design
  dials: fc.option(fc.integer({ min: 0, max: 12 }), { nil: undefined }),
  status: statusArb,
});

const rawCallArb = fc.record({
  date: dayArb,
  atHour: fc.integer({ min: 7, max: 21 }),        // some fall outside every block
});

/** Ids are assigned by index so every record is distinguishable when claimed. */
const stateArb = fc.record({
  events: fc.array(rawBlockArb, { maxLength: 8 }),
  calls: fc.array(rawCallArb, { maxLength: 10 }),
}).map(({ events, calls }) => ({
  events: events.map((e, i) => ({
    id: `e${i}`, date: e.date, type: e.type, status: e.status,
    startHour: e.startHour, endHour: e.startHour + e.span, dials: e.dials,
  })),
  calls: calls.map((c, i) => ({ id: `c${i}`, date: c.date, atHour: c.atHour })),
  declared: {},
}));

const addCall = (state, raw) => ({
  ...state,
  calls: [...state.calls, { id: `c${state.calls.length}`, date: raw.date, atHour: raw.atHour }],
});

const addBlock = (state, raw) => ({
  ...state,
  events: [...state.events, {
    id: `e${state.events.length}`, date: raw.date, type: raw.type, status: raw.status,
    startHour: raw.startHour, endHour: raw.startHour + raw.span, dials: raw.dials,
  }],
});

const runCfg = { numRuns: NUM_RUNS, seed: SEED };

// ── The property ─────────────────────────────────────────────────────────────

describe('monotonicity — f(S + r) >= f(S)', () => {
  it('pcBreakdown().total never decreases when a CALL is logged', () => {
    fc.assert(fc.property(stateArb, rawCallArb, dayArb, (state, call, day) => {
      const before = pcBreakdown(state, day).total;
      const after = pcBreakdown(addCall(state, call), day).total;
      expect(after).toBeGreaterThanOrEqual(before);
    }), runCfg);
  });

  // The subtler direction: a new block can RE-CLAIM calls an existing block or
  // the ad-hoc bucket already held. Re-attribution must never lose a call.
  it('pcBreakdown().total never decreases when a BLOCK is added', () => {
    fc.assert(fc.property(stateArb, rawBlockArb, dayArb, (state, block, day) => {
      const before = pcBreakdown(state, day).total;
      const after = pcBreakdown(addBlock(state, block), day).total;
      expect(after).toBeGreaterThanOrEqual(before);
    }), runCfg);
  });

  it('EVERY weekTotals row never decreases when a call is logged', () => {
    fc.assert(fc.property(stateArb, rawCallArb, (state, call) => {
      const before = weekTotals(state, ANCHOR).rows;
      const after = weekTotals(addCall(state, call), ANCHOR).rows;
      after.forEach((row, i) => {
        expect(row.key).toBe(before[i].key);
        expect(row.evidenced).toBeGreaterThanOrEqual(before[i].evidenced);
      });
    }), runCfg);
  });

  it('EVERY weekTotals row never decreases when a block is added', () => {
    fc.assert(fc.property(stateArb, rawBlockArb, (state, block) => {
      const before = weekTotals(state, ANCHOR).rows;
      const after = weekTotals(addBlock(state, block), ANCHOR).rows;
      after.forEach((row, i) => {
        expect(row.key).toBe(before[i].key);
        expect(row.evidenced).toBeGreaterThanOrEqual(before[i].evidenced);
      });
    }), runCfg);
  });

  // Total >= number of calls, always: every call is either claimed by a block
  // (which contributes at least its claimed count) or counted ad-hoc.
  it('no call is ever lost — total >= the day\'s call count', () => {
    fc.assert(fc.property(stateArb, dayArb, (state, day) => {
      const calls = state.calls.filter((c) => c.date === day).length;
      expect(pcBreakdown(state, day).total).toBeGreaterThanOrEqual(calls);
    }), runCfg);
  });
});

// ── The verified sequence from the source build ──────────────────────────────

describe('the 8 → 9 → 10 fixture', () => {
  const block = {
    id: 'b1', date: ANCHOR, type: 'PC', status: 'kept',
    startHour: 9, endHour: 11, dials: 8,
  };
  const base = { events: [block], calls: [], declared: {} };

  it('a PC block with dials: 8 and no ad-hoc calls totals 8', () => {
    expect(pcBreakdown(base, ANCHOR)).toMatchObject({ inBlocks: 8, adhoc: 0, total: 8 });
  });

  it('+ one ad-hoc call → 9', () => {
    const s = { ...base, calls: [{ id: 'c1', date: ANCHOR, atHour: 14 }] };
    expect(pcBreakdown(s, ANCHOR)).toMatchObject({ inBlocks: 8, adhoc: 1, total: 9 });
  });

  it('+ a second ad-hoc call → 10, composed "8 in blocks + 2 ad-hoc"', () => {
    const s = {
      ...base,
      calls: [
        { id: 'c1', date: ANCHOR, atHour: 14 },
        { id: 'c2', date: ANCHOR, atHour: 15 },
      ],
    };
    const r = pcBreakdown(s, ANCHOR);
    expect(r).toMatchObject({ inBlocks: 8, adhoc: 2, total: 10 });
    expect(`${r.inBlocks} in blocks + ${r.adhoc} ad-hoc`).toBe('8 in blocks + 2 ad-hoc');
  });
});

// ── Direct regressions for the two bugs ──────────────────────────────────────

describe('regression — the per-day scoping bug', () => {
  it('an itemised call INSIDE a dials:8 window leaves the total at 8, never 1', () => {
    const s = {
      events: [{
        id: 'b1', date: ANCHOR, type: 'PC', status: 'kept',
        startHour: 9, endHour: 11, dials: 8,
      }],
      calls: [{ id: 'c1', date: ANCHOR, atHour: 10 }], // inside the window
      declared: {},
    };
    const r = pcBreakdown(s, ANCHOR);
    expect(r.total).toBe(8);       // max(8 dials, 1 itemised) — not 8 + 1
    expect(r.total).not.toBe(1);   // the bug: per-day scoping collapsed it to 1
    expect(r.adhoc).toBe(0);       // the call was claimed, not double-counted
  });

  it('logging that call did not LOWER the total (the accusation-generating bug)', () => {
    const before = {
      events: [{
        id: 'b1', date: ANCHOR, type: 'PC', status: 'kept',
        startHour: 9, endHour: 11, dials: 8,
      }],
      calls: [], declared: {},
    };
    const after = { ...before, calls: [{ id: 'c1', date: ANCHOR, atHour: 10 }] };
    expect(pcBreakdown(after, ANCHOR).total)
      .toBeGreaterThanOrEqual(pcBreakdown(before, ANCHOR).total);
  });
});

describe('regression — overlapping blocks claim a call exactly once', () => {
  it('a call inside TWO overlapping call blocks is not double-counted', () => {
    const s = {
      events: [
        { id: 'b1', date: ANCHOR, type: 'PC', status: 'kept', startHour: 9, endHour: 12, dials: 0 },
        { id: 'b2', date: ANCHOR, type: 'SC', status: 'kept', startHour: 10, endHour: 13, dials: 0 },
      ],
      calls: [{ id: 'c1', date: ANCHOR, atHour: 11 }], // inside BOTH windows
      declared: {},
    };
    const r = pcBreakdown(s, ANCHOR);
    // b1 (earlier start) claims it; b2 sees it already claimed and contributes 0.
    expect(r.inBlocks).toBe(1);
    expect(r.adhoc).toBe(0);
    expect(r.total).toBe(1);       // the prototype's bug produced 2
  });

  it('claiming is deterministic under input reordering', () => {
    const blocks = [
      { id: 'b1', date: ANCHOR, type: 'PC', status: 'kept', startHour: 9, endHour: 12, dials: 3 },
      { id: 'b2', date: ANCHOR, type: 'SC', status: 'kept', startHour: 10, endHour: 13, dials: 0 },
    ];
    const calls = [{ id: 'c1', date: ANCHOR, atHour: 11 }];
    const forward = pcBreakdown({ events: blocks, calls, declared: {} }, ANCHOR);
    const reversed = pcBreakdown({ events: [...blocks].reverse(), calls, declared: {} }, ANCHOR);
    expect(reversed).toEqual(forward);
  });
});

// ── Shape contracts ──────────────────────────────────────────────────────────

describe('evidenced and declared are never blended', () => {
  it('no row exposes a combined total — a consumer must add the two itself', () => {
    const s = {
      events: [{ id: 'b1', date: ANCHOR, type: 'FFI', status: 'kept', startHour: 9, endHour: 10 }],
      calls: [],
      declared: { [ANCHOR]: { FFI: 4 } },
    };
    const row = weekTotals(s, ANCHOR).rows.find((r) => r.key === 'FFI');
    expect(row.evidenced).toBe(1);
    expect(row.declared).toBe(4);
    expect(row).not.toHaveProperty('total');
    expect(row.evidencedPct).toBe(20); // 1 of 5, always visible
  });

  it('evidencedPct is null rather than a confident 0% when there is nothing', () => {
    const row = weekTotals({ events: [], calls: [], declared: {} }, ANCHOR).rows[0];
    expect(row.evidencedPct).toBeNull();
  });
});

describe('row set', () => {
  it('pools the call-attributed codes into one CALLS row and keeps the rest', () => {
    expect(LEDGER_ROW_KEYS[0]).toBe(ROW_CALLS);
    expect([...CALL_ATTRIBUTED_CODES].sort()).toEqual(['PC', 'SC']);
    expect(LEDGER_ROW_KEYS).toEqual([ROW_CALLS, 'AI', 'FFI', 'CI', 'SALE', 'SEM', 'TRADE']);
    // Neither member code appears as a row of its own — see the untyped-call note.
    expect(LEDGER_ROW_KEYS).not.toContain('PC');
    expect(LEDGER_ROW_KEYS).not.toContain('SC');
  });

  it('the CALLS row states what it was derived from', () => {
    const s = {
      events: [{
        id: 'b1', date: ANCHOR, type: 'PC', status: 'kept',
        startHour: 9, endHour: 11, dials: 8,
      }],
      calls: [{ id: 'c1', date: ANCHOR, atHour: 15 }],
      declared: {},
    };
    const row = weekTotals(s, ANCHOR).rows.find((r) => r.key === ROW_CALLS);
    expect(row).toMatchObject({ evidenced: 9, inBlocks: 8, adhoc: 1 });
    expect([...row.memberCodes].sort()).toEqual(['PC', 'SC']);
  });
});

describe('the week is all seven days', () => {
  it('covers Sunday through Saturday, with no excluded day', () => {
    const { weekStart, days } = weekTotals({ events: [], calls: [], declared: {} }, ANCHOR);
    expect(weekStart).toBe('2026-07-26');
    expect(days).toEqual(WEEK);
    expect(days).toHaveLength(7);
  });

  it('credits work done on a SATURDAY — the prototype excluded it', () => {
    const saturday = '2026-08-01';
    const s = {
      events: [{ id: 'b1', date: saturday, type: 'CI', status: 'kept', startHour: 9, endHour: 10 }],
      calls: [], declared: {},
    };
    const row = weekTotals(s, ANCHOR).rows.find((r) => r.key === 'CI');
    expect(row.evidenced).toBe(1);
  });
});

describe('only evidenced work counts', () => {
  it.each(['cancelled', 'postponed', 'scheduled', 'confirmed'])(
    'a %s block contributes nothing', (status) => {
      const s = {
        events: [{ id: 'b1', date: ANCHOR, type: 'FFI', status, startHour: 9, endHour: 10 }],
        calls: [], declared: {},
      };
      expect(loggedFor(s, ANCHOR).FFI).toBe(0);
    },
  );

  it.each(['kept', 'done'])('a %s block counts once', (status) => {
    const s = {
      events: [{ id: 'b1', date: ANCHOR, type: 'FFI', status, startHour: 9, endHour: 10 }],
      calls: [], declared: {},
    };
    expect(loggedFor(s, ANCHOR).FFI).toBe(1);
  });
});

describe('declaredFor is a pure read over a plain object', () => {
  it('takes a plain object and returns a plain object', () => {
    const out = declaredFor({ declared: { [ANCHOR]: { FFI: 3, CI: 2 } } }, ANCHOR);
    expect(out.FFI).toBe(3);
    expect(out.CI).toBe(2);
    expect(Object.keys(out).sort()).toEqual([...LEDGER_ROW_KEYS].sort());
  });

  it('is total on absent / malformed input rather than throwing', () => {
    expect(declaredFor({}, ANCHOR).FFI).toBe(0);
    expect(declaredFor(undefined, ANCHOR).FFI).toBe(0);
    expect(declaredFor({ declared: { [ANCHOR]: { FFI: 'x', CI: -4 } } }, ANCHOR).FFI).toBe(0);
  });
});
