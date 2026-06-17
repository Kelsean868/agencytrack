import { extractTotalProductionCredit, extractFields } from '../utils/extractFields';

export const DEFAULT_PERIOD = { grain: 'year', value: String(new Date().getFullYear()) };

/**
 * YYYY-MM month key for persistency/settlement lookup.
 *   week  → month containing that Sunday ("YYYY-MM-DD" → "YYYY-MM")
 *   month → that month directly
 *   year  → current calendar month; December when the year is in the past
 *
 * @param {{ grain: 'year'|'month'|'week', value: string }} period
 * @param {Date} [now]  injectable for tests
 */
export function containingMonth(period, now = new Date()) {
  if (period.grain === 'week')  return period.value.slice(0, 7);
  if (period.grain === 'month') return period.value;
  const periodYear = parseInt(period.value, 10);
  if (periodYear < now.getFullYear()) return `${period.value}-12`;
  return `${period.value}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Subset of submissions that fall within the given period.
 * Matched by weekStarting string prefix (always a Sunday, "YYYY-MM-DD").
 */
export function filterSubmissionsByPeriod(submissions, period) {
  if (period.grain === 'week') {
    return submissions.filter((s) => s.weekStarting === period.value);
  }
  return submissions.filter((s) => String(s.weekStarting).startsWith(period.value));
}

/**
 * YTD submitted API ÷ personal annual commitment → fraction (e.g. 0.72 = 72 %).
 * Returns null when no committed target; render as "—" in the UI.
 *
 * Pacing swap (one-line future variant):
 *   computePctOfGoal(periodSubmittedAPI, proratedTarget(period))
 */
export function computePctOfGoal(ytdAPI, personalAnnualAPI) {
  if (!personalAnnualAPI) return null;
  return ytdAPI / personalAnnualAPI;
}

/**
 * Assembles one roster row for a single member.
 *
 * @param {object}      opts.member            user doc
 * @param {Array}       opts.periodSubs        submissions in the selected period for this member
 * @param {Array}       opts.ytdSubs           all YTD submissions for this member
 * @param {object|null} opts.settlement        settlement doc for the containing month, or null
 * @param {object|null} opts.persistencyRecord persistency doc for the containing month, or null
 * @param {object|null} opts.goals             goals doc, or null
 */
export function assembleRosterRow({ member, periodSubs, ytdSubs, settlement, persistencyRecord, goals }) {
  const submittedAPI  = periodSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0);
  const submittedApps = periodSubs.reduce((sum, s) => sum + (extractFields(s).applicationsSold || 0), 0);
  const ytdAPI        = ytdSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0);

  return {
    memberId:        member.id,
    name:            member.displayName ?? member.name ?? member.email ?? member.id,
    contractDate:    member.contractStartDate ?? null,
    submittedAPI,
    submittedApps,
    issuedAPI:       settlement?.settledAPI  ?? null,
    issuedApps:      settlement?.settledApps ?? null,
    persistency:     persistencyRecord?.persistency ?? null,
    pctOfAnnualGoal: computePctOfGoal(ytdAPI, goals?.personalAnnualAPI ?? null),
  };
}

/**
 * Assembles roster rows for all members.
 *
 * @param {object}   opts
 * @param {Array}    opts.members                 user docs from getTenantUsers
 * @param {Array}    opts.allSubmissions           all YTD submitted submissions for the scope
 * @param {{ grain: string, value: string }} opts.period
 * @param {Map<string, object[]>} opts.settlementsByAgent  agentId → settlement records
 * @param {Map<string, object>}  opts.persistencyByAgent   agentId → persistency record
 * @param {Map<string, object|null>} opts.goalsByAgent     agentId → goals doc or null
 * @returns {Array} rows
 */
export function assembleRoster({
  members,
  allSubmissions,
  period,
  settlementsByAgent,
  persistencyByAgent,
  goalsByAgent,
}) {
  const periodSubs = filterSubmissionsByPeriod(allSubmissions, period);
  const monthKey   = containingMonth(period);

  return members.map((member) => {
    const memberPeriodSubs = periodSubs.filter((s) => s.agentId === member.id);
    const memberYtdSubs    = allSubmissions.filter((s) => s.agentId === member.id);
    const settlement       = (settlementsByAgent.get(member.id) ?? []).find((s) => s.periodKey === monthKey) ?? null;

    return assembleRosterRow({
      member,
      periodSubs:        memberPeriodSubs,
      ytdSubs:           memberYtdSubs,
      settlement,
      persistencyRecord: persistencyByAgent.get(member.id) ?? null,
      goals:             goalsByAgent.get(member.id) ?? null,
    });
  });
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

export const SORT_COLUMNS = [
  'name', 'contractDate', 'submittedAPI', 'submittedApps',
  'issuedAPI', 'issuedApps', 'persistency', 'pctOfAnnualGoal',
];

/**
 * Returns a sorted copy of rows. Nulls always float to the bottom
 * regardless of direction.
 *
 * @param {Array}        rows
 * @param {string}       col   one of SORT_COLUMNS
 * @param {'asc'|'desc'} dir
 */
export function sortRows(rows, col, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (col === 'name' || col === 'contractDate') {
      return sign * String(av).localeCompare(String(bv));
    }
    return sign * (av - bv);
  });
}
