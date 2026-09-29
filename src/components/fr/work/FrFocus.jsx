import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAgentDay } from '../../../services/plannerService';
import { getProspectInfo } from '../../../services/prospectInfoService';
import { getTodayTT } from '../../../utils/dateInputs';
import { focusCalls, paperwork } from '../../../lib/fr/workModel';
import { reinstatementPlan } from '../../../lib/fr/moneyModel';
import { campaignGate } from '../../../lib/fr/homeCampaigns';
import FrFocusView from './FrFocusView';

/**
 * FrFocus — CONTAINER for FR "Focus" (FR-4, route `focus`, FR-D11).
 *
 * READ-ONLY. Calls: today's planner items (getAgentDay) and the agent's
 * prospects (getProspectInfo) — the same two reads the planner makes, for the
 * same phone lookup the planner's Running-late sheet uses. Today's counts come
 * from the daily entry AgentDashboard already holds. Outcomes are logged
 * through the existing Daily Capture sheet (`onLogToday`); nothing here writes.
 * Paperwork: own (filtered) policies. Win-back: the FR-3 reinstatement planner
 * on the unfiltered ledger, same gate rule as Money. FR-6: `reinstateActions`
 * (AgentDashboard's useReinstatementDeclaration) gives the planner rows
 * "Mark reinstated" / "Withdraw"; the write lives there, not here.
 */
export default function FrFocus({
  tenantId, uid, mode, onMode, policies, campaignPolicies, persistency, activeCampaigns,
  todayDailyEntry, onLogToday, onOpenTab, reinstateActions = null,
}) {
  const todayTT = getTodayTT();
  const [day, setDay] = useState({ appts: null, prospects: [], error: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!tenantId || !uid) return undefined;
    let live = true;
    setDay((d) => ({ ...d, appts: null, error: false }));
    Promise.all([
      getAgentDay(tenantId, uid, todayTT),
      getProspectInfo({ tenantId, agentId: uid, callerRole: 'agent', callerUid: uid }).catch(() => []),
    ])
      .then(([appts, prospects]) => { if (live) setDay({ appts: appts ?? [], prospects: prospects ?? [], error: false }); })
      .catch(() => { if (live) setDay({ appts: null, prospects: [], error: true }); });
    return () => { live = false; };
  }, [tenantId, uid, todayTT, attempt]);

  const calls = useMemo(
    () => (day.appts ? focusCalls({ appointments: day.appts, prospects: day.prospects, dailyEntry: todayDailyEntry ?? null }) : null),
    [day, todayDailyEntry],
  );
  const rows = useMemo(() => (Array.isArray(policies) ? paperwork({ policies, todayTT }) : null), [policies, todayTT]);
  const gate = useMemo(() => campaignGate(activeCampaigns), [activeCampaigns]);
  const plan = useMemo(() => (mode === 'winback' && Array.isArray(campaignPolicies)
    ? reinstatementPlan({ policies: campaignPolicies, records: Array.isArray(persistency) ? persistency : [], todayTT, gate })
    : null), [mode, campaignPolicies, persistency, todayTT, gate]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <FrFocusView
      mode={mode}
      onMode={onMode}
      calls={calls}
      callsLoading={!day.error && !day.appts}
      callsError={day.error}
      onRetryCalls={retry}
      paperwork={rows}
      plan={plan}
      reinstateActions={reinstateActions}
      onLogToday={onLogToday}
      onOpenLedger={() => onOpenTab?.('policy-ledger')}
      onOpenPlanner={() => onOpenTab?.('planner')}
    />
  );
}
