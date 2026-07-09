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

// Statuses that RETAIN a slot but read as "no longer active" (dimmed/struck).
export const RETIRED_STATUSES = new Set(['cancelled', 'postponed']);
// Statuses that count as the plan being carried out.
export const COMPLETED_STATUSES = new Set(['kept', 'done']);

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
 * Build a Daily-Capture seed from the day's KEPT (or done) appointments.
 * Returns flat count fields + a nested newBusiness { apps, api } so the caller
 * can blank-fill DailyCaptureV2's entry state. Only appointments dated `date`
 * with a completed status contribute.
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
