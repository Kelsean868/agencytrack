import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { clearAgentUidCache } from '../services/managerService';

const AuthContext = createContext(null);

// Per-user localStorage cache for the resolved tenantId.
// This lets us kick off a parallel doc read alongside the forced token refresh
// on every sign-in — critical for managers whose setCustomUserClaims() call
// hasn't propagated to the regional token-issuance server yet (can take
// 60–120 s on fresh accounts). Keyed by uid so multi-user devices stay clean.
function readCachedTenantId(uid) {
  try { return localStorage.getItem(`agencytrack-tenantid-${uid}`) || null; }
  catch { return null; }
}
function writeCachedTenantId(uid, tenantId) {
  try { localStorage.setItem(`agencytrack-tenantid-${uid}`, tenantId); }
  catch { /* localStorage unavailable (private mode or security policy) */ }
}

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

        // Run the forced token refresh and a cached-doc read in parallel.
        // The doc is the immediate source of truth for UI routing; claims
        // are eventually-consistent and authoritative for Firestore rules.
        // If a cached tenantId exists we can start the doc read right away
        // without waiting for the token result.
        const cachedTenantId = readCachedTenantId(firebaseUser.uid);
        const [tokenResult, cachedSnap] = await Promise.all([
          firebaseUser.getIdTokenResult(true),
          cachedTenantId
            ? getDoc(doc(db, `tenants/${cachedTenantId}/users/${firebaseUser.uid}`))
            : Promise.resolve(null),
        ]);

        console.log('[AgencyTrack] Auth claims:', tokenResult.claims);
        console.log('[AgencyTrack] UID:', firebaseUser.uid);

        const claimTenantId = tokenResult.claims.tenantId ?? null;
        const claimRole     = tokenResult.claims.role     ?? null;

        // If claims reveal a different tenantId than the cache (e.g. after a
        // cross-tenant role change), re-read from the canonical path.
        let snap = cachedSnap;
        if (claimTenantId && claimTenantId !== cachedTenantId) {
          snap = await getDoc(doc(db, `tenants/${claimTenantId}/users/${firebaseUser.uid}`));
        }

        let profile     = null;
        let docTenantId = null;
        let docRole     = null;

        try {
          if (snap?.exists()) {
            profile     = snap.data();
            docTenantId = profile.tenantId ?? null;
            docRole     = profile.role     ?? null;

            // Dev-only guardrail: when claims ARE present they must agree with
            // the doc. Missing claims (propagation delay) are not a mismatch.
            if (
              import.meta.env.DEV &&
              claimTenantId &&
              docTenantId &&
              docTenantId !== claimTenantId
            ) {
              throw new Error(
                `[AgencyTrack] tenantId mismatch — claim=${claimTenantId} profile=${docTenantId}. ` +
                  'Auth claim and Firestore user doc disagree. Refusing to continue in dev.'
              );
            }
          }
        } catch (err) {
          if (import.meta.env.DEV && /tenantId mismatch/.test(err?.message ?? '')) throw err;
          profile     = null;
          docTenantId = null;
          docRole     = null;
        }

        // Doc is load-bearing: claims.role ?? doc.role, claims.tenantId ?? doc.tenantId.
        // Early-exit only if BOTH resolved values are null (true error state —
        // account provisioning failed or claims + doc are simultaneously absent).
        const resolvedTenantId = claimTenantId ?? docTenantId ?? null;
        const resolvedRole     = claimRole     ?? docRole     ?? null;

        setUserProfile(profile);
        setTenantId(resolvedTenantId);
        setRole(resolvedRole);

        // Persist so the next sign-in can start the doc read in parallel.
        if (resolvedTenantId) writeCachedTenantId(firebaseUser.uid, resolvedTenantId);

        if (!resolvedTenantId && !resolvedRole) {
          console.error(
            '[AgencyTrack] No tenantId or role after all resolution paths — ' +
              'account may still be provisioning (setCustomUserClaims propagation delay).',
          );
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setRole(null);
        setTenantId(null);
        clearAgentUidCache();
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
