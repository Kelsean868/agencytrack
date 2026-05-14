import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// Per-session cache of a UM caller's agent UIDs, keyed by `${tenantId}:${callerUid}`.
// Populated lazily on first read, cleared on sign-out by AuthContext via
// clearAgentUidCache(). No TTL — reassignments are reflected after next sign-in.
const agentUidCache = new Map();

export function clearAgentUidCache() {
  agentUidCache.clear();
}

// Resolves the UM caller's scoped agent UIDs, with per-session memoization.
// Submissions don't carry unitId; SHAKEDOWN-002B established the user-list
// pre-fetch as the defense-in-depth filter for UM-scoped submission reads.
async function getCallerAgentUids(tenantId, callerUid) {
  const cacheKey = `${tenantId}:${callerUid}`;
  if (agentUidCache.has(cacheKey)) {
    return agentUidCache.get(cacheKey);
  }
  const agentsSnap = await getDocs(
    query(collection(db, `tenants/${tenantId}/users`), where('unitId', '==', callerUid))
  );
  // TODO: chunk into ≤30-item batches if units ever exceed Firestore `in` cap
  const agentUids = agentsSnap.docs
    .filter((d) => d.data().provisioning !== true)
    .map((d) => d.id);
  agentUidCache.set(cacheKey, agentUids);
  return agentUids;
}

export async function getWeeklySubmissions(tenantId, weekStarting) {
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    const agentUids = await getCallerAgentUids(tenantId, callerUid);
    if (agentUids.length === 0) return [];
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('weekStarting', '==', weekStarting),
      where('agentId', 'in', agentUids)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // BM / TA / PA: full query unchanged.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '==', weekStarting)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTenantUsers(tenantId) {
  const { claims } = await auth.currentUser.getIdTokenResult();
  const callerUid = auth.currentUser.uid;

  // SHAKEDOWN-002: unit_manager callers see only their own unit's agents.
  // Other manager roles retain full branch/tenant visibility.
  const col = collection(db, `tenants/${tenantId}/users`);
  const q = claims.role === 'unit_manager'
    ? query(col, where('unitId', '==', callerUid))
    : col;

  const snap = await getDocs(q);
  // PR-1: hide provisioning users from every list-style UI consumer (9 callers).
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true);
}

export async function getAllYTDSubmissions(tenantId) {
  const year = new Date().getFullYear();
  const { claims } = await auth.currentUser.getIdTokenResult();

  if (claims.role === 'unit_manager') {
    const callerUid = auth.currentUser.uid;
    const agentUids = await getCallerAgentUids(tenantId, callerUid);
    if (agentUids.length === 0) return [];
    // status filtered client-side to avoid a 3-field compound index (agentId + weekStarting range + status).
    const q = query(
      collection(db, `tenants/${tenantId}/submissions`),
      where('agentId', 'in', agentUids),
      where('weekStarting', '>=', `${year}-01-01`),
      where('weekStarting', '<=', `${year}-12-31`)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => s.status === 'submitted');
  }

  // BM / TA / PA: full query unchanged.
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '>=', `${year}-01-01`),
    where('weekStarting', '<=', `${year}-12-31`),
    where('status', '==', 'submitted')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
