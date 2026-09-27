// Track K — Strategic Plan · model assembly (pure). THE single math path.
//
// The hook fetches; this module derives every number. Dashboard, presentation
// mode, and PDF all read the assembled model — numbers can never disagree across
// render targets. No re-derivation is permitted in any component.
//
// Design intent: docs/design-system/screens-v2/stratplan-handoff/ — the CD mockup
// resolves the brief's %-objective ambiguity toward a PACE read: the tracker shows
// a prorated "Obj · YTD" (annual quota × year-elapsed) and % Objective = net ÷ that
// prorated objective, banded ON PACE / AT FLOOR / BELOW. Net stays the numerator
// (brief §4 "net is the locked denominator"); the raw annual % is `apiPctObj`.

import { aggregatePersistency } from '../persistency/calculations';
import { RECRUITING_STAGES, STAGE_KEYS, stageIndex } from '../../services/recruitingService';
import {
  yearWindow, periodWindows, sumProductionWindow, prorateQuota,
  periodElapsedFraction, monthsElapsedInYear,
} from './periodModel';
import { periodSettlement } from './settledTwinRun';
import { groupByUnit, displayTitle, experienceYears } from './unitGrouping';
import { ymdTT } from '../../utils/dateInputs';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const subId = (s) => s.agentId ?? s.userId ?? null;
const PRODUCING_ROLES = new Set(['agent', 'unit_manager']);

// Latest-month persistency % (0–100) from an agent's E3 record list. Records
// store persistency as a decimal 0–1 (calculations.js) → ×100 here. null when none.
function latestPersistencyPct(records) {
  if (!records || !records.length) return null;
  const latest = [...records].sort(
    (a, b) => String(a.monthKey).localeCompare(String(b.monthKey)),
  ).at(-1);
  const p = latest?.persistency;
  return typeof p === 'number' ? p * 100 : null;
}

function latestRecords(persistencyByAgent) {
  return Object.values(persistencyByAgent || {})
    .map((records) => (records && records.length
      ? [...records].sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey))).at(-1)
      : null))
    .filter(Boolean);
}

// Branch persistency % (0–100) via aggregatePersistency — sum numerators /
// denominators, NEVER average percentages (RULING 1). null when no records.
function branchPersistencyPct(persistencyByAgent) {
  const latest = latestRecords(persistencyByAgent);
  if (!latest.length) return null;
  const agg = aggregatePersistency(latest);
  if (!(agg.sumGrossSettled > 0)) return null;
  return agg.aggregatedPersistency * 100;
}

// ── Agent Performance Tracker (deck §02) ────────────────────────────────────
// Per producing advisor, YTD vs the PRORATED annual objective. Producing UMs are
// rows (RULING 3). % Objective = calendar-year NET settled ÷ (annual quota ×
// elapsed) — the pace read the CD mockup shows.
export function assembleAgentTrackerRows({
  roster, ytdSubmissions, settledByAgent, persistencyByAgent, goalsByAgent, year, elapsed = 1,
}) {
  const fy = yearWindow(year);
  return (roster || []).map((u) => {
    const subs = (ytdSubmissions || []).filter((s) => subId(s) === u.id);
    const prod = sumProductionWindow(subs, fy);
    const settled = settledByAgent?.[u.id] ?? { net: { api: 0, apps: 0 }, gross: { api: 0, apps: 0 } };
    const goals = goalsByAgent?.[u.id] ?? null;
    const apiQuota = goals ? (num(goals.personalAnnualAPI) || num(goals.targetAnnualAPI) || null) : null;
    const appQuota = goals ? (num(goals.personalAnnualApps) || num(goals.targetAnnualApps) || null) : null;
    const objYtd = apiQuota != null ? apiQuota * elapsed : null;
    return {
      id: u.id,
      name: u.name ?? u.displayName ?? u.email ?? u.id,
      title: displayTitle(u),
      role: u.role,
      unitId: u.unitId ?? (u.role === 'unit_manager' ? u.id : null),
      isUnitHead: u.role === 'unit_manager',
      contractYear: typeof u.contractStartDate === 'string' ? u.contractStartDate.slice(0, 4) : null,
      experienceYears: experienceYears(u.contractStartDate),
      calls: prod.calls,
      contacts: prod.contacts,
      factFinds: prod.factFinds,
      closingInterviews: prod.closingInterviews,
      persistencyPct: latestPersistencyPct(persistencyByAgent?.[u.id]),
      apiQuota,
      appQuota,
      objYtd,
      apiSubmitted: prod.api,
      apiGrossSettled: settled.gross.api,
      apiNetSettled: settled.net.api,
      appSubmitted: prod.apps,
      appGrossSettled: settled.gross.apps,
      appNetSettled: settled.net.apps,
      // Raw annual % (brief) + prorated pace % (mockup display + banding).
      apiPctObj: apiQuota ? (settled.net.api / apiQuota) * 100 : null,
      apiPacePct: objYtd ? (settled.net.api / objYtd) * 100 : null,
      appPctObj: appQuota ? (settled.net.apps / appQuota) * 100 : null,
    };
  }).sort((a, b) => b.apiNetSettled - a.apiNetSettled);
}

// Branch tracker summary strip (deck §02 hero).
export function assembleTrackerSummary({ rows, elapsed = 1 }) {
  const list = rows || [];
  const netYtd = list.reduce((s, r) => s + r.apiNetSettled, 0);
  const objYtd = list.reduce((s, r) => s + (r.objYtd ?? 0), 0);
  const callsTotal = list.reduce((s, r) => s + r.calls, 0);
  const appsTotal = list.reduce((s, r) => s + r.appNetSettled, 0);
  const top = list.reduce((best, r) => (r.apiNetSettled > (best?.apiNetSettled ?? -1) ? r : best), null);
  return {
    advisors: list.length,
    netYtd,
    objYtd,
    callsTotal,
    appsTotal,
    funnelPct: callsTotal > 0 ? (appsTotal / callsTotal) * 100 : null,
    topProducer: top && top.apiNetSettled > 0 ? { name: top.name, netApi: top.apiNetSettled } : null,
    pacePct: objYtd > 0 ? (netYtd / objYtd) * 100 : null,
    elapsed,
  };
}

// ── Production Summary (deck §03) ────────────────────────────────────────────
export function assembleProductionSummary({
  ytdSubmissions, policies, branchGoals, persistencyByAgent, year, now = new Date(),
}) {
  const fy = yearWindow(year);
  const prod = sumProductionWindow(ytdSubmissions, fy);
  const settled = periodSettlement(policies, fy); // { net, gross } full-year
  const annualApiQuota = branchGoals ? num(branchGoals.api) || null : null;
  const annualAppQuota = branchGoals ? num(branchGoals.apps) || null : null;

  const monthsElapsed = monthsElapsedInYear(year, now);
  const monthlyApiQuota = annualApiQuota != null ? annualApiQuota / 12 : null;
  const avgMonthlyApi = monthsElapsed > 0 ? settled.net.api / monthsElapsed : null;

  const frac = periodElapsedFraction(fy, now);
  const projectedApi = frac > 0 ? settled.net.api / frac : null;
  const projectedApp = frac > 0 ? settled.net.apps / frac : null;
  const gapToQuota = annualApiQuota != null && projectedApi != null ? projectedApi - annualApiQuota : null;

  return {
    elapsedPct: frac * 100,
    monthly: {
      apiQuota: monthlyApiQuota,
      avgMonthlyApi,
      pctAchieved: monthlyApiQuota ? (avgMonthlyApi / monthlyApiQuota) * 100 : null,
    },
    annual: {
      apiQuota: annualApiQuota,
      appQuota: annualAppQuota,
      apiSubmitted: prod.api,
      appSubmitted: prod.apps,
      apiGrossSettled: settled.gross.api,
      appGrossSettled: settled.gross.apps,
      apiNetSettled: settled.net.api,
      appNetSettled: settled.net.apps,
      apiPctAchieved: annualApiQuota ? (settled.net.api / annualApiQuota) * 100 : null,
      appPctAchieved: annualAppQuota ? (settled.net.apps / annualAppQuota) * 100 : null,
      projectedApi,
      projectedApp,
      projectedApiPct: annualApiQuota && projectedApi != null ? (projectedApi / annualApiQuota) * 100 : null,
      gapToQuota,
      gapPct: annualApiQuota && gapToQuota != null ? (gapToQuota / annualApiQuota) * 100 : null,
    },
    persistency: {
      currentPct: branchPersistencyPct(persistencyByAgent),
      eoyPct: null, // Phase 1: current only — projectPersistency is a what-if lever tool
    },
    empty: prod.count === 0 && settled.net.api === 0 && settled.gross.api === 0,
  };
}

// ── Period Metrics (deck §04) — quarter/half toggle + manpower ───────────────
// Manpower Goal reads the OPTIONAL branchGoals.manpower field if present (dispatcher
// ruling); "—" when absent. The setter is Phase 2 — this is a read-only fold.
function windowState(w, now) {
  const nowYMD = ymdTT(now);
  if (w.endYMD < nowYMD) return 'done';
  if (w.startYMD > nowYMD) return 'future';
  return 'progress';
}

export function assemblePeriodMetrics({ ytdSubmissions, policies, branchGoals, roster, period, now = new Date() }) {
  const windows = periodWindows(period);
  const annualApi = branchGoals ? num(branchGoals.api) || null : null;
  const annualApp = branchGoals ? num(branchGoals.apps) || null : null;
  const manpowerActual = (roster || []).length; // current headcount (no historical snapshot in Phase 1)
  const manpowerGoal = branchGoals && branchGoals.manpower != null ? num(branchGoals.manpower) : null;

  const mkRow = (w) => {
    const prod = sumProductionWindow(ytdSubmissions, w);
    const settled = periodSettlement(policies, w);
    const apiGoal = annualApi != null ? prorateQuota(annualApi, w.months) : null;
    const appGoal = annualApp != null ? prorateQuota(annualApp, w.months) : null;
    const state = windowState(w, now);
    return {
      key: w.key,
      label: w.label,
      months: w.months,
      state,
      apiGoal,
      apiActual: settled.net.api,
      apiVariance: apiGoal != null && state === 'done' ? settled.net.api - apiGoal : null,
      appGoal,
      appActual: settled.net.apps,
      appVariance: appGoal != null && state === 'done' ? settled.net.apps - appGoal : null,
      manpowerGoal,
      manpowerActual,
      hasData: prod.count > 0 || settled.net.api > 0 || settled.gross.api > 0,
    };
  };

  const rows = windows.map(mkRow);
  const fy = mkRow({ ...yearWindow(period.year), label: 'FY', key: 'FY' });
  fy.isFy = true;

  return {
    granularity: period.granularity,
    rows,
    fy,
    manpowerGoal,
    manpowerActual,
    empty: rows.every((r) => !r.hasData),
  };
}

// ── Org Structure (deck §05) ─────────────────────────────────────────────────
export function assembleOrgStructure({ branchUsers, ytdSubmissions, policies, year, settledByAgent = {} }) {
  const fy = yearWindow(year);
  const users = branchUsers || [];
  const netOf = (id) => settledByAgent?.[id]?.net?.api ?? null;
  const { units, adminCount, unitCount } = groupByUnit(users);

  const unitIds = new Set(units.map((u) => u.unitId));
  const author = users.find((u) => u.role === 'branch_manager') || null;
  const admins = users
    .filter((u) => !PRODUCING_ROLES.has(u.role) && u.role !== 'branch_manager' && !unitIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.name ?? u.displayName ?? u.email ?? u.id, title: displayTitle(u) }));
  const newContracts = users
    .filter((u) => PRODUCING_ROLES.has(u.role) && typeof u.contractStartDate === 'string' && u.contractStartDate.slice(0, 4) === String(year))
    .map((u) => u.name ?? u.displayName ?? u.id);

  const enriched = units.map((unit) => {
    const memberIds = new Set([unit.unitId, ...unit.advisors.map((a) => a.id)]);
    const subs = (ytdSubmissions || []).filter((s) => memberIds.has(subId(s)));
    const unitPolicies = (policies || []).filter((p) => memberIds.has(p.agentId));
    const prod = sumProductionWindow(subs, fy);
    const settled = periodSettlement(unitPolicies, fy);
    return {
      unitId: unit.unitId,
      unitName: unit.unitName,
      headName: unit.headName,
      headTitle: unit.headTitle,
      headExperienceYears: unit.head ? experienceYears(unit.head.contractStartDate) : null,
      headNetApi: unit.head ? netOf(unit.head.id) : null,
      advisorCount: unit.advisorCount,
      advisors: unit.advisors.map((a) => ({
        id: a.id,
        name: a.name ?? a.displayName ?? a.email ?? a.id,
        title: displayTitle(a),
        contractYear: typeof a.contractStartDate === 'string' ? a.contractStartDate.slice(0, 4) : null,
        experienceYears: experienceYears(a.contractStartDate),
        netApi: netOf(a.id),
      })),
      ytdNetApi: settled.net.api,
      ytdNetApps: settled.net.apps,
      ytdSubmittedApi: prod.api,
    };
  }).sort((a, b) => b.ytdNetApi - a.ytdNetApi);

  const licensedAdvisors = enriched.reduce((s, u) => s + u.advisorCount, 0);
  return {
    units: enriched,
    author: author ? { name: author.name ?? author.displayName ?? author.id, title: displayTitle(author) } : null,
    admins,
    newContracts,
    adminCount,
    unitCount,
    licensedAdvisors,
    empty: unitCount === 0,
  };
}

// ── Recruitment Pipeline (deck §06) ──────────────────────────────────────────
export function assembleRecruitment({ candidates }) {
  const all = candidates || [];
  const active = all.filter((c) => c.status !== 'archived');
  const byStage = STAGE_KEYS.map((key) => ({
    key,
    label: RECRUITING_STAGES.find((s) => s.key === key)?.label ?? key,
    count: active.filter((c) => c.stage === key).length,
  }));
  const hired = active.filter((c) => c.stage === 'licensed').length;
  const sourcedTotal = active.length + hired; // rough sourced-to-date proxy
  const rows = active.map((c) => ({
    id: c.id,
    name: c.name,
    source: c.source ?? '',
    ownerName: c.ownerName ?? '',
    unitName: c.unitName ?? '',
    note: c.note ?? '',
    stage: c.stage,
    stageIndex: stageIndex(c.stage),
    completePct: Math.round(((stageIndex(c.stage) + 1) / STAGE_KEYS.length) * 100),
    hired: c.stage === 'licensed',
  })).sort((a, b) => b.stageIndex - a.stageIndex);
  const next = rows.find((r) => !r.hired) ?? null;
  return {
    byStage,
    hired,
    total: active.length,
    conversionPct: sourcedTotal > 0 ? (hired / sourcedTotal) * 100 : null,
    nextMilestone: next ? { name: next.name, note: next.note, stage: next.stage } : null,
    rows,
    empty: active.length === 0,
  };
}
