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
 * @returns {Promise<{ pinnedNav?: string[] }|null>}
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
