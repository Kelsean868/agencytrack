import { useEffect, useState } from 'react';
import { getMoneyNeeds, computeWorksheetRollup } from '../../../services/moneyNeedsService';
import { getFinancingTerms, FINANCING_STATUS_LABELS, DEFAULT_FINANCING_STATUS } from '../../../services/financingService';

/**
 * useMoneyExtras — the two Money figures the dashboard does not already load:
 * the money-needs worksheet rollup and the financing terms. READ-ONLY, through
 * the existing services (the same reads MoneyNeedsPanel and FinancingSelfView
 * make). A failed read leaves the figure `null` — the view says "—", never 0.
 *
 * Never calls createMoneyNeeds: a missing worksheet stays missing here (the
 * Money Needs tab creates it when the agent opens it, as today).
 *
 * @param {{ tenantId: string|null, uid: string|null, year: number, moneyNeeds?: boolean, financing?: boolean }} p
 * @returns {{ rollup: object|null, terms: object|null, financingLabel: string|null, loading: boolean }}
 */
export default function useMoneyExtras({ tenantId, uid, year, moneyNeeds = true, financing = true }) {
  const [state, setState] = useState({ rollup: null, terms: null, financingLabel: null, loading: true });

  useEffect(() => {
    if (!tenantId || !uid) {
      setState({ rollup: null, terms: null, financingLabel: null, loading: false });
      return undefined;
    }
    let live = true;
    const needsP = moneyNeeds
      ? getMoneyNeeds(tenantId, uid, year)
        .then((ws) => (ws?.expenseGroups ? computeWorksheetRollup(ws.expenseGroups) : null))
        .catch(() => null)
      : Promise.resolve(null);
    const finP = financing
      ? getFinancingTerms(tenantId, uid).catch(() => undefined)
      : Promise.resolve(undefined);
    Promise.all([needsP, finP]).then(([rollup, terms]) => {
      if (!live) return;
      // undefined = the read failed (label unknown); null = no terms doc = not on financing.
      const status = terms === undefined ? null : (terms?.financingStatus ?? DEFAULT_FINANCING_STATUS);
      setState({
        rollup,
        terms: terms ?? null,
        financingLabel: status ? (FINANCING_STATUS_LABELS[status] ?? null) : null,
        loading: false,
      });
    });
    return () => { live = false; };
  }, [tenantId, uid, year, moneyNeeds, financing]);

  return state;
}
