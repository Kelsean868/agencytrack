/**
 * managerMonthlyRollupService.js — I2 monthly recruiting roll-up.
 *
 * Collection: /tenants/{tid}/managerMonthlyRollups/{managerId}_{YYYY_MM}
 * Privacy: WAR direction — owner RW, upline R; peers + downline DENY.
 *
 * Key invariants (locked in I2 brief):
 *  - monthKey stored as 'YYYY-MM' (ISO); never 'MM-YYYY'.
 *  - candidatesAssessed / agentsContracted: parseFloat then floor; clamped ≥ 0.
 *  - Meta fields (managerId, rank, branchId, unitId) sourced from managerMeta
 *    (the caller's live AuthContext values), never from client form input.
 *  - unitId written as ?? null — BM/SM user docs have unitId: null (Item 3).
 *  - managerName written for team-view display; not in rule's keys().hasAll().
 */

import {
  doc, setDoc, getDoc, getDocs, serverTimestamp,
  collection, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getWarRoleRank } from './managerWarService';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function rollupDocId(managerId, monthKey) {
  return `${managerId}_${monthKey}`;
}

/**
 * parseFloat then floor; clamp negatives to 0.
 * Brief: "parseFloat() enforced on both numeric fields; negatives rejected."
 */
function nonNegInt(v) {
  return Math.max(0, Math.floor(parseFloat(v ?? 0) || 0));
}

function sanitizeRollup(data) {
  return {
    candidatesAssessed: nonNegInt(data.candidatesAssessed),
    agentsContracted:   nonNegInt(data.agentsContracted),
    notes:              String(data.notes ?? '').trim().slice(0, 1000),
  };
}

/**
 * Identity + routing fields sourced from the caller's live session.
 * Mirror of managerWarService.warMeta() — unitId ?? null preserves BM/SM null.
 */
function rollupMeta(managerId, managerName, tenantId, monthKey, managerMeta) {
  const { managerRole, branchId, unitId } = managerMeta;
  return {
    managerId,
    managerName,
    tenantId,
    monthKey,
    managerRole,
    managerRoleRank: getWarRoleRank(managerRole),
    branchId:        branchId ?? null,
    unitId:          unitId   ?? null,  // BM/SM have unitId: null — WAR precedent
  };
}

// ── Write paths ───────────────────────────────────────────────────────────────

export async function saveRollupDraft(tenantId, managerId, managerName, monthKey, data, managerMeta) {
  const ref      = doc(db, `tenants/${tenantId}/managerMonthlyRollups/${rollupDocId(managerId, monthKey)}`);
  const existing = await getDoc(ref);
  const createdAt = existing.exists() ? {} : { createdAt: serverTimestamp() };
  await setDoc(
    ref,
    {
      ...createdAt,
      ...rollupMeta(managerId, managerName, tenantId, monthKey, managerMeta),
      ...sanitizeRollup(data),
      status:    'draft',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function submitRollup(tenantId, managerId, managerName, monthKey, data, managerMeta) {
  const ref      = doc(db, `tenants/${tenantId}/managerMonthlyRollups/${rollupDocId(managerId, monthKey)}`);
  const existing = await getDoc(ref);
  const createdAt = existing.exists() ? {} : { createdAt: serverTimestamp() };
  await setDoc(ref, {
    ...createdAt,
    ...rollupMeta(managerId, managerName, tenantId, monthKey, managerMeta),
    ...sanitizeRollup(data),
    status:      'submitted',
    updatedAt:   serverTimestamp(),
    submittedAt: serverTimestamp(),
  });
}

// ── Read paths ────────────────────────────────────────────────────────────────

export async function getRollup(tenantId, managerId, monthKey) {
  const ref  = doc(db, `tenants/${tenantId}/managerMonthlyRollups/${rollupDocId(managerId, monthKey)}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Fetch monthly rollups for the upline browse view (I2 team-view).
 * BM (rank 2): own-branch query → (branchId ASC, monthKey ASC) composite index.
 * SM+ (rank ≥ 3): tenant-wide query → monthKey single-field auto-index.
 *
 * Mirror of managerWarService.getWarsForUpline() with weekStart → monthKey.
 */
export async function getRollupsForUpline({ tenantId, monthKey, role, branchId }) {
  const coll = collection(db, `tenants/${tenantId}/managerMonthlyRollups`);
  const rank = getWarRoleRank(role);
  const q    = rank >= 3
    ? query(coll, where('monthKey', '==', monthKey))
    : query(coll, where('branchId', '==', branchId), where('monthKey', '==', monthKey));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
