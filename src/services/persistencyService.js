// E3 — Persistency service.
//
// Tenant resolution: ALWAYS via getTenantId() from firebase.js (SEC-9).
// Never accepts tenantId as a parameter; never reads import.meta.env directly.
//
// Schema is the E3-shaped doc — see docs/briefs/e3-persistency-playground-kickoff.md
// § Schema and docs/e3-persistency-discovery-notes.md.
//
// Legacy filter: pre-E3 docs (lacking the six business-input fields) are silently
// hidden via isE3Doc(). They never reach the UI, no warning, no "needs re-entry"
// state — just hidden until overwritten by an E3 write.

import {
  doc, getDoc, getDocs, setDoc,
  collection, query, where,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, getTenantId } from '../firebase';
import { deriveAll, aggregatePersistency } from '../lib/persistency/calculations';
import { getTenantUsers } from './managerService';

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

const AWARD_GATE = 0.90;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests + UI)
// ─────────────────────────────────────────────────────────────────────────────

export function isE3Doc(d) {
  if (!d || typeof d !== 'object') return false;
  return E3_FIELDS.every((f) => d[f] !== undefined && d[f] !== null);
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

// 12-month rolling period ENDING in monthKey.
//   '2026-02' → start '2025-03-01', end '2026-02-28'
//   '2026-12' → start '2026-01-01', end '2026-12-31'
export function reportPeriodFromMonthKey(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const startYear  = month === 12 ? year     : year - 1;
  const startMonth = month === 12 ? 1        : month + 1;
  const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { reportPeriodStart: start, reportPeriodEnd: end };
}

function persistencyCollection() {
  return collection(db, `tenants/${getTenantId()}/persistency`);
}

function persistencyDocRef(agentUid, monthKey) {
  return doc(db, `tenants/${getTenantId()}/persistency/${persistencyDocId(agentUid, monthKey)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getPersistencyForAgent(monthKey, agentUid) {
  const snap = await getDoc(persistencyDocRef(agentUid, monthKey));
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  return isE3Doc(data) ? data : null;
}

async function getPersistencyForUserList(monthKey, userList) {
  const tenantId = getTenantId();
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
        return isE3Doc(data) ? { ...data, _user: u } : null;
      } catch {
        // Reads denied by rules return null — caller treats as "no record."
        return null;
      }
    }),
  );
  return settled.filter(Boolean);
}

export async function getPersistencyForUnit(monthKey, unitId) {
  const users = (await getTenantUsers()).filter(
    (u) => u.unitId === unitId && u.role === 'agent',
  );
  return getPersistencyForUserList(monthKey, users);
}

export async function getPersistencyForBranch(monthKey, branchId) {
  const users = (await getTenantUsers()).filter(
    (u) => u.branchId === branchId && u.role === 'agent',
  );
  return getPersistencyForUserList(monthKey, users);
}

export async function getPersistencyForTenant(monthKey) {
  const users = (await getTenantUsers()).filter((u) => u.role === 'agent');
  return getPersistencyForUserList(monthKey, users);
}

// Returns distinct monthKeys, sorted newest first. For 'agent' scope, queries
// by agentId. For other scopes, queries the tenant collection (rules apply).
// If no E3 docs exist, returns the current month so the UI selector still has
// at least one option.
export async function getAvailableMonths(scopeType, scopeId) {
  let q;
  if (scopeType === 'agent') {
    q = query(persistencyCollection(), where('agentId', '==', scopeId));
  } else {
    q = query(persistencyCollection());
  }
  const snap = await getDocs(q);
  const monthKeys = new Set();
  snap.forEach((d) => {
    const data = d.data();
    if (isE3Doc(data) && data.monthKey) monthKeys.add(data.monthKey);
  });
  const sorted = Array.from(monthKeys).sort().reverse();
  if (sorted.length === 0) {
    const now = new Date();
    sorted.push(monthKeyFromYearMonth(now.getFullYear(), now.getMonth() + 1));
  }
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
export async function getPersistencyMapForYear(year, opts = {}) {
  const tenantId = getTenantId();
  const allUsers = await getTenantUsers();
  let agents = allUsers.filter((u) => u.role === 'agent');
  if (opts.branchId) agents = agents.filter((u) => u.branchId === opts.branchId);
  if (opts.unitId)   agents = agents.filter((u) => u.unitId   === opts.unitId);

  const map = {};
  await Promise.all(agents.map(async (u) => {
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/persistency`),
        where('agentId', '==', u.id),
        where('year', '==', year),
      );
      const snap = await getDocs(q);
      const recs = snap.docs.map((d) => d.data()).filter(isE3Doc);
      if (recs.length > 0) map[u.id] = recs;
    } catch {
      // Read denied by rules — skip this agent silently.
    }
  }));
  return map;
}

// Returns oldest-first array of E3 records for a single agent, capped at
// lastNMonths. Used by the agent trend chart.
export async function getAgentHistory(agentUid, lastNMonths = 12) {
  const q = query(persistencyCollection(), where('agentId', '==', agentUid));
  const snap = await getDocs(q);
  const records = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(isE3Doc)
    .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)));
  return records.slice(-lastNMonths);
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

// Computes derived fields, validates inputs non-negative, and writes the doc.
// On overwrite, preserves the original enteredAt/By/ByRole and updates only
// lastEdited*. The 'role' parameter is the writer's claim role.
export async function savePersistency(monthKey, agentUid, inputs, role) {
  const tenantId = getTenantId(); // throws if unpopulated — SEC-9 fail-fast
  const writerUid = auth?.currentUser?.uid;

  if (!writerUid)             throw new Error('savePersistency: no signed-in user');
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`savePersistency: invalid role "${role}"`);
  }
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`savePersistency: invalid monthKey "${monthKey}"`);
  }
  if (!agentUid) throw new Error('savePersistency: agentUid required');

  // Coerce + validate the six numeric inputs. parseFloat enforced (project rule).
  const sanitized = {};
  for (const f of E3_FIELDS) {
    const raw = inputs?.[f];
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`savePersistency: ${f} must be a non-negative number (got "${raw}")`);
    }
    sanitized[f] = n;
  }

  const derived = deriveAll(sanitized);
  const meetsAwardGate = derived.persistency >= AWARD_GATE;
  const { year, month } = parseMonthKey(monthKey);
  const period = reportPeriodFromMonthKey(monthKey);

  const docRef = persistencyDocRef(agentUid, monthKey);
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
    grossSettled: derived.grossSettled,
    netSettled:   derived.netSettled,
    persistency:  derived.persistency,
    meetsAwardGate,
    lastEditedAt:     auditNow,
    lastEditedBy:     writerUid,
    lastEditedByRole: role,
  };

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

// Computes a branch aggregate from current docs. Phase 1 computes on read; a
// future Cloud Function may persist these to a `persistencyAggregates` collection
// for cheaper kiosk/leaderboard reads (out of scope for E3 PR).
export async function calculateAndCacheBranchAggregate(monthKey, branchId) {
  const records = await getPersistencyForBranch(monthKey, branchId);
  const agg = aggregatePersistency(records);
  return {
    monthKey,
    branchId,
    recordCount: records.length,
    ...agg,
  };
}
