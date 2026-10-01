'use strict';

// FR Leaderboard L-1 — the three board metrics, per agent, per period.
// Pure logic: no firebase-admin, no Firestore. The aggregate CF
// (leaderboardAggregate.js) loads the inputs and calls these.
//
//   periodApi  (API board)       — settled API from the policy ledger (D2)
//   apps       (Apps board)      — applications from the policy ledger (D3)
//   points     (Activity board)  — points from logged activity (D5, ruling below)
//
// D2/D3: one entry per Life policy that is settled (or confirmed) with a
// readable `dateIssued` — the client's own `settledCreditList`, through the CJS
// twin (functions/lib/ledgerCredit.js). A policy counts in a period when its
// `dateIssued` (YYYY-MM-DD) falls inside the period's TT date window. Head-office
// imports, manager-confirmed and agent-confirmed policies all count.
// D4: self/family policies (`isSelfOrFamily === true`) are left out of both.
//
// D5 — DISPATCHER RULING (Kyron, 1 Oct 2026, option A): a week with a SUBMITTED
// report scores computePoints(report); any other week scores the sum of
// computeDayPoints over that week's daily entries. Drafts are never read (the
// Sunday cron's draft is written once at Sun 23:00 TT and goes stale when a day
// is edited later). A week is placed in a period by its `weekStarting`; weeks
// are not split.
//
// Ranking (D7): one ranker for every board. Order = the board's metric desc,
// then the remaining metrics in the fixed order periodApi → apps → points
// (desc), then name, then agentId. For the API board this is today's order
// (API, apps, name) with points inserted before the name.

const { getPeriodBoundaries } = require('./rankingLogic');
const { settledCreditList } = require('../lib/ledgerCredit');
const { computePoints } = require('../lib/computePoints');
const { computeDayPoints } = require('../lib/dayPoints');

const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Board id → entry field. The previousRanks keys use the board ids. */
const BOARD_METRIC = Object.freeze({ activity: 'points', api: 'periodApi', apps: 'apps' });
const TIE_ORDER = Object.freeze(['periodApi', 'apps', 'points']);

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/** The TT calendar date ('YYYY-MM-DD') of a UTC instant. */
function ttDateString(instant) {
  return ymd(new Date(instant.getTime() - TRINI_OFFSET_MS));
}

/** A period as an inclusive TT date window: { from, to } ('YYYY-MM-DD'). */
function periodWindow(period, referenceDate) {
  const { start, end } = getPeriodBoundaries(period, referenceDate);
  return { from: ttDateString(start), to: ttDateString(end) };
}

function inWindow(dateStr, window) {
  return typeof dateStr === 'string' && dateStr >= window.from && dateStr <= window.to;
}

/** Every Sunday ('YYYY-MM-DD') from the first one on/after `fromStr` to `toSunday`. */
function sundaysBetween(fromStr, toSunday) {
  const out = [];
  const d = new Date(`${fromStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  for (; ymd(d) <= toSunday; d.setUTCDate(d.getUTCDate() + 7)) out.push(ymd(d));
  return out;
}

const subAgentId = (s) => (s && (s.agentId || s.userId)) || null;

// ── D2–D4: ledger credits per agent ──────────────────────────────────────────

/** Map<agentId, [{ issued, api, apps }]> — settled Life policies, self/family left out. */
function ledgerCreditsByAgent(policies) {
  const byAgent = new Map();
  for (const row of settledCreditList(policies)) {
    if (row.policy.isSelfOrFamily === true) continue;
    const agentId = row.policy.agentId;
    if (!agentId) continue;
    if (!byAgent.has(agentId)) byAgent.set(agentId, []);
    byAgent.get(agentId).push({
      issued: row.issued,
      api: Number(row.credit.api) || 0,
      apps: Number(row.credit.apps) || 0,
    });
  }
  return byAgent;
}

// ── D5: points per agent per week ────────────────────────────────────────────

/** Map<agentId, Set<weekStarting>> of weeks that have a SUBMITTED report. */
function submittedWeeksByAgent(submissions) {
  const byAgent = new Map();
  for (const s of Array.isArray(submissions) ? submissions : []) {
    if (!s || s.status !== 'submitted' || typeof s.weekStarting !== 'string') continue;
    const agentId = subAgentId(s);
    if (!agentId) continue;
    if (!byAgent.has(agentId)) byAgent.set(agentId, new Set());
    byAgent.get(agentId).add(s.weekStarting);
  }
  return byAgent;
}

/**
 * Map<agentId, Map<weekStarting, points>> under the D5 ruling.
 * `dailiesByAgent`: Map<agentId, dailyActivity docs>. Days in a week that has a
 * submitted report are ignored even if they were loaded.
 */
function weekPointsByAgent(submissions, dailiesByAgent) {
  const out = new Map();
  const add = (agentId, ws, pts) => {
    if (!out.has(agentId)) out.set(agentId, new Map());
    const weeks = out.get(agentId);
    weeks.set(ws, (weeks.get(ws) || 0) + pts);
  };

  const submitted = submittedWeeksByAgent(submissions);
  for (const s of Array.isArray(submissions) ? submissions : []) {
    if (!s || s.status !== 'submitted' || typeof s.weekStarting !== 'string') continue;
    const agentId = subAgentId(s);
    if (!agentId) continue;
    add(agentId, s.weekStarting, computePoints(s));
  }

  const dailies = dailiesByAgent instanceof Map ? dailiesByAgent : new Map();
  for (const [agentId, days] of dailies.entries()) {
    const reported = submitted.get(agentId) || new Set();
    for (const day of Array.isArray(days) ? days : []) {
      const ws = day && day.weekStarting;
      if (typeof ws !== 'string' || reported.has(ws)) continue;
      add(agentId, ws, computeDayPoints(day));
    }
  }
  return out;
}

// ── Per-agent metrics in one window ──────────────────────────────────────────

function metricsFor(agentId, window, ctx) {
  let api = 0;
  let apps = 0;
  for (const c of ctx.creditsByAgent.get(agentId) || []) {
    if (!inWindow(c.issued, window)) continue;
    api += c.api;
    apps += c.apps;
  }
  let points = 0;
  for (const [ws, pts] of (ctx.weekPointsByAgent.get(agentId) || new Map()).entries()) {
    if (inWindow(ws, window)) points += pts;
  }
  return { periodApi: cents(api), apps, points };
}

// ── Ranking (D7) ─────────────────────────────────────────────────────────────

/** Rows sorted for one board's metric (new array; rows are not changed). */
function sortByMetric(rows, metric) {
  const order = [metric, ...TIE_ORDER.filter((m) => m !== metric)];
  return [...rows].sort((a, b) => {
    for (const m of order) {
      const diff = (Number(b[m]) || 0) - (Number(a[m]) || 0);
      if (diff !== 0) return diff;
    }
    const byName = String(a.name).localeCompare(String(b.name));
    if (byName !== 0) return byName;
    return String(a.agentId).localeCompare(String(b.agentId));
  });
}

/** Map<agentId, rank> for one board's metric. */
function ranksByMetric(rows, metric) {
  const ranks = new Map();
  sortByMetric(rows, metric).forEach((r, i) => ranks.set(r.agentId, i + 1));
  return ranks;
}

const displayName = (u) => u.name || u.email || u.id;

function metricRows(users, window, ctx) {
  return users.map((u) => ({
    agentId: u.id,
    name: displayName(u),
    unitId: u.unitId == null ? null : u.unitId,
    ...metricsFor(u.id, window, ctx),
  }));
}

/** Map<agentId, { activity, api, apps }> — the prior week's branch ranks per board. */
function priorRanksForBranch(branchUsers, priorReferenceDate, ctx) {
  const rows = metricRows(branchUsers, periodWindow('week', priorReferenceDate), ctx);
  const perBoard = Object.fromEntries(
    Object.entries(BOARD_METRIC).map(([board, metric]) => [board, ranksByMetric(rows, metric)])
  );
  const out = new Map();
  for (const r of rows) {
    out.set(r.agentId, {
      activity: perBoard.activity.get(r.agentId),
      api: perBoard.api.get(r.agentId),
      apps: perBoard.apps.get(r.agentId),
    });
  }
  return out;
}

/**
 * One period's entries for one branch, ordered by the API board (the stored
 * `rank` / `rankWithinUnit` stay API-based for the Nexus surface, D7).
 */
function periodEntries(branchUsers, period, referenceDate, ctx, unitNameByMgrUid, priorRanks) {
  const rows = metricRows(branchUsers, periodWindow(period, referenceDate), ctx);
  const ranked = sortByMetric(rows, 'periodApi');
  const withinUnit = new Map();
  const isWeek = period === 'week';
  return ranked.map((r, i) => {
    const unitKey = r.unitId == null ? 'none' : r.unitId;
    const rankWithinUnit = (withinUnit.get(unitKey) || 0) + 1;
    withinUnit.set(unitKey, rankWithinUnit);
    const prev = isWeek ? (priorRanks.get(r.agentId) || null) : null;
    return {
      agentId: r.agentId,
      name: r.name,
      unitId: r.unitId,
      unitName: r.unitId ? (unitNameByMgrUid[r.unitId] || null) : null,
      periodApi: r.periodApi,
      apps: r.apps,
      points: r.points,
      rank: i + 1,
      rankWithinUnit,
      previousRank: prev ? prev.api : null,
      previousRanks: prev,
    };
  });
}

// ── D9: tenant-wide champions for the prior week ─────────────────────────────

function isChampionCandidate(u) {
  return !!u && u.role === 'agent' && u.provisioning !== true
    && u.isTestAccount !== true && u.active !== false;
}

function weeklyChampions(users, priorReferenceDate, ctx, weekStarting) {
  const window = periodWindow('week', priorReferenceDate);
  const rows = metricRows((users || []).filter(isChampionCandidate), window, ctx);
  const pickTop = (metric) => {
    let best = null;
    for (const r of rows) {
      const value = r[metric];
      if (!(value > 0)) continue;
      if (best === null || value > best.value
        || (value === best.value && r.name.localeCompare(best.agentName) < 0)) {
        best = { agentId: r.agentId, agentName: r.name, value };
      }
    }
    return best;
  };
  return {
    topAPI: pickTop('periodApi'),
    topApps: pickTop('apps'),
    topActivity: pickTop('points'),
    weekStarting,
  };
}

module.exports = {
  BOARD_METRIC,
  TIE_ORDER,
  periodWindow,
  sundaysBetween,
  ledgerCreditsByAgent,
  submittedWeeksByAgent,
  weekPointsByAgent,
  metricsFor,
  sortByMetric,
  ranksByMetric,
  priorRanksForBranch,
  periodEntries,
  isChampionCandidate,
  weeklyChampions,
};
