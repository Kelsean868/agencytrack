import React, { useMemo } from 'react';
import { outlookGateFor } from '../../../lib/persistency/persistencyOutlook';
import { getTodayTT } from '../../../utils/dateInputs';
import { ytdEarned } from '../../../utils/commissionAnchor';
import { AVG_POLICY_API } from '../../../lib/moneyNeedsAllocation';
import { heroGoal } from '../../dashboard/HomeV2/homeDerivations';
import CampaignHeroCard from '../../campaigns/CampaignHeroCard';
import { settledByMonthFrom } from '../../../lib/fr/todayModel';
import { isHomeCampaign } from '../../../lib/fr/homeCampaigns';
import { paceModel, reinstatementPlan, moneyCards } from '../../../lib/fr/moneyModel';
import useMinWidth from '../../../hooks/useMinWidth';
import useMoneyExtras from './useMoneyExtras';
import FrMoneyView from './FrMoneyView';

/**
 * FrMoney — CONTAINER for the FR Money hub's Overview (FR-3, route `money`).
 *
 * Every figure comes from props AgentDashboard already loads (ledger
 * production, the UNFILTERED ledger list, own policies, persistency records,
 * goals, the goal hierarchy, active campaigns) plus two read-only calls
 * through existing services (useMoneyExtras). No writes.
 *
 * Persistency uses the same gate month as Today: the first active campaign
 * with a persistency gate (outlookGateFor), else the current month at 90%.
 */
export default function FrMoney({
  tenantId,
  uid,
  ledgerProduction,
  ledgerPending,
  ledgerError,
  onRetryLedger,
  campaignPolicies,
  policies,
  persistency,
  goals,
  hierarchy,
  activeCampaigns,
  campaignsLoading,
  onOpenTab,
}) {
  const wide = useMinWidth(768);
  const todayTT = getTodayTT();
  const year = ledgerProduction?.year ?? Number(todayTT.slice(0, 4));
  const currentMonth = Number(todayTT.slice(5, 7));
  const extras = useMoneyExtras({ tenantId, uid, year });

  const homeCampaigns = useMemo(
    () => (Array.isArray(activeCampaigns) ? activeCampaigns.filter(isHomeCampaign) : []),
    [activeCampaigns],
  );
  const gate = useMemo(() => {
    const c = homeCampaigns.find((x) => outlookGateFor(x));
    return c ? outlookGateFor(c) : null;
  }, [homeCampaigns]);

  const known = Boolean(ledgerProduction) && !ledgerPending && !ledgerError;
  const settled = known && Number.isFinite(ledgerProduction?.settled?.api) ? ledgerProduction.settled.api : null;
  const { goal, isMdrt } = heroGoal(goals?.personalAnnualAPI ?? null);

  const pace = useMemo(() => (known && Array.isArray(campaignPolicies)
    ? paceModel({ settledByMonth: settledByMonthFrom(campaignPolicies, year), year, currentMonth, goal, isMdrt })
    : null), [known, campaignPolicies, year, currentMonth, goal, isMdrt]);

  const plan = useMemo(() => (Array.isArray(campaignPolicies)
    ? reinstatementPlan({ policies: campaignPolicies, records: Array.isArray(persistency) ? persistency : [], todayTT, gate })
    : null), [campaignPolicies, persistency, todayTT, gate]);

  const commissionEarned = useMemo(() => (Array.isArray(policies) ? ytdEarned(policies, year) : null), [policies, year]);

  const cards = useMemo(() => moneyCards({
    hierarchy,
    settled,
    committedAnnualAPI: goals?.personalAnnualAPI ?? null,
    commissionEarned,
    moneyNeedAfterTax: extras.rollup?.totalAnnualAfterTax ?? null,
    plan,
    financingLabel: extras.financingLabel,
  }), [hierarchy, settled, goals?.personalAnnualAPI, commissionEarned, extras.rollup, extras.financingLabel, plan]);

  const model = {
    pace,
    plan,
    cards,
    settled,
    goal,
    isMdrt,
    year,
    avgApi: Number(goals?.playgroundAvgPolicyAPI) > 0 ? Number(goals.playgroundAvgPolicyAPI) : AVG_POLICY_API,
  };

  const campaignLoading = Boolean(campaignsLoading) || (Boolean(ledgerPending) && homeCampaigns.length > 0);
  // Parenthesised so the policy-array guard (excludeImported.test.js) does not
  // read this object literal as a JSX prop; the CampaignHeroCard `policies`
  // prop site inside it is still enumerated.
  const slots = ({
    campaign: campaignLoading
      ? <CampaignHeroCard variant="compact" campaign={null} loading />
      : homeCampaigns.length
        ? homeCampaigns.map((c) => (
          <CampaignHeroCard
            key={c.id}
            variant="compact"
            campaign={c}
            policies={campaignPolicies ?? []}
            persistencyRecords={persistency}
            error={Boolean(ledgerError)}
            onOpenDetails={() => onOpenTab?.('awards')}
          />
        ))
        : null,
  });

  return (
    <FrMoneyView
      model={model}
      wide={wide}
      loading={Boolean(ledgerPending)}
      error={Boolean(ledgerError)}
      onRetry={onRetryLedger}
      onNavigate={(tabId) => onOpenTab?.(tabId)}
      slots={slots}
    />
  );
}
