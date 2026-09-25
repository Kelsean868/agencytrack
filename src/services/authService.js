import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { doc, getDoc, collection, addDoc, serverTimestamp, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { APP_URL } from '../constants/brand';

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * signOut — SEC-10. Beyond revoking the Firebase Auth session, this clears
 * the Firestore IndexedDB cache so the next sign-in (same user, or a
 * different one on a shared device) never reads stale or cross-account
 * cached documents, and then reloads so the app boots clean.
 *
 * Order matters: terminate(db) MUST run before clearIndexedDbPersistence —
 * Firestore throws ("Persistence cannot be cleared while the Firestore
 * instance is still running") if the connection is still open. Auth is
 * signed out FIRST so any in-flight listeners tear down against a null
 * user before the Firestore connection itself is torn down underneath
 * them.
 *
 * The cache-clear step is best-effort: a failure there must not block
 * sign-out, which is the security-relevant half of this function.
 */
export async function signOut() {
  await firebaseSignOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.error('[authService] Firestore cache clear on logout failed', err);
  }
  window.location.reload();
}

export async function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(tenantId, uid) {
  const ref = doc(db, `tenants/${tenantId}/users/${uid}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * requestEmailUpdate — tenant_admin self-service email change.
 *
 * Re-authenticates with the current password, then calls
 * verifyBeforeUpdateEmail so the new address must be clicked to confirm.
 * The Firebase Auth email does NOT change until the user clicks the link;
 * the Firestore user doc email syncs lazily via AuthContext on the next
 * sign-in after verification (see AuthContext.jsx email-mismatch branch).
 *
 * Writes an audit entry to auditAdminEmailUpdates on success.
 *
 * Throws on re-auth failure (wrong password), email already in use,
 * or network error — callers handle these and surface appropriate copy.
 */
export async function requestEmailUpdate(user, currentPassword, newEmail, tenantId) {
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await verifyBeforeUpdateEmail(user, newEmail, {
    url: APP_URL,
  });
  await addDoc(collection(db, 'auditAdminEmailUpdates'), {
    uid: user.uid,
    tenantId,
    oldEmail: user.email,
    newEmail,
    initiatedByUid: user.uid,
    userAgent: navigator.userAgent,
    timestamp: serverTimestamp(),
  });
}
