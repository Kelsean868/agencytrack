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

function sanitizeWar(data, isProducingManager = false) {
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
    jfwCount:             0,
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
  await setDoc(
    ref,
    {
      ...createdAt,
      ...warMeta(managerId, managerName, tenantId, weekStart, managerMeta),
      ...sanitizeWar(data, managerMeta.isProducingManager),
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
  await setDoc(ref, {
    ...createdAt,
    ...warMeta(managerId, managerName, tenantId, weekStart, managerMeta),
    ...sanitizeWar(data, managerMeta.isProducingManager),
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
 * Uses a collectionGroup query scoped to the caller's authorUid (I1.2 author arm
 * in firestore.rules). appointmentKept filter applied client-side to keep the
 * Firestore index 2-field: (authorUid, appointmentDate).
 */
export async function getOwnJfwCount({ tenantId: _tenantId, managerId, weekStart }) {
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
    where('appointmentDate', '>=', weekStart),
    where('appointmentDate', '<', weekEnd),
  );
  const snap = await getDocs(q);
  return snap.docs.filter((d) => d.data().appointmentKept === true).length;
}
