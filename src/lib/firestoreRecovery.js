// SEC-10 — Firestore local-persistence corruption recovery.
//
// Firestore's IndexedDB persistence layer can enter an unrecoverable
// corrupted state, surfaced as:
//   FIRESTORE (<sdk version>) INTERNAL ASSERTION FAILED: Unexpected state
//   (ID: <hex>)
// (seen live 2026-09-23, ID: b815, with the app stuck on "Loading
// AgencyTrack…" indefinitely). Once thrown, every subsequent Firestore call
// in that browser tab fails the same way — the SDK cannot self-heal. The
// only fix is deleting the corrupted IndexedDB database and reloading.
//
// This module is the single source of truth for (a) recognizing the error
// family and (b) performing the repair, so the render-time error boundary,
// the async/global listeners registered at app start, and the loading-
// screen timeout fallback all share one implementation.

import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { db } from '../firebase';

const ASSERTION_FAILURE_PATTERN = /INTERNAL ASSERTION FAILED/i;

/** True if `error` (an Error, a string, or an unknown thrown/rejected value) matches the Firestore internal-assertion-failure family. */
export function isFirestoreAssertionFailure(error) {
  if (!error) return false;
  const message = typeof error === 'string' ? error : (error.message ?? String(error));
  return ASSERTION_FAILURE_PATTERN.test(message);
}

/**
 * repairFirestoreCache — clears ONLY the Firestore IndexedDB cache, never
 * the Firebase Auth store (a separate IndexedDB database the SDK owns) — a
 * signed-in user stays signed in and lands back on their dashboard after
 * reload, not the login screen.
 *
 * Order matters: terminate(db) MUST run first. clearIndexedDbPersistence
 * throws ("Persistence cannot be cleared while the Firestore instance is
 * running") if a connection is still open, and once the assertion failure
 * has fired the instance is unusable for anything else anyway.
 *
 * Both steps are best-effort — a failure clearing the (already-corrupted)
 * cache must not block the reload, since the reload is the actual fix path
 * for the user.
 */
export async function repairFirestoreCache() {
  try {
    await terminate(db);
  } catch (err) {
    console.error('[firestoreRecovery] terminate(db) failed during repair', err);
  }
  try {
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.error('[firestoreRecovery] clearIndexedDbPersistence failed during repair', err);
  }
  window.location.reload();
}
