import {
  computeAgentAwards, computeRatioTrends, computeAtRiskStatus, computeAwardPace,
  getPeriodCtx, nextTierDistance, isPersistencyOnlyBlock,
} from '../../utils/awardsEngine';
import { awardRowsFromLedger } from '../ledgerProduction';

/**
 * Agent award model — the award inputs and per-award view the Awards tab
 * builds, as pure functions (FR-5b). Moved verbatim out of AgentAwardsPanel so
 * the Awards tab and the FR Trophy room read ONE derivation (no twin).
 * No React, no Firebase.
 */

/**
 * The rows the awards engine reads.
 *
 * H2 item 2 — the ledger is the source when the agent is flagged OR holds at
 * least one ledger policy. An agent with neither keeps confirmed settlements.
 * The flag is kept: it still forces the ledger for a flagged agent whose
 * ledger is empty. `ledgerPolicies` is the UNFILTERED getOwnPolicies list
 * (awards are earned by date, not origin — R5); `null` while it loads.
 *
 * @returns {{ readsLedger: boolean, rows: object[] }}
 */
export function awardInputs({ ledgerPolicies, confirmedSettlements, usesPolicyLedger }) {
  const readsLedger = usesPolicyLedger || (ledgerPolicies?.length ?? 0) > 0;
  if (!readsLedger) return { readsLedger, rows: confirmedSettlements ?? [] };
  const persistByPeriod = {};
  for (const s of (confirmedSettlements ?? [])) {
    if (s.periodKey && s.persistency) persistByPeriod[s.periodKey] = s.persistency;
  }
  const rows = awardRowsFromLedger(ledgerPolicies ?? [])
    .map((row) => ({ ...row, persistency: persistByPeriod[row.periodKey] ?? 0 }));
  return { readsLedger, rows };
}

/**
 * Every award for the agent, each with its pace status, persistency block,
 * club tier gap and pace narrative, plus the ratio trends.
 *
 * @returns {{ awards: object, ratioTrends: object|null, error: string|null }}
 */
export function agentAwardsView({ rows, submissions, agentProfile, now, ruleset, activeCampaigns }) {
  try {
    // Rule 10 — the campaigns are ALREADY loaded by the dashboard via
    // getActiveCampaignsForAgent, so this is a prop, not a new read. A
    // flagged campaign covering this month/quarter turns the four advisor
    // prize strings into "Recognition only"; nothing else about the award
    // changes, because the award is still won.
    const rawAwards = computeAgentAwards(rows, submissions, agentProfile, now, ruleset, activeCampaigns);
    const awards = {};
    for (const [id, award] of Object.entries(rawAwards)) {
      const periodCtx = getPeriodCtx(award.category, now);
      const paceStatus = computeAtRiskStatus(award, periodCtx);
      const persistencyBlock = isPersistencyOnlyBlock(award);
      let tierGap = null;
      if (award.category === 'club' && !award.eligible) {
        const annualApi = award.criteria[0]?.current ?? 0;
        tierGap = nextTierDistance(annualApi, ruleset.clubAward.tiers);
      }
      // §2.7 pace narrative — same periodCtx.weeksElapsed already used for
      // paceStatus above; see computeAwardPace's own doc comment for the
      // honesty rule (period-total ÷ elapsed-weeks, null for '%' criteria).
      const pace = computeAwardPace(award, periodCtx.weeksElapsed, now);
      awards[id] = { ...award, paceStatus, persistencyBlock, tierGap, pace };
    }
    return { awards, ratioTrends: computeRatioTrends(submissions), error: null };
  } catch (e) {
    console.error(e);
    return { awards: {}, ratioTrends: null, error: 'Failed to compute awards.' };
  }
}
