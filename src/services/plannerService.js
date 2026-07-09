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
 * range). NO deletes — cancel/postpone flip status (+ rescheduledToId on rebook).
 *
 * Because updateDoc() merges, a partial update's merged request.resource.data
 * retains every required key, so partial writes are contract-safe as long as no
 * required key is removed or the immutable agent-scope keys mutated (stripped
 * below defensively).
 */

import {
  addDoc, updateDoc, doc, collection, getDocs,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getWarRoleRank } from './managerWarService';

// ── Activity types (selling ladder + free blocks) ────────────────────────────
// Order = the mockup's timeline/legend order. `label` is the display code with
// dots (P.C, S.C, …); `short` is the storage/enum key (contract TYPE set).
export const APPOINTMENT_TYPES = [
  { key: 'PC',   label: 'P.C',  name: 'Prospecting call' },
  { key: 'SC',   label: 'S.C',  name: 'Seen call' },
  { key: 'AI',   label: 'A.I',  name: 'Approach interview' },
  { key: 'FFI',  label: 'F.F.I', name: 'Fact-finding interview' },
  { key: 'CI',   label: 'C.I',  name: 'Closing interview' },
  { key: 'SALE', label: 'Sale', name: 'Life / annuity written' },
  { key: 'FREE', label: 'Free', name: 'Training · seminar · prospecting time · personal' },
];
export const TYPE_KEYS = APPOINTMENT_TYPES.map((t) => t.key);

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
 * Owner field edit — time / duration / type / note / prospect / free label /
 * apiAmount. NEVER changes agentId / agentUnitId / agentBranchId / tenantId
 * (stripped here even if a caller passes them — they are immutable pins the
 * update rule re-validates via the hasAll floor on the merged doc).
 */
export async function updateAppointment(tenantId, apptId, patch) {
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
  await updateDoc(apptRef(tenantId, apptId), clean);
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
