import { db } from '../firebase';
import {
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { PROSPECTING_SOURCES } from './prospectInfoService';

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
