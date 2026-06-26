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

// ─────────────────────────────────────────────────────────────────────────────
// Track K · K5 — validation-schedule proration
//
// Writes the proration fields onto the SAME financing/{agentId}_{YYYY_MM} doc
// (the K2 ledger doc). Proration is FORWARD — it sets the coming month's draw
// before any statement exists — so this method MAY create the doc with proration
// fields only (no statement core). The K2 rules block was restructured (K5) so the
// statement-core fields are required only when a statement field is present; a
// proration-only write is permitted (no hasOnly / no key-allowlist preserved).
//
// All numerics parseFloat-enforced. basisSource is validated against BASIS_SOURCES
// (K5 IS the writer of basisSource — K2 reserved it, derived-at-render only).
// managerFinancing + adjustmentPct are OPTIONAL: a bare system suggestion writes
// neither; once the manager confirms, both are stored (adjustmentPct is computed by
// the caller via financingProration.computeAdjustmentPct on the CONFIRMED figure —
// lock b). runningBalance and the statement core are NEVER touched here (merge:true
// preserves them); proration never overwrites the authoritative statement.
export async function setFinancingProration(tenantId, agentId, month, proration, actor) {
  const writerUid = auth?.currentUser?.uid;
  if (!writerUid)                      throw new Error('setFinancingProration: no signed-in user');
  if (!tenantId)                       throw new Error('setFinancingProration: tenantId required');
  if (!agentId)                        throw new Error('setFinancingProration: agentId required');
  if (!MONTH_KEY_RE.test(month ?? '')) throw new Error('setFinancingProration: month must be YYYY_MM');
  if (!actor || !actor.role)           throw new Error('setFinancingProration: actor.role required');

  const validatingAPI      = parseFloat(proration?.validatingAPI);
  const actualAPI          = parseFloat(proration?.actualAPI);
  const suggestedFinancing = parseFloat(proration?.suggestedFinancing);
  const { basisSource } = proration ?? {};

  if (!Number.isFinite(validatingAPI)      || validatingAPI      < 0) throw new Error('setFinancingProration: validatingAPI must be a non-negative number');
  if (!Number.isFinite(actualAPI)          || actualAPI          < 0) throw new Error('setFinancingProration: actualAPI must be a non-negative number');
  if (!Number.isFinite(suggestedFinancing) || suggestedFinancing < 0) throw new Error('setFinancingProration: suggestedFinancing must be a non-negative number');
  if (!BASIS_SOURCES.includes(basisSource)) throw new Error(`setFinancingProration: basisSource must be one of ${BASIS_SOURCES.join(', ')}`);

  // managerFinancing is optional — present only once the manager confirms a figure.
  let managerFinancing;
  const hasManager = proration?.managerFinancing !== undefined
    && proration?.managerFinancing !== null
    && proration?.managerFinancing !== '';
  if (hasManager) {
    managerFinancing = parseFloat(proration.managerFinancing);
    if (!Number.isFinite(managerFinancing) || managerFinancing < 0) {
      throw new Error('setFinancingProration: managerFinancing must be a non-negative number when present');
    }
  }

  // adjustmentPct rides with the confirmed figure: stored only when managerFinancing
  // is set (lock b). The caller computes it; the service stores the typed value. May
  // be negative (managerFinancing above the current amount in effect).
  let adjustmentPct;
  const hasAdjustment = hasManager
    && proration?.adjustmentPct !== undefined
    && proration?.adjustmentPct !== null
    && proration?.adjustmentPct !== '';
  if (hasAdjustment) {
    adjustmentPct = parseFloat(proration.adjustmentPct);
    if (!Number.isFinite(adjustmentPct)) {
      throw new Error('setFinancingProration: adjustmentPct must be a number when present');
    }
  }

  const ref = financingMonthDocRef(tenantId, agentId, month);
  const existing = await getDoc(ref);
  const now = serverTimestamp();

  const core = {
    agentId,
    tenantId,
    month,
    validatingAPI,
    actualAPI,
    suggestedFinancing,
    basisSource,
    prorationUpdatedAt: now,
    prorationUpdatedBy: writerUid,
  };
  if (hasManager)    core.managerFinancing = managerFinancing;
  if (hasAdjustment) core.adjustmentPct    = adjustmentPct;

  if (existing.exists()) {
    // Merge onto the existing doc (statement and/or prior proration) — never touch
    // runningBalance or the statement core; preserve first-proration audit.
    await setDoc(ref, core, { merge: true });
    return { id: ref.id, ...existing.data(), ...core };
  }

  // Forward proration before any statement — create the doc with proration only.
  const created = {
    ...core,
    source: 'manager_entry',
    prorationEnteredBy:     writerUid,
    prorationEnteredByName: actor.name ?? '',
    prorationEnteredAt:     now,
  };
  await setDoc(ref, created);
  return { id: ref.id, ...created };
}

// ─────────────────────────────────────────────────────────────────────────────
// Track K · K6 — reconciliation event + record
//
// Schema: /tenants/{tid}/financingReconciliation/{agentId}_{year}  (composite doc
// ID; one record per agent-year). The year-1 wind-down event (or earlier on a 6.5b
// election): applies the service-gated waiver, computes surplus-or-owing, writes the
// record, and drives the status machine forward. The reconciliation MATH is the pure
// lib (src/lib/financingReconciliation.js) — this method persists the computed record
// and drives K1's machine (it does NOT re-implement the state machine or the calc).
// See docs/track-k-financing-new-agent-design.md §5/§6 and the K6 build annotation
// (design_handoff_track_k/Track K Reconciliation - Build.html).
// ─────────────────────────────────────────────────────────────────────────────

// The two reconciliation outcomes / triggers (mirror the lib's exports; defined here
// too so the data layer validates without importing the calc module — same pattern as
// FINANCING_STATUSES / BASIS_SOURCES).
export const RECONCILIATION_OUTCOMES = ['owing', 'surplus'];
export const RECONCILIATION_TRIGGERS = ['auto_month12', 'manual_election'];

const YEAR_RE = /^\d{4}$/;

function financingReconciliationDocRef(tenantId, agentId, year) {
  return doc(db, `tenants/${tenantId}/financingReconciliation/${agentId}_${year}`);
}

export async function getFinancingReconciliation(tenantId, agentId, year) {
  if (!tenantId)               throw new Error('getFinancingReconciliation: tenantId required');
  if (!agentId)                throw new Error('getFinancingReconciliation: agentId required');
  if (!YEAR_RE.test(String(year ?? ''))) throw new Error('getFinancingReconciliation: year must be YYYY');
  const snap = await getDoc(financingReconciliationDocRef(tenantId, agentId, year));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Persist the reconciliation record AND drive the status machine to the terminal state.
//
// Precondition: the agent is ALREADY in `reconciling` (the begin-reconciliation step —
// on_financing → reconciling — is a separate transitionFinancingStatus call, mirroring
// the mockup's event-bar before the worksheet). Ordering matters (mockup "Error · write
// failed" state): the record is written FIRST and the status is advanced ONLY after the
// write resolves, so a failed write never strands the agent in a half-settled state.
//
// `reconciliation` is the computeReconciliation output (numerics + outcome + triggeredBy).
// nextStatus is RE-DERIVED from outcome here (never trusted from the caller). Numerics are
// parseFloat-enforced; outcome/triggeredBy validated against the enums. On overwrite (a
// re-reconciliation) the first-create audit is preserved.
export async function reconcileFinancing(tenantId, agentId, year, reconciliation, actor) {
  const writerUid = auth?.currentUser?.uid;
  if (!writerUid)            throw new Error('reconcileFinancing: no signed-in user');
  if (!tenantId)             throw new Error('reconcileFinancing: tenantId required');
  if (!agentId)              throw new Error('reconcileFinancing: agentId required');
  if (!YEAR_RE.test(String(year ?? ''))) throw new Error('reconcileFinancing: year must be YYYY');
  if (!actor || !actor.role) throw new Error('reconcileFinancing: actor.role required');

  const rec = reconciliation ?? {};
  const outcome     = rec.outcome;
  const triggeredBy = rec.triggeredBy;
  if (!RECONCILIATION_OUTCOMES.includes(outcome))     throw new Error(`reconcileFinancing: outcome must be one of ${RECONCILIATION_OUTCOMES.join(', ')}`);
  if (!RECONCILIATION_TRIGGERS.includes(triggeredBy)) throw new Error(`reconcileFinancing: triggeredBy must be one of ${RECONCILIATION_TRIGGERS.join(', ')}`);

  const totalFinancingDrawn = parseFloat(rec.totalFinancingDrawn);
  const totalOffsets        = parseFloat(rec.totalOffsets);
  const closingBalance      = parseFloat(rec.closingBalance);
  const waiverApplied       = parseFloat(rec.waiverApplied);
  const reconciledPosition  = parseFloat(rec.reconciledPosition);
  const surplusPaid         = parseFloat(rec.surplusPaid);
  const serviceMonths       = parseFloat(rec.serviceMonths);
  if (!Number.isFinite(totalFinancingDrawn)) throw new Error('reconcileFinancing: totalFinancingDrawn must be a number');
  if (!Number.isFinite(totalOffsets))        throw new Error('reconcileFinancing: totalOffsets must be a number');
  if (!Number.isFinite(closingBalance))      throw new Error('reconcileFinancing: closingBalance must be a number');
  if (!Number.isFinite(waiverApplied) || waiverApplied < 0) throw new Error('reconcileFinancing: waiverApplied must be a non-negative number');
  if (!Number.isFinite(reconciledPosition))  throw new Error('reconcileFinancing: reconciledPosition must be a number');
  if (!Number.isFinite(surplusPaid) || surplusPaid < 0)     throw new Error('reconcileFinancing: surplusPaid must be a non-negative number');
  if (!Number.isFinite(serviceMonths) || serviceMonths < 0) throw new Error('reconcileFinancing: serviceMonths must be a non-negative number');

  // Status precondition — must be mid-reconciliation. Begin-reconciliation
  // (on_financing → reconciling) is a separate explicit transition.
  const termsRef  = financingDocRef(tenantId, agentId);
  const termsSnap = await getDoc(termsRef);
  if (!termsSnap.exists()) throw new Error('reconcileFinancing: no financing terms for this agent');
  const currentStatus = termsSnap.data().financingStatus ?? DEFAULT_FINANCING_STATUS;
  if (currentStatus !== 'reconciling') {
    throw new Error(`reconcileFinancing: agent must be in 'reconciling' (is '${currentStatus}') — begin reconciliation first`);
  }

  const nextStatus = outcome === 'surplus' ? 'cleared' : 'post_financing_repayment';

  // 1) Write the record FIRST (mockup error-state rule: never advance status on an
  //    unpersisted record).
  const ref = financingReconciliationDocRef(tenantId, agentId, year);
  const existing = await getDoc(ref);
  const now = serverTimestamp();
  const core = {
    agentId,
    tenantId,
    year: Number(year),
    totalFinancingDrawn,
    totalOffsets,
    closingBalance,
    waiverApplied,
    serviceMet:       !!rec.serviceMet,
    serviceMonths,
    reconciledPosition,
    outcome,
    surplusPaid,
    garnishStarted:   outcome === 'owing',
    triggeredBy,
    updatedAt: now,
    updatedBy: writerUid,
  };

  let record;
  if (existing.exists()) {
    await setDoc(ref, core, { merge: true });
    record = { id: ref.id, ...existing.data(), ...core };
  } else {
    const created = {
      ...core,
      reconciledBy:     writerUid,
      reconciledByName: actor.name ?? '',
      reconciledAt:     now,
      createdAt:        now,
    };
    await setDoc(ref, created);
    record = { id: ref.id, ...created };
  }

  // 2) Advance the machine reconciling → terminal ONLY after the record persists.
  await transitionFinancingStatus(
    tenantId, agentId, nextStatus, actor,
    `K6 reconciliation — ${outcome} (${triggeredBy})`,
  );

  return record;
}
