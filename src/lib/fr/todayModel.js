/**
 * todayModel.js — the FR "Today" screen's view model (FR-2).
 *
 * PURE: no SDK, no JSX, no clock. Everything arrives as input — the same
 * figures HomeV2 already derives (deriveYearProduction output, the week's floor
 * actuals, the Do-next descriptors, the persistency records) — and comes back
 * as plain data for FrTodayView.
 *
 * FR-D10 honest numbers: every figure may be `null` = unknown. The view shows
 * "—" or hides it; nothing here turns "not loaded" or "not captured" into a
 * confident 0. Coach lines are computed from the numbers (gap to the weekly
 * minimum, pace to MDRT / goal, persistency gap) — no AI.
 *
 * Money: the monthly split is read from `settledCreditList` (ledgerProduction.js),
 * the SAME list `deriveYearProduction` sums for the hero, so the months always
 * add up to the settled figure (pinned by a test).
 */
import { settledCreditList, provenanceLine } from '../ledgerProduction';
import { WEEKLY_ACTIVITY_FLOOR_ROWS } from '../../utils/weeklyActivityFloors';
import { varianceState, elapsedWorkingDays, PACE_WORKING_DAYS } from '../../utils/planVariance';
import { weekNumber } from '../../utils/dateHelpers';
import { PERS_GATE_PCT } from '../persistency/calculations';
import { heroGoal, firstBehindStandardRow } from '../../components/dashboard/HomeV2/homeDerivations';

export const MONTH_SHORT = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const MONTH_LONG = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const cents = (n) => Math.round(n * 100) / 100;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Whole TTD with grouping, no prefix: 87146.28 → "87,146". */
export function wholeTTD(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-TT');
}

/** YYYY-MM-DD → DD-MM-YYYY (null for anything else). */
export function ddmmyyyy(ymd) {
  const m = YMD.exec(String(ymd ?? ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "Morning" 00–11 · "Afternoon" 12–16 · "Evening" 17–23 (TT hour). */
export function greetingFor(hourTT, displayName) {
  const h = hourTT == null || hourTT === '' ? NaN : Number(hourTT);
  const part = !Number.isInteger(h) || h < 0 || h > 23
    ? 'Hello'
    : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  const first = String(displayName ?? '').trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** Whole weeks from `todayTT` to 31 Dec of its year (the hero's "weeks left"). */
export function weeksToYearEnd(todayTT) {
  const m = YMD.exec(String(todayTT ?? ''));
  if (!m) return null;
  const today = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const yearEnd = Date.UTC(+m[1], 11, 31);
  return Math.max(0, Math.ceil((yearEnd - today) / (7 * 86400000)));
}

/**
 * settledByMonthFrom(policies, year) — settled API per issue month for one
 * year, from the hero's own credit list. `[{ month: 'YYYY-MM', api }]`, sorted.
 * `policies` must be the UNFILTERED ledger list, as for deriveYearProduction
 * (R5: date decides, not origin) — otherwise the months cannot sum to the hero.
 */
export function settledByMonthFrom(policies, year) {
  const y = String(year);
  const byMonth = new Map();
  for (const { periodKey, issued, credit } of settledCreditList(policies)) {
    if (!issued.startsWith(`${y}-`)) continue;
    byMonth.set(periodKey, (byMonth.get(periodKey) ?? 0) + (Number(credit?.api) || 0));
  }
  return [...byMonth.entries()]
    .map(([month, api]) => ({ month, api: cents(api) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * The latest persistency reading as a percentage, or null. Records are the
 * E3 shape (`persistency` = 0–1 fraction). A month with no settled business
 * (`grossSettled === 0`) stores persistency 0 by division rule — that is "no
 * reading", not 0 %, so it is skipped.
 */
export function latestPersistencyPct(records) {
  const list = (Array.isArray(records) ? records : [])
    .filter((r) => r && isNum(r.persistency) && !(r.grossSettled === 0))
    .map((r) => ({ r, key: r.monthKey ?? `${r.year}-${String(r.month).padStart(2, '0')}` }))
    .sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const last = list[list.length - 1];
  return last ? Math.round(last.r.persistency * 1000) / 10 : null;
}

function sentenceCase(label) {
  const s = String(label ?? '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Cumulative running total of a value list. */
function cumulative(values) {
  let run = 0;
  return values.map((v) => { run += v; return cents(run); });
}

/**
 * buildTodayModel(input) → the Today view model.
 *
 * @param {object} p
 * @param {object|null} p.production        deriveYearProduction() output; null while loading / on error
 * @param {boolean} [p.pending]             ledger still loading
 * @param {boolean} [p.error]               ledger failed to load
 * @param {number|null} [p.personalGoalAPI] the agent's own annual goal (null → MDRT)
 * @param {object} p.floors                 weeklyFloors() output
 * @param {{source:string, values:object}|null} p.actuals  thisWeekActuals() output
 * @param {boolean} [p.weekLoading]
 * @param {boolean} [p.weekError]
 * @param {string} [p.weekStart]            YYYY-MM-DD Sunday of this week
 * @param {Array} [p.doNextItems]           buildDoNextItems() output
 * @param {boolean} [p.doNextLoading]
 * @param {object|null} [p.currentWeekSub]
 * @param {number|null} [p.persistencyLatestPct]  e.g. 86.6
 * @param {Array<{month:string, api:number}>} [p.settledByMonth]
 * @param {string} p.todayTT                YYYY-MM-DD
 * @param {number} [p.hourTT]               0–23
 * @param {string} [p.displayName]
 */
export function buildTodayModel({
  production = null,
  pending = false,
  error = false,
  personalGoalAPI = null,
  floors = {},
  actuals = null,
  weekLoading = false,
  weekError = false,
  weekStart = null,
  doNextItems = [],
  doNextLoading = false,
  currentWeekSub = null,
  persistencyLatestPct = null,
  settledByMonth = [],
  todayTT,
  hourTT = null,
  displayName = '',
} = {}) {
  const tm = YMD.exec(String(todayTT ?? ''));
  const year = production?.year ?? (tm ? Number(tm[1]) : null);
  const currentMonth = tm ? Number(tm[2]) : 12;
  const weekNo = tm ? weekNumber(todayTT) : null;
  const weekday = tm ? WEEKDAYS[new Date(`${todayTT}T12:00:00Z`).getUTCDay()] : null;

  // ── Hero ────────────────────────────────────────────────────────────────
  const { goal, isMdrt } = heroGoal(personalGoalAPI);
  const goalWord = isMdrt ? 'MDRT' : 'your goal';
  const known = Boolean(production) && !pending && !error;
  const settled = known && isNum(production.settled?.api) ? production.settled.api : null;
  const waitingApi = known && isNum(production.pending?.api) ? production.pending.api : null;
  const waitingApps = known && isNum(production.pending?.apps) ? production.pending.apps : null;
  const met = settled != null && settled >= goal;
  let pct = settled != null && goal > 0 ? Math.round((settled / goal) * 100) : null;
  if (pct != null && pct >= 100 && !met) pct = 99; // never say 100 % before it is reached
  const weeksLeft = weeksToYearEnd(todayTT);
  const perWeekNeeded = settled != null && !met && weeksLeft > 0
    ? Math.ceil((goal - settled) / weeksLeft)
    : null;

  let heroTitle;
  if (pending) heroTitle = 'Loading your policy ledger…';
  else if (error) heroTitle = 'Your policy ledger did not load';
  else if (settled == null) heroTitle = 'No production figures yet';
  else if (met) heroTitle = `TTD ${wholeTTD(settled)} settled — ${isMdrt ? 'MDRT' : 'your goal'} reached`;
  else heroTitle = `TTD ${wholeTTD(settled)} settled — ${pct}% of ${isMdrt ? 'MDRT' : 'your goal'}`;

  const hero = {
    year,
    settled,
    pending: waitingApi,
    pendingApps: waitingApps,
    goal,
    isMdrt,
    goalLabel: `${isMdrt ? 'MDRT' : 'Goal'} ${wholeTTD(goal)}`,
    pct,
    met,
    weeksLeft,
    perWeekNeeded,
    title: heroTitle,
    settledApps: known && isNum(production.settled?.apps) ? production.settled.apps : null,
    submittedApi: known && isNum(production.submitted?.api) ? production.submitted.api : null,
    submittedApps: known && isNum(production.submitted?.apps) ? production.submitted.apps : null,
    datedByIssue: known ? Boolean(production.submitted?.datedByIssue) : false,
    provenance: known ? provenanceLine(production.settled) : null,
  };

  // ── Monthly (Jan … this month, or the latest month holding a settlement) ──
  let monthly = null;
  if (known && year != null) {
    const inYear = (Array.isArray(settledByMonth) ? settledByMonth : [])
      .filter((m) => typeof m?.month === 'string' && m.month.startsWith(`${year}-`));
    const byKey = new Map(inYear.map((m) => [m.month, Number(m.api) || 0]));
    const lastWithData = inYear.reduce((mx, m) => Math.max(mx, Number(m.month.slice(5, 7)) || 0), 0);
    const through = Math.max(currentMonth, lastWithData);
    const data = [];
    for (let i = 1; i <= through; i += 1) {
      const key = `${year}-${String(i).padStart(2, '0')}`;
      data.push({ key, label: MONTH_SHORT[i - 1], value: byKey.get(key) ?? 0, highlight: false });
    }
    const best = data.reduce((b, d) => (d.value > (b?.value ?? 0) ? d : b), null);
    // Emphasis: this month — unless nothing has settled in it yet, when the
    // best month (the one the title names) carries it instead of an empty bar.
    const current = data[currentMonth - 1];
    const emphasis = current && current.value > 0 ? current : best;
    if (emphasis) emphasis.highlight = true;
    let title;
    if (!best) title = `No settled API yet in ${year}`;
    else if (best.key === `${year}-${String(currentMonth).padStart(2, '0')}`) title = `${MONTH_LONG[currentMonth - 1]} is your best month so far`;
    else title = `Best month so far: ${MONTH_LONG[Number(best.key.slice(5, 7)) - 1]}, TTD ${wholeTTD(best.value)}`;
    monthly = { title, year, data };
  }

  // ── Stat tiles ("Am I on track") ────────────────────────────────────────
  const cumulativeSettled = monthly ? cumulative(monthly.data.map((d) => d.value)) : [];
  const tiles = [
    {
      id: 'settled',
      label: `Settled API ${year ?? ''}`.trim(),
      value: settled,
      unit: 'ttd',
      decimals: 0,
      note: hero.provenance ?? (settled === 0 ? 'Nothing settled yet this year' : null),
      tone: 'neutral',
      spark: cumulativeSettled.length > 1 ? { values: cumulativeSettled, label: 'Settled API, running total by month' } : null,
      target: 'policy-ledger',
    },
    {
      id: 'waiting',
      label: 'Submitted, not settled',
      value: waitingApi,
      unit: 'ttd',
      decimals: 0,
      note: waitingApps == null ? null : waitingApps === 0 && waitingApi === 0
        ? 'Nothing waiting to settle'
        : `${plural(waitingApps, 'app', 'apps')} waiting to settle`,
      tone: 'neutral',
      spark: null,
      target: 'policy-ledger',
    },
    {
      id: 'goal',
      label: isMdrt ? 'MDRT progress' : 'Goal progress',
      value: pct,
      unit: 'pct',
      decimals: 0,
      qualifier: isMdrt ? 'of MDRT' : 'of goal',
      note: settled == null ? null : met
        ? `${isMdrt ? 'MDRT' : 'Goal'} ${wholeTTD(goal)} reached`
        : `TTD ${wholeTTD(goal - settled)} to go`,
      tone: 'neutral',
      spark: null,
      target: 'goals',
    },
  ];
  if (isNum(persistencyLatestPct)) {
    const below = persistencyLatestPct < PERS_GATE_PCT;
    tiles.push({
      id: 'persistency',
      label: 'Persistency',
      value: persistencyLatestPct,
      unit: 'pct',
      decimals: 1,
      note: below ? `Below the ${PERS_GATE_PCT}% gate` : `At or above the ${PERS_GATE_PCT}% gate`,
      tone: below ? 'warm' : 'neutral',
      spark: null,
      target: 'persistency',
    });
  }

  // ── Week meters ─────────────────────────────────────────────────────────
  const elapsed = weekStart && todayTT ? elapsedWorkingDaysSafe(weekStart, todayTT) : 0;
  const weekKnown = !weekLoading && !weekError && Boolean(actuals);
  const meters = WEEKLY_ACTIVITY_FLOOR_ROWS
    .filter((row) => !row.isCurrency && (Number(floors?.[row.key]) || 0) > 0)
    .map((row) => {
      const target = Number(floors[row.key]);
      const raw = weekKnown ? actuals.values?.[row.key] : null;
      const value = isNum(raw) ? raw : null;
      // Same rule as firstBehindStandardRow: pace-based varianceState, unknown
      // actuals never count as behind, and a positive shortfall is required.
      const behind = value != null
        && varianceState({ actual: value, plan: target, elapsed, source: actuals.source }) === 'behind'
        && Math.ceil(target - value) > 0;
      return { key: row.key, label: sentenceCase(row.label), value, target, behind };
    });
  const weekSource = weekKnown ? actuals.source : null;

  // ── Coach (computed, never AI) ──────────────────────────────────────────
  const coach = [];
  const behindRow = weekKnown ? firstBehindStandardRow({ floors, actuals, elapsed }) : null;
  if (behindRow) {
    const daysLeft = Math.max(0, PACE_WORKING_DAYS - elapsed);
    coach.push({
      id: 'behind',
      text: actuals.source === 'final' || daysLeft === 0
        ? `${behindRow.needed} ${behindRow.noun} short of the weekly minimum this week`
        : `${behindRow.needed} ${behindRow.noun} behind the weekly minimum — ${plural(daysLeft, 'working day', 'working days')} left`,
      tone: 'warm',
      action: { label: 'Log today', target: 'daily-log' },
    });
  }
  if (settled != null && perWeekNeeded != null) {
    coach.push({
      id: 'pace',
      text: `TTD ${wholeTTD(perWeekNeeded)} a week gets you to ${goalWord} by 31-12-${year}`,
      tone: 'neutral',
      action: { label: 'Open game plan', target: 'game-plan' },
    });
  } else if (settled != null && met) {
    coach.push({
      id: 'pace',
      text: `You have passed ${goalWord} for ${year} — TTD ${wholeTTD(settled - goal)} over`,
      tone: 'neutral',
      action: { label: 'Open game plan', target: 'game-plan' },
    });
  }
  if (isNum(persistencyLatestPct) && persistencyLatestPct < PERS_GATE_PCT) {
    coach.push({
      id: 'persistency',
      text: `Persistency ${persistencyLatestPct.toFixed(1)}% — below the ${PERS_GATE_PCT}% gate`,
      tone: 'warm',
      action: { label: 'See persistency', target: 'persistency' },
    });
  }

  // ── Waiting on you ──────────────────────────────────────────────────────
  const waiting = [];
  if (currentWeekSub?.status !== 'submitted') {
    waiting.push({
      id: 'submit',
      title: 'Submit your weekly report',
      sub: currentWeekSub?.status === 'draft'
        ? 'Your draft is saved — finish and submit it'
        : 'Your daily logs fill most of it in',
      tone: 'teal',
      target: 'submit',
    });
  }
  for (const it of Array.isArray(doNextItems) ? doNextItems : []) {
    waiting.push({ id: it.id, title: it.title, sub: it.sub, tone: it.tone ?? 'neutral', target: it.target });
  }

  return {
    greeting: greetingFor(hourTT, displayName),
    dateLine: tm ? `${weekday} ${ddmmyyyy(todayTT)} · week ${weekNo}` : null,
    weekTitle: weekNo != null ? `Week ${weekNo} so far` : 'This week so far',
    weekSource,
    weekLoading: Boolean(weekLoading),
    weekError: Boolean(weekError),
    tiles,
    hero,
    meters,
    coach: coach.slice(0, 3),
    waiting,
    waitingLoading: Boolean(doNextLoading),
    waitingIncomplete: Boolean(error),
    monthly,
    reportSubmitted: currentWeekSub?.status === 'submitted',
  };
}

/** elapsedWorkingDays, but a malformed weekStart reads as day 0 (never behind). */
function elapsedWorkingDaysSafe(weekStart, todayTT) {
  try {
    const n = elapsedWorkingDays(weekStart, todayTT);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
