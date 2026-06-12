const DEFAULT_AVG_POLICY_API = 12000;

export const ASSUMED_PERSIST_DEFAULT = 90;

export function derivedApps(lifeTargetAPI, avgPolicyAPI) {
  return Math.round(lifeTargetAPI / (avgPolicyAPI ?? DEFAULT_AVG_POLICY_API));
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
export function projectAwards(lifeTargetAPI, agentProfile, ruleset) {
  const api = lifeTargetAPI;
  const apps = derivedApps(api);
  const { monthsInIndustry, monthsAtTatil, isBdoDso } = agentProfile ?? {};
  const {
    persistencyAward,
    rookieAward,
    newBsAward,
    agentOfYearAward,
    mdrtAward,
    clubAward,
  } = ruleset;

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

  // 3. Club tier — single pill for the highest tier the plan reaches.
  {
    const { tiers, appsMin, appsInContention: appsIC } = clubAward;
    let chosenTier = null;
    let tierApiState = 'not-yet';
    // Scan descending (gold → bronze_l3) for highest on-track tier.
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (api >= tiers[i].apiMin) {
        chosenTier = tiers[i];
        tierApiState = 'on-track';
        break;
      }
    }
    if (!chosenTier) {
      // Below all tiers — show bronze_l3 with its actual inContention state.
      chosenTier = tiers[0];
      tierApiState = apiGateState(api, tiers[0].apiMin, tiers[0].apiInContention);
    }
    results.push({
      id:      chosenTier.id,
      label:   chosenTier.name,
      state:   worstState(tierApiState, appsGateState(apps, appsMin, appsIC)),
      isClub:  true,
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

  return results;
}
