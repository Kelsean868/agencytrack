/**
 * planner.helpers.js — pure (React-free) helpers for the Planner surfaces.
 *
 * Grouping, week-date math, follow-up derivation (client-side over the prospect
 * prep list — the handoff's `callbackDueAt` prospect-schema extension is NOT
 * contracted, so we derive the honest signal the loaded data already supports),
 * and the plan→daily-capture seed mapping (screen 9 payoff).
 */

import { getSundayOf } from '../../lib/schema/dailyActivity';

// ── Week / day math ──────────────────────────────────────────────────────────

/** The 7 'YYYY-MM-DD' dates Sun→Sat for the week containing `dateStr`. */
export function buildWeekDates(dateStr) {
  const sunday = getSundayOf(dateStr);
  const base = new Date(sunday + 'T12:00:00Z');
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
}

/** { start, end } Sunday..Saturday for the week containing `dateStr`. */
export function weekRange(dateStr) {
  const dates = buildWeekDates(dateStr);
  return { start: dates[0], end: dates[6] };
}

/** Ascending sort by startTime ('HH:mm'), stable. Returns a new array. */
export function sortByStartTime(appts = []) {
  return [...appts].sort((a, b) =>
    String(a.startTime ?? '').localeCompare(String(b.startTime ?? '')));
}

/** Map of date → time-sorted appointments. */
export function groupByDate(appts = []) {
  const map = new Map();
  for (const a of appts) {
    if (!map.has(a.date)) map.set(a.date, []);
    map.get(a.date).push(a);
  }
  for (const [k, v] of map) map.set(k, sortByStartTime(v));
  return map;
}

/** Map of agentId → all appointments for that agent. */
export function groupByAgent(appts = []) {
  const map = new Map();
  for (const a of appts) {
    if (!map.has(a.agentId)) map.set(a.agentId, []);
    map.get(a.agentId).push(a);
  }
  return map;
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** 'HH:mm' → '9:00 AM' (falls back to the raw string on a bad input). */
export function formatTime12(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!m) return String(hhmm ?? '');
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

/** 'YYYY-MM-DD' → 'Sun 22' style short label. */
export function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const wd = d.toLocaleDateString('en-TT', { weekday: 'short', timeZone: 'UTC' });
  return `${wd} ${d.getUTCDate()}`;
}

/**
 * 'YYYY-MM-DD' → { dow: 'WED', day: '22' } — the stacked week-column header the
 * design board's day columns use (mockups/planner-desktop.jsx: DOW on one line,
 * the date number under it). A single-line "Wed 22 · Today" measurably clips at
 * a 131px week column (observed scrollWidth 102 vs clientWidth 58), which is
 * what this replaces.
 */
export function dayHeaderParts(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return {
    dow: d.toLocaleDateString('en-TT', { weekday: 'short', timeZone: 'UTC' }).toUpperCase(),
    day: String(d.getUTCDate()),
  };
}

/**
 * Week range → a compact human label for the week navigator, e.g.
 * 'Jul 19 – 25' (same month) or 'Jun 28 – Jul 4' (spanning months).
 */
export function weekRangeLabel(startStr, endStr) {
  const fmt = (s, withMonth) => {
    const d = new Date(s + 'T12:00:00Z');
    const mon = d.toLocaleDateString('en-TT', { month: 'short', timeZone: 'UTC' });
    return withMonth ? `${mon} ${d.getUTCDate()}` : String(d.getUTCDate());
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startStr ?? '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endStr ?? ''))) {
    return '';
  }
  const sameMonth = startStr.slice(0, 7) === endStr.slice(0, 7);
  return `${fmt(startStr, true)} – ${fmt(endStr, !sameMonth)}`;
}

/**
 * 'YYYY-MM-DD' + N days → 'YYYY-MM-DD' (UTC-noon math, same discipline as
 * buildWeekDates — immune to DST/local-timezone edges). Malformed input is
 * returned unchanged (defensive, mirrors formatTime12's fallback contract).
 * Run 9 A5: powers the bulk-move "shift by ±N days" mode.
 */
export function shiftDateStr(dateStr, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr ?? ''))) return dateStr;
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 'HH:mm' + minutes → 'HH:mm' (clamped to 23:59, same-day). Malformed input or a
 * result past midnight returns null (caller falls back). Used by the E2 drag
 * gap-slot model to derive a drop-slot's suggested start from the preceding
 * appointment's end.
 */
export function addMinutesToTime(hhmm, mins) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!m) return null;
  const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (Number(mins) || 0);
  if (!Number.isFinite(total) || total < 0 || total > 23 * 60 + 59) return null;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * computeDayGaps — the E2 drag drop-slots for one day column: a "top" slot
 * (start-of-day) plus one slot AFTER each rendered card, whose suggested start
 * is that card's end time (`startTime + durationMin` — the "hole" the README's
 * gap model targets). Dropping a dragged card into a slot changes its time to
 * the slot's `startTime` (and its date to the column's day). Cards missing a
 * parseable end contribute no after-slot (defensive). Pure — no date math beyond
 * addMinutesToTime.
 * @returns {Array<{key:string, startTime:string}>}
 */
export function computeDayGaps(dayAppts = []) {
  const sorted = sortByStartTime(dayAppts);
  const zones = [{ key: 'gap-top', startTime: '08:00' }];
  for (const a of sorted) {
    const end = addMinutesToTime(a.startTime, a.durationMin);
    if (end) zones.push({ key: `gap-after-${a.id}`, startTime: end });
  }
  return zones;
}

// Statuses that RETAIN a slot but read as "no longer active" (dimmed/struck).
export const RETIRED_STATUSES = new Set(['cancelled', 'postponed']);
// Statuses that count as the plan being carried out.
export const COMPLETED_STATUSES = new Set(['kept', 'done']);

/** 'HH:mm' → minutes-of-day (0–1439), or null on malformed input. */
function minutesOfDay(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// ── E3: running-late cascade (gap-smart) ─────────────────────────────────────

/**
 * findRunningLate — the "you're behind" signal: the EARLIEST non-retired,
 * non-completed appointment on `today` whose end (`startTime + durationMin`) is
 * already before `nowTime` ('HH:mm'). It should have been churned by now. Returns
 * that appointment, or null when nothing is overdue. Pure — the panel's client
 * tick supplies `nowTime` (TT).
 */
export function findRunningLate(appts = [], today, nowTime) {
  const nowMin = minutesOfDay(nowTime);
  if (nowMin == null) return null;
  const overdue = appts
    .filter((a) => a && a.date === today
      && !RETIRED_STATUSES.has(a.status) && !COMPLETED_STATUSES.has(a.status))
    .map((a) => ({ a, startMin: minutesOfDay(a.startTime), dur: Number(a.durationMin) || 0 }))
    .filter((x) => x.startMin != null && x.startMin + x.dur < nowMin)
    .sort((x, y) => x.startMin - y.startMin);
  return overdue.length ? overdue[0].a : null;
}

/**
 * computeLateCascade — gap-smart running-late math (README E3). Given the day's
 * `appts`, the `lateAppt` that overran, a `pushMin` (10/20/30) and a `scope`
 * ('next' | 'all'), returns:
 *   - `following`: the day's still-active appointments AT/AFTER the late one
 *   - `affected`:  the ones that shift under `scope`, each `{id, oldStartTime,
 *                  newStartTime, prospectId, type}`
 *   - `unaffected`: the following appts NOT shifted
 *   - `gapAfterNextMin`: the gap (min) after the NEXT appt (Infinity if none) —
 *                  drives `recommendedScope`
 *   - `recommendedScope`: 'next' when that gap ≥ the push (the push absorbs, the
 *                  rest is unaffected), else 'all' (cascade the day)
 * Pure — no clock read. Cross-midnight pushes clamp (addMinutesToTime → null →
 * no shift for that row).
 */
export function computeLateCascade(appts = [], lateAppt, pushMin, scope = 'next') {
  const push = Number(pushMin) || 0;
  const lateStart = minutesOfDay(lateAppt?.startTime) ?? 0;
  const following = sortByStartTime(
    appts.filter((a) => a && a.id !== lateAppt?.id
      && a.date === lateAppt?.date
      && !RETIRED_STATUSES.has(a.status) && !COMPLETED_STATUSES.has(a.status)
      && (minutesOfDay(a.startTime) ?? -1) >= lateStart),
  );
  let gapAfterNextMin = Infinity;
  if (following.length >= 2) {
    const nextEnd = (minutesOfDay(following[0].startTime) ?? 0) + (Number(following[0].durationMin) || 0);
    gapAfterNextMin = (minutesOfDay(following[1].startTime) ?? 0) - nextEnd;
  }
  const recommendedScope = gapAfterNextMin >= push ? 'next' : 'all';
  const shiftList = scope === 'all' ? following : following.slice(0, 1);
  const affected = shiftList.map((a) => ({
    id: a.id, prospectId: a.prospectId, type: a.type,
    oldStartTime: a.startTime,
    newStartTime: addMinutesToTime(a.startTime, push) ?? a.startTime,
  }));
  const affectedIds = new Set(affected.map((x) => x.id));
  const unaffected = following.filter((a) => !affectedIds.has(a.id));
  return { following, affected, unaffected, gapAfterNextMin, recommendedScope };
}

// ── Conflict detection (Run 9 A3 — R7: warn-only, never blocks) ─────────────

/**
 * Parse a { startTime: 'HH:mm', durationMin } pair into a clamped [start, end)
 * minute-of-day interval. Returns null for anything malformed or missing —
 * callers skip such appointments defensively rather than throwing. Cross-
 * midnight duration (start + durationMin > 24:00) is clamped at 1440
 * (midnight), same-date only — it never spills into the next date's window.
 */
function parseApptInterval(appt) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(appt?.startTime ?? ''));
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  const duration = Number(appt.durationMin);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const start = h * 60 + min;
  const end = Math.min(start + duration, 24 * 60);
  return { start, end };
}

/** Half-open interval intersection — touching (a.end === b.start) is NOT an overlap. */
function intervalsOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * detectConflicts — ids of appointments that overlap another NON-RETIRED
 * appointment on the SAME date. FREE blocks participate (booking over your
 * own blocked time is exactly what deserves a warning). Malformed/missing
 * `startTime`/`durationMin` are skipped defensively, never thrown. R7:
 * warn-only — the returned Set is for rendering badges, never for gating a
 * save.
 * @param {Array} appts
 * @returns {Set<string>} conflicting appointment ids
 */
export function detectConflicts(appts = []) {
  const conflicts = new Set();
  const byDate = new Map();
  for (const a of appts) {
    if (!a || !a.date || RETIRED_STATUSES.has(a.status)) continue;
    const interval = parseApptInterval(a);
    if (!interval) continue;
    if (!byDate.has(a.date)) byDate.set(a.date, []);
    byDate.get(a.date).push({ id: a.id, ...interval });
  }
  for (const list of byDate.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (intervalsOverlap(list[i], list[j])) {
          conflicts.add(list[i].id);
          conflicts.add(list[j].id);
        }
      }
    }
  }
  return conflicts;
}

/**
 * findConflictingAppointment — given a candidate `{ date, startTime, durationMin }`
 * (typically live, unsaved sheet form state) and the loaded week's
 * appointments, returns the FIRST other non-retired appointment on the same
 * date whose interval overlaps the candidate's, or null if none. `excludeId`
 * omits the appointment currently being edited (edit-mode self-exclusion).
 * Same malformed-input and RETIRED_STATUSES rules as `detectConflicts`.
 */
export function findConflictingAppointment(candidate, appts = [], excludeId = null) {
  if (!candidate?.date) return null;
  const candidateInterval = parseApptInterval(candidate);
  if (!candidateInterval) return null;
  for (const a of appts) {
    if (!a || a.id === excludeId || a.date !== candidate.date || RETIRED_STATUSES.has(a.status)) continue;
    const interval = parseApptInterval(a);
    if (!interval) continue;
    if (intervalsOverlap(candidateInterval, interval)) return a;
  }
  return null;
}

// ── Follow-up derivation (client-side; honest signal) ────────────────────────

/**
 * Derive the follow-up worklist from the loaded prospect prep list + the loaded
 * appointments. A prospect is a follow-up when it has an `intendedAppointmentDate`
 * and there is NO active (non-cancelled/postponed) appointment already booked
 * against its id. Soonest-due first; overdue (intended date before `today`) is
 * flagged. This is the honest derivation the contracted data supports — the
 * handoff's `callbackDueAt` field is skipped (not contracted).
 *
 * @param {Array} prospects   prospectInfo docs ({ id, clientName, intendedAppointmentDate, ... })
 * @param {Array} appointments appointment docs ({ prospectId, status, ... })
 * @param {string} today       'YYYY-MM-DD'
 */
export function deriveFollowups(prospects = [], appointments = [], today) {
  const booked = new Set(
    appointments
      .filter((a) => a.prospectId && !RETIRED_STATUSES.has(a.status))
      .map((a) => a.prospectId),
  );
  return prospects
    .filter((p) => p.intendedAppointmentDate && !booked.has(p.id))
    .map((p) => ({
      id: p.id,
      clientName: p.clientName || 'Prospect',
      intendedAppointmentDate: p.intendedAppointmentDate,
      appointmentType: p.appointmentType || null,
      policyType: p.policyType || null,
      overdue: today ? p.intendedAppointmentDate < today : false,
    }))
    .sort((a, b) =>
      String(a.intendedAppointmentDate).localeCompare(String(b.intendedAppointmentDate)));
}

// ── E4: per-appointment notes thread ─────────────────────────────────────────

/**
 * readNoteThread — merge an appointment's timestamped `notes[]` with its legacy
 * single `note` string into one display thread (oldest-first). The legacy note
 * surfaces as the FIRST entry on migrate-read (README E4: "keep the legacy note
 * as the first thread entry"), tagged `legacy` so it sorts ahead and is never
 * duplicated once it has also been re-saved into the thread. Each thread entry:
 * `{ at, text, during, legacy? }` — `at` is a client ISO string (or null for the
 * legacy entry). Defensive: non-array `notes` / missing fields are tolerated.
 * @returns {Array<{at:(string|null), text:string, during:boolean, legacy?:boolean}>}
 */
export function readNoteThread(appt) {
  const raw = Array.isArray(appt?.notes) ? appt.notes : [];
  const thread = raw
    .filter((n) => n && typeof n.text === 'string' && n.text.trim())
    .map((n) => ({ at: n.at ?? null, text: n.text, during: Boolean(n.during) }));
  const legacy = String(appt?.note ?? '').trim();
  // Surface the legacy note only when it isn't already present as a thread entry.
  if (legacy && !thread.some((n) => n.text === legacy)) {
    thread.unshift({ at: null, text: legacy, during: false, legacy: true });
  }
  return thread.sort((a, b) => {
    if (a.legacy) return -1;
    if (b.legacy) return 1;
    return String(a.at ?? '').localeCompare(String(b.at ?? ''));
  });
}

/**
 * prospectNoteHistory — E4 "notes travel with the prospect" (THIS-WEEK scope,
 * deploy-free per the Option-1 ruling). Aggregates note-thread entries from the
 * OTHER loaded appointments (`appts`, i.e. the current week) that share the same
 * `prospectId`, excluding the appointment being viewed. Each returned row carries
 * its source appointment's `date` so the booking sheet can show "from Mon 22".
 * Cross-time history (pre-this-week) is a banked follow-up needing a composite
 * index — see FOLLOW_UPS. Owner-scoped by construction (`appts` is the agent's
 * own loaded week).
 * @returns {Array<{date:string, text:string, during:boolean}>}
 */
export function prospectNoteHistory(appts = [], prospectId, excludeApptId = null) {
  if (!prospectId) return [];
  const out = [];
  for (const a of appts) {
    if (a.id === excludeApptId || a.prospectId !== prospectId) continue;
    for (const n of readNoteThread(a)) {
      if (n.text) out.push({ date: a.date, text: n.text, during: n.during });
    }
  }
  return out;
}

/**
 * appointmentIsActive — E4 "THIS MEETING" gate: a note added while the appt is
 * happening is tagged `during`. Active = a non-retired, non-completed appointment
 * dated `today` (TT). (Time-of-day window is intentionally not required — a note
 * added the day of the meeting is "this meeting"; the compact card doesn't tick
 * per-minute.)
 */
export function appointmentIsActive(appt, today) {
  if (!appt || appt.date !== today) return false;
  return !RETIRED_STATUSES.has(appt.status) && !COMPLETED_STATUSES.has(appt.status);
}

// ── Plan → Daily Capture seed (screen 9 handoff payoff) ──────────────────────

/**
 * Map a kept planner activity type → the DailyCaptureV2 count field it feeds.
 * Best-effort, editable-on-confirm mapping (README §8 plan→report table). SALE
 * is handled separately (apps + API). FREE contributes no activity/production
 * count. The agent confirms/edits in Daily Capture, so an approximate seed is a
 * head-start, never an authoritative write.
 */
export const PLAN_TO_DAILY_FIELD = {
  PC:  'dials',
  SC:  'telContacts',
  AI:  'qualifiedApproaches',
  FFI: 'ffiConducted',
  CI:  'ciConducted',
};

/**
 * The types a kept appointment can actually CARRY into Daily Capture: the
 * mapped count fields above, plus SALE (handled separately as apps + API).
 * Derived from PLAN_TO_DAILY_FIELD rather than restated, so adding a mapping
 * can never leave this stale.
 *
 * Deliberately NOT imported from plannerService's `SELLING_TYPE_KEYS`, for two
 * reasons. (1) Import graph: `plannerService` imports `recurrence.helpers`,
 * which imports THIS module — importing plannerService here would close a
 * three-module cycle that does not exist today. (2) Semantics: the two sets
 * answer different questions. `SELLING_TYPE_KEYS` is "does it count as selling
 * activity" (it includes SEM/TRADE); this is "does it seed a Daily Capture
 * field" (it does not — a kept seminar carries nothing). The CTA this figure
 * labels is specifically about carrying, so the narrower set is the honest one.
 */
const SEEDS_DAILY_CAPTURE = new Set([...Object.keys(PLAN_TO_DAILY_FIELD), 'SALE']);

/**
 * Build a Daily-Capture seed from the day's KEPT (or done) appointments.
 * Returns flat count fields + a nested newBusiness { apps, api } so the caller
 * can blank-fill DailyCaptureV2's entry state. Only appointments dated `date`
 * with a completed status contribute.
 *
 * `keptCount` counts only types in SEEDS_DAILY_CAPTURE. It labels the
 * carry-to-Daily-Capture CTA ("N kept appointments today"), so it must describe
 * what is actually being carried: support work and blocks map to no Daily
 * Capture field, so counting them overstated the CTA. This also fixes the same
 * pre-existing overstatement for `FREE`, which was counted here before the nine
 * new types existed.
 *
 * TWO things change, not one — an earlier version of this comment claimed only
 * the label figure moved, which was FALSE:
 *   1. the figure itself, and
 *   2. **the visibility of the whole end-of-day handoff banner**, because
 *      `AgentPlannerPanel.jsx` gates it on `seed.keptCount > 0`. A day of only
 *      kept blocks / support work (or, previously, only a kept `FREE`) now
 *      renders NO banner at all where it used to render one.
 * That second effect is ENDORSED, not incidental (dispatcher ruling, 2026-07-27):
 * a "Carry into today's log" button that carries nothing is worse than no
 * banner. Do not restore the old behaviour by widening this set.
 *
 * The `counts` / `newBusiness` PAYLOAD is genuinely unchanged — every type that
 * could contribute is in SEEDS_DAILY_CAPTURE, and `PLAN_TO_DAILY_FIELD` already
 * returned undefined for anything unmapped.
 *
 * @returns {{ counts: object, newBusiness: {apps:number, api:number}, keptCount:number }}
 */
export function deriveSeedFromKept(appointments = [], date) {
  const counts = {};
  const newBusiness = { apps: 0, api: 0 };
  let keptCount = 0;
  for (const a of appointments) {
    if (a.date !== date) continue;
    if (!COMPLETED_STATUSES.has(a.status)) continue;
    if (!SEEDS_DAILY_CAPTURE.has(a.type)) continue;
    keptCount += 1;
    if (a.type === 'SALE') {
      newBusiness.apps += 1;
      const api = parseFloat(a.apiAmount);
      if (Number.isFinite(api) && api > 0) newBusiness.api += api;
      continue;
    }
    const field = PLAN_TO_DAILY_FIELD[a.type];
    if (field) counts[field] = (counts[field] || 0) + 1;
  }
  return { counts, newBusiness, keptCount };
}
