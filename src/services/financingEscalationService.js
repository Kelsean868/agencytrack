import { db } from '../firebase';
import {
  collection, doc, setDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { getTodayTT, monthKeyFromDate } from '../utils/dateInputs';

// Track K · K10b — financing escalations (UM → same-branch BM).
//
// A Unit Manager raises a TRACKED escalation on one of their OWN-unit agents'
// financing; the SAME-BRANCH Branch Manager (and SM/TA/PA) reads an inbox and
// ACKS it. Flat collection /tenants/{tid}/financingEscalations/{escalationId}.
//
// NAMING: everything is prefixed financingEscalation*. This is UNRELATED to
// functions/war/escalationLogic.js (WAR missed-standard upline notify) — no
// shared symbols, no import.
//
// Read model (locked by the K10b rules block):
//   • create — UM only, on an own-unit agent (agentUnitId == caller uid).
//   • get/list — SM/TA/PA tenant-wide, or a BM whose branchId == the doc's
//     denormalized branchId. The UM has NO read arm (raises blind; the inbox is
//     the BM's surface).
//   • update — the ack (status → 'acknowledged'), field-restricted to the ack
//     triple, by a reader.
//
// Idempotency WITHOUT a UM read: the doc ID is deterministic
// ({agentId}_{reason}_{YYYY_MM}). A first raise this month hits the rules
// `create` arm (resource == null) and succeeds. A same-month re-raise routes
// setDoc to the `update` arm (resource != null), which the UM cannot satisfy →
// permission-denied. createFinancingEscalation surfaces that as the
// "already raised this month" state rather than overwriting — no read needed
// (and the UM has none). Re-raise in a LATER month gets a fresh ID and is allowed.

// Reason enum — value must match the Firestore rules `reason in [...]` allowlist.
export const ESCALATION_REASONS = [
  { value: 'draw_decision',    label: 'Draw decision needed' },
  { value: 'confirm_request',  label: 'Confirm production' },
  { value: 'notify_5_3',       label: 'Notify Sales Admin (>10%, clause 5.3)' },
  { value: 'termination_risk', label: 'Termination risk (3rd confirmed miss)' },
];

export const ESCALATION_REASON_VALUES = ESCALATION_REASONS.map((r) => r.value);

/** Human label for a stored reason value (falls back to the raw value). */
export function escalationReasonLabel(value) {
  return ESCALATION_REASONS.find((r) => r.value === value)?.label ?? value;
}

function escalationsCol(tenantId) {
  return collection(db, `tenants/${tenantId}/financingEscalations`);
}

function escalationRef(tenantId, escalationId) {
  return doc(db, `tenants/${tenantId}/financingEscalations/${escalationId}`);
}

/** Deterministic, idempotent-per-month doc ID: {agentId}_{reason}_{YYYY_MM}. */
export function escalationDocId(agentId, reason, monthKey) {
  return `${agentId}_${reason}_${monthKey}`;
}

/**
 * Raise a TRACKED escalation on an agent's financing. UM-only (enforced by rules).
 *
 * Returns:
 *   { created: true,  id, status: 'open' }        — a new escalation was written.
 *   { created: false, alreadyRaised: true, id }   — one already exists for this
 *       agent+reason THIS MONTH; the write was rejected by the rules `update`
 *       arm and nothing was overwritten (re-raise allowed next month).
 * Any other failure (malformed payload, wrong-unit agent, offline) re-throws.
 *
 * @param {object} args
 *   - tenantId, agentId, agentName
 *   - agentUnitId  the agent's unitId (== the raising UM's uid for own-unit agents)
 *   - branchId     the agent's denormalized branchId — the BM inbox read key
 *   - raisedByUid, raisedByName, raisedByRole   the raising manager
 *   - reason       one of ESCALATION_REASON_VALUES
 *   - note         optional free text (trimmed, capped at 2000 like coachingNotes)
 */
export async function createFinancingEscalation({
  tenantId, agentId, agentName, agentUnitId, branchId,
  raisedByUid, raisedByName, raisedByRole, reason, note,
}) {
  const monthKey = monthKeyFromDate(getTodayTT());
  const id = escalationDocId(agentId, reason, monthKey);
  const trimmedNote = (note ?? '').trim().slice(0, 2000);

  try {
    await setDoc(escalationRef(tenantId, id), {
      tenantId,
      agentId,
      agentName,
      agentUnitId,
      branchId,
      raisedByUid,
      raisedByName,
      raisedByRole,
      reason,
      note: trimmedNote,
      status: 'open',
      createdAt: serverTimestamp(),
    });
    return { created: true, id, status: 'open' };
  } catch (err) {
    // A same-month re-raise (doc already exists) routes to the rules `update`
    // arm, which the UM cannot satisfy → permission-denied. Surface it as the
    // idempotent "already raised" state instead of a hard error.
    if (err?.code === 'permission-denied') {
      return { created: false, alreadyRaised: true, id };
    }
    throw err;
  }
}

/**
 * BM inbox query: every escalation for the caller's branch, newest-first within
 * each status group. Uses the K10b composite index
 * (branchId ASC, status ASC, createdAt DESC). SM/TA/PA may pass any branchId to
 * read tenant-wide; a BM passes their own branchId (the rules also enforce it).
 */
export async function listBranchEscalations({ tenantId, branchId }) {
  const snap = await getDocs(query(
    escalationsCol(tenantId),
    where('branchId', '==', branchId),
    orderBy('status', 'asc'),
    orderBy('createdAt', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Acknowledge an escalation (status → 'acknowledged'). Field-restricted to the
 * ack triple to satisfy the rules `update` hasOnly allowlist (SEC-10 precedent).
 */
export async function acknowledgeFinancingEscalation({ tenantId, escalationId, acknowledgedByUid }) {
  await updateDoc(escalationRef(tenantId, escalationId), {
    status: 'acknowledged',
    acknowledgedByUid,
    acknowledgedAt: serverTimestamp(),
  });
}
