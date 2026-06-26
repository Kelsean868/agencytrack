import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Track K · K7 — financing config (the clause-5.3 notify recipient).
//
// Firestore path: tenants/{tenantId}/config/financingConfig. Mirrors the
// established config/{concern}+service pattern (goalsService.getCompanyMinimums /
// managerActivityStandardsService). The wildcard config/{docId} rule already
// governs access:
//   read:  any signed-in same-tenant user (managers + the agent surfaces)
//   write: platform_admin | tenant_admin only
// → K7 adds NO firestore.rules and needs no index (single doc read by id).
//
// Single field today: notifyRecipientUid — the uid the 5.3 >10%-adjustment
// notify duty fires at (the CRO-function holder). When a `cro` role is built the
// uid re-points cleanly; K7 invents NO role (banked FU). The app tolerates
// absence: a null/absent recipient disables the notify affordance with an
// explicit "no recipient configured" state — never a silent no-op. The K7 CF
// (notifyFinancingAdjustment) resolves this same doc server-side via the Admin
// SDK; this client service powers the tenant-admin config surface + the panel's
// disabled-state read.

export const FINANCING_CONFIG_DEFAULT = { notifyRecipientUid: null };

// Returns the tenant's financingConfig with the default filled in for the
// missing/absent field. Missing doc → { notifyRecipientUid: null }.
export async function getFinancingConfig(tenantId) {
  if (!tenantId) throw new Error('getFinancingConfig: tenantId required');
  const ref = doc(db, `tenants/${tenantId}/config/financingConfig`);
  const snap = await getDoc(ref);
  const stored = snap.exists() ? snap.data() : {};
  return { notifyRecipientUid: stored.notifyRecipientUid ?? null };
}

// Writes the notify recipient. notifyRecipientUid is a non-empty string uid, or
// null/''/'undefined' to CLEAR (re-disables the affordance). actor = { uid, name }
// — updatedBy/updatedByName/updatedAt are the audit metadata. merge:true preserves
// any future financingConfig fields. Rules restrict the write to tenant_admin /
// platform_admin (defense-in-depth; the UI gates the surface too).
export async function setFinancingConfig(tenantId, data, actor) {
  if (!tenantId) throw new Error('setFinancingConfig: tenantId required');
  if (!actor || !actor.uid) throw new Error('setFinancingConfig: actor.uid required');

  let notifyRecipientUid = null;
  const raw = data?.notifyRecipientUid;
  if (raw !== undefined && raw !== null && raw !== '') {
    if (typeof raw !== 'string') {
      throw new Error('setFinancingConfig: notifyRecipientUid must be a string uid or null');
    }
    notifyRecipientUid = raw;
  }

  const ref = doc(db, `tenants/${tenantId}/config/financingConfig`);
  await setDoc(
    ref,
    {
      notifyRecipientUid,
      updatedBy: actor.uid,
      updatedByName: actor.name ?? '',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { notifyRecipientUid };
}
