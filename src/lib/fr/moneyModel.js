/**
 * moneyModel.js — the FR Money hub's view models (FR-3).
 *
 * PURE: no SDK, no JSX, no clock. Every figure is derived from inputs the app
 * already loads (the ledger list, the saved persistency records, the goal
 * hierarchy, own policies). Nothing is stored.
 *
 * Money rules (brief FR-D5 / FR-D10):
 *   · Persistency figures come from buildPersistencyOutlook, which calls
 *     deriveFromLedger + calculateShortfall. This file never re-implements the
 *     memo formula; it only picks which of the outlook's figures to show and
 *     lists the lapses the outlook already counted (`figure.evidence.lapses`).
 *   · A figure that cannot be derived is `null` and the view says so.
 *   · Every TTD sum is rounded to cents once, at the end.
 */
import { buildPersistencyOutlook, toLedgerDoc } from '../persistency/persistencyOutlook';
import { calculateShortfall, deriveAll, projectPersistency, PERS_GATE } from '../persistency/calculations';
import { roundPersistencyPct, formatPersistencyPct } from '../persistency/persistencyRounding';
import { isTwentyFourMonthModel } from '../persistency/model';
import { declarationView } from '../persistency/reinstatementDeclaration';

export const MONTH_SHORT = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);

/** 24-month window: the report month and the 23 before it (deriveFromLedger). */
export const WINDOW_MONTHS = 24;

/**
 * A lapse "ages out soon" when it stops counting (leaves the 24-month window)
 * no more than this many months after the planned month (Kyron ruling
 * 28-09-2026: flag any policy that ages out before or soon after the gate
 * month). Reinstating it helps only until then.
 */
export const SOON_MONTHS = 2;

/** Above this many lapses the smallest-set search is greedy, not exhaustive. */
export const EXACT_SEARCH_MAX = 16;

const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** "2026-09" → { y: 2026, m: 9 } or null. */
function parseMonthKey(key) {
  const m = MONTH_KEY_RE.exec(String(key ?? ''));
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null;
}

/** Month index (months since year 0) — for differences. */
function monthIndex(key) {
  const p = parseMonthKey(key);
  return p ? p.y * 12 + (p.m - 1) : null;
}

/** Shift a "YYYY-MM" key by `delta` months. */
export function shiftMonthKey(key, delta) {
  const i = monthIndex(key);
  if (i == null) return null;
  const n = i + delta;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
}

/** "2026-09" → "Sep 2026". */
export function monthLabel(key) {
  const p = parseMonthKey(key);
  return p ? `${MONTH_SHORT[p.m - 1]} ${p.y}` : '';
}

/** "2026-09" → "Sep 26" (compact axis label). */
function monthAxisLabel(key) {
  const p = parseMonthKey(key);
  return p ? `${MONTH_SHORT[p.m - 1]} ${String(p.y).slice(2)}` : '';
}

/** Whole TTD with grouping: 7099.36 → "7,099". */
export function wholeTTD(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-TT');
}

/** Whole TTD rounded UP — a "you need" figure is never understated. */
export function wholeTTDUp(n) {
  return Math.ceil((Number(n) || 0) - 1e-9).toLocaleString('en-TT');
}

// ── MDRT / goal pace ────────────────────────────────────────────────────────

/**
 * paceModel — cumulative settled API by month (Jan … this month) against an
 * EVEN pace to the goal (goal × month ÷ 12). Settled months come from
 * `settledByMonth` (todayModel.settledByMonthFrom: the hero's own credit list,
 * so the cumulative line ends on the hero figure).
 *
 * @param {object} p
 * @param {Array<{month:string, api:number}>} p.settledByMonth
 * @param {number} p.year
 * @param {number} p.currentMonth   1–12
 * @param {number} p.goal           TTD (MDRT or the agent's own goal)
 * @param {boolean} p.isMdrt
 * @returns {null | { labels, series, settledToDate, paceToDate, delta, title, goal, goalLabel }}
 */
export function paceModel({ settledByMonth, year, currentMonth, goal, isMdrt }) {
  if (!isNum(goal) || goal <= 0 || !Number.isInteger(currentMonth) || currentMonth < 1 || currentMonth > 12) return null;
  const byKey = new Map((Array.isArray(settledByMonth) ? settledByMonth : [])
    .filter((m) => typeof m?.month === 'string' && m.month.startsWith(`${year}-`))
    .map((m) => [m.month, Number(m.api) || 0]));
  const cumulative = [];
  let run = 0;
  for (let i = 1; i <= currentMonth; i += 1) {
    run += byKey.get(`${year}-${String(i).padStart(2, '0')}`) ?? 0;
    cumulative.push(money2(run));
  }
  const pace = MONTH_SHORT.map((_, i) => money2((goal * (i + 1)) / 12));
  const settledToDate = cumulative[cumulative.length - 1] ?? 0;
  const paceToDate = pace[currentMonth - 1];
  const delta = money2(settledToDate - paceToDate);
  const who = isMdrt ? 'MDRT' : 'your goal';
  const title = delta >= 0
    ? `TTD ${wholeTTD(delta)} ahead of an even pace to ${who}`
    : `TTD ${wholeTTD(-delta)} behind an even pace to ${who}`;
  return {
    labels: [...MONTH_SHORT],
    series: [
      { key: 'settled', label: 'Settled API, running total', values: cumulative, tone: 1 },
      { key: 'pace', label: `Even pace to ${isMdrt ? 'MDRT' : 'goal'}`, values: pace, tone: 3 },
    ],
    settledToDate,
    paceToDate,
    delta,
    title,
    goal,
    goalLabel: `${isMdrt ? 'MDRT' : 'Goal'} ${wholeTTD(goal)}`,
  };
}

// ── Persistency month by month ─────────────────────────────────────────────

/** A saved record's persistency as a 0–1 fraction, or null for "no reading". */
function recordFraction(r) {
  if (!r || r.grossSettled === 0) return null; // no settled business → no reading, not 0 %
  return isNum(r.persistency) ? r.persistency : null;
}

/**
 * persistencySeries — the saved monthly records (newest `limit`), plus the
 * outlook's estimate for the current month as a PROJECTED bar when it is
 * newer than the last saved month. Values in percent, 2 decimals, half up
 * (ruling R-a, `roundPersistencyPct`).
 *
 * @returns {{ data: Array<{key,label,value,projected}>, hasTwelveMonthModel: boolean }}
 */
export function persistencySeries({ records, estimate = null, limit = 12 }) {
  const byMonth = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const key = r?.monthKey ?? (r?.year && r?.month ? `${r.year}-${String(r.month).padStart(2, '0')}` : null);
    const f = recordFraction(r);
    if (!parseMonthKey(key) || f == null) continue;
    byMonth.set(key, f); // a later duplicate for the same month wins
  }
  const saved = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-limit);
  const data = saved.map(([key, f]) => ({
    key, label: monthAxisLabel(key), value: roundPersistencyPct(f * 100), projected: false,
  }));
  const last = saved[saved.length - 1]?.[0] ?? null;
  if (estimate && isNum(estimate.persistency) && parseMonthKey(estimate.monthKey)
    && (last == null || estimate.monthKey > last)) {
    data.push({
      key: estimate.monthKey,
      label: monthAxisLabel(estimate.monthKey),
      value: roundPersistencyPct(estimate.persistency * 100),
      projected: true,
    });
    if (data.length > limit) data.shift();
  }
  return {
    data,
    hasTwelveMonthModel: data.some((d) => !isTwentyFourMonthModel(d.key)),
  };
}

// ── Reinstatement planner ──────────────────────────────────────────────────

/**
 * clearingSets(items, need) — two honest answers to "which lapses do I
 * reinstate to reach the gate?":
 *   leastMoney      the set with the smallest total API (ties: fewer policies)
 *   fewestPolicies  the set with the fewest policies (ties: smallest total)
 * Each reinstatement is a client conversation, so the two can differ and the
 * agent is shown both (canvas: "smallest set" and "one policy alone").
 * Exhaustive when there are ≤ EXACT_SEARCH_MAX lapses. Above that, fewest is
 * still exact (largest-first always needs the fewest), and least money is a
 * largest-first greedy with spare policies dropped (`exact: false`).
 *
 * @param {Array<{api:number}>} items
 * @param {number} need   TTD
 * @returns {{ leastMoney, fewestPolicies } | null}  null when even all of them fall short;
 *          each is { items, total, exact }
 */
export function clearingSets(items, need) {
  const list = (Array.isArray(items) ? items : []).filter((it) => isNum(it?.api) && it.api > 0);
  const target = money2(need);
  if (!(target > 0)) {
    const none = { items: [], total: 0, exact: true };
    return { leastMoney: none, fewestPolicies: none };
  }
  const all = money2(list.reduce((s, it) => s + it.api, 0));
  if (all < target) return null;

  // Fewest policies: take the largest until the need is met (exact), then
  // swap for the cheapest set of that size when the search is exhaustive.
  const sorted = [...list].sort((a, b) => b.api - a.api);
  const greedy = [];
  let greedyTotal = 0;
  for (const it of sorted) {
    if (greedyTotal >= target) break;
    greedy.push(it);
    greedyTotal = money2(greedyTotal + it.api);
  }

  if (list.length <= EXACT_SEARCH_MAX) {
    let money = null;
    let few = null;
    const n = list.length;
    for (let mask = 1; mask < (1 << n); mask += 1) {
      let total = 0;
      let count = 0;
      for (let i = 0; i < n; i += 1) {
        if (mask & (1 << i)) { total += list[i].api; count += 1; }
      }
      total = money2(total);
      if (total < target) continue;
      if (!money || total < money.total || (total === money.total && count < money.count)) money = { mask, total, count };
      if (!few || count < few.count || (count === few.count && total < few.total)) few = { mask, total, count };
    }
    const pick = (b) => ({ items: list.filter((_, i) => b.mask & (1 << i)), total: b.total, exact: true });
    return { leastMoney: pick(money), fewestPolicies: pick(few) };
  }

  const chosen = [...greedy];
  let total = greedyTotal;
  for (let i = 0; i < chosen.length; i += 1) {
    if (money2(total - chosen[i].api) >= target) {
      total = money2(total - chosen[i].api);
      chosen.splice(i, 1);
      i -= 1;
    }
  }
  return {
    leastMoney: { items: chosen, total, exact: false },
    fewestPolicies: { items: greedy, total: greedyTotal, exact: true },
  };
}

/**
 * reinstatementPlan — which lapsed policies can lift persistency to the gate.
 *
 * The month planned for is the campaign gate month when a gate applies
 * (outlook.gateMonth), else the current month (outlook.estimateToday). The
 * lapses listed are EXACTLY the ones that month's figure counted
 * (`evidence.lapses`), so a lapse aged out of the 24-month window, or cleared
 * by 24 months of premium, is never offered as a lever.
 *
 * Reinstating a lapse adds its API to Reinstatements (Net Settled =
 * Net Gross Settled − Lapses + Reinstatements), so the persistency after a
 * set is deriveAll with reinstatements raised by the set's total.
 *
 * @param {object} p
 * @param {Array} p.policies    the agent's policies, UNFILTERED (as the outlook takes them)
 * @param {Array} [p.records]   saved persistency records
 * @param {string} p.todayTT    YYYY-MM-DD
 * @param {{monthKey:string, threshold:number}|null} [p.gate]
 * @returns {null | object}     null when there is no ledger figure to plan against
 */
export function reinstatementPlan({ policies, records = [], todayTT, gate = null }) {
  if (!YMD_RE.test(String(todayTT ?? ''))) return null;
  let outlook;
  try {
    outlook = buildPersistencyOutlook({ policies, records, today: todayTT, gate });
  } catch {
    return null;
  }
  const fig = outlook.gateMonth ?? outlook.estimateToday;
  if (!fig) return null;
  const threshold = isNum(outlook.gateMonth?.threshold) ? outlook.gateMonth.threshold : PERS_GATE * 100;
  // R-a: the figure and the verdict are the same 2-dp rounded value.
  const currentPct = roundPersistencyPct(fig.persistency * 100);
  const meets = currentPct >= threshold;

  const need = outlook.gateMonth
    ? money2(outlook.gateMonth.gap.reinstateNeeded)
    : money2(calculateShortfall({
      targetPersistency: threshold / 100,
      currentGrossSettled: fig.derived.grossSettled,
      currentLapses: fig.inputs.lapses,
      currentReinstatements: fig.inputs.reinstatements,
    }).nrNeeded);

  // Itemise the counted lapses. A policy number can only be listed once.
  const docs = (Array.isArray(policies) ? policies : []).map(toLedgerDoc);
  const byNumber = new Map();
  for (const d of docs) {
    if (d?.policyNumber == null) continue;
    // Prefer the lapsed doc when a number repeats (a stale annuity counted
    // under the "lapse" rule is still status settled, so any status is kept).
    const prev = byNumber.get(d.policyNumber);
    if (!prev || (prev.status !== 'lapsed' && d.status === 'lapsed')) byNumber.set(d.policyNumber, d);
  }
  const currentMonth = todayTT.slice(0, 7);
  const seen = new Set();
  const lapses = [];
  for (const num of fig.evidence?.lapses ?? []) {
    if (num == null || seen.has(num)) continue;
    seen.add(num);
    const d = byNumber.get(num);
    const issuedMonth = YMD_RE.exec(String(d?.dateIssued ?? ''));
    if (!d || !issuedMonth) continue;
    const issuedKey = `${issuedMonth[1]}-${issuedMonth[2]}`;
    const countsThrough = shiftMonthKey(issuedKey, WINDOW_MONTHS - 1);
    lapses.push({
      policyNumber: num,
      // FR-6: the policy doc behind the row (for "Mark reinstated" / "Withdraw")
      // and its live declaration, if any. Display only — never in a figure below.
      id: d.id ?? null,
      agentId: d.agentId ?? null,
      status: d.status ?? null,
      declaration: declarationView(d, todayTT),
      clientName: d.ownerName ?? d.insuredName ?? d.clientName ?? null,
      api: money2(Number(d.proposedAPI) || 0),
      dateIssued: String(d.dateIssued).slice(0, 10),
      countsThrough,
      monthsLeft: Math.max(0, monthIndex(countsThrough) - monthIndex(currentMonth)),
      agesOutSoon: monthIndex(countsThrough) - monthIndex(fig.monthKey) <= SOON_MONTHS,
    });
  }
  lapses.sort((a, b) => a.countsThrough.localeCompare(b.countsThrough) || b.api - a.api);
  const itemised = money2(lapses.reduce((s, l) => s + l.api, 0));
  const unitemised = money2(Math.max(0, (Number(fig.inputs.lapses) || 0) - itemised));

  const after = (extra) => {
    const d = deriveAll({ ...fig.inputs, reinstatements: money2((Number(fig.inputs.reinstatements) || 0) + extra) });
    return roundPersistencyPct(d.persistency * 100);
  };

  // Two presets (Kyron ruling 28-09-2026): "Fewest calls" and "Least money",
  // always both. Each carries the policies in it that age out soon.
  // `suggestion` is the least-money preset (the Overview card and What-if).
  const preset = (set) => ({
    ...set,
    afterPct: after(set.total),
    agingOut: set.items.filter((l) => l.agesOutSoon),
  });
  let presets = null;
  let outOfReach = false;
  if (!meets && need > 0) {
    const sets = clearingSets(lapses, need);
    if (sets) {
      presets = { fewestCalls: preset(sets.fewestPolicies), leastMoney: preset(sets.leastMoney) };
    } else {
      outOfReach = true; // every counted lapse together still falls short
    }
  }
  const suggestion = presets?.leastMoney ?? null;

  return {
    monthKey: fig.monthKey,
    isGateMonth: Boolean(outlook.gateMonth),
    threshold,
    currentPct,
    meets,
    need: meets ? 0 : need,
    grossSettled: money2(fig.derived.grossSettled),
    netSettled: money2(fig.derived.netSettled),
    lapsesTotal: money2(fig.inputs.lapses),
    lapses,
    unitemised,
    presets,
    suggestion,
    outOfReach,
    annuityRuleLabel: fig.annuityRuleLabel ?? null,
    exportDate: outlook.exportDate ?? null,
    stale: Boolean(outlook.stale),
    estimate: outlook.estimateToday,
    inputs: fig.inputs,
    // FR-6 — declared reinstatements, BESIDE the evidenced figure. Raw percents
    // (formatted with formatPersistencyPct at display). Every other field of
    // this plan is evidenced-only; a declaration never moves them.
    declared: fig.declared
      ? {
        count: fig.declared.policies.length,
        total: money2(fig.declared.reinstatements),
        evidencedPct: fig.persistency * 100,
        pct: fig.declared.persistency * 100,
      }
      : null,
  };
}

/**
 * selectionSummary(plan, policyNumbers) — the agent's own mix of lapses
 * (Kyron ruling 28-09-2026: any mix can be ticked): running total against
 * the gap and the projected persistency. Unknown numbers are ignored.
 */
export function selectionSummary(plan, policyNumbers) {
  if (!plan) return null;
  const chosen = new Set(Array.isArray(policyNumbers) ? policyNumbers : []);
  const items = plan.lapses.filter((l) => chosen.has(l.policyNumber));
  const total = money2(items.reduce((s, l) => s + l.api, 0));
  const d = deriveAll({ ...plan.inputs, reinstatements: money2((Number(plan.inputs.reinstatements) || 0) + total) });
  const afterPct = roundPersistencyPct(d.persistency * 100);
  return {
    count: items.length,
    total,
    remaining: money2(Math.max(0, plan.need - total)),
    clears: plan.meets || total >= plan.need,
    afterPct,
    agingOut: items.filter((l) => l.agesOutSoon),
  };
}

// ── What if ─────────────────────────────────────────────────────────────────

/**
 * whatIf — a scenario on today's numbers. Extra applications at an average
 * API are assumed to SETTLE this year (so they add to settled API) and, for
 * persistency, to be placed inside the planned month's window (they add to
 * both sides of the fraction via projectPersistency). Reinstating the
 * suggested set adds its total to Reinstatements.
 *
 * @param {object} p
 * @param {number|null} p.settled   settled API this year (null = unknown)
 * @param {number} p.goal
 * @param {number} p.extraApps
 * @param {number} p.avgApi
 * @param {object|null} p.plan      reinstatementPlan() output
 * @param {boolean} p.reinstate
 */
export function whatIf({ settled, goal, extraApps = 0, avgApi = 0, plan = null, reinstate = false }) {
  const apps = Math.max(0, Math.floor(Number(extraApps) || 0));
  const avg = Math.max(0, Number(avgApi) || 0);
  const added = money2(apps * avg);
  const projectedSettled = isNum(settled) ? money2(settled + added) : null;
  const pctOfGoal = projectedSettled != null && goal > 0 ? Math.round((projectedSettled / goal) * 1000) / 10 : null;

  let persistencyPct = null;
  if (plan?.inputs) {
    const reinstated = reinstate && plan.suggestion ? plan.suggestion.total : 0;
    const p = projectPersistency({
      currentGrossSettled: plan.grossSettled,
      currentLapses: plan.lapsesTotal,
      currentReinstatements: Number(plan.inputs.reinstatements) || 0,
      newBusinessPlanned: added,
      newReinstatementsPlanned: reinstated,
    });
    persistencyPct = roundPersistencyPct(p.projectedPersistency * 100);
  }
  return { added, projectedSettled, pctOfGoal, persistencyPct, reinstated: reinstate && plan?.suggestion ? plan.suggestion.total : 0 };
}

// ── Overview cards ──────────────────────────────────────────────────────────

/**
 * moneyCards — one honest headline per Money tab for the Overview. Every
 * figure comes from data the app already holds; a tab with nothing to say
 * says so in words ("Not filled in yet"), never a TTD 0.
 *
 * @param {object} p
 * @param {object|null} p.hierarchy       getGoalHierarchy() output
 * @param {number|null} p.settled         settled API this year
 * @param {number|null} p.committedAnnualAPI   goals.personalAnnualAPI
 * @param {number|null} p.commissionEarned     ytdEarned(policies, year), null when unknown
 * @param {number|null} p.moneyNeedAfterTax    worksheet rollup, null when not loaded / not filled
 * @param {object|null} p.plan            reinstatementPlan() output
 * @param {string|null} p.financingLabel  FINANCING_STATUS_LABELS[status], null when not loaded
 */
export function moneyCards({
  hierarchy = null, settled = null, committedAnnualAPI = null, commissionEarned = null,
  moneyNeedAfterTax = null, plan = null, financingLabel = null,
}) {
  const floor = isNum(hierarchy?.companyFloor?.api) && hierarchy.companyFloor.api > 0 ? hierarchy.companyFloor.api : null;
  const target = isNum(hierarchy?.personal?.api) && hierarchy.personal.api > 0 ? hierarchy.personal.api : null;
  const goalLine = target != null ? { value: target, word: 'your target' } : floor != null ? { value: floor, word: 'the company minimum' } : null;

  const cards = [];
  cards.push({
    id: 'goals',
    tabId: 'goals',
    eyebrow: 'Goals',
    headline: goalLine ? `TTD ${wholeTTD(goalLine.value)}` : 'No target yet',
    sub: goalLine && isNum(settled)
      ? `${Math.min(999, Math.round((settled / goalLine.value) * 100))}% of ${goalLine.word} settled`
      : floor != null ? `Company minimum TTD ${wholeTTD(floor)}` : 'Set a target on the Goals tab',
  });
  cards.push({
    id: 'gameplan',
    tabId: 'game-plan',
    eyebrow: 'Game plan',
    headline: isNum(committedAnnualAPI) && committedAnnualAPI > 0 ? `TTD ${wholeTTD(committedAnnualAPI)}` : 'No plan committed',
    sub: isNum(committedAnnualAPI) && committedAnnualAPI > 0 ? 'Committed API for the year' : 'Build and commit your plan',
  });
  cards.push({
    id: 'commission',
    tabId: 'commission',
    eyebrow: 'Commission',
    headline: isNum(commissionEarned) && commissionEarned > 0 ? `TTD ${wholeTTD(commissionEarned)}` : 'None recorded yet',
    sub: isNum(commissionEarned) && commissionEarned > 0 ? 'Earned on settled policies this year' : 'Try targets in the playground',
  });
  cards.push({
    id: 'moneyneeds',
    tabId: 'money-needs',
    eyebrow: 'Money needs',
    headline: isNum(moneyNeedAfterTax) && moneyNeedAfterTax > 0 ? `TTD ${wholeTTD(moneyNeedAfterTax)}` : 'Not filled in yet',
    sub: isNum(moneyNeedAfterTax) && moneyNeedAfterTax > 0 ? 'A year, after tax' : 'Work out what you need to earn',
  });
  let persSub = 'No ledger figure yet';
  if (plan) {
    persSub = plan.meets
      ? `At or above the ${plan.threshold}% gate`
      : plan.suggestion
        ? `TTD ${wholeTTDUp(plan.need)} reinstated clears ${plan.threshold}% — ${plan.suggestion.items.length} ${plan.suggestion.items.length === 1 ? 'policy' : 'policies'}`
        : `TTD ${wholeTTDUp(plan.need)} short of the ${plan.threshold}% gate`;
  }
  cards.push({
    id: 'persistency',
    tabId: 'persistency',
    eyebrow: 'Persistency',
    headline: plan ? formatPersistencyPct(plan.currentPct) : '—',
    sub: persSub,
    warm: Boolean(plan && !plan.meets),
  });
  cards.push({
    id: 'financing',
    tabId: 'financing',
    eyebrow: 'Financing',
    headline: financingLabel ?? '—',
    sub: financingLabel ? 'Your financing status' : 'Status not loaded',
  });
  return cards;
}

// ── Per-tab FR headers ─────────────────────────────────────────────────────

/** The Money tabs that get an FR header (the existing calculator routes). */
export const FR_MONEY_TABS = Object.freeze(['goals', 'game-plan', 'money-needs', 'commission', 'persistency', 'financing']);

const tile = (id, label, value, unit, extra = {}) => ({ id, label, value, unit, decimals: 0, ...extra });

/**
 * headerTiles(tab, inputs) — the glanceable tiles above one Money tab's
 * existing calculator (FR-D5: the calculator is mounted unchanged below).
 * `null` values render "—"; nothing is defaulted to 0.
 *
 * @param {string} tab  'goals' | 'game-plan' | 'money-needs' | 'commission' | 'persistency' | 'financing'
 * @param {object} i    see each case
 * @returns {Array} tiles
 */
export function headerTiles(tab, i = {}) {
  const n = (v) => (isNum(v) ? v : null);
  switch (tab) {
    case 'goals': {
      const floor = n(i.hierarchy?.companyFloor?.api);
      const floorApps = n(i.hierarchy?.companyFloor?.apps);
      const target = n(i.hierarchy?.personal?.api) && i.hierarchy.personal.api > 0 ? i.hierarchy.personal.api : null;
      const aim = target ?? floor;
      const settled = n(i.settled);
      return [
        tile('settled', `Settled API ${i.year ?? ''}`.trim(), settled, 'ttd', { note: i.provenance ?? null }),
        tile('floor', 'Company minimum', floor, 'ttd', { note: floorApps != null ? `and ${floorApps} applications a year` : null }),
        tile('target', 'Your target', target ?? 'Not set', target != null ? 'ttd' : 'text', { note: target == null ? 'The company minimum applies' : null }),
        tile('togo', 'To go', settled != null && aim != null ? Math.max(0, money2(aim - settled)) : null, 'ttd', {
          note: settled != null && aim != null ? (settled >= aim ? 'Reached' : `to ${target != null ? 'your target' : 'the company minimum'}`) : null,
        }),
      ];
    }
    case 'game-plan':
      return [
        tile('committed', 'Committed API for the year', n(i.committedAnnualAPI) && i.committedAnnualAPI > 0 ? i.committedAnnualAPI : 'Not committed', n(i.committedAnnualAPI) && i.committedAnnualAPI > 0 ? 'ttd' : 'text'),
        tile('avg', 'Average API per policy', n(i.avgPolicyAPI) && i.avgPolicyAPI > 0 ? i.avgPolicyAPI : 'Not set', n(i.avgPolicyAPI) && i.avgPolicyAPI > 0 ? 'ttd' : 'text'),
        tile('weekly', 'Weekly API minimum', n(i.weeklyApiFloor), 'ttd', { note: 'Company weekly standard' }),
      ];
    case 'money-needs':
      return [
        tile('after', 'Yearly need, after tax', n(i.rollup?.totalAnnualAfterTax) && i.rollup.totalAnnualAfterTax > 0 ? i.rollup.totalAnnualAfterTax : null, 'ttd', { note: i.rollup ? null : 'Not filled in yet' }),
        tile('before', 'Before tax', n(i.rollup?.totalAnnualPreTax) && i.rollup.totalAnnualPreTax > 0 ? i.rollup.totalAnnualPreTax : null, 'ttd'),
        tile('paye', 'PAYE on that', n(i.rollup?.computedPAYE) && i.rollup.totalAnnualPreTax > 0 ? i.rollup.computedPAYE : null, 'ttd', { note: 'TTD 90,000 personal allowance' }),
      ];
    case 'commission':
      return [
        tile('earned', 'Earned this year', n(i.earned), 'ttd', { note: 'On settled policies' }),
        tile('runrate', 'Run rate, a year', n(i.runRate?.value) && i.runRate.weekCount > 0 ? i.runRate.value : null, 'ttd', { note: i.runRate?.weekCount > 0 ? (i.runRate.isLinear ? i.runRate.window : 'Last 8 weeks × 52 ÷ 8') : 'No settled commission yet' }),
        tile('rate', 'Your commission rate', n(i.commissionRate) ? i.commissionRate : 'Not set', n(i.commissionRate) ? 'pct' : 'text', { note: n(i.commissionRate) ? 'From your profile' : 'Playground uses 35% until set' }),
      ];
    case 'persistency': {
      const p = i.plan;
      return [
        tile('now', p ? `Persistency, ${monthLabel(p.monthKey)}` : 'Persistency', p ? p.currentPct : null, 'pct', { decimals: 2 /* R-a: currentPct is already roundPersistencyPct() */, warm: Boolean(p && !p.meets), note: p ? (p.meets ? `At or above ${p.threshold}%` : `Below the ${p.threshold}% gate`) : 'No ledger figure yet' }),
        tile('need', 'Reinstated to clear the gate', p ? (p.meets ? 0 : Math.ceil(p.need)) : null, 'ttd', { note: p && !p.meets ? 'Rounded up to the dollar' : null }),
        tile('lapses', 'Lapses counted', p ? p.lapsesTotal : null, 'ttd', { note: p ? `${p.lapses.length} ${p.lapses.length === 1 ? 'policy' : 'policies'} in the 24-month window` : null }),
      ];
    }
    case 'financing':
      return [
        tile('status', 'Financing status', i.financingLabel ?? null, 'text'),
        tile('month', 'Financing this month', n(i.terms?.currentMonthlyFinancing), 'ttd'),
        tile('agreed', 'Agreed monthly', n(i.terms?.agreedMonthlyFinancing), 'ttd'),
      ];
    default:
      if (import.meta.env?.DEV) throw new Error(`headerTiles: unknown Money tab "${tab}"`);
      return [];
  }
}
