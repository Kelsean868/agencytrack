import React, { useMemo } from 'react';
import { outlookGateFor } from '../../../lib/persistency/persistencyOutlook';
import { getTodayTT } from '../../../utils/dateInputs';
import { ytdEarned, runRate } from '../../../utils/commissionAnchor';
import { provenanceLine } from '../../../lib/ledgerProduction';
import { heroGoal, weeklyFloors } from '../../dashboard/HomeV2/homeDerivations';
import { settledByMonthFrom } from '../../../lib/fr/todayModel';
import { isHomeCampaign } from '../../../lib/fr/homeCampaigns';
import { paceModel, persistencySeries, reinstatementPlan, headerTiles } from '../../../lib/fr/moneyModel';
import useMoneyExtras from './useMoneyExtras';
import FrMoneyHeaderView from './FrMoneyHeaderView';

/**
 * FrMoneyHeader — CONTAINER for the FR header above one existing Money
 * calculator (FR-3, FR-D5). Rendered by AgentDashboard ABOVE the unchanged
 * calculator, only under the FR look. Reads props the dashboard already
 * loads; Money Needs and Financing add one read-only existing-service call
 * each (useMoneyExtras), and only on their own tab.
 */
export default function FrMoneyHeader({
  tab,
  tenantId,
  uid,
  ledgerProduction,
  ledgerPending,
  ledgerError,
  campaignPolicies,
  policies,
  persistency,
  goals,
  hierarchy,
  hierarchyLoading,
  resolvedMinimums,
  commissionRate,
  activeCampaigns,
}) {
  const todayTT = getTodayTT();
  const year = ledgerProduction?.year ?? Number(todayTT.slice(0, 4));
  const extras = useMoneyExtras({
    tenantId, uid, year, moneyNeeds: tab === 'money-needs', financing: tab === 'financing',
  });

  const known = Boolean(ledgerProduction) && !ledgerPending && !ledgerError;
  const settled = known && Number.isFinite(ledgerProduction?.settled?.api) ? ledgerProduction.settled.api : null;

  const gate = useMemo(() => {
    const c = (Array.isArray(activeCampaigns) ? activeCampaigns : []).filter(isHomeCampaign).find((x) => outlookGateFor(x));
    return c ? outlookGateFor(c) : null;
  }, [activeCampaigns]);

  const plan = useMemo(() => (tab === 'persistency' && Array.isArray(campaignPolicies)
    ? reinstatementPlan({ policies: campaignPolicies, records: Array.isArray(persistency) ? persistency : [], todayTT, gate })
    : null), [tab, campaignPolicies, persistency, todayTT, gate]);

  const series = useMemo(() => (tab === 'persistency'
    ? persistencySeries({ records: persistency, estimate: plan?.estimate ?? null })
    : null), [tab, persistency, plan]);

  const pace = useMemo(() => {
    if (tab !== 'goals' || !known || !Array.isArray(campaignPolicies)) return null;
    const { goal, isMdrt } = heroGoal(goals?.personalAnnualAPI ?? null);
    return paceModel({ settledByMonth: settledByMonthFrom(campaignPolicies, year), year, currentMonth: Number(todayTT.slice(5, 7)), goal, isMdrt });
  }, [tab, known, campaignPolicies, goals?.personalAnnualAPI, year, todayTT]);

  const tiles = useMemo(() => headerTiles(tab, {
    year,
    settled,
    provenance: known ? provenanceLine(ledgerProduction.settled) : null,
    hierarchy,
    committedAnnualAPI: goals?.personalAnnualAPI ?? null,
    avgPolicyAPI: goals?.playgroundAvgPolicyAPI ?? null,
    weeklyApiFloor: weeklyFloors(resolvedMinimums)?.api ?? null,
    rollup: extras.rollup,
    earned: tab === 'commission' && Array.isArray(policies) ? ytdEarned(policies, year) : null,
    runRate: tab === 'commission' && Array.isArray(policies) ? runRate(policies, new Date()) : null,
    commissionRate: Number.isFinite(commissionRate) ? commissionRate : null,
    plan,
    terms: extras.terms,
    financingLabel: extras.financingLabel,
  }), [tab, year, settled, known, ledgerProduction, hierarchy, goals, resolvedMinimums, extras, policies, commissionRate, plan]);

  const loading = (tab === 'goals' && (Boolean(ledgerPending) || Boolean(hierarchyLoading)))
    || ((tab === 'money-needs' || tab === 'financing') && extras.loading);

  return <FrMoneyHeaderView tab={tab} tiles={tiles} loading={loading} pace={pace} series={series} plan={plan} />;
}
