import {
  collection, query, where, getDocs, getCountFromServer,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * getTenantUserCount — server-side aggregate count of all docs under
 * tenants/{tid}/users. Used by the Company Config surface (Run 5) for the
 * "applied to N users at {company}" save/flag toasts. Cheap (aggregate, no doc
 * transfer). Caller is expected to fail-soft on reject (toast omits the number).
 *
 * @param {string} tenantId
 * @returns {Promise<number>}
 */
export async function getTenantUserCount(tenantId) {
  const col = collection(db, `tenants/${tenantId}/users`);
  const snap = await getCountFromServer(col);
  return snap.data().count;
}

export async function getWeeklySubmissions(tenantId, weekStarting) {
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('unitId', '==', callerUid),
      where('weekStarting', '==', weekStarting)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (claims.role === 'branch_manager' && claims.branchId) {
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('branchId', '==', claims.branchId),
      where('weekStarting', '==', weekStarting)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // TA / PA: full query.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantUsers(tenantId, { includeInactive = false } = {}) {
  const { claims } = await auth.currentUser.getIdTokenResult();
  const callerUid = auth.currentUser.uid;

  const col = collection(db, `tenants/${tenantId}/users`);
  let q;
  if (claims.role === 'unit_manager') {
    q = query(col, where('unitId', '==', callerUid));
  } else if (claims.role === 'branch_manager' && claims.branchId) {
    q = query(col, where('branchId', '==', claims.branchId));
  } else {
    q = col;
  }

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true && (includeInactive || u.active !== false));
}

export async function getAllYTDSubmissions(tenantId) {
  const year = new Date().getFullYear();
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    // status filtered client-side to avoid a 3-field compound index
    // (unitId + weekStarting range + status).
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('unitId', '==', callerUid),
      where('weekStarting', '>=', `${year}-01-01`),
      where('weekStarting', '<=', `${year}-12-31`)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => s.status === 'submitted');
  }

  if (claims.role === 'branch_manager' && claims.branchId) {
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('branchId', '==', claims.branchId),
      where('status', '==', 'submitted'),
      where('weekStarting', '>=', `${year}-01-01`),
      where('weekStarting', '<=', `${year}-12-31`)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // TA / PA: full query.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
