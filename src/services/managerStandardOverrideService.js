import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  getManagerActivityStandards,
  getRoleStandards,
  NUMERIC_STANDARDS,
  BOOLEAN_STANDARDS,
} from './managerActivityStandardsService';

function mergeOverride(base, overrideDoc, activityKeys) {
  const out = { ...base };
  for (const key of activityKeys) {
    const val = overrideDoc?.[key];
    if (val !== undefined && val !== null) {
      out[key] = val;
    }
  }
  return out;
}

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
  const base = getRoleStandards(standards, role);
  return mergeOverride(base, overrideDoc, ACTIVITY_KEYS);
}

/**
 * Bulk-resolve standards for a list of managers in one batch.
 * Fetches the org-default config ONCE, then fans out by-id override gets in
 * parallel. Returns a Map keyed by managerId → resolved standards map. Used
 * by TeamWarsTab for per-row at-a-glance flags without paying 2N reads.
 *
 * Failure on a single override fetch degrades to org-default-only for that
 * row (matches the existing list behavior; never throws to the caller).
 *
 * @param {object} args
 * @param {string} args.tenantId
 * @param {Array<{ managerId: string, managerRole: string }>} args.managers
 * @returns {Promise<Map<string, object>>}
 */
/**
 * Counts, per manager role and per standard key, how many managers have an
 * override set for that key. The override doc does NOT store role (forgery
 * prevention reads it from the user doc), so the caller supplies a
 * managerId→role map. Returns { [role]: { [key]: count } }; a key with zero
 * overrides is simply absent (→ the indicator renders an em-dash).
 * Requires the tenant_admin/platform_admin list arm on the collection.
 *
 * @param {object} args
 * @param {string} args.tenantId
 * @param {Record<string, string>} args.rolesByManagerId managerId → role
 * @returns {Promise<Record<string, Record<string, number>>>}
 */
export async function getManagerActivityStandardOverrideCounts({ tenantId, rolesByManagerId }) {
  const counts = {};
  const snap = await getDocs(collection(db, `tenants/${tenantId}/managerActivityStandardOverrides`));
  snap.forEach((docSnap) => {
    const role = rolesByManagerId?.[docSnap.id];
    if (!role) return; // manager role unknown/missing → skip
    const data = docSnap.data() || {};
    for (const key of ACTIVITY_KEYS) {
      const val = data[key];
      if (val !== undefined && val !== null) {
        if (!counts[role]) counts[role] = {};
        counts[role][key] = (counts[role][key] || 0) + 1;
      }
    }
  });
  return counts;
}

export async function getResolvedStandardsForMany({ tenantId, managers }) {
  const result = new Map();
  if (!managers || managers.length === 0) return result;

  const standards = await getManagerActivityStandards(tenantId);

  const overrideDocs = await Promise.all(
    managers.map((m) =>
      getManagerActivityStandardOverride(tenantId, m.managerId)
        .catch(() => ({})),
    ),
  );

  managers.forEach((m, idx) => {
    const base = getRoleStandards(standards, m.managerRole);
    result.set(m.managerId, mergeOverride(base, overrideDocs[idx], ACTIVITY_KEYS));
  });

  return result;
}
