// Track K — Strategic Plan · model assembly (pure). THE single math path.
//
// The hook fetches; this module derives every number. Dashboard, presentation
// mode, and PDF all read the assembled model — numbers can never disagree across
// render targets. No re-derivation is permitted in any component.

import { aggregatePersistency } from '../persistency/calculations';
import { RECRUITING_STAGES, STAGE_KEYS, stageIndex } from '../../services/recruitingService';
import {
  yearWindow, periodWindows, sumProductionWindow, prorateQuota,
  periodElapsedFraction, monthsElapsedInYear,
} from './periodModel';
import { periodSettlement } from './settledTwinRun';
import { groupByUnit, displayTitle, experienceYears } from './unitGrouping';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const subId = (s) => s.agentId ?? s.userId ?? null;

// Latest-month persistency % (0–100) from an agent's E3 record list. Records
// store persistency as a decimal 0–1 (calculations.js) → ×100 here. null when
// no record.
function latestPersistencyPct(records) {
  if (!records || !records.length) return null;
  const latest = [...records].sort(
    (a, b) => String(a.monthKey).localeCompare(String(b.monthKey)),
  ).at(-1);
  const p = latest?.persistency;
  return typeof p === 'number' ? p * 100 : null;
}

// ── Agent Performance Tracker (deck p5) ─────────────────────────────────────
// Annual (full plan year) figures per producing advisor vs the advisor's annual
// quota. The period granularity toggle drives Period Metrics + Production, NOT
// this tracker (an "Agency Strategic Plan" tracker reads year-to-date).
// % Objective Achieved = calendar-year NET settled ÷ annual quota (RULING 2).
export function assembleAgentTrackerRows({
  roster, ytdSubmissions, settledByAgent, persistencyByAgent, goalsByAgent, year,
}) {
  const fy = yearWindow(year);
  return (roster || []).map((u) => {
    const subs = (ytdSubmissions || []).filter((s) => subId(s) === u.id);
    const prod = sumProductionWindow(subs, fy);
    const settled = settledByAgent?.[u.id] ?? { net: { api: 0, apps: 0 }, gross: { api: 0, apps: 0 } };
    const goals = goalsByAgent?.[u.id] ?? null;
    const apiQuota = goals ? (num(goals.personalAnnualAPI) || num(goals.targetAnnualAPI) || null) : null;
    const appQuota = goals ? (num(goals.personalAnnualApps) || num(goals.targetAnnualApps) || null) : null;
    const persistencyPct = latestPersistencyPct(persistencyByAgent?.[u.id]);
    return {
      id: u.id,
      name: u.name ?? u.displayName ?? u.email ?? u.id,
      title: displayTitle(u),
      role: u.role,
      isUnitHead: u.role === 'unit_manager',
      experienceYears: experienceYears(u.contractStartDate),
      calls: prod.calls,
      contacts: prod.contacts,
      factFinds: prod.factFinds,
      closingInterviews: prod.closingInterviews,
      persistencyPct,
      apiQuota,
      appQuota,
      apiSubmitted: prod.api,
      apiGrossSettled: settled.gross.api,
      apiNetSettled: settled.net.api,
      appSubmitted: prod.apps,
      appGrossSettled: settled.gross.apps,
      appNetSettled: settled.net.apps,
      apiPctObj: apiQuota ? (settled.net.api / apiQuota) * 100 : null,
      appPctObj: appQuota ? (settled.net.apps / appQuota) * 100 : null,
    };
  }).sort((a, b) => b.apiNetSettled - a.apiNetSettled);
}

// Branch persistency % (0–100) via aggregatePersistency — sum numerators /
// denominators, NEVER average percentages (RULING 1). Feeds it the latest record
// per agent. null when no records.
function branchPersistencyPct(persistencyByAgent) {
  const latest = Object.values(persistencyByAgent || {})
    .map((records) => {
      if (!records || !records.length) return null;
      return [...records].sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey))).at(-1);
    })
    .filter(Boolean);
  if (!latest.length) return null;
  const agg = aggregatePersistency(latest);
  if (!(agg.sumGrossSettled > 0)) return null;
  return agg.aggregatedPersistency * 100;
}

// ── Production Summary (deck p9) ─────────────────────────────────────────────
export function assembleProductionSummary({
  ytdSubmissions, policies, branchGoals, persistencyByAgent, year, now = new Date(),
}) {
  const fy = yearWindow(year);
  const prod = sumProductionWindow(ytdSubmissions, fy);
  const settled = periodSettlement(policies, fy); // { net, gross } full-year
  const annualApiQuota = branchGoals ? num(branchGoals.api) || null : null;
  const annualAppQuota = branchGoals ? num(branchGoals.apps) || null : null;

  // Monthly table — quota prorated ÷ 12; avg monthly production = net ÷ months elapsed.
  const monthsElapsed = monthsElapsedInYear(year, now);
  const monthlyApiQuota = annualApiQuota != null ? annualApiQuota / 12 : null;
  const avgMonthlyApi = monthsElapsed > 0 ? settled.net.api / monthsElapsed : null;

  // Annual table — run-rate EOY projection (§3 decision 6): actual ÷ elapsedFraction.
  const frac = periodElapsedFraction(fy, now);
  const projectedApi = frac > 0 ? settled.net.api / frac : null;
  const projectedApp = frac > 0 ? settled.net.apps / frac : null;

  return {
    monthly: {
      apiQuota: monthlyApiQuota,          // labeled "prorated" in the UI
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
    },
    persistency: {
      currentPct: branchPersistencyPct(persistencyByAgent),
      eoyPct: null, // Phase 1: current only — projectPersistency is a what-if lever tool (§3 decision 6)
    },
    empty: prod.count === 0 && settled.net.api === 0 && settled.gross.api === 0,
  };
}

// ── Period Metrics (deck p18) — quarter/half toggle ─────────────────────────
export function assemblePeriodMetrics({ ytdSubmissions, policies, branchGoals, roster, period }) {
  const windows = periodWindows(period);
  const annualApi = branchGoals ? num(branchGoals.api) || null : null;
  const annualApp = branchGoals ? num(branchGoals.apps) || null : null;
  const manpower = (roster || []).length; // current headcount (no historical snapshot in Phase 1)

  const rows = windows.map((w) => {
    const prod = sumProductionWindow(ytdSubmissions, w);
    const settled = periodSettlement(policies, w);
    const apiGoal = annualApi != null ? prorateQuota(annualApi, w.months) : null;
    const appGoal = annualApp != null ? prorateQuota(annualApp, w.months) : null;
    return {
      key: w.key,
      label: w.label,
      months: w.months,
      apiGoal,
      apiActual: settled.net.api,
      apiVariance: apiGoal != null ? settled.net.api - apiGoal : null,
      appGoal,
      appActual: settled.net.apps,
      appVariance: appGoal != null ? settled.net.apps - appGoal : null,
      manpowerActual: manpower,
      hasData: prod.count > 0 || settled.net.api > 0 || settled.gross.api > 0,
    };
  });

  return { granularity: period.granularity, rows, empty: rows.every((r) => !r.hasData) };
}

// ── Org Structure (deck p8/14–17) ────────────────────────────────────────────
export function assembleOrgStructure({ branchUsers, ytdSubmissions, policies, year }) {
  const fy = yearWindow(year);
  const { units, adminCount, unitCount } = groupByUnit(branchUsers);

  const enriched = units.map((unit) => {
    // Members whose production rolls up to this unit = the head (a producing UM)
    // + the unit's agents.
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
      advisorCount: unit.advisorCount,
      advisors: unit.advisors.map((a) => ({
        id: a.id,
        name: a.name ?? a.displayName ?? a.email ?? a.id,
        title: displayTitle(a),
        experienceYears: experienceYears(a.contractStartDate),
      })),
      ytdNetApi: settled.net.api,
      ytdNetApps: settled.net.apps,
      ytdSubmittedApi: prod.api,
    };
  }).sort((a, b) => b.ytdNetApi - a.ytdNetApi);

  return { units: enriched, adminCount, unitCount, empty: unitCount === 0 };
}

// ── Recruitment Pipeline (deck p6–7) ─────────────────────────────────────────
export function assembleRecruitment({ candidates }) {
  const active = (candidates || []).filter((c) => c.status !== 'archived');
  const byStage = STAGE_KEYS.map((key) => ({
    key,
    label: RECRUITING_STAGES.find((s) => s.key === key)?.label ?? key,
    count: active.filter((c) => c.stage === key).length,
  }));
  const hired = active.filter((c) => c.stage === 'licensed').length;
  const rows = active.map((c) => ({
    id: c.id,
    name: c.name,
    source: c.source ?? '',
    ownerName: c.ownerName ?? '',
    stage: c.stage,
    stageIndex: stageIndex(c.stage),
    hired: c.stage === 'licensed',
  })).sort((a, b) => b.stageIndex - a.stageIndex);
  return { byStage, hired, total: active.length, rows, empty: active.length === 0 };
}
