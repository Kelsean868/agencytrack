import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, getTenantId } from '../firebase';


/**
 * createUser(userData)
 * Polymorphic wrapper around the createUser Cloud Function.
 *
 * The CF provisions the Auth user, Firestore doc, custom claims, and queues
 * a password-reset email via the Trigger Email Extension (mail/ collection).
 * Returns { success, uid, emailQueued } from the CF.
 *
 * userData: { role, name, email, ...roleSpecificFields }
 */
export async function createUser(userData) {
  const fns = getFunctions();
  const fn = httpsCallable(fns, 'createUser');
  const result = await fn(userData);
  return result.data;
}

/**
 * deactivateUser(targetUid, active)
 * active: false deactivates; active: true reactivates.
 */
export async function deactivateUser(targetUid, active) {
  const fns = getFunctions();
  const fn = httpsCallable(fns, 'deactivateUser');
  const result = await fn({ targetUid, active });
  return result.data;
}

/**
 * getAllUsers({ includeInactive })
 * All users in the current tenant, minus provisioning docs.
 * Optionally includes users with active: false.
 */
export async function getAllUsers({ includeInactive = false } = {}) {
  const snap = await getDocs(collection(db, `tenants/${getTenantId()}/users`));
  return snap.docs
    .map((d) => ({ uid: d.id, id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true)
    .filter((u) => includeInactive || u.active !== false);
}

/**
 * getBranchManagers(tenantId)
 * Returns all branch managers — used to populate branch selector.
 */
export async function getBranchManagers(tenantId) {
  const snap = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/users`),
      where('role', '==', 'branch_manager')
    )
  );
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true && u.active !== false);
}

/**
 * getUnitManagers(tenantId)
 * Returns all unit managers — used to populate unit selector.
 */
export async function getUnitManagers(tenantId) {
  const snap = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/users`),
      where('role', '==', 'unit_manager')
    )
  );
  // PR-1: exclude provisioning users.
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true);
}

/**
 * getAgentsForUnit(tenantId, unitId)
 * Returns all agents in a specific unit.
 */
export async function getAgentsForUnit(tenantId, unitId) {
  const snap = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/users`),
      where('role', '==', 'agent'),
      where('unitId', '==', unitId)
    )
  );
  // PR-1: exclude provisioning users.
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true);
}
