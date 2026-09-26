import { deriveAnnualApps } from './deriveApps';
import { mdrtAwardThresholds } from '../config/mdrtThresholds/2026';

const DEFAULT_AVG_POLICY_API = 12000;

export const ASSUMED_PERSIST_DEFAULT = 90;

export function derivedApps(lifeTargetAPI, avgPolicyAPI) {
  return Math.round(deriveAnnualApps(lifeTargetAPI, avgPolicyAPI ?? DEFAULT_AVG_POLICY_API));
}

function apiGateState(api, threshold, inContention) {
  if (api >= threshold) return 'on-track';
  if (api >= inContention) return 'in-contention';
  return 'not-yet';
}

function appsGateState(apps, threshold, inContention) {
  if (apps >= threshold) return 'on-track';
  if (apps >= inContention) return 'in-contention';
  return 'not-yet';
}

// Returns the weaker of two states: 'not-yet' < 'in-contention' < 'on-track'.
function worstState(a, b) {
  const rank = { 'not-yet': 0, 'in-contention': 1, 'on-track': 2 };
  return rank[a] <= rank[b] ? a : b;
}

/**
 * projectAwards(lifeTargetAPI, agentProfile, ruleset)
 *
 * Pure projection: returns which annual awards the agent's current Life-line
 * plan puts them on track for. No Firestore reads — purely derived from the
 * allocator's live Life-line value.
 *
 * @param {number} lifeTargetAPI - Life line annual API from the year plan.
 * @param {object} agentProfile  - { monthsInIndustry?, monthsAtTatil?, isBdoDso? }
 * @param {object} ruleset       - DEFAULT_RULESET_2026 (or compatible shape)
 * @returns {Array<{ id, label, state, persistNote? }>}
 *   state: 'on-track' | 'in-contention' | 'not-yet'
 *   Awards that fail an immutable profile gate (isBdoDso, experience) are
 *   omitted entirely (equivalent to 'n/a' in the brief display states).
 */
export function projectAwards(lifeTargetAPI, agentProfile, ruleset, avgPolicyAPI) {
  const api = lifeTargetAPI;
  const apps = derivedApps(api, avgPolicyAPI);
  const { monthsInIndustry, monthsAtTatil, isBdoDso } = agentProfile ?? {};
  const {
    persistencyAward,
    rookieAward,
    newBsAward,
    agentOfYearAward,
    clubAward,
  } = ruleset;
  // MDRT reads the real MDRT line (MDRT_THRESHOLDS_2026), never
  // ruleset.mdrtAward.apiThreshold — see mdrtAwardThresholds() (PR #MX).
  const mdrtAward = mdrtAwardThresholds(ruleset);

  const results = [];

  // Shared apps thresholds for persistency (gold reuses silver's inContention).
  const persAppsThreshold   = persistencyAward.silver.appsThreshold;
  const persAppsInContention = persistencyAward.silver.appsInContention;

  // 1. Persistency Silver
  results.push({
    id:          'persistency_silver',
    label:       'Persistency Silver',
    state:       worstState(
      apiGateState(api, persistencyAward.silver.apiThreshold, persistencyAward.silver.apiInContention),
      appsGateState(apps, persAppsThreshold, persAppsInContention),
    ),
    persistNote: true,
  });

  // 2. Persistency Gold (same API/apps thresholds as Silver; higher persist gate)
  results.push({
    id:          'persistency_gold',
    label:       'Persistency Gold',
    state:       worstState(
      apiGateState(api, persistencyAward.gold.apiThreshold, persistencyAward.gold.apiInContention),
      appsGateState(apps, persAppsThreshold, persAppsInContention),
    ),
    persistNote: true,
  });

  // 3. Club tier — single pill for the highest tier the plan reaches, plus the
  //    API gap to the NEXT tier up, or "top tier reached" at the highest tier
  //    (no invented higher award).
  {
    const { tiers, appsMin, appsInContention: appsIC } = clubAward;
    // Highest tier whose apiMin the Life-line API meets.
    let apiTierIdx = -1;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (api >= tiers[i].apiMin) { apiTierIdx = i; break; }
    }

    let chosenTier;
    let tierApiState;
    let apiThreshold;
    let gapToNext = 0;
    let nextLabel;
    let topTier = false;

    if (apiTierIdx >= 0) {
      chosenTier = tiers[apiTierIdx];
      tierApiState = 'on-track';
      if (apiTierIdx === tiers.length - 1) {
        // Highest tier reached — cap, never invent a higher award.
        topTier = true;
        apiThreshold = chosenTier.apiMin;
      } else {
        const nextTier = tiers[apiTierIdx + 1];
        apiThreshold = nextTier.apiMin;
        gapToNext = Math.max(0, nextTier.apiMin - api);
        nextLabel = nextTier.name;
      }
    } else {
      // Below all tiers — show the lowest tier with its real in-contention state.
      chosenTier = tiers[0];
      tierApiState = apiGateState(api, tiers[0].apiMin, tiers[0].apiInContention);
      apiThreshold = tiers[0].apiMin;
      gapToNext = Math.max(0, tiers[0].apiMin - api);
      nextLabel = tiers[0].name;
    }

    results.push({
      id:      chosenTier.id,
      label:   chosenTier.name,
      state:   worstState(tierApiState, appsGateState(apps, appsMin, appsIC)),
      isClub:  true,
      apiThreshold,
      gapToNext,
      nextLabel,
      topTier,
    });
  }

  // 4. MDRT — only shown when api >= inContention (250k).
  if (api >= mdrtAward.apiInContention) {
    results.push({
      id:    'mdrt',
      label: 'MDRT',
      state: apiGateState(api, mdrtAward.apiThreshold, mdrtAward.apiInContention),
    });
  }

  // 5. Rookie of the Year — omitted if experience gate fails.
  if (typeof monthsInIndustry === 'number' && monthsInIndustry <= rookieAward.maxMonthsInIndustry) {
    results.push({
      id:    'rookie',
      label: 'Rookie of the Year',
      state: worstState(
        apiGateState(api, rookieAward.apiThreshold, rookieAward.apiInContention),
        appsGateState(apps, rookieAward.appsThreshold, rookieAward.appsInContention),
      ),
    });
  }

  // 6. New Business Advisor — omitted if experience gate fails.
  if (typeof monthsAtTatil === 'number' && monthsAtTatil <= newBsAward.maxMonthsAtTatil) {
    results.push({
      id:    'new_bs_advisor',
      label: 'New Business Advisor',
      state: worstState(
        apiGateState(api, newBsAward.apiThreshold, newBsAward.apiInContention),
        appsGateState(apps, newBsAward.appsThreshold, newBsAward.appsInContention),
      ),
    });
  }

  // 7. Agent of the Year — omitted if isBdoDso; only shown when api >= inContention (500k).
  if (!isBdoDso && api >= agentOfYearAward.apiInContention) {
    results.push({
      id:    'agent_of_year',
      label: 'Agent of the Year',
      state: worstState(
        apiGateState(api, agentOfYearAward.apiThreshold, agentOfYearAward.apiInContention),
        appsGateState(apps, agentOfYearAward.appsThreshold, agentOfYearAward.appsInContention),
      ),
    });
  }

  // Attach the API gap-to-on-track for each single-threshold award (the club
  // pill is already enriched above with its next-tier gap / top-tier cap).
  const API_THRESHOLD_BY_ID = {
    persistency_silver: persistencyAward.silver.apiThreshold,
    persistency_gold:   persistencyAward.gold.apiThreshold,
    mdrt:               mdrtAward.apiThreshold,
    rookie:             rookieAward.apiThreshold,
    new_bs_advisor:     newBsAward.apiThreshold,
    agent_of_year:      agentOfYearAward.apiThreshold,
  };
  for (const r of results) {
    if (r.isClub) continue;
    const t = API_THRESHOLD_BY_ID[r.id];
    if (t != null) {
      r.apiThreshold = t;
      r.gapToNext = r.state === 'on-track' ? 0 : Math.max(0, t - api);
    }
  }

  return results;
}
