/**
 * Daily activity entry schema (E6).
 *
 * One doc per agent per day. Path:
 *   tenants/{tenantId}/users/{userId}/dailyActivity/{YYYY-MM-DD}
 *
 * Field names mirror the weekly wizard's INITIAL_DATA so aggregation is a
 * direct 1:1 map (see dailyActivity.aggregator.js). Two simplifications
 * versus the wizard:
 *
 *   - newNamesAdded is a single rollup; wizard splits names across 7 sources.
 *     Aggregator maps it to namesFromOther so the agent can re-allocate on
 *     the wizard review screen if they want fine-grained breakdown.
 *   - oldNamesWorked maps to wizard's oldNamesPool.
 *
 * Reflection fields (hoursWorked / wins / blockers / notes) are journal-only
 * — the aggregator does NOT propagate them to the weekly draft. The agent
 * fills wizard Step 7+8 manually on review.
 */

import { WEEKLY_REPORT_VERSION } from './weeklyReport.js';

export const DAILY_ACTIVITY_VERSION = 1;

export function createEmptyDailyEntry(date, agentId, agentName) {
  return {
    version: DAILY_ACTIVITY_VERSION,
    weeklyReportVersion: WEEKLY_REPORT_VERSION,
    date,
    weekStarting: getSundayOf(date),
    agentId,
    agentName,

    qualifiedApproaches: 0,
    appointmentsSet: 0,
    ffisScheduled: 0,
    ffiConducted: 0,
    solutionPresentations: 0,
    newCIBooked: 0,
    oldCIBooked: 0,
    ciConducted: 0,

    newBusiness:  { apps: 0, api: 0 },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums:     { grossAmount: 0 },

    newNamesAdded: 0,
    oldNamesWorked: 0,
    serviceContacts: 0,

    hoursWorked: null,
    wins: '',
    blockers: '',
    notes: '',

    isCatchUp: false,
    catchUpStartDate: null,
    catchUpEndDate: null,

    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Returns the Sunday that starts the week containing `dateStr`.
 * Sunday → same Sunday. Mon-Sat → previous Sunday.
 *
 * Date math is done in UTC against a noon anchor to avoid DST edges.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} 'YYYY-MM-DD' (Sunday)
 */
export function getSundayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
