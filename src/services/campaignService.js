/**
 * Campaign service — all reads/writes for /tenants/{tenantId}/campaigns
 *
 * Supported metric keys:
 *   apiSold, applicationsSold, ffiConducted, ciConducted
 */
import {
  collection, query, orderBy, where, getDocs,
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export async function getCampaigns(tenantId) {
  const q = query(
    collection(db, `tenants/${tenantId}/campaigns`),
    orderBy('startDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getActiveCampaignsForAgent(tenantId, agentId, unitId) {
  const today = new Date().toISOString().slice(0, 10);
  const q = query(
    collection(db, `tenants/${tenantId}/campaigns`),
    where('startDate', '<=', today),
    where('endDate', '>=', today)
  );
  const snap = await getDocs(q);
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return all.filter((c) => {
    const { type, unitIds = [], agentIds = [] } = c.scope ?? {};
    if (type === 'branch') return true;
    if (type === 'unit') return unitId && unitIds.includes(unitId);
    if (type === 'agent') return agentIds.includes(agentId);
    return false;
  });
}

export async function createCampaign(tenantId, createdBy, createdByName, createdByRole, campaignData) {
  const targets = (campaignData.targets ?? []).map((t) => ({
    ...t,
    threshold: parseFloat(t.threshold) || 0,
  }));

  const ref = collection(db, `tenants/${tenantId}/campaigns`);
  const docRef = await addDoc(ref, {
    ...campaignData,
    targets,
    tenantId,
    createdBy,
    createdByName,
    createdByRole,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCampaign(tenantId, campaignId, updates) {
  const targets = updates.targets
    ? updates.targets.map((t) => ({ ...t, threshold: parseFloat(t.threshold) || 0 }))
    : undefined;

  const payload = { ...updates, updatedAt: serverTimestamp() };
  if (targets) payload.targets = targets;

  await updateDoc(doc(db, `tenants/${tenantId}/campaigns/${campaignId}`), payload);
}

export async function deleteCampaign(tenantId, campaignId) {
  await deleteDoc(doc(db, `tenants/${tenantId}/campaigns/${campaignId}`));
}

export async function getCampaignSubmissions(tenantId, startDate, endDate) {
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('weekStarting', '>=', startDate),
    where('weekStarting', '<=', endDate),
    where('status', '==', 'submitted')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
