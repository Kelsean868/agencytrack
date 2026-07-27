/**
 * plannerService.js — item 3.2 Planner & Scheduler (agent Planner + Team Planner).
 *
 * Collection: /tenants/{tid}/appointments/{autoId}  (FLAT tenant collection —
 * deliberate divergence from the handoff's per-agent subcollection; see the
 * contract in firestore.rules, commit 9694797b). All Firestore access for the
 * planner lives here.
 *
 * Contract (locked, emulator-tested 20/20):
 *  REQUIRED keys: tenantId, agentId, agentUnitId, agentBranchId, date
 *    ('YYYY-MM-DD'), startTime ('HH:mm'), durationMin (int 1–720),
 *    type ∈ TYPE_KEYS, status ∈ STATUS_KEYS, note (≤2000), createdAt, updatedAt.
 *  OPTIONAL: prospectId, freeBlockLabel, apiAmount (≥0|null), rescheduledToId.
 *  Extra keys allowed (rule uses a hasAll floor).
 *
 * Ownership: owner (agent OR producing manager) creates/updates OWN docs only —
 * agentId is pinned to the caller's uid; agentUnitId/agentBranchId are
 * denormalized from the caller's profile (agentUnitId == the caller's UNIT
 * MANAGER'S uid, matching prospectInfoService's convention and the UM read arm
 * `where('agentUnitId','==',uid)`). Upline is READ-ONLY:
 *   UM (rank 1):  where('agentUnitId','==', umUid)
 *   BM (rank 2):  where('agentBranchId','==', ownBranchId)
 *   SM+/TA (≥3):  unfiltered (date range only)
 * Composites exist for (agentId,date) (agentUnitId,date) (agentBranchId,date);
 * day/week reads stay inside these shapes (equality on the scope key + a date
 * range). NO USER-FACING deletes — cancel/postpone flip status (+
 * rescheduledToId on rebook). Run 9 A1 adds `deleteAppointment` / the owner
 * `allow delete` rules arm SOLELY as the undo/redo history's undo-create and
 * undo-postpone inverses — no delete affordance is exposed in the UI.
 *
 * Because updateDoc() merges, a partial update's merged request.resource.data
 * retains every required key, so partial writes are contract-safe as long as no
 * required key is removed or the immutable agent-scope keys mutated (stripped
 * below defensively).
 */

import {
  addDoc, updateDoc, deleteDoc, doc, collection, getDocs,
  query, where, orderBy, serverTimestamp, writeBatch, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getWarRoleRank } from './managerWarService';
import { expandSeriesDates, MAX_SERIES_INSTANCES } from '../components/planner/recurrence.helpers';

// ── Activity types (selling ladder + support work + blocks) ──────────────────
// Order = the mockup's timeline/legend order for the original seven; the nine
// added types follow. `label` is the display code with dots (P.C, S.C, …) or a
// short word (Sale, Free, Paper …); the key is the storage/enum key (contract
// TYPE set, mirrored in firestore.rules — see the allowlist note below).
//
// LABEL BUDGET IS LOAD-BEARING (≤5 chars). The dense week-column card gives the
// [time · type chip] row roughly an 81px content box at the narrowest column
// (131.4px at 1280px with the sidebar expanded); today's worst case `F.F.I`
// already exceeds it by ~4px and relies on the card's `flex-wrap` safety valve.
// Every label here is ≤5 chars so wrapping stays the exception, not the norm.
// See the dense-card comment in AgentPlannerPanel.jsx before lengthening any.
//
// FUTURE TENANT CONFIG — READ BEFORE MAKING THIS LIST CONFIGURABLE. This list is
// hardcoded deliberately. A per-tenant type set CANNOT be expressed as the
// literal allowlist that `firestore.rules` uses today (`d.type in [...]` in both
// validApptWrite and validTemplateWrite): a tenant-varying set would need either
// a `get()` against the tenant config doc on every appointment write (a billed
// read per write) or relaxing the rule from a value check to a shape check. When
// that layer is built, mirror the `weeklyActivityFloors` precedent —
// `Object.freeze(DEFAULT_…)` here, tenant override at `config/companyMinimums`,
// consumers merging `{ ...DEFAULT, ...(config ?? {}) }` — and resolve the rules
// question explicitly rather than by omission.
export const APPOINTMENT_TYPES = [
  { key: 'PC',    label: 'P.C',   name: 'Prospecting call' },
  { key: 'SC',    label: 'S.C',   name: 'Seen call' },
  { key: 'AI',    label: 'A.I',   name: 'Approach interview' },
  { key: 'FFI',   label: 'F.F.I', name: 'Fact-finding interview' },
  { key: 'CI',    label: 'C.I',   name: 'Closing interview' },
  { key: 'SALE',  label: 'Sale',  name: 'Life / annuity written' },
  { key: 'FREE',  label: 'Free',  name: 'Training · seminar · prospecting time · personal' },
  // Support work — client-linked, but not itself a selling interview.
  { key: 'PROP',  label: 'Prop',  name: 'Solution / proposal writing' },
  { key: 'PAPER', label: 'Paper', name: 'Writing / submitting applications' },
  { key: 'COLL',  label: 'Coll',  name: 'Premium collection' },
  { key: 'DEL',   label: 'Del',   name: 'Policy delivery' },
  // Blocks — booked time that is not a client appointment.
  { key: 'SEM',   label: 'Sem',   name: 'Company seminar' },
  { key: 'TRADE', label: 'Trade', name: 'Tradeshow' },
  { key: 'MTG',   label: 'Mtg',   name: 'Branch meeting' },
  { key: 'TRAIN', label: 'Train', name: 'Training / CPD' },
  { key: 'ADMIN', label: 'Admin', name: 'Admin work' },
];
export const TYPE_KEYS = APPOINTMENT_TYPES.map((t) => t.key);

/**
 * SELLING_TYPE_KEYS — the types that count as selling ACTIVITY for any
 * "how much did you book / do" total. Everything not in this set (support work,
 * blocks, and the legacy `FREE`) is logged-but-not-counted: it still occupies a
 * slot and still records `durationMin`, it just never inflates an activity total
 * a manager or agent reads as production effort.
 *
 * `SEM` / `TRADE` are IN: a company seminar and a tradeshow are prospecting
 * activity (they are also the two block types the weekly-floor `callsMade`
 * 4-sum already counts on the WAR side, via `computeProspectingCallsActual`'s
 * `seminarTradeshow` term).
 *
 * NOTE this is deliberately NOT the same axis as the picker groups in
 * PICKER_GROUPS — `SEM`/`TRADE` sit in the Block group but count as selling.
 * Grouping answers "where does the agent find it"; this set answers "does it
 * count". Consumers: the booked-vs-floor totals in TeamPlannerPanel and the
 * kept-count in planner.helpers' deriveSeedFromKept.
 *
 * The booked-vs-floor PER-TYPE counters (WEEK_COUNTER_ROWS / COUNTER_ROWS) do
 * NOT consume this set — they filter by exact type equality against CI/FFI/PC,
 * so every type outside those three is already inert for them by construction.
 */
export const SELLING_TYPE_KEYS = Object.freeze(
  ['PC', 'SC', 'AI', 'FFI', 'CI', 'SALE', 'SEM', 'TRADE'],
);

/** True when a type counts toward selling-activity totals. */
export function isSellingType(type) {
  return SELLING_TYPE_KEYS.includes(type);
}

/**
 * PICKER_GROUPS — the booking sheet's mode structure (ordered). Ports the design
 * authority's mode pattern (the agent sheet's existing Prospect / Free-block
 * toggle, widened to three modes the way the manager sheet's four-mode stream
 * selector does) rather than growing a flat 16-button grid, which would put
 * `A.I` (Approach interview) two buttons from `Admin`.
 *
 * `FREE` stays in the Block group, last, and keeps its FREE_BLOCK_LABELS chip
 * row — untouched for backward compatibility.
 */
export const PICKER_GROUPS = Object.freeze([
  { key: 'prospect', label: 'Prospect', types: ['PC', 'SC', 'AI', 'FFI', 'CI', 'SALE'] },
  { key: 'support',  label: 'Support',  types: ['PROP', 'PAPER', 'COLL', 'DEL'] },
  { key: 'block',    label: 'Block',    types: ['SEM', 'TRADE', 'MTG', 'TRAIN', 'ADMIN', 'FREE'] },
]);

/**
 * Types that may attach a prospect. Selling types always could; Support types
 * are client-linked in practice (a delivery or a collection is FOR someone), so
 * they get the same optional attach. Block types attach nothing — `FREE` shows
 * its label chip row instead, and the other blocks show neither.
 */
export const PROSPECT_ATTACH_TYPES = Object.freeze([
  ...PICKER_GROUPS[0].types,
  ...PICKER_GROUPS[1].types,
]);

/** The picker group a type belongs to ('prospect' | 'support' | 'block'). */
export function groupOfType(type) {
  return PICKER_GROUPS.find((g) => g.types.includes(type))?.key ?? 'prospect';
}

// ── Status set (contract STATUS enum) ────────────────────────────────────────
export const APPOINTMENT_STATUSES = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'kept',      label: 'Kept' },
  { key: 'done',      label: 'Done' },
  { key: 'postponed', label: 'Postponed' },
  { key: 'cancelled', label: 'Cancelled' },
];
export const STATUS_KEYS = APPOINTMENT_STATUSES.map((s) => s.key);

// Free-block labels (fixed set — handoff §11.8).
export const FREE_BLOCK_LABELS = [
  'Training', 'Company seminar', 'Tradeshow', 'Prospecting time', 'Personal',
];

// ── String / number discipline ───────────────────────────────────────────────
function trimStr(v, max) {
  const s = String(v ?? '').trim();
  return max ? s.slice(0, max) : s;
}
function clampDuration(v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return 30;
  return Math.min(720, Math.max(1, n));
}
function coerceApi(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function apptCollection(tenantId) {
  return collection(db, `tenants/${tenantId}/appointments`);
}
function apptRef(tenantId, apptId) {
  return doc(db, `tenants/${tenantId}/appointments/${apptId}`);
}

/**
 * Build the full contract payload for a create. `meta` carries the pinned agent
 * scope (agentId + denormalized unit/branch) from the caller's live profile.
 */
function buildCreatePayload(tenantId, data, meta) {
  const { agentId, agentUnitId, agentBranchId } = meta;
  const type = TYPE_KEYS.includes(data.type) ? data.type : 'PC';
  const status = STATUS_KEYS.includes(data.status) ? data.status : 'scheduled';
  const api = coerceApi(data.apiAmount);
  return {
    tenantId,
    agentId,
    agentUnitId:   trimStr(agentUnitId),
    agentBranchId: trimStr(agentBranchId),
    date:          trimStr(data.date, 10),
    startTime:     trimStr(data.startTime, 5),
    durationMin:   clampDuration(data.durationMin),
    type,
    status,
    note:          trimStr(data.note, 2000),
    // Optional keys — only written when meaningful (extra keys allowed).
    ...(trimStr(data.prospectId) ? { prospectId: trimStr(data.prospectId, 200) } : {}),
    ...(type === 'FREE' && trimStr(data.freeBlockLabel)
      ? { freeBlockLabel: trimStr(data.freeBlockLabel, 120) } : {}),
    ...(api != null ? { apiAmount: api } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

// ── Write paths ──────────────────────────────────────────────────────────────

/**
 * Create an appointment. Stamps denormalized agentUnitId/agentBranchId from the
 * caller's profile (meta). @returns {Promise<string>} the new appointment id.
 */
export async function createAppointment(tenantId, data, meta) {
  const ref = await addDoc(apptCollection(tenantId), buildCreatePayload(tenantId, data, meta));
  return ref.id;
}

/**
 * Create a RECURRING series — materializes N concrete appointment docs (one per
 * occurrence), each carrying series metadata so every instance is self-describing
 * (fits the no-delete / honest-week model: churn is per-instance status flips).
 *
 * `recurrence` = { repeatRule: 'daily'|'weekly'|'custom', daysOfWeek?: string[],
 * endCondition: { type:'count', count } | { type:'date', onDate } }. Occurrence
 * dates come from expandSeriesDates (hard-capped at MAX_SERIES_INSTANCES). All
 * instances are committed in a single writeBatch (atomic; 52 ≪ the 500 cap).
 *
 * `ids` (Run 9 A1 addition): per-instance doc ids in date order, resolved via
 * pre-minted `doc(coll)` refs so callers know every id before the batch
 * commits — the planner's undo/redo history uses this to batch-delete a
 * series create on undo. Non-breaking addition alongside the existing keys.
 *
 * @returns {Promise<{ seriesId: string, count: number, dates: string[], ids: string[] }>}
 */
export async function createRecurringAppointments(tenantId, data, recurrence, meta) {
  const { repeatRule, daysOfWeek = [], endCondition } = recurrence || {};
  const dates = expandSeriesDates({ startDate: data.date, repeatRule, daysOfWeek, endCondition })
    .slice(0, MAX_SERIES_INSTANCES);
  if (!dates.length) throw new Error('Recurrence produced no occurrences.');

  const coll = apptCollection(tenantId);
  const seriesId = doc(coll).id; // mint a stable grouping id (Firestore auto-id)
  const total = dates.length;
  const batch = writeBatch(db);
  const refs = dates.map(() => doc(coll)); // pre-mint per-instance refs so ids are known before commit
  const ids = refs.map((r) => r.id);

  dates.forEach((date, i) => {
    const base = buildCreatePayload(tenantId, { ...data, date }, meta);
    batch.set(refs[i], {
      ...base,
      seriesId,
      repeatRule,
      seriesPos: i + 1,
      seriesTotal: total,
      // daysOfWeek is only meaningful for custom cadence — omit otherwise so the
      // stored shape stays minimal (extra keys are contract-safe either way).
      ...(repeatRule === 'custom' && daysOfWeek.length ? { daysOfWeek } : {}),
    });
  });

  await batch.commit();
  return { seriesId, count: total, dates, ids };
}

/**
 * Hard delete a single appointment. Run 9 A1: this function exists SOLELY as
 * the undo-create inverse for the planner's undo/redo history (undoing a
 * just-created appointment deletes it outright). No UI delete affordance is
 * added anywhere in the app — cancel/postpone remain the only user-facing
 * "remove" actions, which stay status flips (never a real delete).
 */
export async function deleteAppointment(tenantId, apptId) {
  await deleteDoc(apptRef(tenantId, apptId));
}

/**
 * Shared owner-edit patch allowlist (Run 9 A5 extraction) — the SINGLE place
 * the updatable field set is defined. `updateAppointment` and
 * `bulkUpdateAppointments` both build their write payloads here, so a bulk op
 * can never write a field a single edit couldn't. NEVER passes through
 * agentId / agentUnitId / agentBranchId / tenantId (immutable pins the update
 * rule re-validates via the hasAll floor on the merged doc). Always stamps
 * updatedAt: serverTimestamp().
 */
function buildUpdatePatch(patch = {}) {
  const clean = { updatedAt: serverTimestamp() };
  if (patch.date          !== undefined) clean.date = trimStr(patch.date, 10);
  if (patch.startTime     !== undefined) clean.startTime = trimStr(patch.startTime, 5);
  if (patch.durationMin   !== undefined) clean.durationMin = clampDuration(patch.durationMin);
  if (patch.type          !== undefined && TYPE_KEYS.includes(patch.type)) clean.type = patch.type;
  if (patch.status        !== undefined && STATUS_KEYS.includes(patch.status)) clean.status = patch.status;
  if (patch.note          !== undefined) clean.note = trimStr(patch.note, 2000);
  if (patch.prospectId    !== undefined) clean.prospectId = trimStr(patch.prospectId, 200);
  if (patch.freeBlockLabel !== undefined) clean.freeBlockLabel = trimStr(patch.freeBlockLabel, 120);
  if (patch.apiAmount     !== undefined) clean.apiAmount = coerceApi(patch.apiAmount);
  return clean;
}

/**
 * Owner field edit — time / duration / type / note / prospect / free label /
 * apiAmount. Field allowlist lives in buildUpdatePatch (shared with the A5
 * bulk path).
 */
export async function updateAppointment(tenantId, apptId, patch) {
  await updateDoc(apptRef(tenantId, apptId), buildUpdatePatch(patch));
}

/**
 * E4: append one entry to an appointment's timestamped `notes[]` thread. Uses
 * arrayUnion so concurrent adds don't clobber each other. The entry's `at` is a
 * CLIENT ISO string — NEVER serverTimestamp() (Firestore rejects the sentinel
 * inside array elements; banked). `notes` is an extra field the coarse
 * validApptWrite() floor allows (hasAll, not hasOnly); `allow update` still gates
 * on owner (agentId == uid), so this stays appointment-scoped + owner-only. The
 * legacy single `note` field is left untouched (readNoteThread merges it).
 * @param {string} text  note body (trimmed/capped by the caller/UI)
 * @param {boolean} during  "THIS MEETING" tag — note taken while the appt is active
 */
export async function addAppointmentNote(tenantId, apptId, { text, during = false, at }) {
  const entry = { text: String(text ?? '').slice(0, 2000), during: Boolean(during), at: at ?? new Date().toISOString() };
  await updateDoc(apptRef(tenantId, apptId), {
    notes: arrayUnion(entry),
    updatedAt: serverTimestamp(),
  });
}

// Firestore hard-caps a WriteBatch at 500 writes; chunk at 400 for headroom
// (Run 9 A5, operator ruling R6).
export const BULK_CHUNK_SIZE = 400;

/**
 * Bulk owner edit (Run 9 A5) — applies per-doc patches through the SAME
 * allowlist as updateAppointment (buildUpdatePatch), so bulk writes are
 * exactly as constrained as single edits. `updates` = [{ id, patch }].
 *
 * Chunked at BULK_CHUNK_SIZE (400) writes per writeBatch — headroom under
 * Firestore's 500 cap — and chunks commit SEQUENTIALLY: chunk N+1's batch is
 * only built after chunk N's commit resolves. If a chunk commit fails, this
 * THROWS with an error naming how many chunks (and docs) committed vs total —
 * the caller surfaces it; a partial apply is NEVER silent (R6). Rules
 * evaluate client-SDK batch writes per-doc, so each update passes the same
 * owner + validApptWrite arm a single update does.
 *
 * @returns {Promise<{count: number}>} count = total docs written.
 */
export async function bulkUpdateAppointments(tenantId, updates = []) {
  if (updates.length === 0) return { count: 0 };
  const chunks = [];
  for (let i = 0; i < updates.length; i += BULK_CHUNK_SIZE) {
    chunks.push(updates.slice(i, i + BULK_CHUNK_SIZE));
  }
  let committedChunks = 0;
  let committedDocs = 0;
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const { id, patch } of chunk) {
      batch.update(apptRef(tenantId, id), buildUpdatePatch(patch));
    }
    try {
      await batch.commit();
    } catch (err) {
      throw new Error(
        `Bulk update stopped: ${committedChunks} of ${chunks.length} batches committed ` +
        `(${committedDocs} of ${updates.length} appointments applied). ` +
        `${err?.message || 'Commit failed.'}`,
        { cause: err },
      );
    }
    committedChunks += 1;
    committedDocs += chunk.length;
  }
  return { count: committedDocs };
}

/**
 * Status flip (kept / cancelled / postponed / done / confirmed / scheduled). No
 * delete path — cancelled & postponed keep their docs (honest week record).
 * When marking a SALE-converted CI kept, pass apiAmount to stamp the written API.
 */
export async function setAppointmentStatus(tenantId, apptId, status, extra = {}) {
  if (!STATUS_KEYS.includes(status)) {
    throw new Error(`Invalid appointment status: ${status}`);
  }
  const patch = { status, updatedAt: serverTimestamp() };
  if (extra.apiAmount !== undefined) patch.apiAmount = coerceApi(extra.apiAmount);
  await updateDoc(apptRef(tenantId, apptId), patch);
}

/**
 * Postpone-with-rebook: creates the NEW appointment first (to obtain its id),
 * then flips the original to status='postponed' + rescheduledToId=<newId> so the
 * retained original links forward to where it moved. Two writes; returns the new
 * appointment id.
 */
export async function postponeWithRebook(tenantId, originalApptId, newData, meta) {
  const newId = await createAppointment(tenantId, newData, meta);
  await updateDoc(apptRef(tenantId, originalApptId), {
    status: 'postponed',
    rescheduledToId: newId,
    updatedAt: serverTimestamp(),
  });
  return newId;
}

/**
 * Undo-postpone inverse (Run 9 A1): reverses a `postponeWithRebook` call —
 * deletes the newly-rebooked appointment and flips the original back to
 * status:'scheduled' with rescheduledToId cleared. `rescheduledToId` is NOT
 * in `updateAppointment`'s patch allowlist, so it is written directly here,
 * mirroring `postponeWithRebook`'s own style (direct updateDoc, not the
 * allowlisted helper).
 */
export async function undoPostpone(tenantId, originalApptId, newApptId) {
  await deleteDoc(apptRef(tenantId, newApptId));
  await updateDoc(apptRef(tenantId, originalApptId), {
    status: 'scheduled',
    rescheduledToId: null,
    updatedAt: serverTimestamp(),
  });
}

// ── Read paths ───────────────────────────────────────────────────────────────

/** Owner day read — (agentId, date) equality shape. Sorted by startTime. */
export async function getAgentDay(tenantId, agentId, date) {
  const q = query(
    apptCollection(tenantId),
    where('agentId', '==', agentId),
    where('date', '==', date),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
}

/**
 * Owner week read — (agentId, date) composite with a date RANGE
 * [weekStart, weekEnd] (both 'YYYY-MM-DD'). orderBy('date') is index-served by
 * the (agentId ASC, date ASC) composite. Callers group/sort client-side.
 */
export async function getAgentWeek(tenantId, agentId, weekStart, weekEnd) {
  const q = query(
    apptCollection(tenantId),
    where('agentId', '==', agentId),
    where('date', '>=', weekStart),
    where('date', '<=', weekEnd),
    orderBy('date', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Series read (Run 9 F3c) — every concrete instance of one series in date order,
 * across weeks. Owner-scoped: `(agentId, seriesId)` equality + `orderBy('date')`
 * is served by the additive `(agentId ASC, seriesId ASC, date ASC)` composite.
 * agentId==uid keeps it inside the owner `allow list` rules arm. Powers F3d's
 * "edit this and future / edit all" propagation (the loaded week only ever holds
 * 7 days of a series — the propagation window spans the whole series).
 *
 * @returns {Promise<Array<{id:string}>>} instances, ascending by date.
 */
export async function getSeriesInstances(tenantId, agentId, seriesId) {
  const q = query(
    apptCollection(tenantId),
    where('agentId', '==', agentId),
    where('seriesId', '==', seriesId),
    orderBy('date', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Team week read — role-split per the locked contract. Returns ALL team docs in
 * the [weekStart, weekEnd] range; callers group by agent + day. READ-ONLY (no
 * upline write arm exists).
 *   UM (rank 1):  where('agentUnitId','==', uid)      + date range → (agentUnitId,date)
 *   BM (rank 2):  where('agentBranchId','==', branchId) + date range → (agentBranchId,date)
 *   SM+/TA (≥3):  date range only (single-field date index)
 */
export async function getTeamWeek({ tenantId, role, uid, branchId, weekStart, weekEnd }) {
  const rank = getWarRoleRank(role);
  const base = apptCollection(tenantId);
  let q;
  if (rank >= 3) {
    q = query(
      base,
      where('date', '>=', weekStart),
      where('date', '<=', weekEnd),
      orderBy('date', 'asc'),
    );
  } else if (rank === 2) {
    q = query(
      base,
      where('agentBranchId', '==', branchId),
      where('date', '>=', weekStart),
      where('date', '<=', weekEnd),
      orderBy('date', 'asc'),
    );
  } else {
    q = query(
      base,
      where('agentUnitId', '==', uid),
      where('date', '>=', weekStart),
      where('date', '<=', weekEnd),
      orderBy('date', 'asc'),
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
