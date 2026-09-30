import { db } from '../firebase';
import {
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp,
  writeBatch, doc, updateDoc, deleteField,
} from 'firebase/firestore';
import { PROSPECTING_SOURCES } from './prospectInfoService';
import { SOCIAL_PLATFORMS_ATTRIBUTION } from '../utils/prospectingConstants';
import { isLegalAgentTransition } from '../constants/policyLifecycle';
import { parseDateOnlyTT, getTodayTT } from '../utils/dateInputs';
import { buildLapseUpdate } from '../lib/policies/lapsePolicyUpdate';
import { excludeImported } from '../lib/portfolioImport/excludeImported';
import { isFromHeadOffice } from '../lib/settledProvenance';
import {
  REINSTATEMENT_NOTE_MAX,
  REINSTATEMENT_EVENTS,
  canDeclareReinstatement,
  hasLiveDeclaration,
} from '../lib/persistency/reinstatementDeclaration';
import {
  STATUS_SOURCE_AGENT,
  STATUS_SOURCE_MANAGER,
} from '../lib/portfolioImport/oipaImportConfig';

/**
 * Roles whose hand-set status reads as `manager` rather than `agent` (P4e).
 * A label for whoever reads the policy later — `firestore.rules` decides what
 * each role may actually do, and pins `statusSetBy` to the caller regardless.
 */
const MANAGER_STATUS_ROLES = new Set([
  'unit_manager', 'branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin',
]);

const VALID_SOURCES          = new Set(PROSPECTING_SOURCES.map((s) => s.value));
const VALID_PRODUCT_LINES    = new Set(['life', 'ah', 'property', 'motor']);
const VALID_NEW_BIZ_TYPES    = new Set(['nb_ordinary', 'inc_ppp', 'replacement', 'spia', 'lumpsum', 'platinum_edge']);
// `critical_illness` added for the OIPA portfolio import (CIB = LifeSpan Gold,
// 13 policies in the 15 Sep 2026 export). NOTE: `firestore.rules` does NOT
// validate policyClass values at all — `policyClass` appears there only inside an
// `affectedKeys().hasOnly([...])` allow-list, so there is no rules enum to mirror
// and no rules deploy is needed for this. Do not confuse it with the rules'
// `critical_illness_or_health`, which is a different field (product-need taxonomy).
const VALID_POLICY_CLASSES   = new Set(['whole_life', 'term', 'universal_life', 'endowment', 'annuity', 'critical_illness']);
const VALID_FREQUENCIES      = new Set(['A', 'S', 'Q', 'M']);
const VALID_SOCIAL_PLATFORMS = new Set(SOCIAL_PLATFORMS_ATTRIBUTION.map((p) => p.value));

/**
 * toTimestamp — the value to STORE. Converts a "YYYY-MM-DD" string (as typed into
 * a date input — parsed at TT-local midnight, never UTC) or a Date to a Firestore
 * Timestamp. Anything else is already a Timestamp (read straight off a policy doc)
 * and is passed through untouched.
 */
function toTimestamp(v) {
  if (v == null) return null;
  if (typeof v === 'string') return Timestamp.fromDate(parseDateOnlyTT(v));
  if (v instanceof Date) return Timestamp.fromDate(v);
  return v;
}

/**
 * millisOf — the millisecond value to COMPARE, read from the RAW input rather than
 * from a converted Timestamp. Deliberately duck-typed across `toMillis()`,
 * `toDate()` and `.seconds`: comparisons must not depend on which Timestamp
 * implementation produced the value. Returns NaN for anything unreadable, so the
 * caller refuses rather than silently comparing against a garbage number.
 */
function millisOf(v) {
  if (v == null) return NaN;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') return parseDateOnlyTT(v).getTime();
  return NaN;
}

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
  // dateSubmitted is NOT required at create (slice 1A / D1): a policy opens at
  // `written`, and the day it reached head office is not known until it does.
  // The `dateSubmitted >= dateWritten` check MOVED to the written → submitted
  // transition below, and is mirrored in firestore.rules Arm B.
  const proposedAPI = parseFloat(data.proposedAPI);
  if (!(proposedAPI > 0)) throw new Error('proposedAPI must be positive');
  // R4 — a replacement's credit is the DIFFERENCE between the new API and the
  // API of the policy it replaced (Rule 4 of the Christmas Campaign document),
  // so a replacement without that figure cannot be credited at all: the campaign
  // lens has to abstain and show 'Replaced API not recorded'. Required at create
  // rather than patched later, because the number is known at the point of sale
  // and nowhere else. Zero IS a valid answer (nothing was in force); blank is not.
  if (data.newBusinessType === 'replacement') {
    const replaced = parseFloat(data.replacedPolicyAPI);
    if (!Number.isFinite(replaced) || replaced < 0) {
      throw new Error('replacedPolicyAPI is required for a replacement');
    }
  }
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
    // D1 — a policy record opens at `written`, not `submitted`.
    status: 'written',
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
    // Stamped null at create; written by the `written → submitted` transition.
    // A policy at `written` has not been submitted, so it carries no submitted date.
    dateSubmitted: null,
    notes: data.notes?.trim() || null,
    isSelfOrFamily: Boolean(data.isSelfOrFamily),
    // `parseFloat(x) || null` used to live here and turned a legitimate ZERO
    // into null — indistinguishable from "not recorded", which makes the
    // campaign lens abstain on a policy that should credit its full new API.
    // validate() now guarantees a finite non-negative number for a replacement,
    // so the coercion is exact.
    replacedPolicyAPI: data.newBusinessType === 'replacement' ? parseFloat(data.replacedPolicyAPI) : null,
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

/**
 * getOwnPolicies — one agent's policies, newest first.
 *
 * P2b (SEC-08): when a MANAGER reads another agent's book, pass the caller's
 * `scope` ({ role, uid, branchId } — same shape as getPoliciesForManager) so the
 * query carries the clause the scoped list rule needs: BM → where('branchId'),
 * UM → where('unitId' == uid). SM / TA / PA and self-reads pass nothing.
 * Indexes: (agentId, branchId, createdAt desc) and (agentId, unitId, createdAt desc).
 */
export async function getOwnPolicies(tenantId, agentId, scope) {
  const ref = collection(db, 'tenants', tenantId, 'policies');
  const scopeClauses = scope?.role === 'branch_manager' ? [where('branchId', '==', scope.branchId ?? null)]
    : scope?.role === 'unit_manager' ? [where('unitId', '==', scope.uid ?? null)]
      : [];
  const snap = await getDocs(query(ref, where('agentId', '==', agentId), ...scopeClauses, orderBy('createdAt', 'desc')));
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

  /* P4e — STATUS PROVENANCE. A person is setting this status, so the document
   * must say so.
   *
   * These three are NOT optional, on any edge. `firestore.rules` now guards
   * every status arm with `statusSource in ['agent','manager']` and
   * `statusSetBy == request.auth.uid`, and rules see the document AFTER the
   * write — so a transition that omits them leaves whatever was there before
   * (`oipa_import` on an imported policy, or nothing at all on an organic one)
   * and Firestore rejects the whole write. Omitting them does not lose the
   * stamp; it breaks the transition.
   *
   * `manager` vs `agent` is read from the caller's own profile role. It is a
   * label for the reader, not a permission — the rules decide what each role may
   * actually do, and the uid is pinned to the caller either way. */
  const isManagerRole = MANAGER_STATUS_ROLES.has(agentProfile?.role);
  policyUpdate.statusSource = isManagerRole ? STATUS_SOURCE_MANAGER : STATUS_SOURCE_AGENT;
  policyUpdate.statusSetBy = agentProfile.uid;
  policyUpdate.statusAsOf = getTodayTT();
  changedFields.statusSource = policyUpdate.statusSource;
  changedFields.statusSetBy = policyUpdate.statusSetBy;

  if (currentStatus === 'written' && newStatus === 'submitted') {
    // Per-edge requirement — EDGE_REQUIRED_FIELDS['written->submitted'].
    // The postponed → submitted re-entry stays field-free and falls through.
    // `dateWritten` is passed in from the policy doc purely to run the ordering
    // check here; it is never written back.
    if (!fields?.dateSubmitted) throw new Error('dateSubmitted is required to submit an application');
    if (!fields?.dateWritten)   throw new Error('dateWritten is required to check dateSubmitted');
    const submittedMs = millisOf(fields.dateSubmitted);
    const writtenMs   = millisOf(fields.dateWritten);
    if (!Number.isFinite(submittedMs)) throw new Error('dateSubmitted is not a readable date');
    if (!Number.isFinite(writtenMs))   throw new Error('dateWritten is not a readable date');
    if (submittedMs > Date.now())  throw new Error('dateSubmitted cannot be in the future');
    if (submittedMs < writtenMs)   throw new Error('dateSubmitted must be on or after dateWritten');
    const dateSubmitted = toTimestamp(fields.dateSubmitted);
    policyUpdate.dateSubmitted  = dateSubmitted;
    changedFields.dateSubmitted = dateSubmitted;
  } else if (newStatus === 'rated') {
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
  // submitted (from postponed): no new fields required — handled by falling
  // through every branch above, which is the field-free re-entry.

  const policyRef  = doc(db, 'tenants', tenantId, 'policies', policyId);
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));

  const historyDoc = {
    fromStatus:    currentStatus,
    toStatus:      newStatus,
    changedFields,
    actorUid:      agentProfile.uid,
    actorRole:     agentProfile.role ?? 'agent',
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
 * The four settled-detail fields an agent confirms (P2d). Same fields, same
 * guards as the `→ settled` transition above; firestore.rules Arm F.
 */
export const SELF_CONFIRM_FIELDS = Object.freeze([
  'settledAPI', 'issuedCoverage', 'initialPremium', 'earnedCommission',
]);

/**
 * selfConfirmPolicy — the agent confirms their OWN settled policy's details
 * (P2d; Kyron, 26 Sep 2026 — BUG-01 option B). Atomic writeBatch: the four
 * detail fields + provenance stamps on the policy, and a settled → settled
 * history event.
 *
 * Never touches status, dateIssued or statusSource, so the award period and the
 * provenance bucket cannot move. Refuses a head-office policy outright — its
 * figures are locked (Kyron, 27 Sep 2026, option A). Stamps are
 * `selfConfirmedBy/At` + `enteredBy/At` — NOT `confirmedAt`, which is the
 * manager's (Arm C) and which `isConfirmed()` reads.
 *
 * @param {string} tenantId
 * @param {object} agentProfile — { uid, role, unitId }
 * @param {string} policyId
 * @param {object} policy       — current policy doc ({ agentId, status, confirmedByUid, ... })
 * @param {object} fields       — raw form values for SELF_CONFIRM_FIELDS
 */
export async function selfConfirmPolicy(tenantId, agentProfile, policyId, policy, fields) {
  if (policy?.agentId !== agentProfile?.uid) throw new Error('You can only confirm your own policies');
  if (policy?.status !== 'settled') throw new Error('Only a settled policy can be confirmed');
  if (policy?.confirmedByUid) throw new Error('A manager has already confirmed this policy');
  // Kyron's ruling, 27 Sep 2026 (option A): head-office figures are locked
  // (firestore.rules isHeadOfficeStatus). Self-confirm is for the agent's own
  // self-declared settlements only.
  if (isFromHeadOffice(policy)) throw new Error('These figures were set by head office and cannot be changed');

  const settledAPI       = parseFloat(fields?.settledAPI);
  const issuedCoverage   = parseFloat(fields?.issuedCoverage);
  const initialPremium   = parseFloat(fields?.initialPremium);
  const earnedCommission = parseFloat(fields?.earnedCommission);
  if (!(settledAPI       > 0))  throw new Error('settledAPI must be positive');
  if (!(issuedCoverage   > 0))  throw new Error('issuedCoverage must be positive');
  if (!(initialPremium   > 0))  throw new Error('initialPremium must be positive');
  if (!(earnedCommission >= 0)) throw new Error('earnedCommission must be non-negative');

  const details = { settledAPI, issuedCoverage, initialPremium, earnedCommission };
  const policyRef  = doc(db, 'tenants', tenantId, 'policies', policyId);
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));

  const batch = writeBatch(db);
  batch.update(policyRef, {
    ...details,
    selfConfirmedBy: agentProfile.uid,
    selfConfirmedAt: serverTimestamp(),
    enteredBy:       agentProfile.uid,
    enteredAt:       serverTimestamp(),
  });
  batch.set(historyRef, {
    fromStatus:    'settled',
    toStatus:      'settled',
    changedFields: { ...details, selfConfirmedBy: agentProfile.uid },
    actorUid:      agentProfile.uid,
    actorRole:     agentProfile.role ?? 'agent',
    agentId:       agentProfile.uid,
    unitId:        agentProfile.unitId ?? null,
    at:            serverTimestamp(),
  });
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

  // F-1 (audit A-1): the update carries status provenance, or rules Arm D
  // denies it. Built by a pure function the emulator rules test also imports.
  const { policyUpdate, changedFields } = buildLapseUpdate({
    managerUid:      managerProfile.uid,
    fields,
    today:           getTodayTT(),
    statusUpdatedAt: serverTimestamp(),
  });

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
 * declareReinstatement — FR-6 (Option A): the agent declares that their OWN
 * LAPSED policy has been reinstated, while head office still shows it lapsed
 * (docs/audits/fr-6-mark-reinstated-recon.md § 3; Kyron ruling R-b). Atomic
 * writeBatch: the three declaration fields on the policy, and a lapsed → lapsed
 * `reinstatement_declared` history event.
 *
 * Never touches status, statusSource or any money field (firestore.rules Arm G
 * refuses the write if it did), so the P2d head-office lock holds and no
 * award, financing or commission figure moves. No amount is stored: readers
 * take the lapse's own API from the ledger evidence.
 *
 * @param {string} tenantId
 * @param {object} agentProfile — { uid, role, unitId }
 * @param {string} policyId
 * @param {object} policy       — current policy doc ({ agentId, status, ... })
 * @param {{ note?: string }} [opts] — optional short note (receipt reference), ≤ 200 chars
 */
export async function declareReinstatement(tenantId, agentProfile, policyId, policy, { note } = {}) {
  // JS mirror of Arm G.
  if (policy?.agentId !== agentProfile?.uid) throw new Error('You can only mark your own policies reinstated');
  if (policy?.status !== 'lapsed') throw new Error('Only a lapsed policy can be marked reinstated');
  if (!canDeclareReinstatement(policy, agentProfile)) throw new Error('Your role cannot mark a policy reinstated');
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (trimmed.length > REINSTATEMENT_NOTE_MAX) {
    throw new Error(`The note can be at most ${REINSTATEMENT_NOTE_MAX} characters`);
  }

  const policyRef  = doc(db, 'tenants', tenantId, 'policies', policyId);
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));

  const batch = writeBatch(db);
  batch.update(policyRef, {
    reinstatementDeclaredAt: serverTimestamp(),
    reinstatementDeclaredBy: agentProfile.uid,
    // An empty note is removed, not stored as ''.
    reinstatementNote: trimmed ? trimmed : deleteField(),
  });
  batch.set(historyRef, {
    fromStatus:    'lapsed',
    toStatus:      'lapsed',
    event:         REINSTATEMENT_EVENTS.declared,
    changedFields: { reinstatementDeclaredBy: agentProfile.uid, ...(trimmed ? { reinstatementNote: trimmed } : {}) },
    actorUid:      agentProfile.uid,
    actorRole:     agentProfile.role ?? 'agent',
    agentId:       agentProfile.uid,
    unitId:        agentProfile.unitId ?? null,
    at:            serverTimestamp(),
  });
  await batch.commit();
}

/**
 * withdrawReinstatement — FR-6: the agent withdraws their declaration on their
 * OWN LAPSED policy. Atomic writeBatch: the three declaration fields deleted,
 * and a lapsed → lapsed `reinstatement_withdrawn` history event. Same limits as
 * declareReinstatement (Arm G).
 *
 * @param {string} tenantId
 * @param {object} agentProfile — { uid, role, unitId }
 * @param {string} policyId
 * @param {object} policy       — current policy doc
 */
export async function withdrawReinstatement(tenantId, agentProfile, policyId, policy) {
  if (policy?.agentId !== agentProfile?.uid) throw new Error('You can only change your own policies');
  if (policy?.status !== 'lapsed') throw new Error('Only a lapsed policy has a reinstatement to withdraw');
  if (!canDeclareReinstatement(policy, agentProfile)) throw new Error('Your role cannot change this declaration');
  if (!hasLiveDeclaration(policy)) throw new Error('This policy is not marked reinstated');

  const policyRef  = doc(db, 'tenants', tenantId, 'policies', policyId);
  const historyRef = doc(collection(db, 'tenants', tenantId, 'policies', policyId, 'history'));

  const batch = writeBatch(db);
  batch.update(policyRef, {
    reinstatementDeclaredAt: deleteField(),
    reinstatementDeclaredBy: deleteField(),
    reinstatementNote:       deleteField(),
  });
  batch.set(historyRef, {
    fromStatus:    'lapsed',
    toStatus:      'lapsed',
    event:         REINSTATEMENT_EVENTS.withdrawn,
    changedFields: { reinstatementDeclaredBy: null },
    actorUid:      agentProfile.uid,
    actorRole:     agentProfile.role ?? 'agent',
    agentId:       agentProfile.uid,
    unitId:        agentProfile.unitId ?? null,
    at:            serverTimestamp(),
  });
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

// Re-exported from src/lib/policiesDerivation.js (single source of truth).
// The harness imports from policiesDerivation.js directly to avoid the client-SDK chain.
export { settlementShapeFromPolicies } from '../lib/policiesDerivation';

/**
 * getDeliverablePolicies — the CRO Delivery Register read (Tier-3 3.1).
 *
 * Returns every SETTLED policy in the tenant. The register splits these
 * client-side into undelivered (`policyDeliveryDate == null`) vs delivered.
 *
 * Query shape: a SINGLE equality filter (`status == 'settled'`) with NO
 * orderBy. Firestore serves single-equality/no-orderBy queries from the
 * automatic per-field index — no composite index is required. Sorting (by
 * clawback urgency) is done client-side in the panel. The rules `allow list`
 * arm accepts this read via `isCroInTenant()` (the tenant path already scopes
 * the collection; the CRO arm needs no extra where() clause, unlike the agent
 * arm which must filter by agentId).
 *
 * @param {string} tenantId
 * @returns {Promise<object[]>} settled policy docs ({ id, ...data })
 */
export async function getDeliverablePolicies(tenantId) {
  const ref = collection(db, 'tenants', tenantId, 'policies');
  const snap = await getDocs(query(ref, where('status', '==', 'settled')));
  // Imported historical policies are NOT deliverable — they were delivered years
  // ago, outside this system. Without this filter the CRO's Delivery Register
  // opens to 117 settled OIPA docs apparently awaiting delivery. Filtered here
  // rather than at the caller because this reader has exactly one consumer and
  // no legitimate use for imported docs. (Dispatcher ruling 5e / P2b.)
  return excludeImported(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/**
 * recordPolicyDelivery — CRO marks a settled policy delivered (Tier-3 3.1,
 * rules Arm E). Writes EXACTLY the three delivery contract fields via a plain
 * updateDoc so the rule's `hasOnly(['policyDeliveryDate','deliveredBy',
 * 'deliveredAt'])` diff-check holds:
 *   - policyDeliveryDate: Timestamp (the chosen delivery day, TT-local midnight;
 *     defaults to today; NEVER future — enforced client-side here and in rules)
 *   - deliveredBy: the acting CRO's uid (rules pin this to request.auth.uid)
 *   - deliveredAt: serverTimestamp (audit stamp)
 *
 * The 30-day clawback clock is a display derivation (utils/clawbackClock.js) and
 * is NEVER written here.
 *
 * @param {string} tenantId
 * @param {string} policyId
 * @param {{ deliveredBy: string, deliveryDate?: string }} opts
 *        deliveryDate is a "YYYY-MM-DD" string; omitted → today (TT).
 */
export async function recordPolicyDelivery(tenantId, policyId, { deliveredBy, deliveryDate } = {}) {
  if (!deliveredBy) throw new Error('deliveredBy is required');
  const dateStr = deliveryDate || getTodayTT();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('deliveryDate must be YYYY-MM-DD');
  if (dateStr > getTodayTT()) throw new Error('Delivery date cannot be in the future');

  const policyRef = doc(db, 'tenants', tenantId, 'policies', policyId);
  await updateDoc(policyRef, {
    policyDeliveryDate: Timestamp.fromDate(parseDateOnlyTT(dateStr)),
    deliveredBy,
    deliveredAt: serverTimestamp(),
  });
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
  // Both consumers of this reader aggregate (PolicyReconciliationPanel totals a
  // manager's book, useStrategicPlan projects from it), so the exclusion belongs
  // here rather than duplicated at each. (Dispatcher ruling 5e / P2b.)
  return excludeImported(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}
