/**
 * appointmentTemplateService.js — Run 9 A4: reusable appointment templates.
 *
 * Collection: /tenants/{tid}/appointmentTemplates/{autoId}  (FLAT tenant
 * collection, per-agent owned). A template is a reusable appointment SHAPE —
 * NOT a booking: it carries no date, no prospect, no series metadata. The
 * agent saves a template from an existing appointment (churn dialog) and
 * applies it when booking a new one (AppointmentSheet), picking the date fresh.
 *
 * Doc shape (locked — the rules `validTemplateWrite` hasOnly mirrors these):
 *  REQUIRED: tenantId, agentId (owner uid), name (1–60), type ∈ TYPE_KEYS,
 *    startTime ('HH:mm'), durationMin (int 1–720), note (≤2000, may be ''),
 *    createdAt, updatedAt.
 *  OPTIONAL: freeBlockLabel (string), apiAmount (number ≥0 | null).
 *
 * Ownership: templates are personal — agentId is pinned to the caller's uid;
 * get/list/delete are owner-only (NO manager read arms). Read is an
 * equality-only query on agentId with a CLIENT-SIDE name sort, deliberately
 * avoiding an (agentId ==, name orderBy) composite index.
 *
 * Cap: an agent may hold at most TEMPLATE_CAP templates; saveTemplate refuses
 * the (cap+1)th with a friendly error rather than writing it.
 */

import {
  addDoc, deleteDoc, doc, collection, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { TYPE_KEYS } from './plannerService';

/** Max templates an agent may keep (client-enforced friendly cap). */
export const TEMPLATE_CAP = 20;

// ── String / number discipline (mirrors plannerService) ──────────────────────
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

function templateCollection(tenantId) {
  return collection(db, `tenants/${tenantId}/appointmentTemplates`);
}
function templateRef(tenantId, id) {
  return doc(db, `tenants/${tenantId}/appointmentTemplates/${id}`);
}

/**
 * Build the full contract payload for a template create. `meta` carries the
 * owner scope (agentId) from the caller's live profile. Optional keys are only
 * written when meaningful (extra keys are hasOnly-safe either way).
 */
function buildTemplatePayload(tenantId, data, meta) {
  const { agentId } = meta;
  const type = TYPE_KEYS.includes(data.type) ? data.type : 'PC';
  const api = coerceApi(data.apiAmount);
  return {
    tenantId,
    agentId,
    name:        trimStr(data.name, 60),
    type,
    startTime:   trimStr(data.startTime, 5),
    durationMin: clampDuration(data.durationMin),
    note:        trimStr(data.note, 2000),
    ...(trimStr(data.freeBlockLabel) ? { freeBlockLabel: trimStr(data.freeBlockLabel, 120) } : {}),
    ...(api != null ? { apiAmount: api } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * List the caller's own templates. Equality-only query on agentId (no orderBy,
 * so no composite index needed) — sorted by name client-side.
 * @returns {Promise<Array<{id:string} & object>>}
 */
export async function listTemplates(tenantId, agentId) {
  const snap = await getDocs(query(templateCollection(tenantId), where('agentId', '==', agentId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/**
 * Save a new template. Pins tenantId/agentId from meta. Enforces the friendly
 * cap: if the caller already holds TEMPLATE_CAP templates, throws instead of
 * writing (the (cap+1)th is refused). Requires a non-empty name.
 * @returns {Promise<string>} the new template id.
 */
export async function saveTemplate(tenantId, data, meta) {
  const name = trimStr(data.name, 60);
  if (!name) throw new Error('Give the template a name first.');

  const existing = await listTemplates(tenantId, meta.agentId);
  if (existing.length >= TEMPLATE_CAP) {
    throw new Error(`You can keep up to ${TEMPLATE_CAP} templates — delete one to save another.`);
  }

  const ref = await addDoc(templateCollection(tenantId), buildTemplatePayload(tenantId, { ...data, name }, meta));
  return ref.id;
}

/** Delete one of the caller's templates (owner-scoped by the rules arm). */
export async function deleteTemplate(tenantId, id) {
  await deleteDoc(templateRef(tenantId, id));
}
