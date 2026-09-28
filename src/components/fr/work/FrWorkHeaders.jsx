import React, { useMemo } from 'react';
import { getTodayTT } from '../../../utils/dateInputs';
import { provenanceLine } from '../../../lib/ledgerProduction';
import { numbersTiles } from '../../../lib/fr/workModel';
import { reinstatementPlan } from '../../../lib/fr/moneyModel';
import { campaignGate } from '../../../lib/fr/homeCampaigns';
import { FrNumbersHeaderView, FrLedgerHeaderView } from './FrWorkHeaderViews';

/**
 * CONTAINERS for the FR headers above the Numbers hub routes and the Policy
 * Ledger (FR-4). No reads of their own and no writes: submissions, the
 * ledger's year figures and the unfiltered ledger are what AgentDashboard
 * already holds.
 */
export function FrNumbersHeader({ allSubmissions }) {
  const year = Number(getTodayTT().slice(0, 4));
  const tiles = useMemo(() => numbersTiles({ submissions: allSubmissions, year }), [allSubmissions, year]);
  return <FrNumbersHeaderView tiles={tiles} />;
}

export function FrLedgerHeader({ ledgerProduction, ledgerPending, ledgerError, campaignPolicies, persistency, activeCampaigns, onOpenWinback }) {
  const todayTT = getTodayTT();
  const known = Boolean(ledgerProduction) && !ledgerPending && !ledgerError;
  const n = (v) => (known && Number.isFinite(v) ? v : null);
  const tiles = [
    { id: 'settled', label: `Settled API ${ledgerProduction?.year ?? todayTT.slice(0, 4)}`, value: n(ledgerProduction?.settled?.api), unit: 'ttd', note: known ? provenanceLine(ledgerProduction.settled) : null },
    { id: 'apps', label: 'Settled apps', value: n(ledgerProduction?.settled?.apps), unit: 'count', note: 'Count toward MDRT and awards' },
    { id: 'waiting', label: 'Submitted, not settled', value: n(ledgerProduction?.pending?.api), unit: 'ttd', note: known && Number.isFinite(ledgerProduction?.pending?.apps) ? `${ledgerProduction.pending.apps} ${ledgerProduction.pending.apps === 1 ? 'app' : 'apps'} waiting` : null },
  ];
  const gate = useMemo(() => campaignGate(activeCampaigns), [activeCampaigns]);
  const plan = useMemo(() => (Array.isArray(campaignPolicies)
    ? reinstatementPlan({ policies: campaignPolicies, records: Array.isArray(persistency) ? persistency : [], todayTT, gate })
    : null), [campaignPolicies, persistency, todayTT, gate]);
  return <FrLedgerHeaderView tiles={tiles} plan={plan} loading={Boolean(ledgerPending)} onOpenWinback={onOpenWinback} />;
}
