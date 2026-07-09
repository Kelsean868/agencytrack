import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
  collection, collectionGroup, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { validateSundayDate } from '../utils/validators';

// Mirrors cnRoleRank()/jcRoleRank() in firestore.rules — block-local pattern.
// FU banked: hoist all three (cn/jc/war) to a shared top-level rules helper.
const WAR_ROLE_RANKS = {
  unit_manager:   1,
  branch_manager: 2,
  sales_manager:  3,
  tenant_admin:   4,
  platform_admin: 5,
};

export function getWarRoleRank(role) {
  return WAR_ROLE_RANKS[role] ?? 0;
}

export function warDocId(managerId, weekStart) {
  return `${managerId}_${weekStart}`;
}

function sanitizeWar(data, storedJfwCount = 0) {
  const int = (v) => parseInt(v ?? 0, 10) || 0;

  return {
    oneOnOnesConducted:   int(data.oneOnOnesConducted),
    namesSourced:         int(data.namesSourced),
    interviewsConducted:  int(data.interviewsConducted),
    recruitsInFirstWeeks: int(data.recruitsInFirstWeeks),
    trainingSessions:     int(data.trainingSessions),
    trainingTopic:        String(data.trainingTopic ?? ''),
    unitMeetingHeld:      Boolean(data.unitMeetingHeld),
    attendanceCount:      data.unitMeetingHeld ? int(data.attendanceCount) : null,
    dashboardReviewDone:  Boolean(data.dashboardReviewDone),
    // Preserve the CF-written jfwCount so the update rule's preserve-check passes.
    // On create (storedJfwCount=0) this equals 0, satisfying the create rule.
    jfwCount:             storedJfwCount,
  };
}

function warMeta(managerId, managerName, tenantId, weekStart, managerMeta) {
  const { managerRole, branchId, unitId } = managerMeta;
  return {
    managerId,
    managerName,
    tenantId,
    weekStart,
    managerRole,
    managerRoleRank: getWarRoleRank(managerRole),
    branchId: branchId ?? null,
    unitId:   unitId ?? null,
  };
}

export async function saveWarDraft(tenantId, managerId, managerName, weekStart, data, managerMeta) {
  if (!validateSundayDate(weekStart)) throw new Error('weekStart must be a Sunday');
  const ref = doc(db, `tenants/${tenantId}/managerWeeklyReports/${warDocId(managerId, weekStart)}`);
  const existing = await getDoc(ref);
  const createdAt = existing.exists() ? {} : { createdAt: serverTimestamp() };
  const storedJfwCount = existing.data?.()?.jfwCount ?? 0;
  await setDoc(
    ref,
    {
      ...createdAt,
      ...warMeta(managerId, managerName, tenantId, weekStart, managerMeta),
      ...sanitizeWar(data, storedJfwCount),
      status:    'draft',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function submitWar(tenantId, managerId, managerName, weekStart, data, managerMeta) {
  if (!validateSundayDate(weekStart)) throw new Error('weekStart must be a Sunday');
  const ref = doc(db, `tenants/${tenantId}/managerWeeklyReports/${warDocId(managerId, weekStart)}`);
  const existing = await getDoc(ref);
  const createdAt = existing.exists() ? {} : { createdAt: serverTimestamp() };
  const storedJfwCount = existing.data?.()?.jfwCount ?? 0;
  await setDoc(ref, {
    ...createdAt,
    ...warMeta(managerId, managerName, tenantId, weekStart, managerMeta),
    ...sanitizeWar(data, storedJfwCount),
    status:      'submitted',
    updatedAt:   serverTimestamp(),
    submittedAt: serverTimestamp(),
  });
}

export async function getWar(tenantId, managerId, weekStart) {
  const ref = doc(db, `tenants/${tenantId}/managerWeeklyReports/${warDocId(managerId, weekStart)}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getWarById(tenantId, docId) {
  const ref = doc(db, `tenants/${tenantId}/managerWeeklyReports/${docId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Upline review of a SUBMITTED WAR (Tier-2 2.1 reviewer workflow).
 * Writes ONLY the five review fields — the rules' reviewer arm enforces
 * hasOnly on exactly this set, upline scope (strictly higher rank; BM
 * branch-scoped; SM+ tenant-wide), status=='submitted', reviewedBy==auth.uid,
 * and reviewNote ≤ 2000 chars. An owner resubmit (full setDoc) clears these
 * fields by omission — a resubmitted WAR needs re-review.
 */
export async function reviewWar(tenantId, docId, { status, note, reviewerUid, reviewerName }) {
  if (!['approved', 'changes_requested'].includes(status)) {
    throw new Error(`reviewWar: invalid review status "${status}"`);
  }
  const ref = doc(db, `tenants/${tenantId}/managerWeeklyReports/${docId}`);
  await updateDoc(ref, {
    reviewStatus:   status,
    reviewNote:     (note ?? '').slice(0, 2000),
    reviewedBy:     reviewerUid,
    reviewedByName: reviewerName ?? '',
    reviewedAt:     serverTimestamp(),
  });
}

/**
 * Fetch WARs for the upline browse view (I1.3b).
 * BM (rank 2): own-branch query (branchId + weekStart composite index).
 * SM+ (rank ≥ 3): tenant-wide query (weekStart single-field auto-index).
 */
export async function getWarsForUpline({ tenantId, weekStart, role, branchId }) {
  const coll = collection(db, `tenants/${tenantId}/managerWeeklyReports`);
  const rank = getWarRoleRank(role);
  const q = rank >= 3
    ? query(coll, where('weekStart', '==', weekStart))
    : query(coll, where('branchId', '==', branchId), where('weekStart', '==', weekStart));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * My-WAR 8-week filing streak (item 2.1 StreakDots on My WAR).
 * Reads the owner's OWN docs by docId, allowed by the WAR `allow get` owner arm
 * (resource.data.managerId == auth.uid, or the warId-prefix existence check when
 * the doc is absent). Works for EVERY manager rank including unit_manager, which
 * cannot run a `list` query. Read-light: one getDoc per week for a single
 * manager, run in parallel. Returns an array aligned to `weekStarts` order —
 * each entry { weekStart, filed } where filed = a submitted WAR exists.
 */
export async function getOwnWarStreak({ tenantId, managerId, weekStarts }) {
  if (!managerId || !Array.isArray(weekStarts) || weekStarts.length === 0) return [];
  const snaps = await Promise.all(
    weekStarts.map((ws) =>
      getDoc(doc(db, `tenants/${tenantId}/managerWeeklyReports/${warDocId(managerId, ws)}`)),
    ),
  );
  return weekStarts.map((ws, i) => ({
    weekStart: ws,
    filed: snaps[i].exists() && snaps[i].data().status === 'submitted',
  }));
}

/**
 * Multi-week upline WAR fetch for the team-row 8-week streak dots (item 2.1).
 * Same scope shape as getWarsForUpline (BM own-branch; SM+ tenant-wide) but
 * across a set of weeks via a single `weekStart in [...]` query — read-light
 * (one getDocs for the whole surface, not one per row). Index-safe on the
 * indexes already in firestore.indexes.json:
 *   BM (rank 2) → (branchId, weekStart) composite.
 *   SM+ (rank ≥ 3) → weekStart single-field automatic index.
 * Firestore `in` supports up to 30 values; the streak window is 8.
 */
export async function getWarsForUplineWeeks({ tenantId, weekStarts, role, branchId }) {
  if (!Array.isArray(weekStarts) || weekStarts.length === 0) return [];
  const coll = collection(db, `tenants/${tenantId}/managerWeeklyReports`);
  const rank = getWarRoleRank(role);
  const q = rank >= 3
    ? query(coll, where('weekStart', 'in', weekStarts))
    : query(coll, where('branchId', '==', branchId), where('weekStart', 'in', weekStarts));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Count the manager's own completed joint-field-work calls for a given week.
 * Uses a collectionGroup query with authorUid + tenantId equality filters.
 * The tenantId where clause enforces tenant isolation at the query level (the rule's
 * author arm only verifies authorUid; tenant boundary is the query's responsibility).
 * appointmentKept filter applied client-side; index: (authorUid, tenantId, appointmentDate)
 * COLLECTION_GROUP.
 */
export async function getOwnJfwCount({ tenantId, managerId, weekStart }) {
  const d = new Date(weekStart + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  const weekEnd = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');

  const q = query(
    collectionGroup(db, 'jointCalls'),
    where('authorUid', '==', managerId),
    where('tenantId', '==', tenantId),
    where('appointmentDate', '>=', weekStart),
    where('appointmentDate', '<', weekEnd),
  );
  const snap = await getDocs(q);
  return snap.docs.filter((d) => d.data().appointmentKept === true).length;
}
