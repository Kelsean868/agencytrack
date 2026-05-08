import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * branchService — Track C C1.
 *
 * Branches as a real Firestore subcollection under each tenant. Path:
 *   tenants/{tenantId}/branches/{branchId}
 *
 * Schema (locked in docs/track-c-implementation.md § PR C1 § Schema):
 *   { name, managerId, isActive, createdAt, updatedAt, updatedBy }
 *
 * Write-path discipline (mirrors goalsService.setCompanyMinimums):
 *   - Validation throws plain Error with a user-readable message; the
 *     UI catches and surfaces inline.
 *   - createdAt is set once on create and never overwritten.
 *   - updatedAt + updatedBy stamped on every write (audit trail; no
 *     separate audit-log collection until P11).
 *   - Branch-name uniqueness is enforced against ACTIVE branches only.
 *     Inactive branches with the same name don't block creation or
 *     rename. Reactivating an inactive branch when an active duplicate
 *     exists IS blocked, with the same error copy.
 *
 * Backwards-compat note: this service NEVER reads from the users
 * collection. Existing branch-derivation read paths (BranchHealthCards,
 * UserManagementPanel branch-dropdown) continue to read user.branchId
 * directly until a follow-up PR migrates them.
 */

const MAX_NAME_LENGTH = 100;

function branchesCollection(tenantId) {
  return collection(db, `tenants/${tenantId}/branches`);
}

function branchDoc(tenantId, branchId) {
  return doc(db, `tenants/${tenantId}/branches/${branchId}`);
}

function normaliseName(name) {
  return String(name ?? '').trim();
}

function validateName(name) {
  const trimmed = normaliseName(name);
  if (!trimmed) {
    throw new Error('Branch name is required.');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Branch name must be at most ${MAX_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

function nameKey(name) {
  return normaliseName(name).toLowerCase();
}

async function findActiveByName(tenantId, name, excludeId = null) {
  const target = nameKey(name);
  const snap = await getDocs(query(branchesCollection(tenantId), where('isActive', '==', true)));
  for (const d of snap.docs) {
    if (excludeId && d.id === excludeId) continue;
    if (nameKey(d.data().name) === target) return { id: d.id, ...d.data() };
  }
  return null;
}

/**
 * listBranches(tenantId)
 * Returns every branch in the tenant (active + inactive).
 * Empty collection returns []. Caller sorts.
 */
export async function listBranches(tenantId) {
  if (!tenantId) return [];
  const snap = await getDocs(branchesCollection(tenantId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * getBranch(tenantId, branchId)
 * Returns a single branch or null. Used by the editor modal to seed
 * the form with a fresh read (no blind writes).
 */
export async function getBranch(tenantId, branchId) {
  if (!tenantId || !branchId) return null;
  const snap = await getDoc(branchDoc(tenantId, branchId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * createBranch(tenantId, { name, managerId }, updatedBy)
 * Creates a new active branch. Throws on validation or duplicate-name
 * collision (against active branches only).
 */
export async function createBranch(tenantId, data, updatedBy) {
  if (!tenantId) throw new Error('Tenant context missing.');
  if (!updatedBy) throw new Error('Caller UID missing.');

  const name = validateName(data?.name);
  const managerId = data?.managerId ? String(data.managerId) : null;

  const collision = await findActiveByName(tenantId, name);
  if (collision) {
    throw new Error(`A branch named "${name}" already exists.`);
  }

  const ref = await addDoc(branchesCollection(tenantId), {
    name,
    managerId,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy,
  });
  return ref.id;
}

/**
 * updateBranch(tenantId, branchId, { name, managerId }, updatedBy)
 * Partial update. Same active-only uniqueness check applies on rename;
 * the branch being renamed is excluded from the collision check.
 */
export async function updateBranch(tenantId, branchId, data, updatedBy) {
  if (!tenantId) throw new Error('Tenant context missing.');
  if (!branchId) throw new Error('Branch id missing.');
  if (!updatedBy) throw new Error('Caller UID missing.');

  const patch = { updatedAt: serverTimestamp(), updatedBy };

  if ('name' in (data ?? {})) {
    const name = validateName(data.name);
    const collision = await findActiveByName(tenantId, name, branchId);
    if (collision) {
      throw new Error(`A branch named "${name}" already exists.`);
    }
    patch.name = name;
  }

  if ('managerId' in (data ?? {})) {
    patch.managerId = data.managerId ? String(data.managerId) : null;
  }

  await updateDoc(branchDoc(tenantId, branchId), patch);
}

/**
 * setBranchActive(tenantId, branchId, isActive, updatedBy)
 * Toggles soft-delete. Reactivation re-runs the active-name uniqueness
 * check against the current active set so reactivating into a duplicate
 * name is blocked with the same error copy as create / rename.
 */
export async function setBranchActive(tenantId, branchId, isActive, updatedBy) {
  if (!tenantId) throw new Error('Tenant context missing.');
  if (!branchId) throw new Error('Branch id missing.');
  if (!updatedBy) throw new Error('Caller UID missing.');

  if (isActive === true) {
    const current = await getBranch(tenantId, branchId);
    if (current?.name) {
      const collision = await findActiveByName(tenantId, current.name, branchId);
      if (collision) {
        throw new Error(`A branch named "${current.name}" already exists.`);
      }
    }
  }

  await updateDoc(branchDoc(tenantId, branchId), {
    isActive: !!isActive,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}
