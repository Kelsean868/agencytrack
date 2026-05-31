/**
 * rankForLeaderboard.js — pure selector for the shared production-ranking data layer.
 *
 * Composes the existing production-report pipeline:
 *   filterSubmissionsByPeriod → computeAgentTotals (per agent) → rankAgentsByApi
 *
 * Consumed by:
 *   • useProductionRanking hook (Leaderboard P1 keystone)
 *   • P3 podium/tail, P4 around-me row, P7 AgentProductionView rank-pill fix
 *
 * Zero React imports. Zero Firebase imports. Testable with plain mock data.
 * DO NOT modify computations.js or managerService — this module only consumes them.
 *
 * Production source (D1): submissions pipeline — getAllYTDSubmissions
 * (branch-scoped calendar-year Firestore query) → period filter → computeAgentTotals
 * → rankAgentsByApi. NOT the reconciled-ledger / awards settlement path.
 *
 * Period source (D2): reuses getPeriodBoundaries + filterSubmissionsByPeriod.
 * WK = current Sunday-anchored WAR week (triniSundayBefore).
 */

import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
} from './computations';
import { getUnitDisplayName } from '../../utils/formatters';

/**
 * buildRankedAgents
 *
 * Derives a period-scoped, branch-ranked array of agents from raw fetch results.
 * Branch scope = all agents in the tenant (role === 'agent', provisioning !== true).
 * The Firestore path (`tenants/${tenantId}/submissions`) already scopes to the tenant;
 * there is no additional branchId filter in the current one-branch-per-tenant model.
 *
 * @param {Object[]} allSubmissions  All YTD submissions from getAllYTDSubmissions.
 * @param {Object[]} allUsers        All tenant users from getTenantUsers.
 * @param {string}   period          'week' | 'mtd' | 'quarter' | 'ytd'
 * @param {Date}     [referenceDate] Optional; defaults to now. Pass for determinism in tests.
 * @returns {RankedEntry[]}
 *
 * @typedef {Object} RankedEntry
 * @property {string}      agentId       Firestore UID
 * @property {string}      name          Display name (name ?? email ?? id)
 * @property {string}      initials      Up to 2 uppercase chars derived from name
 * @property {string|null} unitId        Unit manager UID stored on agent doc (null if unassigned)
 * @property {string|null} unitName      Resolved display name via getUnitDisplayName (null if unassigned)
 * @property {number}      periodApi     Total API for the selected period
 * @property {number}      apps          Total apps for the selected period
 * @property {number}      rank          1-based overall branch rank (desc API, tie-break apps then name)
 * @property {number}      rankWithinUnit 1-based rank within the agent's unit
 */
export function buildRankedAgents(allSubmissions, allUsers, period, referenceDate) {
  const submissions = allSubmissions ?? [];
  const users       = allUsers ?? [];

  // Branch scope: active agents only (no provisioning stubs, no managers/admins)
  const agents = users.filter(
    (u) => u.role === 'agent' && u.provisioning !== true
  );

  // Build unit-name lookup from unit manager docs
  const unitNameMap = users
    .filter((u) => u.role === 'unit_manager')
    .reduce((map, mgr) => {
      map[mgr.id] = getUnitDisplayName(mgr);
      return map;
    }, {});

  // Per-agent: filter to their own submissions for the requested period
  const agentTotals = agents.map((u) => {
    const ownSubs   = submissions.filter((s) => (s.agentId ?? s.userId) === u.id);
    const periodSubs = filterSubmissionsByPeriod(ownSubs, period, referenceDate);
    return {
      agentId:   u.id,
      agentName: u.name ?? u.email ?? u.id,
      unitId:    u.unitId ?? null,
      totals:    computeAgentTotals(periodSubs),
    };
  });

  // Rank: descending API, tie-break apps desc, then name asc (via rankAgentsByApi)
  const rawRanked = rankAgentsByApi(agentTotals);

  // Map to consumer-friendly shape
  return rawRanked.map((entry) => ({
    agentId:       entry.agentId,
    name:          entry.agentName,
    initials:      deriveInitials(entry.agentName),
    unitId:        entry.unitId,
    unitName:      entry.unitId ? (unitNameMap[entry.unitId] ?? null) : null,
    periodApi:     entry.totals.totalApi,
    apps:          entry.totals.totalApps,
    rank:          entry.rank,
    rankWithinUnit: entry.rankWithinUnit,
  }));
}

/**
 * deriveInitials — up to 2 uppercase chars from the first letter of each word.
 * @param {string} name
 * @returns {string}
 */
export function deriveInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const result = name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return result || '?';
}
