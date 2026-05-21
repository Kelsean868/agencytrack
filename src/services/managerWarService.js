import {
  doc, setDoc, getDoc, serverTimestamp,
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
