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
 * The key of the pooled call row. Deliberately NOT 'PC': the repo calls SC
 * "Seen call", the prototype calls it "Sales call" and 03-DATA-MODEL.md calls it
 * "Service calls" — three sources, three meanings — and the company floor for
 * `callsMade` excludes service calls. Folding SC dials into a row labelled
 * prospecting calls would be a business claim none of those three supports. An
 * honest joint row makes no false claim; a mislabelled one does.
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

/** Call records on `day`. Calls carry no status — a logged call happened. */
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
  const blocks = evidencedEventsOn(state, day)
    .filter((e) => CALL_ATTRIBUTED_CODES.includes(e.type))
    .sort(byStartThenId);

  const calls = callsOn(state, day);
  const claimed = new Set();
  let inBlocks = 0;

  for (const block of blocks) {
    const inside = calls.filter((c) => (
      !claimed.has(c.id)
      && c.atHour != null
      && c.atHour >= block.startHour
      && c.atHour < block.endHour
    ));
    for (const c of inside) claimed.add(c.id);
    inBlocks += Math.max(block.dials || 0, inside.length);
  }

  const adhoc = calls.filter((c) => !claimed.has(c.id)).length;

  return {
    inBlocks,
    adhoc,
    total: inBlocks + adhoc,
    memberCodes: CALL_ATTRIBUTED_CODES,
  };
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
