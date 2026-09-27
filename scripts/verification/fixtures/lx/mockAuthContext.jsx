/* eslint-disable react-refresh/only-export-components -- scratch harness */
/**
 * LX fixture double for `src/context/AuthContext.jsx` — used ONLY by
 * ledger-lx-design-check.mjs's local fixture pass. It returns a fake, offline
 * tenant id so PolicyLedgerPanel runs its real load path; every service that
 * path reaches is ALSO aliased to an offline double in this folder, and
 * `src/firebase.js` is aliased to the test stub, so nothing here can reach
 * real Firebase.
 */
export function useAuth() {
  return {
    tenantId: 'offline-fixture-tenant',
    user: { uid: 'offline-fixture-agent' },
    userProfile: { name: 'Fixture Agent', unitId: 'offline-unit' },
    role: 'agent',
  };
}

export function AuthProvider({ children }) {
  return children;
}
