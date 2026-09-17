// E3 — Persistency service.
//
// Tenant resolution: tenantId is always accepted as an explicit first parameter
// (SEC-9b). Never reads import.meta.env directly.
//
// Schema is the E3-shaped doc — see docs/briefs/e3-persistency-playground-kickoff.md
// § Schema and docs/e3-persistency-discovery-notes.md.
//
// Legacy filter: pre-E3 docs (lacking the six business-input fields) are silently
// hidden via isE3Doc(). They never reach the UI, no warning, no "needs re-entry"
// state — just hidden until overwritten by an E3 write.
//
// Model filter: reads additionally require the doc to be complete for the model
// its own report month is on — see isModelCompleteDoc(). From September 2026 the
// Tatil 24-month model adds `decreases`, so a September doc without it is hidden
// on the same silent terms rather than deriving a denominator from a phantom 0.

import {
  doc, getDoc, getDocs, setDoc,
  collection, query, where,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { deriveAll, PERS_GATE } from '../lib/persistency/calculations';
import { persistencyModelFor } from '../lib/persistency/model';
import { getTenantUsers } from './managerService';
import { getTodayTT } from '../utils/dateInputs';

// The six business-input fields that mark a doc as E3-shaped. A doc lacking
// any of these is pre-E3 and is filtered out before reaching any UI consumer.
const E3_FIELDS = [
  'businessPlaced',
  'notTakens',
  'incPPPs',
  'lumpsums100',
  'lapses',
  'reinstatements',
];

const VALID_ROLES = [
  'agent', 'unit_manager', 'branch_manager', 'sales_manager', 'tenant_admin',
];

// Single-sourced from calculations.js — `derived.persistency` is a decimal, so
// this comparison stays on the decimal scale. Was a local `0.90` literal.
const AWARD_GATE = PERS_GATE;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests + UI)
// ─────────────────────────────────────────────────────────────────────────────

export function isE3Doc(d) {
  if (!d || typeof d !== 'object') return false;
  return E3_FIELDS.every((f) => d[f] !== undefined && d[f] !== null);
}

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

// Is this doc complete for the model its own report month is on?
//
// Legacy months: the six E3 fields are the whole requirement, unchanged.
// 24-month-model months (>= '2026-09'): the doc must ALSO carry `decreases` as
// a finite number >= 0 — the one term the 29 Aug 2026 Tatil memo adds. A
// September doc without it would derive a denominator that silently treats an
// unentered figure as zero, so it is hidden rather than rendered.
//
// This is the predicate READS filter on. `isE3Doc` stays exported unchanged for
// the existing tests and for SCOPE-2.
//
// NEVER THROWS: it filters untrusted Firestore documents, so an unclassifiable
// monthKey must not take out a whole list render. A doc with no usable monthKey
// is treated as legacy — and that fallback cannot mislabel a 24-month doc,
// because every 24-month doc is written by savePersistency, which validates the
// key and always stores it. So the fallback only ever keeps an already-visible
// legacy record visible.
export function isModelCompleteDoc(d) {
  if (!isE3Doc(d)) return false;
  const monthKey = d.monthKey;
  if (typeof monthKey !== 'string' || !MONTH_KEY_RE.test(monthKey)) return true;
  if (persistencyModelFor(monthKey).id !== 'tatil24') return true;
  return typeof d.decreases === 'number'
    && Number.isFinite(d.decreases)
    && d.decreases >= 0;
}

export function monthKeyFromYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(monthKey) {
  const [y, m] = String(monthKey).split('-');
  return { year: parseInt(y, 10), month: parseInt(m, 10) };
}

// Doc ID format: `{agentUid}_{YYYY_MM}` (matches existing per-tenant pattern;
// see settlements/{agentId_year_periodKey} and submissions/{agentId_weekStarting}).
export function persistencyDocId(agentUid, monthKey) {
  return `${agentUid}_${String(monthKey).replace('-', '_')}`;
}

// Rolling report period ENDING in monthKey. The span comes from the model the
// month is on — 12 months before Sept 2026, 24 from Sept 2026 (see
// lib/persistency/model.js). The end date is unaffected by the model.
//   '2026-02' → 12-month: start '2025-03-01', end '2026-02-28'
//   '2026-08' → 12-month: start '2025-09-01', end '2026-08-31'
//   '2026-09' → 24-month: start '2024-10-01', end '2026-09-30'
//   '2026-12' → 24-month: start '2025-01-01', end '2026-12-31'
export function reportPeriodFromMonthKey(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const { windowMonths } = persistencyModelFor(monthKey);

  // Absolute month index makes the year rollover fall out of the arithmetic,
  // instead of needing a special case per window length.
  const endIndex   = (year * 12) + (month - 1);
  const startIndex = endIndex - (windowMonths - 1);
  const startYear  = Math.floor(startIndex / 12);
  const startMonth = (startIndex % 12) + 1;

  const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { reportPeriodStart: start, reportPeriodEnd: end };
}

function persistencyCollection(tenantId) {
  return collection(db, `tenants/${tenantId}/persistency`);
}

function persistencyDocRef(tenantId, agentUid, monthKey) {
  return doc(db, `tenants/${tenantId}/persistency/${persistencyDocId(agentUid, monthKey)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getPersistencyForAgent(tenantId, monthKey, agentUid) {
  const snap = await getDoc(persistencyDocRef(tenantId, agentUid, monthKey));
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  return isModelCompleteDoc(data) ? data : null;
}

async function getPersistencyForUserList(tenantId, monthKey, userList) {
  const settled = await Promise.all(
    userList.map(async (u) => {
      try {
        const ref = doc(
          db,
          `tenants/${tenantId}/persistency/${persistencyDocId(u.id, monthKey)}`,
        );
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        const data = { id: snap.id, ...snap.data() };
        return isModelCompleteDoc(data) ? { ...data, _user: u } : null;
      } catch {
        // Reads denied by rules return null — caller treats as "no record."
        return null;
      }
    }),
  );
  return settled.filter(Boolean);
}

export async function getPersistencyForUnit(tenantId, monthKey, unitId) {
  const users = (await getTenantUsers(tenantId)).filter(
    (u) => u.unitId === unitId && u.role === 'agent',
  );
  return getPersistencyForUserList(tenantId, monthKey, users);
}

export async function getPersistencyForBranch(tenantId, monthKey, branchId) {
  const users = (await getTenantUsers(tenantId)).filter(
    (u) => u.branchId === branchId && u.role === 'agent',
  );
  return getPersistencyForUserList(tenantId, monthKey, users);
}

export async function getPersistencyForTenant(tenantId, monthKey) {
  const users = (await getTenantUsers(tenantId)).filter((u) => u.role === 'agent');
  return getPersistencyForUserList(tenantId, monthKey, users);
}

// Returns distinct monthKeys, sorted newest first. For 'agent' scope, queries
// by agentId. For other scopes, queries the tenant collection (rules apply).
// If no E3 docs exist, returns the current month so the UI selector still has
// at least one option.
//
// DELIBERATELY isE3Doc, NOT isModelCompleteDoc — this builds the month SELECTOR,
// which is navigation, not a record read. Filtering it on model-completeness
// would strand data: a September 2026 document written on the six-field code
// (before the 24-month model shipped) carries no `decreases`, so a
// model-complete filter would drop its month from the selector entirely — and
// with no "add a month" affordance anywhere in the UI, that month could never be
// selected again to be corrected. Keeping the month listed while
// isModelCompleteDoc hides the RECORD gives the manager exactly the state they
// need: the month is reachable and reads as having no entry, so re-entering it
// through the seven-field form fixes it.
export async function getAvailableMonths(tenantId, scopeType, scopeId) {
  let q;
  if (scopeType === 'agent') {
    q = query(persistencyCollection(tenantId), where('agentId', '==', scopeId));
  } else {
    q = query(persistencyCollection(tenantId));
  }
  const snap = await getDocs(q);
  const monthKeys = new Set();
  snap.forEach((d) => {
    const data = d.data();
    if (isE3Doc(data) && data.monthKey) monthKeys.add(data.monthKey);
  });

  // P1b: always offer an entry window — the current TT month plus the two
  // before it — union'd with whatever months already have data. Tatil's
  // monthly report lags by weeks, so without this a manager can never reach
  // the current month once the last-entered month falls behind it: there is
  // no "add month" control anywhere in the UI. getTodayTT() (TT calendar day),
  // NOT `new Date()` — UTC reads as the previous day for four hours every
  // evening in Trinidad, which would silently offer the wrong window.
  const [todayYear, todayMonth] = getTodayTT().split('-').map(Number);
  for (let i = 0; i < 3; i += 1) {
    let month = todayMonth - i;
    let year = todayYear;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    monthKeys.add(monthKeyFromYearMonth(year, month));
  }

  const sorted = Array.from(monthKeys).sort().reverse();
  return sorted;
}

// Returns `{ agentId: [E3-records...] }` for the given year. Used by branch
// CSV export and any other consumer that needs YTD aggregation per agent.
// Pre-E3 docs are silently filtered out.
//
// `opts` may scope the query to a specific branch/unit so branch_manager and
// unit_manager callers don't trip the new role-scoped firestore rules. When
// no scope is passed, the caller must have tenant-wide read (sales_manager
// or higher) — otherwise the per-agent query for cross-branch agents will be
// rejected by rules and silently dropped.
export async function getPersistencyMapForYear(tenantId, year, opts = {}) {
  const allUsers = await getTenantUsers(tenantId);
  let agents = allUsers.filter((u) => u.role === 'agent');
  if (opts.branchId) agents = agents.filter((u) => u.branchId === opts.branchId);
  if (opts.unitId)   agents = agents.filter((u) => u.unitId   === opts.unitId);

  const agentIds = agents.map((u) => u.id);
  if (agentIds.length === 0) return {};

  // EFF-005: batch the per-agent N+1 into ≤30-id `in` chunks, mirroring
  // settlementService.getSettlementsForUnit. `agentId in [...] + year == y` is
  // equality-class on both fields, so no composite index is required (same as
  // the prior `agentId == x + year == y` query). Each batch is wrapped so a
  // rules-denied read is skipped silently, preserving the prior per-agent
  // "read denied → skip" contract at batch granularity.
  const map = {};
  const batches = [];
  for (let i = 0; i < agentIds.length; i += 30) {
    batches.push(agentIds.slice(i, i + 30));
  }
  await Promise.all(batches.map(async (batch) => {
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/persistency`),
        where('agentId', 'in', batch),
        where('year', '==', year),
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const rec = d.data();
        if (!isModelCompleteDoc(rec)) return;
        (map[rec.agentId] = map[rec.agentId] ?? []).push(rec);
      });
    } catch {
      // Read denied by rules — skip this batch silently.
    }
  }));
  return map;
}

// Track K — returns `{ agentId: [E3-records...] }` for an EXPLICIT set of agent
// ids in a given year. Unlike getPersistencyMapForYear (which derives its ids
// from role === 'agent' users), this accepts the caller's roster verbatim so a
// producing Unit/Trainee Manager's own persistency is included (dispatcher
// RULING 3). Same `agentId in [...] + year ==` equality-class query as
// getPersistencyMapForYear — no composite index; each ≤30-id batch is wrapped so
// a rules-denied read is skipped silently. Client-only read (no rules change).
export async function getPersistencyForAgentIds(tenantId, year, agentIds) {
  const ids = (agentIds || []).filter(Boolean);
  if (ids.length === 0) return {};
  const map = {};
  const batches = [];
  for (let i = 0; i < ids.length; i += 30) {
    batches.push(ids.slice(i, i + 30));
  }
  await Promise.all(batches.map(async (batch) => {
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/persistency`),
        where('agentId', 'in', batch),
        where('year', '==', year),
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const rec = d.data();
        if (!isModelCompleteDoc(rec)) return;
        (map[rec.agentId] = map[rec.agentId] ?? []).push(rec);
      });
    } catch {
      // Read denied by rules — skip this batch silently.
    }
  }));
  return map;
}

// Returns oldest-first array of E3 records for a single agent, capped at
// lastNMonths. Used by the agent trend chart.
export async function getAgentHistory(tenantId, agentUid, lastNMonths = 12) {
  const q = query(persistencyCollection(tenantId), where('agentId', '==', agentUid));
  const snap = await getDocs(q);
  const records = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(isModelCompleteDoc)
    .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)));
  return records.slice(-lastNMonths);
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

// Computes derived fields, validates inputs non-negative, and writes the doc.
// On overwrite, preserves the original enteredAt/By/ByRole and updates only
// lastEdited*. The 'role' parameter is the writer's claim role.
export async function savePersistency(tenantId, monthKey, agentUid, inputs, role, provenance = null) {
  const writerUid = auth?.currentUser?.uid;

  if (!writerUid)             throw new Error('savePersistency: no signed-in user');
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`savePersistency: invalid role "${role}"`);
  }
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`savePersistency: invalid monthKey "${monthKey}"`);
  }
  if (!agentUid) throw new Error('savePersistency: agentUid required');

  // Which inputs this month requires is the model's call, not the caller's:
  // six on the legacy model, seven (plus `decreases`) from September 2026.
  const model = persistencyModelFor(monthKey);

  // Coerce + validate the numeric inputs. parseFloat enforced (project rule).
  // A MISSING required input is rejected explicitly rather than being coerced to
  // 0 — on a 24-month-model month an absent `decreases` is an unentered figure,
  // and writing 0 for it would inflate the denominator and the persistency the
  // award gates read.
  const sanitized = {};
  for (const f of model.inputs) {
    const raw = inputs?.[f];
    if (raw === undefined || raw === null || raw === '') {
      throw new Error(
        `savePersistency: ${f} is required on the ${model.id} model (month ${monthKey})`,
      );
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`savePersistency: ${f} must be a non-negative number (got "${raw}")`);
    }
    sanitized[f] = n;
  }

  const derived = deriveAll(sanitized);

  // P-D10: a negative denominator is a transcription error (decreases larger
  // than the business placed) and would store a negative percentage. Zero is
  // a real state — an agent with no business in the window — and stays
  // saveable; calculatePersistency already returns 0 for a zero denominator.
  if (derived.grossSettled < 0) {
    throw new Error('Net Gross Settled is negative — check Decreases against Gross Settled.');
  }

  const meetsAwardGate = derived.persistency >= AWARD_GATE;
  const { year, month } = parseMonthKey(monthKey);
  const period = reportPeriodFromMonthKey(monthKey);

  const docRef = persistencyDocRef(tenantId, agentUid, monthKey);
  const existing = await getDoc(docRef);

  const auditNow = serverTimestamp();
  const sharedFields = {
    agentId: agentUid,
    tenantId,
    year,
    month,
    monthKey,
    reportPeriodStart: period.reportPeriodStart,
    reportPeriodEnd:   period.reportPeriodEnd,
    ...sanitized,
    // Display-only provenance. Additive: absent on legacy docs. NOTHING branches
    // on it — persistencyModelFor(monthKey) is the authority, so a doc whose
    // modelId disagreed with its monthKey would still be read on the month's model.
    ...(model.id === 'tatil24' ? { modelId: model.id } : {}),
    grossSettled: derived.grossSettled,
    netSettled:   derived.netSettled,
    persistency:  derived.persistency,
    meetsAwardGate,
    lastEditedAt:     auditNow,
    lastEditedBy:     writerUid,
    lastEditedByRole: role,
    // OPTIONAL provenance, additive and absent on every existing doc.
    //
    // `manualConfirmedBy` / `manualConfirmedAt` record that a human answered the
    // four inputs the OIPA export cannot supply (dispatcher ruling 1, 16 Sep
    // 2026). They are what lets a later reader tell a 0 somebody CHECKED from a
    // 0 nobody ever looked at -- the whole reason the form blocks the save until
    // all four are entered.
    //
    // `ledgerDerived` / `ledgerExportDate` / `annuityMissedPremiumRule` record
    // WHICH derivation produced the three prefilled figures. The rule in
    // particular must be stored per document: the same ledger yields 86.6% under
    // `ignore` and 72.2% under `lapse`, so a saved percentage without the rule
    // beside it cannot be reproduced.
    //
    // NOTHING BRANCHES ON ANY OF THIS. It is provenance for a human, exactly as
    // `modelId` above is -- `persistencyModelFor(monthKey)` remains the only
    // authority on which model a month is reckoned on.
    ...(provenance?.manualConfirmedBy ? { manualConfirmedBy: provenance.manualConfirmedBy } : {}),
    ...(provenance?.manualConfirmedAt ? { manualConfirmedAt: provenance.manualConfirmedAt } : {}),
    ...(provenance?.ledgerDerived ? { ledgerDerived: true } : {}),
    ...(provenance?.ledgerExportDate ? { ledgerExportDate: provenance.ledgerExportDate } : {}),
    ...(provenance?.annuityMissedPremiumRule
      ? { annuityMissedPremiumRule: provenance.annuityMissedPremiumRule } : {}),
  };

  // Deliberately isE3Doc, NOT isModelCompleteDoc: this asks "was there a real
  // prior entry whose audit fields must be preserved?" A doc that is E3-shaped
  // but model-incomplete still has an enteredAt/By worth carrying forward.
  if (existing.exists() && isE3Doc(existing.data())) {
    const prior = existing.data();
    await setDoc(docRef, {
      ...sharedFields,
      enteredAt:     prior.enteredAt,
      enteredBy:     prior.enteredBy,
      enteredByRole: prior.enteredByRole,
    });
  } else {
    // First E3 write (covers both "no doc" and "legacy non-E3 doc here.")
    await setDoc(docRef, {
      ...sharedFields,
      enteredAt:     auditNow,
      enteredBy:     writerUid,
      enteredByRole: role,
    });
  }

  return { ...sharedFields, id: docRef.id };
}

