import { useCallback, useMemo, useState } from 'react';
import { declareReinstatement, withdrawReinstatement } from '../../services/policiesService';
import { canDeclareReinstatement, reinstatementWriteError } from '../../lib/persistency/reinstatementDeclaration';

/**
 * useReinstatementDeclaration — FR-6 write handling for a list of the signed-in
 * user's policies (the FR-3 planner's rows). Looks the policy doc up by id so
 * the service's JS mirror of firestore.rules Arm G sees the real doc, runs the
 * write, then calls `onChanged` so the owner of the list refetches.
 *
 * `declarer` is `{ uid, role, unitId }`; with no declarer (or a role Arm G does
 * not admit) `canAct` is false for every row and no control is offered.
 *
 * A rejected write (e.g. the rules arm is not deployed yet) is shown as an
 * error on that row; nothing else changes.
 */
export default function useReinstatementDeclaration({ tenantId, declarer, policies, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState({ id: null, message: null });

  const byId = useMemo(() => {
    const m = new Map();
    for (const p of Array.isArray(policies) ? policies : []) if (p?.id) m.set(p.id, p);
    return m;
  }, [policies]);

  const canAct = useCallback((policyId) => {
    const p = byId.get(policyId);
    return Boolean(tenantId && p && canDeclareReinstatement(p, declarer ?? {}));
  }, [byId, tenantId, declarer]);

  const run = useCallback(async (policyId, write) => {
    const p = byId.get(policyId);
    if (!p || !tenantId || !declarer) return;
    setBusyId(policyId);
    setError({ id: null, message: null });
    try {
      await write(p);
      onChanged?.();
    } catch (err) {
      setError({ id: policyId, message: reinstatementWriteError(err) });
    } finally {
      setBusyId(null);
    }
  }, [byId, tenantId, declarer, onChanged]);

  const declare = useCallback((policyId, note) => run(policyId,
    (p) => declareReinstatement(tenantId, declarer, p.id, p, { note })), [run, tenantId, declarer]);
  const withdraw = useCallback((policyId) => run(policyId,
    (p) => withdrawReinstatement(tenantId, declarer, p.id, p)), [run, tenantId, declarer]);

  return {
    canAct,
    declare,
    withdraw,
    busyId,
    errorFor: (policyId) => (error.id === policyId ? error.message : null),
  };
}
