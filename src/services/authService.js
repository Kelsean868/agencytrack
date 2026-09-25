import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {
  doc, getDoc, collection, addDoc, serverTimestamp,
  terminate, clearIndexedDbPersistence, waitForPendingWrites,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { APP_URL } from '../constants/brand';
import { requestSignOutConfirmation } from '../lib/signOutConfirmBridge';

const PENDING_WRITES_TIMEOUT_MS = 5000;

/**
 * pendingWritesStillOutstanding — races waitForPendingWrites(db) against a
 * timeout. Returns true (treat as "still outstanding, ask the user") when
 * the timeout wins OR waitForPendingWrites rejects; returns false only when
 * it resolves within the window, meaning nothing was pending (or it all
 * synced fast).
 *
 * The `.then`/`.catch` are attached directly to the same promise used in the
 * race, so a late resolution/rejection AFTER the timeout has already won
 * completes quietly (sets `outcome`, which is no longer read) instead of
 * surfacing as an unhandled rejection.
 */
async function pendingWritesStillOutstanding(timeoutMs = PENDING_WRITES_TIMEOUT_MS) {
  let outcome = 'timeout';
  await Promise.race([
    waitForPendingWrites(db)
      .then(() => { outcome = 'settled'; })
      .catch((err) => {
        console.error('[authService] waitForPendingWrites failed — treating as pending writes outstanding', err);
        outcome = 'error';
      }),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  return outcome !== 'settled';
}

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * signOut — SEC-10. Beyond revoking the Firebase Auth session, this clears
 * the Firestore IndexedDB cache so the next sign-in (same user, or a
 * different one on a shared device) never reads stale or cross-account
 * cached documents, and then reloads so the app boots clean.
 *
 * In-PR extension (CodeRabbit finding on PR #974): before doing any of that,
 * wait up to PENDING_WRITES_TIMEOUT_MS for Firestore's queued writes to
 * reach the server. If they're still outstanding when that window closes,
 * ask the user via SignOutConfirmHost (signOutConfirmBridge.js) rather than
 * silently discarding an unsynced write. Cancelling leaves the user signed
 * in with nothing cleared — signOut() returns without touching Auth or
 * Firestore at all.
 *
 * Order matters for the clear sequence itself: terminate(db) MUST run
 * before clearIndexedDbPersistence — Firestore throws ("Persistence cannot
 * be cleared while the Firestore instance is still running") if the
 * connection is still open. Auth is signed out FIRST so any in-flight
 * listeners tear down against a null user before the Firestore connection
 * itself is torn down underneath them.
 *
 * The cache-clear step is best-effort: a failure there must not block
 * sign-out, which is the security-relevant half of this function.
 */
export async function signOut() {
  const stillPending = await pendingWritesStillOutstanding();
  if (stillPending) {
    const confirmed = await requestSignOutConfirmation();
    if (!confirmed) return; // Cancel: stay signed in, nothing cleared.
  }

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
