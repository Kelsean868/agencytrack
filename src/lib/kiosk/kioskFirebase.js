import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase';

const kioskApp = initializeApp(firebaseConfig, 'kiosk');
export const kioskAuth = initializeAuth(kioskApp, { persistence: inMemoryPersistence });
export const kioskDb = getFirestore(kioskApp);
