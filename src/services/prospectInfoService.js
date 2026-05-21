import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

// F3 (Track F): prospect-info — agent-authored, manager-readable.
//
// Privacy direction is OPPOSITE F1/F2: agent owns/reads/edits own; managers in
// scope READ; managers do NOT write. Mirrors the SUBMISSIONS rule shape.
//
// Path: /tenants/{t}/users/{agentId}/prospectInfo/{prospectId}
// Path-bound: agentId in path. agentUnitId denormalized for UM scope.

// Provisional taxonomy — workshop-driven (2026-05-19 Tatil session).
// Also feeds Track H §3.3 "Source of Prospect"; import from here when Track H lands.
export const PROSPECTING_SOURCES = [
  { value: 'seminar',         label: 'Seminar' },
  { value: 'booth-event',     label: 'Booth Event' },
  { value: 'referral',        label: 'Referral' },
  { value: 'cold-call',       label: 'Cold Call' },
  { value: 'social-media',    label: 'Social Media' },
  { value: 'orphan',          label: 'Orphan Policy' },
  { value: 'existing-client', label: 'Existing Client' },
  { value: 'family-friend',   label: 'Family / Friend' },
  { value: 'BOA',             label: 'BOA' },
  { value: 'self',            label: 'Self' },
  { value: 'other',           label: 'Other' },
];

export const APPOINTMENT_TYPES = [
  { value: '2nd-interview',     label: '2nd Interview' },
  { value: 'closing-interview', label: 'Closing Interview' },
];

export const OBJECTIONS = [
  { value: 'no-money',      label: 'No Money' },
  { value: 'no-need',       label: 'No Need' },
  { value: 'no-hurry',      label: 'No Hurry' },
  { value: 'no-confidence', label: 'No Confidence' },
];

const PROSPECTING_SOURCE_VALUES = PROSPECTING_SOURCES.map((s) => s.value);
const APPOINTMENT_TYPE_VALUES   = APPOINTMENT_TYPES.map((a) => a.value);
const OBJECTION_VALUES          = OBJECTIONS.map((o) => o.value);

function prospectRef(tenantId, agentId) {
  return collection(db, `tenants/${tenantId}/users/${agentId}/prospectInfo`);
}

function trim(str, max) {
  return String(str ?? '').trim().slice(0, max);
}

function sanitizeObjections(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v) => OBJECTION_VALUES.includes(v));
}

/**
 * Add a prospect-info prep record for an upcoming joint call.
 * Agent-authored: caller MUST be the agent (rule enforces; this is a client guard).
 */
export async function addProspectInfo({
  tenantId,
  agentId,
  agentUnitId,
  clientName,
  clientAge,
  clientOccupation,
  prospectingSource,
  appointmentType,
  objections,
  policyType,
  intendedAppointmentDate,
}) {
  await addDoc(prospectRef(tenantId, agentId), {
    agentId,
    tenantId,
    agentUnitId: agentUnitId ?? '',
    createdBy: agentId,
    clientName:       trim(clientName, 120),
    clientAge:        parseFloat(clientAge) || 0,
    clientOccupation: trim(clientOccupation, 120),
    prospectingSource,
    appointmentType,
    objections: sanitizeObjections(objections),
    policyType: trim(policyType, 200),
    intendedAppointmentDate: trim(intendedAppointmentDate, 32),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update an existing prospect-info record. Agent-only. Body-shape fields only.
 * The Firestore rule enforces createdBy == caller; this is an additional client guard.
 */
export async function updateProspectInfo({
  tenantId,
  agentId,
  prospectId,
  clientName,
  clientAge,
  clientOccupation,
  prospectingSource,
  appointmentType,
  objections,
  policyType,
  intendedAppointmentDate,
}) {
  await updateDoc(
    doc(db, `tenants/${tenantId}/users/${agentId}/prospectInfo/${prospectId}`),
    {
      clientName:       trim(clientName, 120),
      clientAge:        parseFloat(clientAge) || 0,
      clientOccupation: trim(clientOccupation, 120),
      prospectingSource,
      appointmentType,
      objections: sanitizeObjections(objections),
      policyType: trim(policyType, 200),
      intendedAppointmentDate: trim(intendedAppointmentDate, 32),
      updatedAt: serverTimestamp(),
    },
  );
}

/**
 * List prospect-info records for an agent, visible to the caller.
 *
 * Agent reading own: callerRole === 'agent' && agentId == callerUid → simple
 *   orderBy on intendedAppointmentDate.
 *
 * Manager reading agent's: scope-aware. UM must include
 *   where('agentUnitId','==',callerUid) for the rule's UM clause; BM+/SM/TA/PA
 *   tenant-scoped (no extra filter beyond path).
 *
 * BM+ paths use the auto-built single-field index on intendedAppointmentDate.
 * The UM path uses the composite (agentUnitId asc, intendedAppointmentDate desc)
 * added in firestore.indexes.json.
 */
export async function getProspectInfo({ tenantId, agentId, callerRole, callerUid }) {
  const ref = prospectRef(tenantId, agentId);

  let q;
  if (callerRole === 'unit_manager') {
    q = query(
      ref,
      where('agentUnitId', '==', callerUid),
      orderBy('intendedAppointmentDate', 'desc'),
    );
  } else {
    q = query(ref, orderBy('intendedAppointmentDate', 'desc'));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export {
  PROSPECTING_SOURCE_VALUES,
  APPOINTMENT_TYPE_VALUES,
  OBJECTION_VALUES,
};
