import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * useCallerScope — the signed-in manager's read scope, in the
 * `{ role, uid, branchId }` shape getPoliciesForManager already takes.
 *
 * P2b (SEC-08): the policies / financing `list` rules now scope a
 * branch_manager to their branch and a unit_manager to their unit, so a
 * manager-side query for another agent's docs must carry the matching
 * where() clause. getOwnPolicies / listFinancingMonths / getProjectedBonus
 * turn this scope into that clause.
 *
 * branchId prefers the user doc (what the rules' callerBranchId() reads) and
 * falls back to the auth context's claim-derived value.
 */
export function useCallerScope() {
  const { role, user, userProfile, branchId } = useAuth();
  const uid = user?.uid ?? userProfile?.uid ?? null;
  const scopeBranchId = userProfile?.branchId ?? branchId ?? null;
  return useMemo(
    () => ({ role: role ?? null, uid, branchId: scopeBranchId }),
    [role, uid, scopeBranchId],
  );
}
