/* eslint-disable react-refresh/only-export-components -- scratch harness */
/**
 * mockAuthContext.jsx — dev-server-only alias target for `src/context/AuthContext.jsx`,
 * used ONLY by ledger-l2-design-check.mjs's local fixture pass. `useAuth()` here
 * returns `tenantId: null, user: null` so any hook built on `useLedgerSavedViews` /
 * `useLedgerTargetTier` guards its Firestore call and NEVER reaches real Firebase —
 * the harness renders offline, deterministic fixtures only, never live/prod data.
 */
export function useAuth() {
  return { tenantId: null, user: null, userProfile: null, role: 'agent' };
}

export function AuthProvider({ children }) {
  return children;
}
