import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, setRuntimeTenantId } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        const tokenResult = await firebaseUser.getIdTokenResult(true);
        console.log('[AgencyTrack] Auth claims:', tokenResult.claims);
        console.log('[AgencyTrack] UID:', firebaseUser.uid);

        // ─────────────────────────────────────────────────────────────────────
        // BOOTSTRAP ONLY — auto-promotes first login to super_admin.
        // Remove before multi-tenant rollout. Tracked: SEC-11.
        //
        // This branch is the ONLY place in the app that reads
        // import.meta.env.VITE_TENANT_ID at runtime. All other tenant scoping
        // flows from auth claims (claims.tenantId), set server-side by the
        // setUserClaims / createAgentAccount Cloud Functions.
        // ─────────────────────────────────────────────────────────────────────
        if (!tokenResult.claims.role) {
          console.warn('[AgencyTrack] No role claim — attempting super_admin bootstrap');
          try {
            const bootstrapTenantId = import.meta.env.VITE_TENANT_ID;
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const fns = getFunctions();
            const setUserClaims = httpsCallable(fns, 'setUserClaims');
            await setUserClaims({
              uid: firebaseUser.uid,
              role: 'super_admin',
              tenantId: bootstrapTenantId,
            });
            await firebaseUser.getIdToken(true);
            console.log('[AgencyTrack] Super admin claims set successfully');
          } catch (err) {
            console.error('[AgencyTrack] Bootstrap failed:', err);
          }
        }

        // Re-read claims after potential bootstrap. tenantId is the canonical
        // runtime tenant scope source for the rest of the app.
        const finalClaims = (await firebaseUser.getIdTokenResult()).claims;
        const claimTenantId = finalClaims.tenantId ?? null;
        setTenantId(claimTenantId);
        setRole(finalClaims.role ?? null);
        // Populate the firebase.js runtime holder so non-React services
        // (authService, managerService, persistencyService, submissionService,
        // userService) can read the current tenantId via getTenantId().
        setRuntimeTenantId(claimTenantId);

        if (!claimTenantId) {
          console.error('[AgencyTrack] No tenantId in claims after auth resolution — profile load skipped');
          setUserProfile(null);
          setLoading(false);
          return;
        }

        try {
          const ref = doc(db, `tenants/${claimTenantId}/users/${firebaseUser.uid}`);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const profile = snap.data();
            setUserProfile(profile);
            // Profile role overrides claim role only if claim role was missing.
            if (!finalClaims.role) setRole(profile.role ?? null);

            // Dev-only guardrail: claim tenantId and profile tenantId must match.
            // Q2 confirmed user docs persist tenantId (functions/index.js:159).
            if (
              import.meta.env.DEV &&
              profile.tenantId &&
              profile.tenantId !== claimTenantId
            ) {
              throw new Error(
                `[AgencyTrack] tenantId mismatch — claim=${claimTenantId} profile=${profile.tenantId}. ` +
                  'Auth claim and Firestore user doc disagree. Refusing to continue in dev.'
              );
            }
          } else {
            setUserProfile(null);
          }
        } catch (err) {
          if (import.meta.env.DEV && /tenantId mismatch/.test(err?.message ?? '')) throw err;
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setRole(null);
        setTenantId(null);
        // Clear the runtime holder so a stale tenant cannot leak into the
        // next session if another user signs in on the same client.
        setRuntimeTenantId(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const value = { user, userProfile, role, tenantId, loading, isAuthenticated: !!user };

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
