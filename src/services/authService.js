import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
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
    url: 'https://agencytrack.vercel.app',
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
