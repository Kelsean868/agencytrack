/**
 * callRecord — the properties. THIS IS THE DELIVERABLE, not the shape.
 *
 * Four of the five properties below restate promises the ledger already makes;
 * the second one is new, and it is the whole reason P0-G exists. Under a
 * Teams-Phone-style source a verification lands hours after the call, so a past
 * day's evidenced contact count must be able to rise — and every other count
 * must be unable to fall while it does.
 *
 * BUDGET: numRuns pinned at 200 with a fixed seed, the same discipline as
 * `src/lib/__tests__/activityLedger.test.js`. These generators are much cheaper
 * than the ledger's (no block-attribution pass), and the measured wall-clock
 * added is recorded in the PR body.
 *
 * MUTATION-VERIFIED: the verification-monotonicity property was broken
 * deliberately (making `applyVerification` replace an existing verification
 * rather than returning the call unchanged) and the shrunk counterexample is
 * pasted in the PR body. A property that has never failed may not be wired to
 * anything.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  CALL_DISPOSITIONS,
  DISPOSITION_KEYS,
  REACHED_DISPOSITIONS,
  VERIFICATION_AGREEMENT,
  CALL_COUNT_KEYS,
  isKnownDisposition,
  dispositionReached,
  newCall,
  applyVerification,
  callCountsOn,
} from '../callRecord';
import { pcBreakdown } from '../../activityLedger';

const SEED = 20260812;
const NUM_RUNS = 200;
const runCfg = { numRuns: NUM_RUNS, seed: SEED };

// The same Sunday-anchored week the ledger suite uses, so a reader comparing the
// two is not also reconciling two calendars.
const WEEK = ['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29',
  '2026-07-30', '2026-07-31', '2026-08-01'];
const ANCHOR = '2026-07-29';

// ── Generators ───────────────────────────────────────────────────────────────

const dayArb = fc.constantFrom(...WEEK);

/**
 * Every disposition, plus the two abstention shapes: absent, and a value the
 * table does not know. Both must read as "no claim", never as "not reached" —
 * an un-dispositioned call is not evidence that nobody answered.
 */
const dispositionArb = fc.oneof(
  fc.constantFrom(...DISPOSITION_KEYS),
  fc.constant(null),
  fc.constant('sent_a_pigeon'),
);

const verificationArb = fc.record({
  source: fc.constantFrom('msgraph', 'manual', 'pbx'),
  reached: fc.oneof(fc.boolean(), fc.constant(null)),
  connectedSeconds: fc.oneof(fc.integer({ min: 0, max: 900 }), fc.constant(null)),
  direction: fc.constantFrom('outbound', 'inbound'),
});

const rawCallArb = fc.record({
  date: dayArb,
  atHour: fc.integer({ min: 7, max: 21 }),
  disposition: dispositionArb,
});

/**
 * A state whose calls are a MIX of unverified, verified-agreeing,
 * verified-contradicting and verified-undetermined — the population the counts
 * have to survive. `fc.option` on the verification is what leaves some bare.
 */
const stateArb = fc.array(
  fc.record({ raw: rawCallArb, ver: fc.option(verificationArb, { nil: undefined }) }),
  { maxLength: 12 },
).map((entries) => ({
  calls: entries.map(({ raw, ver }, i) => {
    const call = newCall({ id: `c${i}`, date: raw.date, atHour: raw.atHour, disposition: raw.disposition });
    return ver ? applyVerification(call, ver) : call;
  }),
}));

/**
 * A DENSE single-day generator, and the reason it exists is measured, not
 * decorative.
 *
 * `stateArb` above spreads calls over 7 days and draws dispositions uniformly
 * from 8 outcomes, only 3 of which are "reached". Sampling ONE day on top of
 * that dilutes the case these properties most need — a reached disposition and
 * an agreeing verification on the SAME call on the day being counted — to
 * roughly one run in ninety. Measured: with `declaredContacts` mutated to the
 * disjoint-lane form (`declared && !evidenced`, the design alternative this
 * module rejects), the verification-monotonicity property still PASSED on
 * `stateArb` alone at numRuns 200. Too wide fails to reach the bug just as
 * surely as too narrow does — the same lesson `activityLedger.test.js` banked.
 *
 * So this generator pins every call to one day and weights dispositions 3:1
 * toward reached. The properties below also assert across ALL SEVEN days rather
 * than a sampled one, which removes the remaining 1-in-7 dilution outright.
 */
const denseDispositionArb = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...REACHED_DISPOSITIONS) },
  { weight: 1, arbitrary: dispositionArb },
);

const denseStateArb = fc.array(
  fc.record({
    atHour: fc.integer({ min: 9, max: 15 }),
    disposition: denseDispositionArb,
    ver: fc.option(verificationArb, { nil: undefined }),
  }),
  { minLength: 1, maxLength: 8 },
).map((entries) => ({
  calls: entries.map(({ atHour, disposition, ver }, i) => {
    const call = newCall({ id: `c${i}`, date: ANCHOR, atHour, disposition });
    return ver ? applyVerification(call, ver) : call;
  }),
}));

/** Broad coverage AND the dense same-day case. */
const anyStateArb = fc.oneof(stateArb, denseStateArb);

/** Assert a predicate on every day of the week, not a sampled one. */
function forEachDay(fn) {
  for (const day of WEEK) fn(day);
}

const addCall = (state, raw) => ({
  ...state,
  calls: [...state.calls, newCall({
    id: `c${state.calls.length}`, date: raw.date, atHour: raw.atHour, disposition: raw.disposition,
  })],
});

/**
 * Attach a verification to an ARBITRARY call — deliberately including calls that
 * already carry one.
 *
 * Restricting this to unverified calls would be the comfortable choice and it
 * would gut the property: the dangerous case is precisely a SECOND source
 * arriving and overturning the first, which is the only way an evidenced count
 * could fall. `applyVerification`'s add-only rule is what makes that safe, and
 * it is load-bearing here rather than merely example-tested.
 */
function verifyOneCall(state, verification, pick) {
  if (state.calls.length === 0) return state;
  const idx = pick % state.calls.length;
  const calls = [...state.calls];
  calls[idx] = applyVerification(calls[idx], verification);
  return { ...state, calls };
}

// ── 1. Monotonicity under logging ────────────────────────────────────────────

describe('monotonicity under logging — f(S + call) >= f(S)', () => {
  it('no derived count decreases when a call is logged', () => {
    fc.assert(fc.property(anyStateArb, rawCallArb, (state, raw) => {
      const next = addCall(state, raw);
      forEachDay((day) => {
        const before = callCountsOn(state, day);
        const after = callCountsOn(next, day);
        for (const key of CALL_COUNT_KEYS) {
          expect(after[key], `${key} fell on ${day} when a call was logged`)
            .toBeGreaterThanOrEqual(before[key]);
        }
      });
    }), runCfg);
  });
});

// ── 2. Monotonicity under verification — THE NEW ONE ─────────────────────────
//
// Section 3 of the brief: verification arrives late and counts may RISE. The
// failure this guards is the mirror image — a count that FALLS when evidence
// arrives, which would tell a manager an agent did less work than an hour ago.

describe('monotonicity under verification — f(S + verification) >= f(S)', () => {
  it('no derived count decreases when a verification is attached', () => {
    fc.assert(fc.property(anyStateArb, verificationArb, fc.nat(), (state, ver, pick) => {
      const next = verifyOneCall(state, ver, pick);
      forEachDay((day) => {
        const before = callCountsOn(state, day);
        const after = callCountsOn(next, day);
        for (const key of CALL_COUNT_KEYS) {
          expect(after[key], `${key} fell on ${day} when a verification arrived`)
            .toBeGreaterThanOrEqual(before[key]);
        }
      });
    }), runCfg);
  });

  it('evidenced contacts can RISE retroactively — the point of the whole slice', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 10, disposition: 'appointment_set' });
    const before = callCountsOn({ calls: [call] }, ANCHOR);
    expect(before.evidencedContacts).toBe(0);
    expect(before.declaredContacts).toBe(1);

    const verified = applyVerification(call, { source: 'msgraph', reached: true, connectedSeconds: 214, direction: 'outbound' });
    const after = callCountsOn({ calls: [verified] }, ANCHOR);
    expect(after.evidencedContacts).toBe(1);
    // The agent's account is not retracted by a machine agreeing with it.
    expect(after.declaredContacts).toBe(1);
  });
});

// ── 3. Disposition-independence of PC ────────────────────────────────────────
//
// A dial is evidenced by the record itself. `pcBreakdown` must be blind to
// disposition — that blindness is what lets contacts be additive rather than a
// re-opening of the `max(dials, itemised)` arithmetic that took two rounds.

describe('disposition-independence of pcBreakdown', () => {
  const blockArb = fc.record({
    startHour: fc.integer({ min: 9, max: 14 }),
    span: fc.integer({ min: 1, max: 4 }),
    dials: fc.option(fc.integer({ min: 0, max: 6 }), { nil: undefined }),
  });

  it('a call contributes identically under EVERY disposition value', () => {
    fc.assert(fc.property(
      fc.array(blockArb, { maxLength: 4 }),
      fc.array(fc.integer({ min: 8, max: 17 }), { maxLength: 8 }),
      (rawBlocks, hours) => {
        const events = rawBlocks.map((b, i) => ({
          id: `e${i}`, date: ANCHOR, type: 'PC', status: 'kept',
          startHour: b.startHour, endHour: b.startHour + b.span, dials: b.dials,
        }));

        // Baseline: no disposition at all.
        const baseline = pcBreakdown({
          events,
          calls: hours.map((atHour, i) => newCall({ id: `c${i}`, date: ANCHOR, atHour })),
        }, ANCHOR);

        // Every disposition in the table, plus a verified one, must agree with it.
        for (const { key } of CALL_DISPOSITIONS) {
          const calls = hours.map((atHour, i) => applyVerification(
            newCall({ id: `c${i}`, date: ANCHOR, atHour, disposition: key }),
            { source: 'msgraph', reached: true, connectedSeconds: 60, direction: 'outbound' },
          ));
          expect(pcBreakdown({ events, calls }, ANCHOR), `disposition ${key} moved the dials figure`)
            .toEqual(baseline);
        }
      },
    ), runCfg);
  });
});

// ── 4. Contacts never exceed calls ───────────────────────────────────────────

describe('contacts never exceed calls', () => {
  it('every contact figure is bounded by the day\'s call count', () => {
    fc.assert(fc.property(anyStateArb, (state) => {
      forEachDay((day) => {
        const c = callCountsOn(state, day);
        expect(c.declaredContacts).toBeLessThanOrEqual(c.calls);
        expect(c.evidencedContacts).toBeLessThanOrEqual(c.calls);
        expect(c.contestedContacts).toBeLessThanOrEqual(c.calls);
        expect(c.contactsClaimed).toBeLessThanOrEqual(c.calls);
      });
    }), runCfg);
  });
});

// ── 5. Never blended ─────────────────────────────────────────────────────────
//
// Here the no-blend rule is a CORRECTNESS constraint, not only doctrine: the two
// lanes are provenance claims about the same records, not disjoint populations,
// so their sum double-counts every call that is in both. `contactsClaimed` is
// the union, and this proves it is a union rather than a sum by checking it is
// STRICTLY smaller whenever the lanes actually overlap.

describe('evidenced and declared are never blended', () => {
  it('the return shape carries no total, sum or combined field', () => {
    const keys = Object.keys(callCountsOn({ calls: [] }, ANCHOR));
    for (const k of keys) {
      expect(k, `${k} reads as a blended figure`).not.toMatch(/total|sum|combined|overall/i);
    }
    expect(CALL_COUNT_KEYS).not.toContain('total');
  });

  // CALL_COUNT_KEYS is a hand-maintained literal, and the monotonicity
  // properties iterate over it. A count field added to `callCountsOn` but not
  // here would be silently EXEMPT from both — the properties would still pass
  // while no longer covering the new figure. This pins the two together.
  // `pctEvidenced` is the one deliberate exclusion; it is a ratio, not a count.
  it('CALL_COUNT_KEYS covers every count the shape returns', () => {
    const returned = Object.keys(callCountsOn({ calls: [] }, ANCHOR));
    expect([...CALL_COUNT_KEYS].sort())
      .toEqual(returned.filter((k) => k !== 'pctEvidenced').sort());
  });

  it('contactsClaimed is a UNION — never the sum, and strictly less on overlap', () => {
    fc.assert(fc.property(anyStateArb, (state) => {
      forEachDay((day) => {
        const c = callCountsOn(state, day);
        expect(c.contactsClaimed).toBeLessThanOrEqual(c.declaredContacts + c.evidencedContacts);

        const overlap = (state.calls ?? []).filter((call) => (
          call.date === day
          && dispositionReached(call.disposition) === true
          && call.verification?.reached === true
          && call.verification?.agreement !== VERIFICATION_AGREEMENT.CONTRADICTS
        )).length;

        if (overlap > 0) {
          expect(c.contactsClaimed).toBeLessThan(c.declaredContacts + c.evidencedContacts);
        }
      });
    }), runCfg);
  });
});

// ── Purity and the contradiction contract ────────────────────────────────────

describe('applyVerification', () => {
  it('never mutates its input', () => {
    fc.assert(fc.property(rawCallArb, verificationArb, (raw, ver) => {
      const call = Object.freeze(newCall({ id: 'c1', date: raw.date, atHour: raw.atHour, disposition: raw.disposition }));
      const snapshot = JSON.stringify(call);
      const out = applyVerification(call, ver);
      expect(JSON.stringify(call)).toBe(snapshot);
      expect(out).not.toBe(call);
    }), runCfg);
  });

  it('never invents a disposition the agent did not give', () => {
    fc.assert(fc.property(rawCallArb, verificationArb, (raw, ver) => {
      const call = newCall({ id: 'c1', date: raw.date, atHour: raw.atHour, disposition: raw.disposition });
      expect(applyVerification(call, ver).disposition).toBe(call.disposition);
    }), runCfg);
  });

  it('records a contradiction rather than resolving it', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 10, disposition: 'appointment_set' });
    const out = applyVerification(call, { source: 'msgraph', reached: false, connectedSeconds: 4, direction: 'outbound' });

    expect(out.verification.agreement).toBe(VERIFICATION_AGREEMENT.CONTRADICTS);
    // Both claims stay readable; neither wins.
    expect(out.disposition).toBe('appointment_set');
    expect(out.verification.reached).toBe(false);

    const counts = callCountsOn({ calls: [out] }, ANCHOR);
    expect(counts.contestedContacts).toBe(1);
    expect(counts.declaredContacts).toBe(1);   // the agent still said it
    expect(counts.evidencedContacts).toBe(0);  // and it is still not evidence
  });

  it('is ADD-ONLY — a second source never replaces the first', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 10, disposition: 'appointment_set' });
    const first = applyVerification(call, { source: 'msgraph', reached: true, connectedSeconds: 200, direction: 'outbound' });
    const second = applyVerification(first, { source: 'pbx', reached: false, connectedSeconds: 2, direction: 'outbound' });

    expect(second).toBe(first);
    expect(second.verification.source).toBe('msgraph');
  });

  it('reads `reached` from the source, never from connectedSeconds', () => {
    // A voicemail connects and accrues seconds. Duration is not contact.
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 10, disposition: 'left_voicemail' });
    const out = applyVerification(call, { source: 'msgraph', reached: null, connectedSeconds: 45, direction: 'outbound' });

    expect(out.verification.reached).toBeNull();
    expect(out.verification.agreement).toBe(VERIFICATION_AGREEMENT.UNDETERMINED);
    expect(callCountsOn({ calls: [out] }, ANCHOR).evidencedContacts).toBe(0);
  });
});

// ── The vocabulary ───────────────────────────────────────────────────────────

describe('CALL_DISPOSITIONS', () => {
  // Deliberately a PARTITION test, not a second membership pin — the exact
  // values are pinned by the test below, and two tests asserting the same list
  // is one test plus a maintenance cost. What this proves is the structural
  // claim: every key lands in exactly one lane, and neither lane is empty.
  it('separates reached from not-reached, which is the minimum the model needs', () => {
    const reached = DISPOSITION_KEYS.filter((k) => REACHED_DISPOSITIONS.has(k));
    const notReached = DISPOSITION_KEYS.filter((k) => !REACHED_DISPOSITIONS.has(k));

    expect(reached.length).toBeGreaterThan(0);
    expect(notReached.length).toBeGreaterThan(0);
    expect([...reached, ...notReached].sort()).toEqual([...DISPOSITION_KEYS].sort());
    expect(reached.filter((k) => notReached.includes(k))).toEqual([]);

    // And the classifier agrees with the Set, for every key in the table.
    for (const { key, reached: flag } of CALL_DISPOSITIONS) {
      expect(dispositionReached(key), `${key} classified inconsistently`).toBe(flag);
    }
  });

  it('pins the vocabulary the ledger and the actions contract already named', () => {
    expect(DISPOSITION_KEYS).toEqual([
      'appointment_set', 'callback_requested', 'not_interested',
      'left_voicemail', 'no_answer', 'bad_number',
    ]);
    expect([...REACHED_DISPOSITIONS].sort()).toEqual(
      ['appointment_set', 'callback_requested', 'not_interested'],
    );
  });

  it('abstains on an absent or unknown disposition rather than reading it as not-reached', () => {
    expect(dispositionReached(null)).toBeNull();
    expect(dispositionReached(undefined)).toBeNull();
    expect(dispositionReached('sent_a_pigeon')).toBeNull();
    expect(isKnownDisposition('sent_a_pigeon')).toBe(false);
    expect(dispositionReached('no_answer')).toBe(false);
  });
});

describe('newCall', () => {
  it('creates with no verification, and drops an unknown disposition', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 9, disposition: 'sent_a_pigeon' });
    expect(call.verification).toBeNull();
    expect(call.disposition).toBeNull();
  });

  it('carries exactly the three fields the ledger reads, unchanged', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 9, leadId: 'l1', agentId: 'a1' });
    expect(call.id).toBe('c1');
    expect(call.date).toBe(ANCHOR);
    expect(call.atHour).toBe(9);
  });
});
