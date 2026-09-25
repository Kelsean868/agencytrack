// SEC-10 (in-PR extension) — decouples authService.signOut() (a plain
// service module, no JSX) from the ConfirmDialog UI it needs when Firestore
// still has unsynchronized pending writes at sign-out time.
//
// SignOutConfirmHost (mounted once in main.jsx, alongside
// FirestoreCorruptionBoundary) registers its resolver here on mount.
// authService.signOut() calls requestSignOutConfirmation() and awaits the
// user's choice without needing to import React or hold any component state
// itself.
let handler = null;

/** Registered by SignOutConfirmHost. Pass null on unmount. */
export function registerSignOutConfirmHandler(fn) {
  handler = fn;
}

/**
 * requestSignOutConfirmation — resolves true if the user chose to sign out
 * anyway, false if they cancelled (or if no host is mounted to ask at all —
 * fails toward the safer "don't clear data" choice rather than proceeding
 * silently).
 *
 * @returns {Promise<boolean>}
 */
export async function requestSignOutConfirmation() {
  if (!handler) return false;
  return handler();
}
