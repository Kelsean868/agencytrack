import { db } from '../firebase';
import {
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp,
  writeBatch, doc,
} from 'firebase/firestore';
import { PROSPECTING_SOURCES } from './prospectInfoService';
import { SOCIAL_PLATFORMS_ATTRIBUTION } from '../utils/prospectingConstants';
import { isLegalAgentTransition } from '../constants/policyLifecycle';
import { parseDateOnlyTT } from '../utils/dateInputs';

const VALID_SOURCES          = new Set(PROSPECTING_SOURCES.map((s) => s.value));
const VALID_PRODUCT_LINES    = new Set(['life', 'ah', 'property', 'motor']);
const VALID_NEW_BIZ_TYPES    = new Set(['nb_ordinary', 'inc_ppp', 'replacement', 'spia', 'lumpsum', 'platinum_edge']);
const VALID_POLICY_CLASSES   = new Set(['whole_life', 'term', 'universal_life', 'endowment', 'annuity']);
const VALID_FREQUENCIES      = new Set(['A', 'S', 'Q', 'M']);
const VALID_SOCIAL_PLATFORMS = new Set(SOCIAL_PLATFORMS_ATTRIBUTION.map((p) => p.value));

function validate(data) {
  if (!data.ownerName?.trim()) throw new Error('ownerName is required');
  if (!data.insuredName?.trim()) throw new Error('insuredName is required');
  if (!VALID_PRODUCT_LINES.has(data.productLine)) throw new Error('invalid productLine');
  if (!VALID_NEW_BIZ_TYPES.has(data.newBusinessType)) throw new Error('invalid newBusinessType');
  if (!VALID_POLICY_CLASSES.has(data.policyClass)) throw new Error('invalid policyClass');
  if (!VALID_FREQUENCIES.has(data.proposedFrequency)) throw new Error('invalid proposedFrequency');
  if (!VALID_SOURCES.has(data.sourceOfProspect)) throw new Error('invalid sourceOfProspect');
  if (data.sourceOfProspect === 'social-media' && !data.socialPlatform) throw new Error('socialPlatform is required when source is social-media');
  if (data.socialPlatform != null && !VALID_SOCIAL_PLATFORMS.has(data.socialPlatform)) throw new Error('invalid socialPlatform');
  if (!data.dateWritten) throw new Error('dateWritten is required');
  if (new Date(data.dateWritten) > new Date()) throw new Error('dateWritten cannot be in the future');
  if (!data.dateSubmitted) throw new Error('dateSubmitted is required');
  if (new Date(data.dateSubmitted) < new Date(data.dateWritten)) throw new Error('dateSubmitted must be on or after dateWritten');
  const proposedAPI = parseFloat(data.proposedAPI);
  if (!(proposedAPI > 0)) throw new Error('proposedAPI must be positive');
}

export async function createPolicy(tenantId, agentProfile, data) {
  validate(data);

  const proposedAPI = parseFloat(data.proposedAPI);
  const cashWithApp = {
    collected: Boolean(data.cashWithApp?.collected),
    amount: data.cashWithApp?.collected ? (parseFloat(data.cashWithApp.amount) || 0) : null,
  };

  const payload = {
    tenantId,
    agentId: agentProfile.uid,
    agentNumber: agentProfile.agentNumber ?? null,
    unitId: agentProfile.unitId ?? null,
    branchId: agentProfile.branchId ?? null,
    status: 'submitted',
    statusDate: serverTimestamp(),
    ownerName: data.ownerName.trim(),
    insuredName: data.insuredName.trim(),
    policyNumber: data.policyNumber?.trim() || null,
    productLine: data.productLine,
    newBusinessType: data.newBusinessType,
    policyClass: data.policyClass,
    planId: data.planId?.trim() || null,
    planName: data.planName?.trim() || null,
    proposedPremium: parseFloat(data.proposedPremium) || null,
    proposedFrequency: data.proposedFrequency,
    proposedAPI,
    proposedCoverage: data.proposedCoverage ? parseFloat(data.proposedCoverage) : null,
    dateWritten: Timestamp.fromDate(parseDateOnlyTT(data.dateWritten)),
    dateSubmitted: Timestamp.fromDate(parseDateOnlyTT(data.dateSubmitted)),
    notes: data.notes?.trim() || null,
    isSelfOrFamily: Boolean(data.isSelfOrFamily),
    replacedPolicyAPI: data.newBusinessType === 'replacement' ? (parseFloat(data.replacedPolicyAPI) || null) : null,
    sourceOfProspect: data.sourceOfProspect,
    socialPlatform:   data.sourceOfProspect === 'social-media' ? (data.socialPlatform ?? null) : null,
    cashWithApp,
    dateIssued: null,
    policyDeliveryDate: null,
    createdAt: serverTimestamp(),
    createdBy: agentProfile.uid,
  };

  return addDoc(collection(db, 'tenants', tenantId, 'policies'), payload);
}

export async function getOwnPolicies(tenantId, agentId) {
  const ref = collection(db, 'tenants', tenantId, 'policies');
  const snap = await getDocs(query(ref, where('agentId', '==', agentId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * transitionPolicyStatus — validate legal transition + required fields + parseFloat,
 * then atomically (writeBatch) update the policy doc and create a history doc.
 *
 * @param {string}  tenantId      — tenant scoping key
 * @param {object}  agentProfile  — { uid, unitId, ... }
 * @param {string}  policyId      — Firestore document ID
 * @param {string}  currentStatus — the policy's existing status
 * @param {string}  newStatus     — the target status
 * @param {object}  fields        — per-transition field values (raw from form inputs)
 */
export async function transitionPolicyStatus(tenantId, agentProfile, policyId, currentStatus, newStatus, fields) {
  // JS mirror of rules isLegalAgentTransition
  if (!isLegalAgentTransition(currentStatus, newStatus)) {
    throw new Error(`Illegal status transition: ${currentStatus} → ${newStatus}`);
  }

  // Build the policy update payload and the changedFields audit map.
  // Exclude serverTimestamp sentinels from changedFields (at provides the timestamp).
  const policyUpdate = { status: newStatus, statusUpdatedAt: serverTimestamp() };
  const changedFields = { status: newStatus };

  if (newStatus === 'rated') {
    const ratedPremium = parseFloat(fields.ratedPremium);
    if (!(ratedPremium > 0)) throw new Error('ratedPremium must be a positive number');
    policyUpdate.ratedPremium = ratedPremium;
    changedFields.ratedPremium = ratedPremium;
    const rateReason = fields.rateReason?.trim();
    if (rateReason) { policyUpdate.rateReason = rateReason; changedFields.rateReason = rateReason; }
  } else if (newStatus === 'postponed') {
    const pendingReason = fields.pendingReason?.trim();
    if (pendingReason) { policyUpdate.pendingReason = pendingReason; changedFields.pendingReason = pendingReason; }
  } else if (newStatus === 'ntu') {
    const reason = fields.reason?.trim();
    if (reason) { policyUpdate.reason = reason; changedFields.reason = reason; }
  } else if (newStatus === 'denied') {
    const reason = fields.reason?.trim();
    if (reason) { policyUpdate.reason = reason; changedFields.reason = reason; }
  } else if (newStatus === 'settled') {
    if (!fields.dateIssued) throw new Error('dateIssued is required');
    const settledAPI       = parseFloat(fields.settledAPI);
    const issuedCoverage   = parseFloat(fields.issuedCoverage);
    const initialPremium   = parseFloat(fields.initialPremium);
    const earnedCommission = parseFloat(fields.earnedCommission);
    if (!(settledAPI       > 0))  throw new Error('settledAPI must be positive');
    if (!(issuedCoverage   > 0))  throw new Error('issuedCoverage must be positive');
    if (!(initialPremium   > 0))  throw new Error('initialPremium must be positive');
    if (!(earnedCommission >= 0)) throw new Error('earnedCommission must be non-negative');
    const dateIssued = Timestamp.fromDate(parseDateOnlyTT(fields.dateIssued));
    policyUpdate.dateIssued       = dateIssued;
    policyUpdate.settledAPI       = settledAPI;
    policyUpdate.issuedCoverage   = issuedCoverage;
    policyUpdate.initialPremium   = initialPremium;
    policyUpdate.earnedCommission = earnedCommission;
    changedFields.dateIssued       = dateIssued;
    changedFields.settledAPI       = settledAPI;
    changedFields.issuedCoverage   = issuedCoverage;
    changedFields.initialPremium   = initialPremium;
    changedFields.earnedCommission = earnedCommission;
  }
  // submitted (from postponed): no new fields required

  const policyRef  = doc(db, 'tenants', tenantId, 'policies', policyId);
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));

  const historyDoc = {
    fromStatus:    currentStatus,
    toStatus:      newStatus,
    changedFields,
    actorUid:      agentProfile.uid,
    actorRole:     'agent',
    agentId:       agentProfile.uid,
    unitId:        agentProfile.unitId ?? null,
    at:            serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.update(policyRef, policyUpdate);
  batch.set(historyRef, historyDoc);
  await batch.commit();
}

/**
 * confirmPolicy — manager confirmation of a settled policy (H2a).
 * Atomic writeBatch: updates policy confirmation fields + creates a manager
 * history doc + (only on discrepancy) creates an agent notification.
 *
 * @param {string} tenantId        — tenant scoping key
 * @param {object} managerProfile  — { uid, name, role }
 * @param {string} policyId        — Firestore document ID
 * @param {object} policy          — current policy doc data ({ agentId, unitId, settledAPI, ... })
 * @param {number|string} managerSettledAPI — manager-entered settled API (parseFloat applied)
 * @param {string} managerNote     — optional manager note (empty string allowed)
 */
export async function confirmPolicy(tenantId, managerProfile, policyId, policy, managerSettledAPI, managerNote) {
  const parsedAPI = parseFloat(managerSettledAPI);
  if (!(parsedAPI > 0)) throw new Error('managerSettledAPI must be a positive number');

  const hasDiscrepancy = parsedAPI !== policy.settledAPI;
  const note = managerNote ?? '';

  const policyRef  = doc(db, 'tenants', tenantId, 'policies', policyId);
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));

  const confirmationFields = {
    confirmedByManager: managerProfile.name,
    confirmedByUid:     managerProfile.uid,
    confirmedAt:        serverTimestamp(),
    managerSettledAPI:  parsedAPI,
    managerNote:        note,
    hasDiscrepancy,
  };

  const changedFields = { managerSettledAPI: parsedAPI, hasDiscrepancy };
  if (note.trim()) changedFields.managerNote = note.trim();

  const historyDoc = {
    fromStatus:   'settled',
    toStatus:     'settled',
    changedFields,
    actorUid:     managerProfile.uid,
    actorRole:    managerProfile.role,
    agentId:      policy.agentId,
    unitId:       policy.unitId ?? null,
    at:           serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.update(policyRef, confirmationFields);
  batch.set(historyRef, historyDoc);

  if (hasDiscrepancy) {
    const notifRef = doc(collection(db, 'tenants', tenantId, 'notifications'));
    const agentSettledDisplay = policy.settledAPI != null ? `$${Number(policy.settledAPI).toFixed(2)}` : '(unknown)';
    const managerSettledDisplay = `$${parsedAPI.toFixed(2)}`;
    const policyLabel = policy.ownerName ?? policy.insuredName ?? policy.policyNumber ?? policyId;
    batch.set(notifRef, {
      userId:    policy.agentId,
      tenantId,
      type:      'policy_discrepancy',
      title:     'Policy Confirmation Discrepancy',
      body:      `Your policy for ${policyLabel} was confirmed with manager API ${managerSettledDisplay} vs your settled API of ${agentSettledDisplay}.`,
      link:      null,
      read:      false,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * lapsePolicy — H2c: BM-only settled→lapsed transition.
 * Writes atomically: policy update + history doc + agent notification.
 *
 * @param {string} tenantId
 * @param {object} managerProfile — { uid, name, role }
 * @param {string} policyId       — Firestore document ID
 * @param {object} policy         — current policy doc data ({ agentId, unitId, status, ownerName, ... })
 * @param {object} fields         — { dateLapsed: Firestore Timestamp, lapseReason?: string }
 */
export async function lapsePolicy(tenantId, managerProfile, policyId, policy, fields) {
  const BM_PLUS = ['branch_manager', 'tenant_admin', 'platform_admin'];
  if (!BM_PLUS.includes(managerProfile.role)) {
    throw new Error('Only Branch Manager or above can lapse a policy.');
  }
  if (policy.status !== 'settled') {
    throw new Error('Only settled policies can be lapsed.');
  }
  if (!fields?.dateLapsed) {
    throw new Error('dateLapsed is required to lapse a policy.');
  }

  const policyRef  = doc(db, 'tenants', tenantId, 'policies', policyId);
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));
  const notifRef   = doc(collection(db, 'tenants', tenantId, 'notifications'));

  const policyUpdate = {
    status:          'lapsed',
    statusUpdatedAt: serverTimestamp(),
    dateLapsed:      fields.dateLapsed,
  };
  if (fields.lapseReason?.trim()) policyUpdate.lapseReason = fields.lapseReason.trim();

  const changedFields = { dateLapsed: fields.dateLapsed };
  if (fields.lapseReason?.trim()) changedFields.lapseReason = fields.lapseReason.trim();

  const historyDoc = {
    fromStatus:   'settled',
    toStatus:     'lapsed',
    changedFields,
    actorUid:     managerProfile.uid,
    actorRole:    managerProfile.role,
    agentId:      policy.agentId,
    unitId:       policy.unitId ?? null,
    at:           serverTimestamp(),
  };

  const policyLabel = policy.ownerName ?? policy.insuredName ?? policy.policyNumber ?? policyId;
  const notifDoc = {
    userId:    policy.agentId,
    tenantId,
    type:      'policy_lapsed',
    title:     'Policy Lapsed',
    body:      `Policy for ${policyLabel} has lapsed. This has been deducted from your Centurion progress.`,
    link:      null,
    read:      false,
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.update(policyRef, policyUpdate);
  batch.set(historyRef, historyDoc);
  batch.set(notifRef, notifDoc);
  await batch.commit();
}

/**
 * getPolicyHistory — returns history docs for a policy ordered by `at` desc.
 * Pass `agentId` when calling as an agent so the `where('agentId','==',uid)` filter
 * satisfies the Firestore list rule (which requires the caller to match `resource.data.agentId`).
 * Managers omit `agentId` — their list rule branch doesn't require the filter.
 */
export async function getPolicyHistory(tenantId, policyId, agentId) {
  const ref = collection(db, 'tenants', tenantId, 'policies', policyId, 'history');
  const q = agentId
    ? query(ref, where('agentId', '==', agentId), orderBy('at', 'desc'))
    : query(ref, orderBy('at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Derives a confirmedData-compatible array from settled policy docs for the awards engine.
 * Groups settled policies by month via dateIssued (Firestore Timestamp or Date → YYYY-MM periodKey).
 * Only 'settled' status counts — lapsed policies were deducted and are excluded.
 * Persistency is not sourced here; caller merges from the persistency/settlement collection.
 */
export function settlementShapeFromPolicies(policies) {
  const map = {};
  for (const policy of policies) {
    if (policy.status !== 'settled') continue;
    const dateIssued = policy.dateIssued;
    if (!dateIssued) continue;
    const d = dateIssued.toDate ? dateIssued.toDate() : new Date(dateIssued);
    const periodKey = d.toISOString().substring(0, 7);
    if (!map[periodKey]) map[periodKey] = { periodKey, settledAPI: 0, settledApps: 0, persistency: 0 };
    map[periodKey].settledAPI += parseFloat(policy.settledAPI) || 0;
    map[periodKey].settledApps += 1;
  }
  return Object.values(map);
}

export async function getPoliciesForManager(tenantId, scope) {
  const ref = collection(db, 'tenants', tenantId, 'policies');
  let q;
  if (scope.role === 'unit_manager') {
    q = query(ref, where('tenantId', '==', tenantId), where('unitId', '==', scope.uid), orderBy('createdAt', 'desc'));
  } else if (scope.role === 'branch_manager') {
    q = query(ref, where('tenantId', '==', tenantId), where('branchId', '==', scope.branchId), orderBy('createdAt', 'desc'));
  } else {
    q = query(ref, orderBy('createdAt', 'desc'));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
