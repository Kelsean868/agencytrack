import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';


/**
 * createUser(userData)
 * Polymorphic wrapper around the createUser Cloud Function.
 *
 * The CF provisions the Auth user, Firestore doc, custom claims, and queues
 * a password-reset email via the Trigger Email Extension (mail/ collection).
 * Returns { success, uid, emailQueued, emailError? } from the CF.
 * emailQueued is false (with emailError set) when the mail/ write or the
 * generatePasswordResetLink call failed — the user is still fully provisioned,
 * but the password-reset email never queued. Callers must surface this state
 * to admins so they know recovery is required.
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
export async function getAllUsers(tenantId, { includeInactive = false } = {}) {
  const { claims } = await auth.currentUser.getIdTokenResult();
  const callerUid = auth.currentUser.uid;

  // SHAKEDOWN-002: unit_manager callers see only their own unit's agents.
  // branch_manager callers see only their own branch — required by the list
  // rule (firestore.rules:153-156) which rejects any unfiltered BM query.
  // A BM without a branchId claim would fall to the unfiltered col and get
  // permission-denied; guard it with an early empty return instead.
  // Other manager roles retain full tenant visibility.
  if (claims.role === 'branch_manager' && !claims.branchId) return [];
  const col = collection(db, `tenants/${tenantId}/users`);
  const q = claims.role === 'unit_manager'
    ? query(col, where('unitId', '==', callerUid))
    : claims.role === 'branch_manager'
    ? query(col, where('branchId', '==', claims.branchId))
    : col;

  const snap = await getDocs(q);
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
