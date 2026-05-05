import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

// ─────────────────────────────────────────────────────────────────────────────
// Runtime tenantId holder — SEC-9
//
// Lifecycle:
//   1. Module loads with `_tenantId = null`.
//   2. AuthContext calls `setRuntimeTenantId(claimTenantId)` after Firebase
//      Auth claims resolve (post sign-in or token refresh).
//   3. Services and helpers call `getTenantId()` to read the current tenant.
//   4. AuthContext calls `setRuntimeTenantId(null)` on sign-out so a stale
//      tenant cannot leak into the next session.
//   5. `getTenantId()` THROWS when unpopulated — failing fast beats silent
//      undefined that would corrupt Firestore paths.
//
// `_tenantId` is module-scoped and never exported. Only the getter/setter
// cross the module boundary.
//
// TODO (SEC-9b): This pattern assumes one tenant per browser session.
// Super-admin pivoting between tenants in a single session is NOT supported —
// the holder is a single slot. If/when cross-tenant super-admin views are
// required, migrate services to accept tenantId as an explicit parameter
// (the pattern already used by notificationService.js).
// ─────────────────────────────────────────────────────────────────────────────
let _tenantId = null;

export function setRuntimeTenantId(id) {
  _tenantId = id ?? null;
}

export function getTenantId() {
  if (!_tenantId) {
    throw new Error(
      'getTenantId() called before AuthContext populated the holder — ' +
      'service likely called outside React tree or before auth resolved.'
    );
  }
  return _tenantId;
}

export default app;
