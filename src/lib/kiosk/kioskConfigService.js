// Tier-3 #15: manager-side kiosk rotation config (per-branch panel enable/disable).
//
// This module uses the MAIN app `db` (not kioskDb) because it is consumed by the
// manager's KioskModeTab, which runs in the manager's authenticated session. The
// kiosk DISPLAY reads the same doc via kioskDb in kioskServices.js
// (getKioskDisabledPanels). One doc per branch: tenants/{tid}/kioskConfig/{branchId}
// carrying { disabledPanels: string[], updatedBy, updatedAt } — see firestore.rules
// `match /kioskConfig/{branchId}`.
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export function kioskConfigRef(tenantId, branchId) {
  return doc(db, `tenants/${tenantId}/kioskConfig/${branchId}`);
}

// Returns the branch's disabled-panel list. Absent doc / missing context /
// malformed field all degrade to [] (all panels enabled) — the config is a
// refinement, never a hard dependency.
export async function getKioskConfig(tenantId, branchId) {
  if (!tenantId || !branchId) return { disabledPanels: [] };
  const snap = await getDoc(kioskConfigRef(tenantId, branchId));
  if (!snap.exists()) return { disabledPanels: [] };
  const data = snap.data();
  return {
    disabledPanels: Array.isArray(data.disabledPanels) ? data.disabledPanels : [],
  };
}

// Full overwrite (setDoc, NOT merge) so the persisted doc always holds exactly
// the three fields the rules validate via keys().hasOnly(...). `disabledPanels`
// must contain only kioskConfig.js PANEL_ORDER keys — the caller (KioskModeTab)
// only ever toggles those.
export async function setKioskDisabledPanels(tenantId, branchId, uid, disabledPanels) {
  if (!tenantId || !branchId) throw new Error('Missing tenant or branch context');
  await setDoc(kioskConfigRef(tenantId, branchId), {
    disabledPanels,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
