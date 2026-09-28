/**
 * workModel.js — the FR "Work" screens' view models (FR-4): Focus (Calls,
 * Paperwork, Win-back), Pipeline (Funnel, Board) and the Numbers header.
 *
 * PURE: no SDK, no JSX, no clock. Inputs are what the app already loads:
 * today's planner appointments, the agent's prospects, today's daily entry,
 * own policies, submitted weekly reports.
 *
 * v3 non-negotiables applied here:
 *   · ACTIVITY_METADATA is the only source of activity codes (rule 1); an
 *     unknown code throws in development (rule 11), never renders plausibly.
 *   · A call block is CAPACITY; a call is ACTIVITY (product rule). Blocks are
 *     listed as blocks; the call COUNTS come only from the daily entry.
 *     Nothing here sums a container with its contents.
 *   · Derived, never stored (rule 2); monotonic counts (rule 3, tested).
 *   · FR-D10: unknown is null ("—"), never a confident 0.
 */
import { ACTIVITY_METADATA } from '../../constants/activityMetadata';
import { pipelineStage, PIPELINE_STAGES } from '../policyLedgerDerivation';
import { deriveWeeklyFloorActuals, WEEKLY_ACTIVITY_FLOOR_ROWS } from '../../utils/weeklyActivityFloors';
import { extractFields } from '../../utils/extractFields';
import { toDateStr } from '../policyCampaignLens';
import { COMPLETED_STATUSES, RETIRED_STATUSES } from '../../constants/appointmentStatus';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Statuses still in the agent's hands or head office's queue (FR-D11 Paperwork). */
export const PAPERWORK_STATUSES = Object.freeze(['written', 'submitted', 'rated', 'postponed']);

/** Whole days from `fromYmd` to `toYmd` (both YYYY-MM-DD), or null. */
export function daysBetween(fromYmd, toYmd) {
  const a = YMD_RE.exec(String(fromYmd ?? ''));
  const b = YMD_RE.exec(String(toYmd ?? ''));
  if (!a || !b) return null;
  const t = (m) => Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.round((t(b) - t(a)) / 86400000);
}

/** A ledger date field as YYYY-MM-DD — the ledger's own reader (toDateStr). */
const ymd = (v) => toDateStr(v);

/** The ACTIVITY_METADATA entry for a code; unknown codes throw in development. */
export function activityMeta(code) {
  const meta = ACTIVITY_METADATA[code];
  if (!meta) {
    if (import.meta.env?.DEV) throw new Error(`workModel: unknown activity code "${code}"`);
    return null;
  }
  return meta;
}

// ── Focus · Calls ────────────────────────────────────────────────────────────

/**
 * focusCalls — today's calling plan (FR-D11: read + tel: only).
 *
 *   blocks   call-family planner items with NO prospect (PC/SC capacity blocks,
 *            seminars): shown as time on the calendar, never counted.
 *   calls    planner items WITH a prospect: who, when, and a tel: link when the
 *            prospect has a phone on file. Retired items (postponed,
 *            cancelled) drop out; completed ones (kept, done) stay, marked done.
 *   counts   today's dials and contacts from the daily entry (any source);
 *            null = not logged yet (never 0).
 *
 * @param {object} p
 * @param {Array} p.appointments   getAgentDay() rows for today
 * @param {Array} [p.prospects]    getProspectInfo() rows
 * @param {object|null} [p.dailyEntry]  getDailyEntry() for today (null = none)
 */
export function focusCalls({ appointments, prospects = [], dailyEntry = null }) {
  const byId = new Map((Array.isArray(prospects) ? prospects : []).map((p) => [p.id, p]));
  const blocks = [];
  const calls = [];
  for (const a of Array.isArray(appointments) ? appointments : []) {
    // Postponed / cancelled keep their planner slot but are no longer active.
    if (!a || RETIRED_STATUSES.has(a.status)) continue;
    const meta = activityMeta(a.type);
    if (!meta) continue;
    const time = typeof a.startTime === 'string' ? a.startTime : null;
    const prospect = a.prospectId ? byId.get(a.prospectId) ?? null : null;
    if (!a.prospectId) {
      if (meta.family === 'call') {
        blocks.push({ id: a.id, time, durationMin: Number(a.durationMin) || null, code: a.type, label: meta.name, note: a.freeBlockLabel ?? null });
      }
      continue;
    }
    const phone = prospect?.phone ?? prospect?.clientPhone ?? null;
    calls.push({
      id: a.id,
      time,
      code: a.type,
      label: meta.name,
      name: prospect?.clientName ?? null,
      phone: phone ? String(phone).trim() : null,
      tel: phone ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : null,
      done: COMPLETED_STATUSES.has(a.status),
    });
  }
  const byTime = (x, y) => String(x.time ?? '99:99').localeCompare(String(y.time ?? '99:99'));
  blocks.sort(byTime);
  calls.sort(byTime);
  const n = (v) => (isNum(v) ? v : isNum(Number(v)) && v !== '' && v != null ? Number(v) : null);
  return {
    blocks,
    calls,
    counts: dailyEntry
      ? { dials: n(dailyEntry.dials), contacts: n(dailyEntry.telContacts) }
      : { dials: null, contacts: null },
    logged: Boolean(dailyEntry),
  };
}

// ── Focus · Paperwork ────────────────────────────────────────────────────────

/**
 * paperwork — own policies still in the pipeline, OLDEST first, with age in
 * days since they went in (dateSubmitted, else dateWritten).
 */
export function paperwork({ policies, todayTT }) {
  const rows = [];
  for (const p of Array.isArray(policies) ? policies : []) {
    if (!p || !PAPERWORK_STATUSES.includes(p.status) || p.replacedBy) continue;
    const since = ymd(p.dateSubmitted) ?? ymd(p.dateWritten);
    rows.push({
      id: p.id ?? p.policyNumber,
      policyNumber: p.policyNumber ?? null,
      name: p.ownerName ?? p.insuredName ?? p.clientName ?? null,
      status: p.status,
      stage: pipelineStage(p),
      api: isNum(Number(p.proposedAPI)) ? money2(Number(p.proposedAPI)) : null,
      since,
      ageDays: since ? daysBetween(since, todayTT) : null,
    });
  }
  rows.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
  return rows;
}

// ── Pipeline · Funnel ────────────────────────────────────────────────────────

/** The selling ladder, in order (a subset of the weekly-floor rows). */
export const FUNNEL_KEYS = Object.freeze([
  'callsMade', 'telContacts', 'appointmentsScheduled', 'factFindsCompleted',
  'closingInterviewsKept', 'applicationsSubmitted', 'clientsSold',
]);

// Sentence case, as the FR Today week meters show them ("Contacts made").
const sentenceCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
const ROW_LABEL = Object.fromEntries(WEEKLY_ACTIVITY_FLOOR_ROWS.map((r) => [r.key, sentenceCase(r.label)]));

/**
 * yearActuals — the weekly-floor actuals summed over this year's SUBMITTED
 * weekly reports (the same per-report mapping as the Standard drawer).
 * @returns {{ values: object, weeks: number }}
 */
export function yearActuals(submissions, year) {
  const values = Object.fromEntries(FUNNEL_KEYS.map((k) => [k, 0]));
  let weeks = 0;
  for (const s of Array.isArray(submissions) ? submissions : []) {
    if (s?.status !== 'submitted' || !String(s.weekStarting ?? '').startsWith(`${year}-`)) continue;
    weeks += 1;
    const v = deriveWeeklyFloorActuals(extractFields(s));
    for (const k of FUNNEL_KEYS) values[k] += Number(v[k]) || 0;
  }
  return { values, weeks };
}

/**
 * funnel — each stage's count, its conversion from the stage before, and the
 * company minimum for the period (weekly floor × weeks). A stage whose count
 * is unknown is null and breaks the conversion chain on either side of it.
 *
 * @param {object} p
 * @param {object} p.values   floor-key → number|null
 * @param {object} p.floors   weeklyFloors()
 * @param {number} p.weeks    weeks the period covers (1 for "this week")
 */
export function funnel({ values, floors, weeks = 1 }) {
  let prev = null;
  return FUNNEL_KEYS.map((key) => {
    const raw = values?.[key];
    const count = isNum(raw) ? raw : null;
    const target = (Number(floors?.[key]) || 0) * weeks;
    const conversion = count != null && prev != null && prev > 0 ? Math.round((count / prev) * 1000) / 10 : null;
    prev = count;
    return {
      key,
      label: ROW_LABEL[key] ?? key,
      count,
      target: target > 0 ? target : null,
      short: count != null && target > 0 ? Math.max(0, Math.ceil(target - count)) : null,
      conversion,
    };
  });
}

// ── Pipeline · Board ─────────────────────────────────────────────────────────

/**
 * board — own policies in the ledger's own stage buckets (PIPELINE_STAGES /
 * pipelineStage), each column with its count and API, cards oldest first.
 * `closed` is last and collapsed by the view.
 */
export function board({ policies, todayTT }) {
  const cols = PIPELINE_STAGES.map((s) => ({ ...s, cards: [], api: 0 }));
  const byKey = new Map(cols.map((c) => [c.key, c]));
  for (const p of Array.isArray(policies) ? policies : []) {
    if (!p || p.replacedBy) continue;
    const col = byKey.get(pipelineStage(p));
    if (!col) continue;
    const since = ymd(p.dateSubmitted) ?? ymd(p.dateWritten) ?? ymd(p.dateIssued);
    const api = isNum(Number(p.proposedAPI)) ? Number(p.proposedAPI) : 0;
    col.api += api;
    col.cards.push({
      id: p.id ?? p.policyNumber,
      policyNumber: p.policyNumber ?? null,
      name: p.ownerName ?? p.insuredName ?? p.clientName ?? null,
      status: p.status,
      api: money2(api),
      ageDays: since ? daysBetween(since, todayTT) : null,
    });
  }
  for (const c of cols) {
    c.api = money2(c.api);
    c.cards.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
  }
  return cols;
}

// ── Numbers header ───────────────────────────────────────────────────────────

/**
 * numbersTiles — the Numbers hub's glanceable tiles (above the existing
 * Production report, Performance report and History): weeks reported this
 * year and three selling-ladder ratios from the same submitted reports.
 */
export function numbersTiles({ submissions, year }) {
  const { values, weeks } = yearActuals(submissions, year);
  const ratio = (a, b) => (values[b] > 0 ? Math.round((values[a] / values[b]) * 1000) / 10 : null);
  return [
    { id: 'weeks', label: `Weeks reported, ${year}`, value: weeks, unit: 'count' },
    { id: 'contact', label: 'Contacts per call', value: ratio('telContacts', 'callsMade'), unit: 'pct', decimals: 1, note: 'Contacts ÷ prospecting calls' },
    { id: 'close', label: 'Closing to fact-find', value: ratio('closingInterviewsKept', 'factFindsCompleted'), unit: 'pct', decimals: 1, note: 'Closing interviews ÷ fact finds' },
    { id: 'app', label: 'Apps per closing', value: ratio('applicationsSubmitted', 'closingInterviewsKept'), unit: 'pct', decimals: 1, note: 'Applications ÷ closing interviews' },
  ];
}
