import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * createAgent(agentData)
 * Calls the createAgentAccount Cloud Function.
 * agentData: { name, email, agentNumber, unitId, contractStartDate }
 */
export async function createAgent(agentData) {
  const fns = getFunctions();
  const fn = httpsCallable(fns, 'createAgentAccount');
  const result = await fn(agentData);
  return result.data;
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
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
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
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
