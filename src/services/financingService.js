// Track K · K1 — Financing terms service.
//
// Tenant resolution: tenantId is always the explicit first parameter (SEC-9b).
// Never reads import.meta.env. No component writes Firestore directly.
//
// Schema: /tenants/{tid}/financingTerms/{agentId}  (doc ID == agent UID; one
// current-terms doc per agent). See docs/track-k-financing-new-agent-design.md
// §2/§5 and docs/design/track-k-locked-decisions.md (B.9 forward-only state
// machine, B.12 current <= agreed hard-validation).
//
// Business logic lives HERE (and the UI), not in firestore.rules, per the U2
// single-boundary precedent: rules do coarse type/role/enum checks only.

import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

// The five financing-status states (forward-only machine, Addendum B.9).
export const FINANCING_STATUSES = [
  'not_on_financing',
  'on_financing',
  'reconciling',
  'post_financing_repayment',
  'cleared',
];

export const DEFAULT_FINANCING_STATUS = 'not_on_financing';

// Human-facing labels for each state (shared by the badge primitive + setup
// screen). Lives in the data layer so the badge file exports a component only
// (react-refresh).
export const FINANCING_STATUS_LABELS = {
  not_on_financing:         'Not on financing',
  on_financing:             'On Financing',
  reconciling:              'Reconciling',
  post_financing_repayment: 'Post-fin. repayment',
  cleared:                  'Cleared',
};

// Legal forward-only transitions (Addendum B.9). No backward moves; an
// admin-level corrective transition is a deferred follow-up. Terminal state
// `cleared` has no outbound edges. `not_on_financing` (declined / straight
// commission) only ever advances to `on_financing`.
const LEGAL_TRANSITIONS = {
  not_on_financing:         ['on_financing'],
  on_financing:             ['reconciling'],
  reconciling:              ['post_financing_repayment', 'cleared'],
  post_financing_repayment: ['cleared'],
  cleared:                  [],
};

export function isLegalFinancingTransition(fromStatus, toStatus) {
  return (LEGAL_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

// Allowed next states for a given status — drives the UI machine control.
export function allowedNextStatuses(fromStatus) {
  return LEGAL_TRANSITIONS[fromStatus] ?? [];
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function financingDocRef(tenantId, agentId) {
  return doc(db, `tenants/${tenantId}/financingTerms/${agentId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getFinancingTerms(tenantId, agentId) {
  if (!tenantId) throw new Error('getFinancingTerms: tenantId required');
  if (!agentId)  throw new Error('getFinancingTerms: agentId required');
  const snap = await getDoc(financingDocRef(tenantId, agentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

// Create or update the per-agent financing terms. Numerics are parseFloat-
// enforced; `currentMonthlyFinancing <= agreedMonthlyFinancing` is a hard
// validation (B.12); effectiveDate is a bare YYYY-MM-DD string (mirrors
// contractStartDate — no Timestamp, sidesteps the TT split-brain).
//
// On first write the status defaults to not_on_financing with an empty history.
// On overwrite, the existing financingStatus + statusHistory + creation audit
// are preserved (status changes ONLY via transitionFinancingStatus).
export async function setFinancingTerms(tenantId, agentId, terms, actor) {
  const writerUid = auth?.currentUser?.uid;
  if (!writerUid)            throw new Error('setFinancingTerms: no signed-in user');
  if (!tenantId)             throw new Error('setFinancingTerms: tenantId required');
  if (!agentId)              throw new Error('setFinancingTerms: agentId required');
  if (!actor || !actor.role) throw new Error('setFinancingTerms: actor.role required');

  const agreed   = parseFloat(terms?.agreedMonthlyFinancing);
  const current  = parseFloat(terms?.currentMonthlyFinancing);
  const validApi = parseFloat(terms?.validatingAPI);
  const effectiveDate = terms?.effectiveDate;

  if (!Number.isFinite(agreed)   || agreed   < 0) throw new Error('setFinancingTerms: agreedMonthlyFinancing must be a non-negative number');
  if (!Number.isFinite(current)  || current  < 0) throw new Error('setFinancingTerms: currentMonthlyFinancing must be a non-negative number');
  if (!Number.isFinite(validApi) || validApi < 0) throw new Error('setFinancingTerms: validatingAPI must be a non-negative number');
  if (current > agreed)                            throw new Error('setFinancingTerms: currentMonthlyFinancing cannot exceed agreedMonthlyFinancing');
  if (typeof effectiveDate !== 'string' || !DATE_ONLY_RE.test(effectiveDate)) {
    throw new Error('setFinancingTerms: effectiveDate must be a YYYY-MM-DD string');
  }

  const ref = financingDocRef(tenantId, agentId);
  const existing = await getDoc(ref);
  const now = serverTimestamp();

  const core = {
    agentId,
    tenantId,
    agreedMonthlyFinancing:  agreed,
    currentMonthlyFinancing: current,
    validatingAPI:           validApi,
    effectiveDate,
    updatedAt: now,
    updatedBy: writerUid,
  };

  if (existing.exists()) {
    // Terms-only update — preserve status, history, and creation audit.
    await setDoc(ref, core, { merge: true });
    return { id: ref.id, ...existing.data(), ...core };
  }

  const created = {
    ...core,
    financingStatus: DEFAULT_FINANCING_STATUS,
    statusHistory:   [],
    createdAt: now,
    createdBy: writerUid,
  };
  await setDoc(ref, created);
  return { id: ref.id, ...created };
}

// Advance the forward-only status machine. Rejects illegal/no-op transitions and
// appends a statusHistory entry. The in-array `at` uses Timestamp.now() — a REAL
// value, NOT serverTimestamp(): Firestore rejects FieldValue sentinels nested in
// array elements (banked PR #373 / df161fe). The top-level updatedAt keeps the
// serverTimestamp() sentinel. No cap logic — the forward-only 5-state machine is
// naturally bounded (<= 4 transitions).
export async function transitionFinancingStatus(tenantId, agentId, toStatus, actor, note) {
  const writerUid = auth?.currentUser?.uid;
  if (!writerUid)            throw new Error('transitionFinancingStatus: no signed-in user');
  if (!tenantId)             throw new Error('transitionFinancingStatus: tenantId required');
  if (!agentId)              throw new Error('transitionFinancingStatus: agentId required');
  if (!actor || !actor.role) throw new Error('transitionFinancingStatus: actor.role required');
  if (!FINANCING_STATUSES.includes(toStatus)) {
    throw new Error(`transitionFinancingStatus: unknown status "${toStatus}"`);
  }

  const ref = financingDocRef(tenantId, agentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('transitionFinancingStatus: no financing terms for this agent');

  const data = snap.data();
  const fromStatus = data.financingStatus ?? DEFAULT_FINANCING_STATUS;
  if (fromStatus === toStatus) {
    throw new Error(`transitionFinancingStatus: already in "${toStatus}"`);
  }
  if (!isLegalFinancingTransition(fromStatus, toStatus)) {
    throw new Error(`transitionFinancingStatus: illegal transition ${fromStatus} → ${toStatus}`);
  }

  const entry = {
    from:   fromStatus,
    to:     toStatus,
    at:     Timestamp.now(),
    by:     writerUid,
    byName: actor.name ?? '',
    role:   actor.role,
  };
  if (note) entry.note = note;

  const prior = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  const statusHistory = [...prior, entry];

  await setDoc(ref, {
    financingStatus: toStatus,
    statusHistory,
    updatedAt: serverTimestamp(),
    updatedBy: writerUid,
  }, { merge: true });

  return { id: ref.id, ...data, financingStatus: toStatus, statusHistory };
}
