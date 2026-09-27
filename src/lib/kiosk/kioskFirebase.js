import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase';
import { initAppCheck } from '../appCheck';

// Guard against duplicate-app errors in HMR (Vite hot-reload re-executes the
// module) and in test environments that import this module more than once.
// If the 'kiosk' app already exists (from a prior module load), reuse it —
// getAuth() returns the existing auth instance; initializeAuth() would throw.
const existingKioskApp = getApps().find((a) => a.name === 'kiosk');
const kioskApp = existingKioskApp ?? initializeApp(firebaseConfig, 'kiosk');
// P2e (SEC-11): the kiosk reads Firestore through this secondary app, so it
// gets App Check too — its traffic shows in the metrics, and turning
// enforcement on later does not strand the TV. Monitor mode; skipped without a key.
if (!existingKioskApp) initAppCheck(kioskApp);
export const kioskAuth = existingKioskApp
  ? getAuth(kioskApp)
  : initializeAuth(kioskApp, { persistence: inMemoryPersistence });
export const kioskDb = getFirestore(kioskApp);
