import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, tenantId } from '../firebase';

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid) {
  const ref = doc(db, `tenants/${tenantId}/users/${uid}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
