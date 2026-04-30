import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, tenantId } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Diagnose current custom claims
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        console.log('[AgencyTrack] Auth claims:', tokenResult.claims);
        console.log('[AgencyTrack] UID:', firebaseUser.uid);

        // Bootstrap super_admin claims if none are set yet
        if (!tokenResult.claims.role) {
          console.warn('[AgencyTrack] No role claim — attempting super_admin bootstrap');
          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const fns = getFunctions();
            const setUserClaims = httpsCallable(fns, 'setUserClaims');
            await setUserClaims({
              uid: firebaseUser.uid,
              role: 'super_admin',
              tenantId,
            });
            // Force token refresh to pick up new claims
            await firebaseUser.getIdToken(true);
            console.log('[AgencyTrack] Super admin claims set successfully');
          } catch (err) {
            console.error('[AgencyTrack] Bootstrap failed:', err);
          }
        }

        try {
          const ref = doc(db, `tenants/${tenantId}/users/${firebaseUser.uid}`);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const profile = snap.data();
            setUserProfile(profile);
            setRole(profile.role ?? null);
          } else {
            setUserProfile(null);
            setRole(null);
          }
        } catch {
          setUserProfile(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const value = { user, userProfile, role, loading, isAuthenticated: !!user };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
