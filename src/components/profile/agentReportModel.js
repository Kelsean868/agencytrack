// agentReportModel — the SINGLE derivation path for the interactive Agent
// Report View (AgentReportView.jsx). Its ONE job is to guarantee the view reads
// every displayed number through the SAME extractFields path the PDF
// (AgentReportDocument.jsx) uses — no second math path, no re-derived activity.
//
// Every production/activity/ratio number below flows through one of:
//   • extractTotalProductionCredit  — API / production credit (per submission)
//   • extractFields                 — activity fields (dials, f2f, ffi, ci, apps…)
//   • computeRatios                 — the 8 canonical coaching ratios
//   • computeAgentTotals            — period rollups (itself uses
//                                     extractTotalProductionCredit internally)
//
// This mirrors AgentReportDocument.jsx's derivations (YTD settled-vs-submitted
// hero, latest-persistency, goal read) so the live view and the PDF agree.
import {
  extractFields,
  extractTotalProductionCredit,
  computeRatios,
} from '../../utils/extractFields';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
} from '../../lib/productionReport/computations';
import { resolveAnnualAPIFloor } from '../../utils/tenureFloors';
import { roundPersistencyPct } from '../../lib/persistency/persistencyRounding';

// Keys computeRatios (and the activity tiles) read — seeded to 0 so a
// zero-submission aggregate yields clean nulls/0s, never NaN.
const RATIO_SOURCE_KEYS = [
  'telContacts', 'f2fContacts', 'prospectingTouches', 'qualifiedApproaches',
  'appointmentsSet', 'ffiConducted', 'solutionPresentations', 'ciConducted',
  'applicationsSold', 'livesSold', 'apiSold',
  'totalTelAttempts', 'f2fAttempts', 'totalNewNames',
];

// Sum every numeric field returned by extractFields across a submission set.
// Additive fields sum cleanly; derived per-week totals (prospectingTouches etc.)
// sum to the same value as deriving from the summed source, so computeRatios on
// the aggregate is consistent with the per-week extractFields contract.
export function aggregateFields(subs) {
  const agg = {};
  for (const s of subs ?? []) {
    const f = extractFields(s);
    for (const [k, v] of Object.entries(f)) {
      if (typeof v === 'number') agg[k] = (agg[k] || 0) + v;
    }
  }
  for (const k of RATIO_SOURCE_KEYS) {
    if (agg[k] == null) agg[k] = 0;
  }
  return agg;
}

// Mirror of AgentReportDocument.latestPersistencyPercent — most-recent E3
// persistency entry, converted to a 0–100 display scale.
//
// SCALE: E3 stores `persistency` as a DECIMAL (netSettled / grossSettled, see
// lib/persistency/calculations.js), so the conversion is an unconditional
// `* 100`. It was previously `v <= 1 ? v * 100 : v` — a dual-scale guess that
// (a) is unnecessary, since every read path (`getPersistencyMapForYear`,
// `getPersistencyForAgentIds`, `getAgentHistory`) filters `isE3Doc` and a
// legacy 0–100 doc therefore cannot reach here, and (b) was WRONG for a valid
// input: calculations.js explicitly permits persistency > 1 when
// reinstatements outpace lapses, so a genuine 1.05 (=105%) failed the `<= 1`
// branch and rendered as "1%" — understating a top performer by 100x in a
// head-office PDF. Keep this unconditional.
export function latestPersistencyPercent(persistencyData) {
  const entries = Array.isArray(persistencyData)
    ? persistencyData
    : (persistencyData && typeof persistencyData === 'object' ? Object.values(persistencyData) : []);
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => {
    const ka = `${a.year ?? 0}-${String(a.month ?? 0).padStart(2, '0')}`;
    const kb = `${b.year ?? 0}-${String(b.month ?? 0).padStart(2, '0')}`;
    return kb.localeCompare(ka);
  });
  const v = parseFloat(sorted[0]?.persistency);
  if (!Number.isFinite(v)) return null;
  return v * 100;
}

/**
 * Derive the full report model from the SAME data set the PDF consumes.
 *
 * @param {object} opts
 * @param {Array}  opts.submissions   raw submission docs (any schema variant)
 * @param {Array}  opts.settlements   confirmed settlement docs
 * @param {object} opts.goals         agent goals doc
 * @param {Array}  opts.persistency   E3 persistency records
 * @param {object} opts.agentProfile  user doc (contractStartDate for floor)
 * @param {'week'|'mtd'|'quarter'|'ytd'} opts.period  active period toggle
 * @param {Date}   opts.now
 * @returns {object} model consumed by AgentReportView (all numbers pre-derived)
 */
export function deriveAgentReportModel({
  submissions = [],
  settlements = [],
  goals = null,
  persistency = [],
  agentProfile = null,
  period = 'ytd',
  now = new Date(),
} = {}) {
  const year = now.getFullYear();
  const submitted = (submissions ?? []).filter((s) => s.status === 'submitted');

  // ── YTD hero (mirrors AgentReportDocument) ──────────────────────────────
  const yearSubs = submitted.filter((s) => (s.weekStarting ?? '').startsWith(String(year)));
  const ytdAPI = yearSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0);
  const ytdApps = yearSubs.reduce((sum, s) => sum + (extractFields(s).applicationsSold || 0), 0);

  const yearSettlements = (settlements ?? []).filter(
    (s) => String(s.periodKey ?? '').startsWith(String(year))
  );
  const settledYTD = yearSettlements.reduce((sum, s) => sum + (parseFloat(s.settledAPI) || 0), 0);
  const settledAppsYTD = yearSettlements.reduce((sum, s) => sum + (parseFloat(s.settledApps) || 0), 0);
  const hasSettlements = (settlements ?? []).length > 0;

  const heroPrimaryAPI = hasSettlements ? settledYTD : ytdAPI;
  const heroApps = hasSettlements ? settledAppsYTD : ytdApps;
  const heroEyebrow = hasSettlements ? 'YTD API · Settled' : 'YTD API · Submitted';
  const dataSource = hasSettlements ? 'confirmed' : 'estimated';

  // ── Period windows (same path as AgentProductionView) ───────────────────
  const windows = {
    week:    computeAgentTotals(filterSubmissionsByPeriod(submitted, 'week', now)),
    mtd:     computeAgentTotals(filterSubmissionsByPeriod(submitted, 'mtd', now)),
    quarter: computeAgentTotals(filterSubmissionsByPeriod(submitted, 'quarter', now)),
    ytd:     computeAgentTotals(filterSubmissionsByPeriod(submitted, 'ytd', now)),
  };
  const activePeriod = ['week', 'mtd', 'quarter', 'ytd'].includes(period) ? period : 'ytd';
  const periodTotals = windows[activePeriod];

  // ── Period-scoped activity + ratios (extractFields → computeRatios) ──────
  const periodSubs = filterSubmissionsByPeriod(submitted, activePeriod, now);
  const aggFields = aggregateFields(periodSubs);
  const ratios = computeRatios(aggFields);
  const activity = {
    dials:    aggFields.totalTelAttempts,
    contacts: aggFields.telContacts,
    f2f:      aggFields.f2fAttempts,
    ffi:      aggFields.ffiConducted,
    ci:       aggFields.ciConducted,
    apps:     aggFields.applicationsSold,
    names:    aggFields.totalNewNames,
  };

  // ── 6-week API trajectory (oldest → newest) ─────────────────────────────
  const sortedDesc = [...submitted].sort(
    (a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? '')
  );
  const trajectory = sortedDesc.slice(0, 6).reverse().map((s) => extractTotalProductionCredit(s));

  // ── Floor bar (tenure-based, submitted YTD — matches AgentProductionView) ─
  const ytdFloor = resolveAnnualAPIFloor({ contractStartDate: agentProfile?.contractStartDate, now });
  const floorPct = ytdFloor > 0 ? Math.min(100, Math.round((ytdAPI / ytdFloor) * 100)) : 0;
  const aboveFloor = ytdAPI >= ytdFloor;

  // Goal — mirror AgentReportDocument's read (+ personalAnnualAPI fallback used
  // elsewhere in AgentDashboard).
  const ytdAPIGoal = parseFloat(
    goals?.annualAPI ?? goals?.personalCommitment?.annualAPI ?? goals?.personalAnnualAPI
  ) || 0;

  return {
    year,
    activePeriod,
    hasAnySubmission: submitted.length > 0,
    weeksSubmittedYTD: yearSubs.length,
    // hero
    ytdAPI, ytdApps, settledYTD, settledAppsYTD, hasSettlements,
    heroPrimaryAPI, heroApps, heroEyebrow, dataSource,
    // 2 decimals, half up (ruling R-a) — the value the report prints and judges.
    persistencyPct: roundPersistencyPct(latestPersistencyPercent(persistency)),
    closingRatio: ratios.closingRatio,
    // period
    periodTotals, windows,
    // activity + ratios
    activity, ratios,
    // trajectory + floor + goal
    trajectory, ytdFloor, floorPct, aboveFloor, ytdAPIGoal,
  };
}
