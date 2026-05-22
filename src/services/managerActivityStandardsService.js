import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Firestore path: tenants/{tenantId}/config/managerActivityStandards
// Governed by the existing config/{docId} wildcard rule:
//   read:  all signed-in tenant members
//   write: platform_admin | tenant_admin only
// No rule edit, no index needed (single doc read by id).

export const NUMERIC_STANDARDS = [
  'jfwCount',
  'oneOnOnesConducted',
  'namesSourced',
  'interviewsConducted',
  'recruitsInFirstWeeks',
  'trainingSessions',
];

export const BOOLEAN_STANDARDS = ['unitMeetingHeld', 'dashboardReviewDone'];

export const STANDARDS_ROLE_KEYS = ['unit_manager', 'branch_manager', 'sales_manager'];

/**
 * Returns the full standards doc.
 * Shape: { unit_manager: { jfwCount: 2, ... }, branch_manager: {...}, sales_manager: {...} }
 * Missing doc → {} (all blanks — no standard set for any role).
 * updatedBy / updatedAt fields on the root are metadata, not standards.
 */
export async function getManagerActivityStandards(tenantId) {
  const ref = doc(db, `tenants/${tenantId}/config/managerActivityStandards`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

/**
 * Returns the standards for a specific role.
 * Missing role key → {} (all blanks).
 */
export function getRoleStandards(standards, role) {
  return standards?.[role] ?? {};
}

/**
 * Writes all roles' standards. Caller passes only the role sub-maps;
 * updatedBy + updatedAt are appended here. merge:true preserves other
 * config doc fields if any were stored.
 *
 * data shape: { unit_manager: {...}, branch_manager: {...}, sales_manager: {...} }
 * Numeric fields: parseFloat by caller (blank string → omit key or pass null).
 * Boolean fields: boolean or null.
 */
export async function setManagerActivityStandards(tenantId, data, updatedBy) {
  const ref = doc(db, `tenants/${tenantId}/config/managerActivityStandards`);
  await setDoc(ref, { ...data, updatedBy, updatedAt: serverTimestamp() }, { merge: true });
}
