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
import { createNotification } from './notificationService';
import { formatDateFriendly } from '../utils/formatters';

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

// Coerce every numeric campaign field to a number before it hits Firestore
// (domain rule: never store numbers as strings). Tiers/placements are the v2
// prize-structure fields — optional and absent on legacy campaigns.
const num = (v) => parseFloat(v) || 0;

function sanitizeTiers(tiers) {
  if (!Array.isArray(tiers)) return tiers;
  return tiers.map((t) => ({
    ...t,
    level:   num(t.level),
    api:     num(t.api),
    apps:    num(t.apps),
    cash:    num(t.cash),
    voucher: num(t.voucher),
  }));
}

function sanitizePlacements(placements) {
  if (!Array.isArray(placements)) return placements;
  return placements.map((p) => ({ ...p, rank: num(p.rank), prize: num(p.prize) }));
}

export async function createCampaign(tenantId, createdBy, createdByName, createdByRole, campaignData) {
  const targets = (campaignData.targets ?? []).map((t) => ({
    ...t,
    threshold: parseFloat(t.threshold) || 0,
  }));

  const ref = collection(db, `tenants/${tenantId}/campaigns`);
  const docRef = await addDoc(ref, {
    ...campaignData,
    ...(campaignData.tiers !== undefined ? { tiers: sanitizeTiers(campaignData.tiers) } : {}),
    ...(campaignData.placements !== undefined ? { placements: sanitizePlacements(campaignData.placements) } : {}),
    targets,
    tenantId,
    createdBy,
    createdByName,
    createdByRole,
    createdAt: serverTimestamp(),
  });

  const savedCampaign = { id: docRef.id, ...campaignData, targets };
  if (campaignData.status === 'active') {
    await notifyCampaignParticipants(tenantId, savedCampaign).catch(console.error);
  }

  return docRef.id;
}

export async function updateCampaign(tenantId, campaignId, updates, previousStatus) {
  const targets = updates.targets
    ? updates.targets.map((t) => ({ ...t, threshold: parseFloat(t.threshold) || 0 }))
    : undefined;

  const payload = { ...updates, updatedAt: serverTimestamp() };
  if (targets) payload.targets = targets;
  if (updates.tiers !== undefined) payload.tiers = sanitizeTiers(updates.tiers);
  if (updates.placements !== undefined) payload.placements = sanitizePlacements(updates.placements);

  await updateDoc(doc(db, `tenants/${tenantId}/campaigns/${campaignId}`), payload);

  // Notify when transitioning draft → active
  if (previousStatus === 'draft' && updates.status === 'active') {
    const campaign = { id: campaignId, ...updates };
    await notifyCampaignParticipants(tenantId, campaign).catch(console.error);
  }
}

export async function deleteCampaign(tenantId, campaignId) {
  await deleteDoc(doc(db, `tenants/${tenantId}/campaigns/${campaignId}`));
}

/**
 * notifyCampaignParticipants — internal helper
 * Fetches affected agents by scope and sends each one a notification.
 */
async function notifyCampaignParticipants(tenantId, campaign) {
  const { scope = {}, name, prize, startDate, endDate } = campaign;
  const { type, unitIds = [], agentIds = [] } = scope;

  let agentQuery;
  if (type === 'branch') {
    agentQuery = query(
      collection(db, `tenants/${tenantId}/users`),
      where('role', '==', 'agent')
    );
  } else if (type === 'unit' && unitIds.length > 0) {
    agentQuery = query(
      collection(db, `tenants/${tenantId}/users`),
      where('role', '==', 'agent'),
      where('unitId', 'in', unitIds)
    );
  } else if (type === 'agent' && agentIds.length > 0) {
    // Notify listed agents directly
    const body = `A new campaign has launched. Prize: ${prize ?? '—'}. Runs ${formatDateFriendly(startDate)} to ${formatDateFriendly(endDate)}.`;
    await Promise.all(
      agentIds.map((uid) =>
        createNotification(tenantId, uid, {
          type:  'campaign_launched',
          title: `New Campaign: ${name}`,
          body,
        }).catch(console.error)
      )
    );
    return;
  } else {
    return;
  }

  const snap = await getDocs(agentQuery);
  // PR-1: exclude provisioning users from campaign notification fan-out.
  const recipients = snap.docs.filter((d) => d.data().provisioning !== true);
  const body = `A new campaign has launched. Prize: ${prize ?? '—'}. Runs ${formatDateFriendly(startDate)} to ${formatDateFriendly(endDate)}.`;
  await Promise.all(
    recipients.map((d) =>
      createNotification(tenantId, d.id, {
        type:  'campaign_launched',
        title: `New Campaign: ${name}`,
        body,
      }).catch(console.error)
    )
  );
}

/**
 * Campaign-window submissions, scoped to what the caller's rules arm can prove.
 *
 * The submissions `list` rule requires role-scoped queries: an agent must
 * constrain where('agentId','==',uid), a unit_manager where('unitId','==',uid),
 * a branch_manager where('branchId','==',claim). The previous unscoped
 * tenant-wide query was DENIED for all three (only TA/SM/PA could list), and
 * callers' catch-fallbacks rendered standings as TTD 0 / "no data".
 *
 * Scoped shapes ride the existing composites (agentId|unitId|branchId +
 * weekStarting); `status` is filtered client-side for scoped calls so no new
 * 3-field composite is needed.
 *
 * @param {{agentId?: string, unitId?: string, branchId?: string}} scope —
 *   pass exactly one key for agent/UM/BM callers; omit for TA/SM/PA.
 */
export async function getCampaignSubmissions(tenantId, startDate, endDate, scope = {}) {
  const clauses = [
    where('weekStarting', '>=', startDate),
    where('weekStarting', '<=', endDate),
  ];
  const scoped = Boolean(scope.agentId || scope.unitId || scope.branchId);
  if (scope.agentId) {
    // The only agentId composite is (agentId ASC, weekStarting DESC); a bare
    // equality+range query demands the ASC pairing and throws requires-index.
    // Explicit desc ordering rides the existing composite — no index change.
    clauses.push(where('agentId', '==', scope.agentId), orderBy('weekStarting', 'desc'));
  }
  else if (scope.unitId)   clauses.push(where('unitId', '==', scope.unitId));
  else if (scope.branchId) clauses.push(where('branchId', '==', scope.branchId));
  else clauses.push(where('status', '==', 'submitted'));
  const q = query(collection(db, `tenants/${tenantId}/submissions`), ...clauses);
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return scoped ? rows.filter((r) => r.status === 'submitted') : rows;
}

/**
 * Resolve the caller's getCampaignSubmissions scope from auth context.
 * Mirrors the rules list arms exactly; TA/SM/PA get the unscoped (allowed)
 * query. producing-manager submissions carry the manager's own unitId/branchId,
 * so UM/BM scopes include their own producing rows.
 */
export function campaignSubsScopeFor(role, uid, branchId) {
  if (role === 'branch_manager') return branchId ? { branchId } : { agentId: uid };
  if (role === 'unit_manager') return { unitId: uid };
  if (role === 'agent') return { agentId: uid };
  return {};
}
