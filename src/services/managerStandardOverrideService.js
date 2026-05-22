import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  getManagerActivityStandards,
  getRoleStandards,
  NUMERIC_STANDARDS,
  BOOLEAN_STANDARDS,
} from './managerActivityStandardsService';

// Firestore path: tenants/{tenantId}/managerActivityStandardOverrides/{managerId}
// Fields: tenantId, managerId, updatedBy, updatedAt, + partial activity overrides.
// Rule: upline-write only; owner + upline read; no list.

const ACTIVITY_KEYS = new Set([...NUMERIC_STANDARDS, ...BOOLEAN_STANDARDS]);

/**
 * Returns the override doc for a manager.
 * Missing doc → {} (no overrides set — all activities fall back to org-default).
 */
export async function getManagerActivityStandardOverride(tenantId, managerId) {
  const ref = doc(db, `tenants/${tenantId}/managerActivityStandardOverrides/${managerId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

/**
 * Writes the override doc. overrideMap contains only the activities being overridden
 * (blank activities are omitted → they fall back to org-default on next resolution).
 * Uses setDoc (overwrite) so a re-save with a field omitted clears that override.
 */
export async function setManagerActivityStandardOverride(tenantId, managerId, overrideMap, updatedBy) {
  const ref = doc(db, `tenants/${tenantId}/managerActivityStandardOverrides/${managerId}`);
  await setDoc(ref, {
    ...overrideMap,
    tenantId,
    managerId,
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes the override doc entirely, reverting M to org-defaults for all activities.
 */
export async function clearManagerActivityStandardOverride(tenantId, managerId) {
  const ref = doc(db, `tenants/${tenantId}/managerActivityStandardOverrides/${managerId}`);
  await deleteDoc(ref);
}

/**
 * Returns per-activity resolved standards: override ?? orgDefault[role].
 * Blank both → no target (key absent or null — never "0 of 0").
 */
export async function getResolvedStandards({ tenantId, managerId, role }) {
  const [standards, overrideDoc] = await Promise.all([
    getManagerActivityStandards(tenantId),
    getManagerActivityStandardOverride(tenantId, managerId),
  ]);
  const resolved = { ...getRoleStandards(standards, role) };
  for (const key of ACTIVITY_KEYS) {
    const val = overrideDoc[key];
    if (val !== undefined && val !== null) {
      resolved[key] = val;
    }
  }
  return resolved;
}
