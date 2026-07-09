/**
 * featureFlagsService — read-only tenant feature-flag lookup (item 3.4).
 *
 * Flags live as a `featureFlags` map on the EXISTING tenant config doc
 * `tenants/{tenantId}/config/settings` — the same `config/{docId}` idiom that
 * `goalsService.getCompanyMinimums()` reads (`config/companyMinimums`). This
 * service adds NO write surface: the operator flips a flag directly in the
 * Firebase console. There is NO rules change — the shipped `config/{docId}`
 * block already grants tenant-scoped reads:
 *
 *   match /config/{docId} {
 *     allow read: if isSignedIn() && getTenantId() == tenantId;
 *     ...
 *   }
 *
 * so any signed-in same-tenant user may read `config/settings` exactly as they
 * already read `config/companyMinimums`.
 *
 * ABSENT doc / ABSENT `featureFlags` field / ABSENT key => flag OFF. A read
 * failure also resolves to OFF (fail-closed) so a flag lookup can never block
 * the app. With no flags written, every surface behind these flags is absent
 * and the app is byte-identical to its pre-3.4 behavior.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// The three flag keys introduced by item 3.4. Kept as a frozen map so callers
// reference the canonical spelling rather than bare string literals.
export const FEATURE_FLAG_KEYS = Object.freeze({
  persistencyV2: 'persistencyV2',
  policyLedgerCampaignLens: 'policyLedgerCampaignLens',
  awardsProvenance: 'awardsProvenance',
});

/**
 * getFeatureFlags(tenantId) — returns the tenant's raw `featureFlags` map.
 * Absent doc/field or any read failure resolves to `{}` (all flags OFF).
 *
 * @param {string} tenantId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getFeatureFlags(tenantId) {
  if (!tenantId) return {};
  try {
    const ref = doc(db, `tenants/${tenantId}/config/settings`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return {};
    const data = snap.data() ?? {};
    const flags = data.featureFlags;
    return flags && typeof flags === 'object' ? flags : {};
  } catch {
    // Fail-closed: a read error must never surface as a flag being ON, and
    // must never block the surface that consumes it.
    return {};
  }
}

/** isFlagOn(flags, key) — strict boolean gate; only an explicit `true` is ON. */
export function isFlagOn(flags, key) {
  return flags?.[key] === true;
}
