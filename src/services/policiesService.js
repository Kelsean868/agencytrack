import { db } from '../firebase';
import {
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp,
  writeBatch, doc,
} from 'firebase/firestore';
import { PROSPECTING_SOURCES } from './prospectInfoService';
import { isLegalAgentTransition } from '../constants/policyLifecycle';

const VALID_SOURCES = new Set(PROSPECTING_SOURCES.map((s) => s.value));
const VALID_PRODUCT_LINES = new Set(['life', 'ah', 'property', 'motor']);
const VALID_NEW_BIZ_TYPES = new Set(['nb_ordinary', 'inc_ppp', 'replacement', 'spia', 'lumpsum', 'platinum_edge']);
const VALID_POLICY_CLASSES = new Set(['whole_life', 'term', 'universal_life', 'endowment', 'annuity']);
const VALID_FREQUENCIES = new Set(['A', 'S', 'Q', 'M']);

function validate(data) {
  if (!data.ownerName?.trim()) throw new Error('ownerName is required');
  if (!data.insuredName?.trim()) throw new Error('insuredName is required');
  if (!VALID_PRODUCT_LINES.has(data.productLine)) throw new Error('invalid productLine');
  if (!VALID_NEW_BIZ_TYPES.has(data.newBusinessType)) throw new Error('invalid newBusinessType');
  if (!VALID_POLICY_CLASSES.has(data.policyClass)) throw new Error('invalid policyClass');
  if (!VALID_FREQUENCIES.has(data.proposedFrequency)) throw new Error('invalid proposedFrequency');
  if (!VALID_SOURCES.has(data.sourceOfProspect)) throw new Error('invalid sourceOfProspect');
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
    dateWritten: Timestamp.fromDate(new Date(data.dateWritten)),
    dateSubmitted: Timestamp.fromDate(new Date(data.dateSubmitted)),
    notes: data.notes?.trim() || null,
    isSelfOrFamily: Boolean(data.isSelfOrFamily),
    replacedPolicyAPI: data.newBusinessType === 'replacement' ? (parseFloat(data.replacedPolicyAPI) || null) : null,
    sourceOfProspect: data.sourceOfProspect,
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
    const dateIssued = Timestamp.fromDate(new Date(fields.dateIssued));
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
 * getPolicyHistory — returns history docs for a policy ordered by `at` desc.
 * Used by tests and smoke; history display UI is deferred (H1.2 FU).
 */
export async function getPolicyHistory(tenantId, policyId) {
  const ref = collection(db, 'tenants', tenantId, 'policies', policyId, 'history');
  const snap = await getDocs(query(ref, orderBy('at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
