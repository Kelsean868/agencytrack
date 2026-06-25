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

import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { monthKeyFromDate, monthsBetweenKeys, enumerateMonthKeys } from '../utils/dateInputs';

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

// ─────────────────────────────────────────────────────────────────────────────
// Track K · K2 — monthly financing ledger
//
// Schema: /tenants/{tid}/financing/{agentId}_{YYYY_MM}  (composite doc ID; one
// doc per agent-month). The agent's monthly statement, entered manually. See
// docs/track-k-financing-new-agent-design.md §6/§8 and the K2 build annotation
// (design_handoff_track_k/Track K Monthly Statement Entry - Build.html).
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_KEY_RE = /^\d{4}_\d{2}$/;

// The three basis-source states (CD#3). In K2 the basis is DERIVED at render
// (never stored) from the statement month relative to effectiveDate, so a later
// effectiveDate correction can't strand a stale stored basis. submitted-provisional
// is reserved for K5's live current-month projection — K2 never produces it.
export const BASIS_SOURCES = ['submitted-final', 'submitted-provisional', 'settled-confirmed'];

export const BASIS_SOURCE_LABELS = {
  'submitted-final':       'Submitted · final',
  'submitted-provisional': 'Submitted · provisional',
  'settled-confirmed':     'Settled · confirmed',
};

function financingMonthDocRef(tenantId, agentId, month) {
  return doc(db, `tenants/${tenantId}/financing/${agentId}_${month}`);
}

// 1-based ledger month number for a statement month relative to effectiveDate.
// effectiveDate's own calendar month is month 1. Drives the "MONTH n" chip + the
// basis derivation. Day-of-month is irrelevant (a ledger month is whole-calendar).
// Returns null on a malformed effectiveDate/statementMonth so render consumers
// can fall back rather than crash (Gemini #3).
export function financingMonthIndex(effectiveDate, statementMonth) {
  try {
    return monthsBetweenKeys(monthKeyFromDate(effectiveDate), statementMonth) + 1;
  } catch {
    return null;
  }
}

// Render-derived basis (Decision 5): months 1–3 → submitted-final; month 4+ →
// settled-confirmed (historical/closed statement months are confirmed records).
// submitted-provisional is K5-only and never returned here. A null index
// (malformed effectiveDate) falls back to submitted-final.
export function deriveBasisSource(effectiveDate, statementMonth) {
  const idx = financingMonthIndex(effectiveDate, statementMonth);
  if (idx === null) return 'submitted-final';
  return idx <= 3 ? 'submitted-final' : 'settled-confirmed';
}

// The 6× financing ceiling — basis CORRECTED (contract 2.4 / 6.3): 6 ×
// currentMonthlyFinancing, NOT agreedMonthlyFinancing (this corrects design-spec
// §6 + the mockup; closes the K1-banked ceiling-basis FU). Returns null when the
// terms have no usable current figure.
export function financingCeiling(currentMonthlyFinancing) {
  const cur = parseFloat(currentMonthlyFinancing);
  return Number.isFinite(cur) ? 6 * cur : null;
}

// Skipped-month detection (Decision 7): the gaps between effectiveDate's first
// month and the latest entered month. A gap is FLAGGED, never interpolated.
// Returns the sorted list of missing "YYYY_MM" keys ([] when no entries or no gaps).
export function detectSkippedMonths(effectiveDate, enteredMonthKeys) {
  if (!Array.isArray(enteredMonthKeys) || enteredMonthKeys.length === 0) return [];
  let firstKey;
  try { firstKey = monthKeyFromDate(effectiveDate); } catch { return []; }
  const valid = enteredMonthKeys.filter((k) => MONTH_KEY_RE.test(k ?? ''));
  if (valid.length === 0) return [];
  const entered = new Set(valid);
  // Latest entered month, chronologically (vs firstKey).
  const latestKey = valid.reduce((a, b) => (monthsBetweenKeys(firstKey, b) > monthsBetweenKeys(firstKey, a) ? b : a));
  return enumerateMonthKeys(firstKey, latestKey).filter((k) => !entered.has(k));
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getFinancingMonth(tenantId, agentId, month) {
  if (!tenantId) throw new Error('getFinancingMonth: tenantId required');
  if (!agentId)  throw new Error('getFinancingMonth: agentId required');
  if (!MONTH_KEY_RE.test(month ?? '')) throw new Error('getFinancingMonth: month must be YYYY_MM');
  const snap = await getDoc(financingMonthDocRef(tenantId, agentId, month));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// List one agent's ledger months. Queries on the stored agentId field only (no
// orderBy) so NO composite index is required — the ledger is <= 12 docs/agent-year;
// sort client-side by month ascending. Optional range = { from, to } ("YYYY_MM")
// filters client-side.
export async function listFinancingMonths(tenantId, agentId, range) {
  if (!tenantId) throw new Error('listFinancingMonths: tenantId required');
  if (!agentId)  throw new Error('listFinancingMonths: agentId required');
  const col = collection(db, `tenants/${tenantId}/financing`);
  const snap = await getDocs(query(col, where('agentId', '==', agentId)));
  // Drop any malformed-month docs before month math (Gemini #2) — guards the
  // range filter's monthsBetweenKeys against a bad stored value.
  let rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => typeof r.month === 'string' && MONTH_KEY_RE.test(r.month));
  if (range?.from) rows = rows.filter((r) => monthsBetweenKeys(range.from, r.month) >= 0);
  if (range?.to)   rows = rows.filter((r) => monthsBetweenKeys(r.month, range.to) >= 0);
  return rows.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

// ── Writes ───────────────────────────────────────────────────────────────────

// Create or overwrite an agent's monthly statement. runningBalance is stored
// AUTHORITATIVE — exactly as typed from the statement, never recomputed — and MAY
// be negative (= surplus owed back to the agent). financingPaid / netCommission /
// bonusOffset are non-negative parseFloat numerics (bonusOffset is the manual
// statement value; the 50%-of-net PROJECTION is K4, not here). On overwrite the
// first-entry audit (enteredBy/enteredByName/enteredAt) is preserved; updatedAt
// bumps. merge:true so future K4/K5 fields written by other paths survive.
export async function setFinancingMonth(tenantId, agentId, month, statement, actor) {
  const writerUid = auth?.currentUser?.uid;
  if (!writerUid)                      throw new Error('setFinancingMonth: no signed-in user');
  if (!tenantId)                       throw new Error('setFinancingMonth: tenantId required');
  if (!agentId)                        throw new Error('setFinancingMonth: agentId required');
  if (!MONTH_KEY_RE.test(month ?? '')) throw new Error('setFinancingMonth: month must be YYYY_MM');
  if (!actor || !actor.role)           throw new Error('setFinancingMonth: actor.role required');

  const runningBalance = parseFloat(statement?.runningBalance);
  const financingPaid  = parseFloat(statement?.financingPaid);
  const netCommission  = parseFloat(statement?.netCommission);
  const bonusOffset    = parseFloat(statement?.bonusOffset);

  if (!Number.isFinite(runningBalance))                  throw new Error('setFinancingMonth: runningBalance must be a number');
  if (!Number.isFinite(financingPaid) || financingPaid < 0) throw new Error('setFinancingMonth: financingPaid must be a non-negative number');
  if (!Number.isFinite(netCommission) || netCommission < 0) throw new Error('setFinancingMonth: netCommission must be a non-negative number');
  if (!Number.isFinite(bonusOffset)   || bonusOffset   < 0) throw new Error('setFinancingMonth: bonusOffset must be a non-negative number');

  const notes = typeof statement?.notes === 'string' ? statement.notes : '';

  const ref = financingMonthDocRef(tenantId, agentId, month);
  const existing = await getDoc(ref);
  const now = serverTimestamp();
  const enteredByName = actor.name ?? '';

  const core = {
    agentId,
    tenantId,
    month,
    runningBalance,
    financingPaid,
    netCommission,
    bonusOffset,
    notes,
    source: 'manager_entry',
    updatedAt: now,
  };

  if (existing.exists()) {
    // Re-entry (statement reissued) — preserve first-entry audit, bump updatedAt.
    await setDoc(ref, core, { merge: true });
    return { id: ref.id, ...existing.data(), ...core };
  }

  const created = {
    ...core,
    enteredBy:     writerUid,
    enteredByName: enteredByName,
    enteredAt:     now,
  };
  await setDoc(ref, created);
  return { id: ref.id, ...created };
}
