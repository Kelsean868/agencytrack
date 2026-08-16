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
 * MUTATION-VERIFIED. Both the conservation property and the credit-never-falls
 * property were broken deliberately and the shrunk counterexamples are pasted in
 * the PR body. A property that has never failed may not be wired to anything —
 * and the first mutation attempt on this suite PASSED, which is how the
 * generator weakness documented at `denseStateArb` was found.
 *
 * ── THE PROPERTY SET, AND WHY IT IS SHAPED THIS WAY ─────────────────────────
 * "No derived count ever decreases" was the original ask and it was too strong:
 * it would forbid the transfer that an agreeing verification IS. What agents are
 * owed is that CREDIT never falls, so:
 *
 *   · monotonicity under LOGGING        — every count, no exceptions
 *   · credit under VERIFICATION         — `evidenced` and `total` only
 *   · CONSERVATION under an AGREEING verification — total unchanged, and the
 *     evidenced gain exactly equals the declaredOnly loss
 *
 * The third replaces rather than supplements a direction check on `declaredOnly`
 * and is strictly stronger: it catches double-counting and lane leakage, which a
 * "nothing went down" check passes cleanly.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  CALL_DISPOSITIONS,
  DISPOSITION_KEYS,
  REACHED_DISPOSITIONS,
  VERIFICATION_AGREEMENT,
  CALL_COUNT_KEYS,
  VERIFICATION_MONOTONE_KEYS,
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
 * roughly one run in ninety.
 *
 * Measured, on the shared-lane design this module carried before the lanes were
 * made disjoint: mutating the declared count to `declared && !evidenced` left
 * the monotonicity property PASSING on `stateArb` alone at numRuns 200. (That
 * mutation is now the shipped `declaredOnly` semantics — the finding was about
 * the GENERATOR, and it survives the design change unchanged, which is why this
 * note does.) Too wide fails to reach the bug just as surely as too narrow
 * does — the same lesson `activityLedger.test.js` banked.
 *
 * The current properties are mutation-verified against this generator: see the
 * two counterexamples in the PR body, both found in single figures of runs.
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

// ── 2. Credit never falls under verification ─────────────────────────────────
//
// The guarantee an agent is owed is NOT that every field is monotonic — it is
// that credit never falls when a machine confirms their work. `declaredOnly` is
// deliberately outside this set: an agreeing verification moves a call out of
// that lane, and asserting it never falls would assert the transfer never
// happens. Conservation below covers what this one gives up, and more.

describe('credit never falls when a verification arrives', () => {
  it('evidencedContacts and total never decrease', () => {
    fc.assert(fc.property(anyStateArb, verificationArb, fc.nat(), (state, ver, pick) => {
      const next = verifyOneCall(state, ver, pick);
      forEachDay((day) => {
        const before = callCountsOn(state, day);
        const after = callCountsOn(next, day);
        for (const key of VERIFICATION_MONOTONE_KEYS) {
          expect(after[key], `${key} fell on ${day} when a verification arrived`)
            .toBeGreaterThanOrEqual(before[key]);
        }
      });
    }), runCfg);
  });

  it('evidenced contacts RISE retroactively — the late-arrival case', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 10, disposition: 'appointment_set' });
    const before = callCountsOn({ calls: [call] }, ANCHOR);
    expect(before).toMatchObject({ evidencedContacts: 0, declaredOnlyContacts: 1, total: 1 });

    const verified = applyVerification(call, { source: 'msgraph', reached: true, connectedSeconds: 214, direction: 'outbound' });
    const after = callCountsOn({ calls: [verified] }, ANCHOR);

    // A TRANSFER, not an addition: the lane changed, the credit did not.
    expect(after).toMatchObject({ evidencedContacts: 1, declaredOnlyContacts: 0, total: 1 });
  });
});

// ── 2b. CONSERVATION — an agreeing verification is a TRANSFER ────────────────
//
// This is the property that replaces "nothing went down", and it is strictly
// stronger: a direction-only check passes an implementation that counts the same
// call in both lanes (total would rise, and rising is allowed). Conservation
// fails it immediately, and catches lane leakage in the same assertion.
//
// SCOPED TO AGREEMENT, and the scope is the point. Where a verification
// CONTRADICTS the agent, conservation genuinely does not hold — the machine is
// asserting a contact the agent never claimed. Ranging over that case would
// force the module to pick a winner just to keep the books balanced, i.e. answer
// the open question through a test. So the contradiction case is left to the
// visibility contract below, and is asserted about only there.

describe('conservation — an agreeing verification transfers, never adds', () => {
  /**
   * Build a verification that AGREES with the call's own disposition. Agreement
   * is CONSTRUCTED rather than filtered for: filtering would leave most runs
   * vacuous, which is how a property ends up never exercising its own subject.
   * Returns null when no agreement is possible (no disposition to agree with).
   */
  function agreeingVerificationFor(call) {
    const declared = dispositionReached(call?.disposition);
    if (declared === null) return null;
    return { source: 'msgraph', reached: declared, connectedSeconds: 120, direction: 'outbound' };
  }

  it('total is unchanged, and the evidenced gain equals the declaredOnly loss', () => {
    fc.assert(fc.property(anyStateArb, fc.nat(), (state, pick) => {
      if (state.calls.length === 0) return;
      const idx = pick % state.calls.length;
      const target = state.calls[idx];
      if (target.verification != null) return;      // add-only; nothing moves

      const ver = agreeingVerificationFor(target);
      if (ver === null) return;                     // no claim to agree with

      const calls = [...state.calls];
      calls[idx] = applyVerification(target, ver);
      const next = { ...state, calls };

      // Sanity: the construction really did produce agreement, not a near-miss.
      expect(calls[idx].verification.agreement).toBe(VERIFICATION_AGREEMENT.AGREES);

      forEachDay((day) => {
        const before = callCountsOn(state, day);
        const after = callCountsOn(next, day);

        expect(after.total, `total moved on ${day} under an agreeing verification`)
          .toBe(before.total);

        const gained = after.evidencedContacts - before.evidencedContacts;
        const lost = before.declaredOnlyContacts - after.declaredOnlyContacts;
        expect(gained, `evidenced gain != declaredOnly loss on ${day}`).toBe(lost);
      });
    }), runCfg);
  });

  /**
   * The neutrality half, and it is deliberately NOT the conservation property.
   *
   * Conservation says an agreeing verification MOVES credit. This says a
   * CONTRADICTING one moves NONE — in either direction. That is not answering
   * the open question of which source wins; it is asserting that the question
   * stays open, arithmetically, while `contestedContacts` flags it for a human.
   *
   * It exists because an external reviewer proposed gating both lanes on
   * non-contradiction, which reads tidier and makes `total` fall from 1 to 0 the
   * moment a machine disagrees with an agent. A comment saying "don't" is not a
   * guard; this is.
   */
  it('a CONTRADICTING verification moves no credit — total unchanged both ways', () => {
    fc.assert(fc.property(anyStateArb, fc.nat(), fc.boolean(), (state, pick, machineSays) => {
      if (state.calls.length === 0) return;
      const idx = pick % state.calls.length;
      const target = state.calls[idx];
      if (target.verification != null) return;

      const declared = dispositionReached(target.disposition);
      if (declared === null || declared === machineSays) return;  // need disagreement

      const calls = [...state.calls];
      calls[idx] = applyVerification(target, {
        source: 'msgraph', reached: machineSays, connectedSeconds: 45, direction: 'outbound',
      });
      expect(calls[idx].verification.agreement).toBe(VERIFICATION_AGREEMENT.CONTRADICTS);
      const next = { ...state, calls };

      forEachDay((day) => {
        const before = callCountsOn(state, day);
        const after = callCountsOn(next, day);
        expect(after.total, `total moved on ${day} under a contradiction`).toBe(before.total);
        expect(after.evidencedContacts).toBe(before.evidencedContacts);
        expect(after.declaredOnlyContacts).toBe(before.declaredOnlyContacts);
      });
    }), runCfg);
  });

  it('the lanes partition — total is always exactly their sum', () => {
    fc.assert(fc.property(anyStateArb, (state) => {
      forEachDay((day) => {
        const c = callCountsOn(state, day);
        expect(c.total).toBe(c.evidencedContacts + c.declaredOnlyContacts);
      });
    }), runCfg);
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
        expect(c.evidencedContacts).toBeLessThanOrEqual(c.calls);
        expect(c.declaredOnlyContacts).toBeLessThanOrEqual(c.calls);
        expect(c.contestedContacts).toBeLessThanOrEqual(c.calls);
        // The one that would catch double-counting: the SUM is bounded too.
        expect(c.total).toBeLessThanOrEqual(c.calls);
      });
    }), runCfg);
  });
});

// ── 5. Never blended — the lanes hold disjoint populations ───────────────────
//
// `total` IS emitted, and that is safe only because no call is in both lanes.
// The guard that matters is therefore no longer "there is no sum field" but
// "the sum is over disjoint sets". Counted per call, from the records
// themselves, so an implementation that quietly counted a call in both would
// disagree with this recount even while `total` still equalled its own two
// fields.

describe('the two lanes are disjoint populations', () => {
  it('no call is counted in both lanes — recounted from the records', () => {
    fc.assert(fc.property(anyStateArb, (state) => {
      forEachDay((day) => {
        const onDay = (state.calls ?? []).filter((c) => c.date === day);

        const evidencedIds = onDay.filter((c) => (
          c.verification?.reached === true
          && c.verification?.agreement !== VERIFICATION_AGREEMENT.CONTRADICTS
        )).map((c) => c.id);

        const declaredOnlyIds = onDay.filter((c) => (
          dispositionReached(c.disposition) === true && !evidencedIds.includes(c.id)
        )).map((c) => c.id);

        // AT MOST one lane — never both. A call in NEITHER is legitimate (no
        // source claims a contact for it), so this is not a partition of the
        // day's calls, only a disjointness guarantee over the two lanes.
        expect(evidencedIds.filter((id) => declaredOnlyIds.includes(id)),
          'a call was counted in both lanes').toEqual([]);

        const c = callCountsOn(state, day);
        expect(c.evidencedContacts).toBe(evidencedIds.length);
        expect(c.declaredOnlyContacts).toBe(declaredOnlyIds.length);
        expect(c.total).toBe(new Set([...evidencedIds, ...declaredOnlyIds]).size);
      });
    }), runCfg);
  });

  // CALL_COUNT_KEYS is a hand-maintained literal, and the properties iterate
  // over it (and over VERIFICATION_MONOTONE_KEYS, which derives from it). A
  // count field added to `callCountsOn` but not here would be silently EXEMPT
  // from both — the properties would still pass while no longer covering the new
  // figure. `pctEvidenced` is the one deliberate exclusion: a ratio, not a count.
  it('CALL_COUNT_KEYS covers every count the shape returns', () => {
    const returned = Object.keys(callCountsOn({ calls: [] }, ANCHOR));
    expect([...CALL_COUNT_KEYS].sort())
      .toEqual(returned.filter((k) => k !== 'pctEvidenced').sort());
    expect(VERIFICATION_MONOTONE_KEYS).not.toContain('declaredOnlyContacts');
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

  // The contradiction case is covered by VISIBILITY alone — deliberately. It is
  // outside the conservation property (see §2b) precisely so that no assertion
  // here quietly decides which source wins.
  it('records a contradiction rather than resolving it — agent claimed, machine denies', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 10, disposition: 'appointment_set' });
    const out = applyVerification(call, { source: 'msgraph', reached: false, connectedSeconds: 4, direction: 'outbound' });

    expect(out.verification.agreement).toBe(VERIFICATION_AGREEMENT.CONTRADICTS);
    // Both claims stay readable; neither is deleted.
    expect(out.disposition).toBe('appointment_set');
    expect(out.verification.reached).toBe(false);

    const counts = callCountsOn({ calls: [out] }, ANCHOR);
    expect(counts.contestedContacts).toBe(1);  // flagged for a human
    expect(counts.evidencedContacts).toBe(0);  // the machine did not confirm it
    expect(counts.declaredOnlyContacts).toBe(1); // the agent's claim is not deleted
  });

  // The other direction, which is the one the dispatcher named: the agent
  // recorded no answer and the machine reports connected seconds. The machine is
  // asserting a contact the agent never claimed, so nothing is transferred and
  // nothing is credited — it is surfaced and left for a human.
  it('records a contradiction rather than resolving it — machine claims, agent did not', () => {
    const call = newCall({ id: 'c1', date: ANCHOR, atHour: 10, disposition: 'no_answer' });
    const out = applyVerification(call, { source: 'msgraph', reached: true, connectedSeconds: 45, direction: 'outbound' });

    expect(out.verification.agreement).toBe(VERIFICATION_AGREEMENT.CONTRADICTS);
    expect(out.disposition).toBe('no_answer');
    expect(out.verification.connectedSeconds).toBe(45);

    const counts = callCountsOn({ calls: [out] }, ANCHOR);
    expect(counts.contestedContacts).toBe(1);
    expect(counts.evidencedContacts).toBe(0);
    expect(counts.declaredOnlyContacts).toBe(0);
    // Conservation does NOT apply here, and the total reflects that honestly:
    // no contact is credited to either lane while the two sources disagree.
    expect(counts.total).toBe(0);
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
