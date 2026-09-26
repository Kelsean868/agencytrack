/**
 * homeDerivations.js — pure read-time derivations for the Home redesign (R1).
 *
 * Nothing here is stored and nothing reads Firestore: every function takes data
 * AgentDashboard already loaded and returns a figure or `null` ("unknown"). A
 * `null` is rendered as "—" or hidden — never as a confident 0.
 */
import {
  WEEKLY_ACTIVITY_FLOOR_ROWS,
  DEFAULT_WEEKLY_ACTIVITY_FLOORS,
  deriveWeeklyFloorActuals,
} from '../../../utils/weeklyActivityFloors';
import { extractFields } from '../../../utils/extractFields';
import { aggregateDailyActuals, varianceState } from '../../../utils/planVariance';
import { weekNumber } from '../../../utils/dateHelpers';
import { MDRT_THRESHOLDS_2026 } from '../../../config/mdrtThresholds/2026';

/** The four "This week" tiles, mapped onto real weekly-floor keys. */
export const THIS_WEEK_TILES = Object.freeze([
  { key: 'callsMade', label: 'Calls' },
  { key: 'factFindsCompleted', label: 'FFIs' },
  { key: 'closingInterviewsKept', label: 'CIs' },
  { key: 'applicationsSubmitted', label: 'Apps' },
]);

// Do-next wording for a floor row. Keyed by WEEKLY_ACTIVITY_FLOOR_ROWS keys;
// a row missing here falls back to its own table label, lower-cased.
const ACTIVITY_NOUNS = Object.freeze({
  callsMade: ['prospecting call', 'prospecting calls'],
  telContacts: ['contact', 'contacts'],
  appointmentsScheduled: ['appointment', 'appointments'],
  interviewsKept: ['interview', 'interviews'],
  factFindsCompleted: ['fact-find', 'fact-finds'],
  closingInterviewsKept: ['closing interview', 'closing interviews'],
  applicationsSubmitted: ['application', 'applications'],
  clientsSold: ['client sold', 'clients sold'],
  referralsNewLeads: ['referral', 'referrals'],
});

/** Effective weekly floors: defaults overlaid with the tenant's resolved minimums. */
export function weeklyFloors(resolvedMinimums) {
  return { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, ...(resolvedMinimums?.weeklyActivityFloors ?? {}) };
}

/**
 * This week's activity actuals, per floor key.
 *
 * - A SUBMITTED report for the week is final: every key comes from it.
 * - Otherwise the week is in progress. The daily-log keys come from the week's
 *   daily entries; if a weekly draft exists its figure is also considered, and
 *   the larger of the two wins (never the sum — the draft is often pre-filled
 *   from the same daily entries). A key with neither source is `null`
 *   (unknown), e.g. prospecting calls, which the daily log does not capture.
 *
 * @returns {{ source: 'final'|'daily', values: Record<string, number|null> }}
 */
export function thisWeekActuals({ currentWeekSub, dailyDocs }) {
  if (currentWeekSub?.status === 'submitted') {
    return { source: 'final', values: deriveWeeklyFloorActuals(extractFields(currentWeekSub)) };
  }
  const daily = aggregateDailyActuals(dailyDocs);
  const draft = currentWeekSub ? deriveWeeklyFloorActuals(extractFields(currentWeekSub)) : null;
  const values = {};
  for (const { key } of WEEKLY_ACTIVITY_FLOOR_ROWS) {
    const fromDaily = Object.prototype.hasOwnProperty.call(daily, key) ? daily[key] : null;
    const fromDraft = draft ? draft[key] : null;
    values[key] = fromDaily == null && fromDraft == null
      ? null
      : Math.max(fromDaily ?? 0, fromDraft ?? 0);
  }
  return { source: 'daily', values };
}

/**
 * The first weekly-standard row the agent is BEHIND on, in table order.
 * "Behind" is the Standard drawer's own pace rule (`varianceState`): mid-week
 * the floor is pro-rated by working days elapsed, and day one never counts as
 * behind. Currency rows (API) are production, not loggable activity, and rows
 * with an unknown actual are skipped rather than guessed.
 *
 * @returns {null | { key: string, needed: number, noun: string }}
 */
export function firstBehindStandardRow({ floors, actuals, elapsed }) {
  if (!actuals) return null;
  for (const row of WEEKLY_ACTIVITY_FLOOR_ROWS) {
    if (row.isCurrency) continue;
    const floor = Number(floors?.[row.key]) || 0;
    const actual = actuals.values?.[row.key];
    if (floor <= 0 || actual == null) continue;
    const state = varianceState({ actual, plan: floor, elapsed, source: actuals.source });
    if (state !== 'behind') continue;
    const needed = Math.ceil(floor - actual);
    if (needed <= 0) continue;
    const [one, many] = ACTIVITY_NOUNS[row.key] ?? [row.label.toLowerCase(), row.label.toLowerCase()];
    return { key: row.key, needed, noun: needed === 1 ? one : many };
  }
  return null;
}

const HEADER_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HEADER_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Header date for the Home screen: "SAT 26 SEP · WEEK 39".
 * @param {string} todayTT  YYYY-MM-DD (TT calendar day)
 */
export function formatHomeHeaderDate(todayTT) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(todayTT))) return null;
  const d = new Date(`${todayTT}T12:00:00Z`);
  // Fixed three-letter forms: locale data varies ("Sep" vs "Sept") by runtime.
  const wd = HEADER_WEEKDAYS[d.getUTCDay()];
  const mon = HEADER_MONTHS[d.getUTCMonth()];
  return `${wd} ${d.getUTCDate()} ${mon} · WEEK ${weekNumber(todayTT)}`;
}

/**
 * The goal the hero measures against (brief R1 block 2): the agent's own
 * personal annual API goal when one is set, else the MDRT threshold. `isMdrt`
 * drives the "OF MDRT" / "OF GOAL" label.
 */
export function heroGoal(personalAnnualAPI) {
  const own = Number(personalAnnualAPI);
  return own > 0 ? { goal: own, isMdrt: false } : { goal: MDRT_THRESHOLDS_2026.mdrt, isMdrt: true };
}

/**
 * The provenance line (Kyron, 26 Sep 2026 — BUG-01 option B): agent-declared
 * settled policies keep counting; the hero says where each status came from.
 * Null when nothing is settled — there is nothing to attribute.
 */
export function provenanceLine(settled) {
  if (!settled || !(settled.count > 0)) return null;
  const ho = Number(settled.fromHeadOffice) || 0;
  const self = Number(settled.selfConfirmed) || 0;
  return `${ho} from head office · ${self} self-confirmed`;
}

/** Whole TTD, rounded UP so the stated amount is always enough: 8154.95 → "TTD 8,155". */
function wholeTTDUp(n) {
  return `TTD ${Math.ceil(Number(n) || 0).toLocaleString('en-TT')}`;
}

/**
 * The Do-next descriptors, in display order.
 *
 * @param {object} p
 * @param {number|null} p.awaitingConfirmCount  settled, not head-office, not confirmed; null = unknown
 * @param {object|null} p.gateMonth            persistency outlook `gateMonth` (null when no gate)
 * @param {object|null} p.behind               `firstBehindStandardRow` output
 * @returns {Array<{id:string,title:string,sub:string,tone:string,target:string}>}
 */
export function buildDoNextItems({ awaitingConfirmCount = null, gateMonth = null, behind = null }) {
  const items = [];
  if (Number(awaitingConfirmCount) > 0) {
    items.push({
      id: 'confirm',
      title: 'Confirm settled policies',
      sub: `${awaitingConfirmCount} waiting`,
      tone: 'teal',
      target: 'ledger-confirm',
    });
  }
  const reinstate = Number(gateMonth?.gap?.reinstateNeeded);
  if (gateMonth && !gateMonth.meetsThreshold && reinstate > 0) {
    items.push({
      id: 'winback',
      title: 'Win back a lapsed policy',
      sub: `${wholeTTDUp(reinstate)} reinstated clears the ${gateMonth.threshold}% gate`,
      tone: 'warning',
      target: 'persistency',
    });
  }
  if (behind) {
    items.push({
      id: 'standard',
      title: `Log ${behind.needed} more ${behind.noun}`,
      sub: "To meet this week's standard",
      tone: 'neutral',
      target: 'daily-log',
    });
  }
  return items.slice(0, 3);
}
