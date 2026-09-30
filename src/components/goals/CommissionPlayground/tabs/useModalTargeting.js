import { useState, useMemo } from 'react';
import { reverseCalc, modeBreakdown } from '../utils/commissionMath';
import { DEFAULT_MODE_MIX } from '../utils/modeMixBalancer';

/**
 * useModalTargeting — the Modal Targeting tab's state and derivations (R2-7).
 * Moved VERBATIM out of ModalTargetingTab so the Nexus tab and the FR layout
 * run one code path.
 *
 * @param {{ defaultCommissionRate?: number }} args
 */
export default function useModalTargeting({ defaultCommissionRate = 35 }) {
  const [targetCommission, setTargetCommission] = useState(5000);
  const [commissionRate, setCommissionRate]     = useState(defaultCommissionRate);
  const [modeMix, setModeMix]                   = useState(DEFAULT_MODE_MIX);

  const totalApi = useMemo(
    () => reverseCalc({ targetCommission, modeMix, commissionRate }),
    [targetCommission, modeMix, commissionRate],
  );

  const breakdown = useMemo(
    () => modeBreakdown({ totalApi, modeMix, commissionRate }),
    [totalApi, modeMix, commissionRate],
  );

  return {
    targetCommission, setTargetCommission, commissionRate, setCommissionRate,
    modeMix, setModeMix, totalApi, breakdown,
  };
}
