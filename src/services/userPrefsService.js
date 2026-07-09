import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * userPrefsService — per-user app preferences (Nav redesign PR-2).
 *
 * Single Firestore doc per user: `tenants/{tenantId}/users/{uid}/prefs/app`.
 * Owner-only (firestore.rules `prefs/{prefId}` block). Written with
 * `{ merge: true }` so independent prefs (pinnedNav now; menuLayout in PR-4)
 * never clobber each other.
 *
 * tenantId + uid are sourced by the caller exactly as `moneyNeedsService` does
 * (from AuthContext: tenantId + user.uid).
 */

const PREFS_DOC_ID = 'app';

function prefsDocRef(tenantId, uid) {
  return doc(db, 'tenants', tenantId, 'users', uid, 'prefs', PREFS_DOC_ID);
}

/**
 * Read the user's prefs doc. Returns the doc data (`{ pinnedNav?, menuLayout?, updatedAt? }`)
 * or null when no doc exists. Callers tolerate a thrown read (offline / rules) by
 * falling back to the localStorage mirror or seeds — never block render on this.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @returns {Promise<{ pinnedNav?: string[], menuLayout?: string, navOrder?: Record<string, string[]>, settings?: Record<string, *> }|null>}
 *   `settings` (Tier 2 · 2.4) is the Settings v2 view-defaults map
 *   (`masterSheetPreset`, `defaultPeriod`, …). Theme is device-local (localStorage),
 *   not in this map.
 *   `navOrder` (Tier 1 · 1.4) is a map keyed by navConfig key
 *   (`agent` | `producingManager` | `manager` | `tenantAdmin`) → the user's
 *   preferred ordered list of nav item ids for that config. Agent/manager nav
 *   ids overlap, so the per-config map avoids id collisions a flat array would hit.
 */
export async function getUserPrefs(tenantId, uid) {
  if (!tenantId || !uid) return null;
  const snap = await getDoc(prefsDocRef(tenantId, uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Persist the pinned-nav id list. Merge-write so a future `menuLayout` (PR-4) on
 * the same doc is preserved.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {string[]} pinnedNav  ordered list of navConfig item ids
 * @returns {Promise<void>}
 */
export async function setPinnedNav(tenantId, uid, pinnedNav) {
  if (!tenantId || !uid) throw new Error('setPinnedNav requires tenantId and uid');
  await setDoc(
    prefsDocRef(tenantId, uid),
    { pinnedNav: Array.isArray(pinnedNav) ? pinnedNav : [], updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Persist the sidebar menu-layout preference (Nav redesign PR-4). Merge-write so
 * the coexisting `pinnedNav` (PR-2) on the same doc is preserved. Validation of
 * the value (`pinned` | `workspace` | `both`) and the agent→pinned clamp live in
 * `useMenuLayout`; this writer only guards tenantId/uid presence.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {'pinned'|'workspace'|'both'} menuLayout
 * @returns {Promise<void>}
 */
export async function setMenuLayout(tenantId, uid, menuLayout) {
  if (!tenantId || !uid) throw new Error('setMenuLayout requires tenantId and uid');
  await setDoc(
    prefsDocRef(tenantId, uid),
    { menuLayout, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Persist the sidebar nav-order preference for one nav config (Tier 1 · 1.4 —
 * desktop sidebar drag-reorder). Stored under `navOrder.{configKey}` so distinct
 * configs (agent / producingManager / manager / tenantAdmin) never clobber each
 * other. Deep-merge-write: `{ merge: true }` merges the nested `navOrder` map, so
 * a write for one config preserves the others (and the coexisting `pinnedNav` /
 * `menuLayout`). Validation (dropping stale ids, within-section semantics) lives
 * in `useNavOrder` + `applyNavOrder`; this writer only guards tenantId/uid/configKey.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} configKey  navConfig key the order applies to
 * @param {string[]} orderIds  ordered list of navConfig item ids
 * @returns {Promise<void>}
 */
export async function setNavOrder(tenantId, uid, configKey, orderIds) {
  if (!tenantId || !uid) throw new Error('setNavOrder requires tenantId and uid');
  if (!configKey) throw new Error('setNavOrder requires a configKey');
  await setDoc(
    prefsDocRef(tenantId, uid),
    {
      navOrder: { [configKey]: Array.isArray(orderIds) ? orderIds : [] },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Persist a single App-settings value (Fable Tier 2 · 2.4 — Settings v2 · My
 * Preferences view-defaults). Stored under `settings.{key}` so each pref (e.g.
 * `masterSheetPreset`, `defaultPeriod`) is written independently. Deep-merge:
 * `{ merge: true }` merges the nested `settings` map, so a write for one key
 * preserves the others (and the coexisting `pinnedNav` / `menuLayout` / `navOrder`).
 * ONLY the touched key is written — the caller never rebuilds the whole map, so
 * two devices editing different settings never clobber each other's key.
 *
 * Theme is intentionally NOT stored here — it stays a device-local localStorage
 * pref (see `src/lib/theme.js`), matching the pre-2.4 dark-toggle behavior and
 * the no-FOUC first-paint restore.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} key    settings key (e.g. 'masterSheetPreset' | 'defaultPeriod')
 * @param {*} value       serializable value
 * @returns {Promise<void>}
 */
export async function setAppSetting(tenantId, uid, key, value) {
  if (!tenantId || !uid) throw new Error('setAppSetting requires tenantId and uid');
  if (!key) throw new Error('setAppSetting requires a key');
  await setDoc(
    prefsDocRef(tenantId, uid),
    { settings: { [key]: value }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
