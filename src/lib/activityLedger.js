/**
 * activityLedger — the trust surface's entire arithmetic.
 *
 * PURE. No Firestore, no React, no imports from `src/services/` or
 * `src/components/`. Every function takes state as an argument and returns a
 * value, which is what keeps the three unresolved questions in §2 of the P0-B
 * brief open rather than answered by a default here.
 *
 * ── THE INVARIANT ───────────────────────────────────────────────────────────
 * For any state S and any new record r:   f(S + r) >= f(S)
 *
 * "Working the dialer can only ever raise the number" (04-DECISIONS.md §12) is
 * shipped to the agent as a promise, which is why it has a property test rather
 * than a few examples. It was violated twice in the source build, and both times
 * a manager-facing screen made an accusation about a named agent because of a
 * scoping bug.
 *
 * ── CONTAINER vs CONTENTS (the bug that caused both) ────────────────────────
 * A call block is scheduled CAPACITY; a call is the ACTIVITY. Counting one per
 * block into the same total that receives one per call sums a container with its
 * contents — a one-hour block subtitled "8 dials queued" would contribute 1
 * against a floor of 20.
 *
 * The container/contents choice is made PER BLOCK, never per day. Scoping it to
 * the day — "any itemised call disables all block counts" — makes the total go
 * DOWN when an agent logs a call, punishing the exact behaviour the ledger
 * exists to reward. Per block, adding a call can only ever raise the total.
 *
 * ── WHY CALLS ARE POOLED INTO ONE ROW ───────────────────────────────────────
 * A call record carries no type; only blocks do. A call therefore inherits the
 * type of whichever block claims it, so adding a block RE-TYPES existing calls.
 * Any per-type split of an untyped population is non-monotonic under block-adds:
 * book a seen-call block over an existing ad-hoc call and the prospecting-call
 * row would drop. The joint figure is the only stable quantity the data model
 * offers. That is why `weekTotals` emits one `CALLS` row rather than PC and SC
 * rows — see the `ROW_CALLS` contract note.
 *
 * ── EVIDENCED vs DECLARED ───────────────────────────────────────────────────
 * Never blended, and the shape enforces it: there is no field anywhere in this
 * module holding evidenced + declared. If a consumer wants a combined number it
 * must add two labelled fields itself, and then it owns the claim.
 */

import {
  ACTIVITY_METADATA,
  COUNTED_LIVE_CODES,
  CALL_ATTRIBUTED_CODES,
} from '../constants/activityMetadata';
import { isEvidenced } from '../constants/appointmentStatus';
import { buildWeekDates } from './schema/dailyActivity';

/**
 * The key of the pooled call row. Deliberately NOT 'PC'.
 *
 * PC and SC measure DIFFERENT things and feed DIFFERENT company minimums:
 * PC → `dials` → `callsMade`, and SC → `telContacts` → `telContacts`. SC is a
 * "seen call", i.e. a contact MADE (the person was reached) — a historical term
 * from door-to-door selling, and emphatically not a service call. A row labelled
 * prospecting calls that silently contained contacts would misstate both floors
 * at once. An honest joint row makes no false claim; a mislabelled one does.
 *
 * ── PHASE 2.1 WILL ADD `contacts` TO THIS ROW (do not build it here) ─────────
 * Because SC means "contacted", the dials-vs-contacts distinction is a property
 * of the CALL RECORD's disposition, not of the block that claimed it. Contacts
 * are the subset of calls whose disposition indicates the person was reached.
 * That subset is monotonic by construction and CANNOT migrate between rows when
 * a block is added — which is exactly what makes it safe where the block-type
 * split was not (see the header).
 *
 * So 2.1 adds a `contacts` field feeding `telContacts`, while `total` continues
 * to feed `callsMade`. That is ADDITIVE: `{ inBlocks, adhoc, total, memberCodes }`
 * is unchanged and nothing in this module needs revisiting.
 *
 * ── CORRECTED BY P0-G (ruling D3) ───────────────────────────────────────────
 * This note previously listed the six disposition values in prose and closed
 * with "the disposition vocabulary itself lands with the dialer in Phase 1.5 —
 * do not invent it early". Both are superseded. D3 settled the dialer as
 * `tel:`-only plus a captured outcome, which made the outcome vocabulary a Phase
 * 0 concern, and P0-G defines it as a TABLE in `src/lib/schema/callRecord.js`.
 * Restating the six values here would make this comment a prose twin of that
 * table — the exact class v3 rule 1 exists to remove. Read them there.
 */
export const ROW_CALLS = 'CALLS';

/**
 * The ledger's row keys: every counted live code EXCEPT the call-attributed ones,
 * which are pooled into a single `CALLS` row.
 *
 * THIS IS THE SINGLE NAMED EXCEPTION to one-row-per-counted-code. It exists
 * because call records are untyped (see the header) — not for presentation.
 */
export const LEDGER_ROW_KEYS = Object.freeze([
  ROW_CALLS,
  ...COUNTED_LIVE_CODES.filter((code) => !CALL_ATTRIBUTED_CODES.includes(code)),
]);

/** Blocks are ordered by start, then id, so overlapping blocks claim stably. */
function byStartThenId(a, b) {
  if (a.startHour !== b.startHour) return a.startHour - b.startHour;
  return String(a.id).localeCompare(String(b.id));
}

/** Events on `day` that count as evidence (carried out, not retired). */
function evidencedEventsOn(state, day) {
  return (state?.events ?? []).filter((e) => e && e.date === day && isEvidenced(e.status));
}

/**
 * Call records on `day`.
 *
 * ── CORRECTED BY P0-G (ruling D3) ───────────────────────────────────────────
 * This docblock previously read "Calls carry no status — a logged call
 * happened", and the second clause is still exactly right: a call has no STATUS,
 * and the record's own existence is what makes the DIAL evidenced. But the first
 * clause implied calls carry nothing else, and that is now false.
 *
 * A call may carry a DISPOSITION (the agent's account of whether a person was
 * reached) and a VERIFICATION (a later source's), both defined in
 * `src/lib/schema/callRecord.js`. Both are deliberately invisible to everything
 * in this module: a dial counts identically whatever its disposition, which is
 * the split that keeps `pcBreakdown` monotone and additive. Contacts are counted
 * separately, by `callCountsOn` there.
 */
function callsOn(state, day) {
  return (state?.calls ?? []).filter((c) => c && c.date === day);
}

/**
 * pcBreakdown — the call arithmetic for one day, across ALL call-attributed
 * codes jointly (see the header: joint claiming is what keeps this monotonic).
 *
 * Each call is claimed by AT MOST ONE block. A call inside two overlapping
 * blocks counts once, not twice — the source prototype computed `inside` without
 * excluding already-claimed calls and double-counted it.
 *
 * @returns {{inBlocks:number, adhoc:number, total:number, memberCodes:string[]}}
 *   The composition, not just the total: the row reads "8 in blocks + 2 ad-hoc",
 *   and that habit is the only reason the two monotonicity bugs were findable.
 */
export function pcBreakdown(state, day) {
  const { blocks, adhocIds } = attributeCalls(state, day);
  const blockById = new Map(evidencedEventsOn(state, day).map((e) => [e.id, e]));

  let inBlocks = 0;
  for (const { blockId, insideIds } of blocks) {
    const dials = blockById.get(blockId)?.dials || 0;
    inBlocks += Math.max(dials, insideIds.length);
  }

  const adhoc = adhocIds.length;

  return {
    inBlocks,
    adhoc,
    total: inBlocks + adhoc,
    memberCodes: CALL_ATTRIBUTED_CODES,
  };
}

/**
 * attributeCalls — WHICH block claims which call, for one day. The bug-prone
 * half of the arithmetic, exposed so it can be proven on its own.
 *
 * Attribution is where the source build actually went wrong: `at-tally.jsx:61`
 * recomputes each block's `inside` set WITHOUT excluding already-claimed calls,
 * so a call sitting inside two overlapping blocks is counted twice. That defect
 * is invisible through `pcBreakdown` alone, because by the time you see a number
 * `max(dials, inside)` has already been applied to it and can mask the
 * double-count entirely.
 *
 * ── THE PARTITION INVARIANT ─────────────────────────────────────────────────
 * The returned sets are a strict PARTITION of the day's calls:
 *   · every call id appears exactly once — in one block's `insideIds`, or in
 *     `adhocIds`, never both and never neither
 *   · `insideIds` sets are pairwise disjoint across blocks
 *   · sum(|insideIds|) + |adhocIds| === |calls on that day|
 * Property-tested. A constant-returning implementation fails the third clause on
 * the first non-empty case, which is what the monotonicity properties alone
 * could not catch.
 *
 * Blocks are returned in claim order (start, then id), so the result is stable
 * under input reordering.
 *
 * @returns {{blocks: Array<{blockId: string, insideIds: string[]}>, adhocIds: string[]}}
 */
export function attributeCalls(state, day) {
  const blocks = evidencedEventsOn(state, day)
    .filter((e) => CALL_ATTRIBUTED_CODES.includes(e.type))
    .sort(byStartThenId);

  const calls = callsOn(state, day);
  const claimed = new Set();
  const attributed = [];

  for (const block of blocks) {
    const insideIds = calls
      .filter((c) => (
        !claimed.has(c.id)
        && c.atHour != null
        && c.atHour >= block.startHour
        && c.atHour < block.endHour
      ))
      .map((c) => c.id);
    for (const id of insideIds) claimed.add(id);
    attributed.push({ blockId: block.id, insideIds });
  }

  const adhocIds = calls.filter((c) => !claimed.has(c.id)).map((c) => c.id);

  return { blocks: attributed, adhocIds };
}

/**
 * loggedFor — the EVIDENCED counts for one day, keyed by `LEDGER_ROW_KEYS`.
 *
 * Call-attributed codes route through `pcBreakdown` into the pooled `CALLS` row.
 * Every other counted code is one-per-block over evidenced blocks: one fact find
 * genuinely is one appointment.
 */
export function loggedFor(state, day) {
  const out = {};
  for (const key of LEDGER_ROW_KEYS) out[key] = 0;

  out[ROW_CALLS] = pcBreakdown(state, day).total;

  for (const event of evidencedEventsOn(state, day)) {
    if (CALL_ATTRIBUTED_CODES.includes(event.type)) continue; // counted by call
    if (!Object.prototype.hasOwnProperty.call(out, event.type)) continue;
    out[event.type] += 1;
  }

  return out;
}

/**
 * declaredFor — the TYPED counts for one day: a pure read over the `declared`
 * input shape, keyed by `LEDGER_ROW_KEYS`.
 *
 * No Firestore, no submission reading. Mapping declared onto the existing weekly
 * submission is Phase 2.1's job; this must stay callable with a plain object.
 * Unknown keys in the input are ignored rather than surfaced, because a declared
 * figure for a code the ledger does not show is not evidence of anything.
 */
export function declaredFor(state, day) {
  const entry = state?.declared?.[day] ?? {};
  const out = {};
  for (const key of LEDGER_ROW_KEYS) {
    const raw = Number(entry[key]);
    out[key] = Number.isFinite(raw) && raw > 0 ? raw : 0;
  }
  return out;
}

/**
 * weekTotals — all SEVEN days of the Sunday-anchored week containing
 * `anchorDate`. There is no excluded day: an agent who works a Saturday gets
 * credit for it.
 *
 * Evidenced and declared are returned SEPARATELY and are never blended. There is
 * deliberately no `total` field — the source prototype's `weekTotals` returned
 * `logged + declared` as one number, which is the thing 03-DATA-MODEL.md's
 * central contract forbids. A consumer that wants a combined figure must add the
 * two fields itself and own that claim.
 *
 * @returns {{weekStart:string, days:string[], rows:Array}} one row per
 *   `LEDGER_ROW_KEYS`, each `{ key, evidenced, declared, evidencedPct }`. The
 *   `CALLS` row additionally carries `{ inBlocks, adhoc, memberCodes }` so it
 *   states what it was derived from.
 */
export function weekTotals(state, anchorDate) {
  const days = buildWeekDates(anchorDate);

  const evidenced = {};
  const declared = {};
  for (const key of LEDGER_ROW_KEYS) { evidenced[key] = 0; declared[key] = 0; }

  let inBlocks = 0;
  let adhoc = 0;

  for (const day of days) {
    const lg = loggedFor(state, day);
    const dc = declaredFor(state, day);
    for (const key of LEDGER_ROW_KEYS) {
      evidenced[key] += lg[key];
      declared[key] += dc[key];
    }
    const pc = pcBreakdown(state, day);
    inBlocks += pc.inBlocks;
    adhoc += pc.adhoc;
  }

  const rows = LEDGER_ROW_KEYS.map((key) => {
    const row = {
      key,
      evidenced: evidenced[key],
      declared: declared[key],
      evidencedPct: evidencedPct(evidenced[key], declared[key]),
    };
    if (key === ROW_CALLS) {
      return { ...row, inBlocks, adhoc, memberCodes: CALL_ATTRIBUTED_CODES };
    }
    return { ...row, name: ACTIVITY_METADATA[key].name };
  });

  return { weekStart: days[0], days, rows };
}

/**
 * The percentage of a row that is EVIDENCED rather than declared —
 * 03-DATA-MODEL.md requires it always visible. Null when there is nothing to
 * describe, so a consumer renders "—" rather than a confident 0%.
 */
function evidencedPct(evidencedCount, declaredCount) {
  const sum = evidencedCount + declaredCount;
  if (sum === 0) return null;
  return Math.round((evidencedCount / sum) * 100);
}
