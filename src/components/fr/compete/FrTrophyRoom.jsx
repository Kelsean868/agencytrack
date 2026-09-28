import React, { useMemo } from 'react';
import { trophyRoom, awardTrophies } from '../../../lib/fr/competeModel';
import { awardInputs, agentAwardsView } from '../../../lib/awards/agentAwardModel';
import useMyLeaderboardEntry from './useMyLeaderboardEntry';
import FrTrophyRoomView from './FrTrophyRoomView';

/**
 * CONTAINER for the Trophy room (FR-5, FR-5b). No writes, and no reads beyond
 * the engine doc it already listened to: the award trophies come from what
 * AgentDashboard already holds (the UNFILTERED policy ledger — awards are
 * earned by date, not origin, R5 — plus settlements, submissions, profile,
 * ruleset and campaigns), through the SAME award model the Awards tab uses
 * (lib/awards/agentAwardModel).
 */
export default function FrTrophyRoom({
  tenantId, uid,
  ledgerPolicies = null, ledgerError = false, onRetryPolicies,
  settlements, allSubmissions, userProfile, awardsRuleset, activeCampaigns, now,
}) {
  const { loading, error, entry, retry } = useMyLeaderboardEntry(tenantId, uid);

  const ledgerState = ledgerError ? 'error' : ledgerPolicies === null ? 'loading' : 'ready';
  // null = the engine failed (agentAwardsView already logged it): shown as the
  // Awards group's error state, never as "no awards".
  const awards = useMemo(() => {
    if (ledgerState !== 'ready') return [];
    const { rows } = awardInputs({
      ledgerPolicies,
      confirmedSettlements: settlements,
      usesPolicyLedger: Boolean(userProfile?.usesPolicyLedger),
    });
    const view = agentAwardsView({
      rows, submissions: allSubmissions, agentProfile: userProfile, now, ruleset: awardsRuleset, activeCampaigns,
    });
    return view.error ? null : awardTrophies(view, now);
  }, [ledgerState, ledgerPolicies, settlements, userProfile, allSubmissions, now, awardsRuleset, activeCampaigns]);

  const awardsState = awards === null ? 'error' : ledgerState;
  const room = useMemo(() => (loading || error ? null : trophyRoom(entry, awards ?? [])), [loading, error, entry, awards]);
  return (
    <FrTrophyRoomView
      room={room}
      loading={loading}
      error={error}
      onRetry={retry}
      awardsState={awardsState}
      onRetryAwards={onRetryPolicies}
    />
  );
}
