import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

export const firebaseConfig = {
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

// Local emulator wiring — strictly opt-in via an explicit build-time env flag.
// This flag is NEVER set in the production (Vercel) environment, so production
// builds provably skip this block and connect to live Firebase. It is set only
// for the local emulator-backed smoke harness (see scripts/verification/lib/
// emulator-harness.mjs and the npm-less `vite build --mode emulator` smoke path).
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const authHost =
    import.meta.env.VITE_EMULATOR_AUTH_URL || 'http://127.0.0.1:9099';
  const fsHost = import.meta.env.VITE_EMULATOR_FIRESTORE_HOST || '127.0.0.1';
  const fsPort = Number(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT || 9090);
  connectAuthEmulator(auth, authHost, { disableWarnings: true });
  connectFirestoreEmulator(db, fsHost, fsPort);
  console.info(
    `[firebase] Connected to local emulators — auth: ${authHost}, firestore: ${fsHost}:${fsPort}`
  );
}

export default app;
