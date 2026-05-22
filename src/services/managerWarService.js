import {
  doc, setDoc, getDoc, serverTimestamp,
  collectionGroup, getDocs, query, where,
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

function sanitizeWar(data, isProducingManager = false, storedJfwCount = 0) {
  const float = (v) => parseFloat(v ?? 0) || 0;
  const int   = (v) => parseInt(v ?? 0, 10) || 0;

  const result = {
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

  if (isProducingManager) {
    result.personalApi  = float(data.personalApi);
    result.personalApps = int(data.personalApps);
  }

  return result;
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
      ...sanitizeWar(data, managerMeta.isProducingManager, storedJfwCount),
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
    ...sanitizeWar(data, managerMeta.isProducingManager, storedJfwCount),
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
