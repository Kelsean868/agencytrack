// managerExceptions — pure exception-derivation engine for the Team Dashboard
// (Fable Tier 1 · 1.5 exception-first lead).
//
// The single source of truth for "which agents need attention" on the manager
// overview. Every displayed number flows through the SAME canonical helpers the
// rest of the app uses — no second math path:
//   • extractTotalProductionCredit — per-submission API / production credit
//   • resolveAnnualAPIFloor        — tenure-band annual floor from contractStartDate
//   • formatCurrency / initials    — house display formatters
//
// Read-light: consumes ONLY data useBranchOverview already loads on mount
// (ytdSubs + users + companyMinimums). No new fetch paths. Persistency- and
// daily-activity-based exceptions are intentionally NOT derived here — that data
// is not loaded on the overview (see the drill drawer + SKIP-AND-LOG notes).
//
// All three exception classes are derived from submission history + the tenure
// floor + the calendar, so they are honest and deterministic:
//   • 'floor'  (danger)  — critically behind the pace needed to clear the annual
//                          tenure floor by year-end (< 50% of pro-rata pace)
//   • 'pace'   (warning) — behind pace but not critically (< 85% of pro-rata)
//   • 'report' (warning) — an active filer missed the most recent branch week,
//                          or has filed no reports at all this year

import { extractTotalProductionCredit } from './extractFields';
import { resolveAnnualAPIFloor } from './tenureFloors';
import { formatCurrency, initials } from './formatters';

// Pace thresholds against the pro-rata annual-floor pace. Named so tests and
// future config can reference them; not yet operator-tunable (derivable-subset
// per the brief — a tunable threshold would be a product-ambiguous config).
export const FLOOR_PACE_DANGER = 0.5;
export const FLOOR_PACE_WARN = 0.85;

// Fraction of the calendar year elapsed (0..1), UTC-stable. Used to pro-rate the
// annual tenure floor into an "expected by now" pace target.
export function yearFraction(now = new Date()) {
  const y = now.getFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  const cur = Date.UTC(y, now.getMonth(), now.getDate());
  const f = (cur - start) / (end - start);
  return Math.min(1, Math.max(0, f));
}

function displayName(u) {
  return u?.name ?? u?.displayName ?? u?.email ?? 'Agent';
}

/**
 * Derive the ordered exception list for the manager overview.
 *
 * @param {object}  opts
 * @param {Array}   opts.users        tenant user docs (agents + managers)
 * @param {Array}   opts.subs         YTD submission docs (any schema variant)
 * @param {object}  opts.companyMins  config/companyMinimums (tenureApiFloors)
 * @param {Set}     [opts.scopeIds]   agent ids in the manager's scope; null = all agents
 * @param {Date}    [opts.now]
 * @returns {Array} exception cards, most-urgent first
 */
export function deriveExceptions({ users = [], subs = [], companyMins = null, scopeIds = null, now = new Date() } = {}) {
  const year = String(now.getFullYear());
  const frac = yearFraction(now);
  const tenureApiFloors = companyMins?.tenureApiFloors ?? undefined;

  const agents = (users ?? []).filter(
    (u) => u?.role === 'agent' && (!scopeIds || scopeIds.has(u.id))
  );

  // Bucket submissions by agent id (agentId, userId fallback).
  const byAgent = new Map();
  for (const s of subs ?? []) {
    const aid = s?.agentId ?? s?.userId ?? '';
    if (!aid) continue;
    if (!byAgent.has(aid)) byAgent.set(aid, []);
    byAgent.get(aid).push(s);
  }

  // Latest week any scoped agent has filed — the "expected" week for report-late.
  let latestWeek = '';
  for (const a of agents) {
    for (const s of byAgent.get(a.id) ?? []) {
      const w = s?.weekStarting ?? '';
      if (w > latestWeek) latestWeek = w;
    }
  }

  const exceptions = [];

  for (const a of agents) {
    const agentSubs = (byAgent.get(a.id) ?? []).filter((s) => (s?.weekStarting ?? '').startsWith(year));
    // YTD API — matches the team-total math in useBranchOverview (no status filter).
    const ytdApi = agentSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0);
    const floor = resolveAnnualAPIFloor({ contractStartDate: a.contractStartDate, tenureApiFloors, now });
    const expectedByNow = floor * frac;

    const sortedWeeks = [...agentSubs].sort(
      (x, y) => (x.weekStarting ?? '').localeCompare(y.weekStarting ?? '')
    );
    const spark = sortedWeeks.slice(-6).map((s) => extractTotalProductionCredit(s));
    const lastFiledWeek = sortedWeeks.length ? sortedWeeks[sortedWeeks.length - 1].weekStarting : null;

    const base = {
      id: a.id,
      agentId: a.id,
      name: displayName(a),
      unitId: a.unitId ?? null,
      initials: initials(displayName(a)),
      contractStartDate: a.contractStartDate ?? null,
      ytdApi,
      floor,
      expectedByNow,
      spark,
    };

    // 1 + 2 — pace vs the pro-rata annual floor. Only for agents who have filed
    // at least once this year (an agent with zero YTD subs is a report gap, not a
    // pace signal — handled below to avoid double-flagging).
    if (agentSubs.length >= 1 && expectedByNow > 0) {
      const ratio = ytdApi / expectedByNow;
      const pctOfPace = Math.round(ratio * 100);
      if (ratio < FLOOR_PACE_DANGER) {
        exceptions.push({
          ...base,
          type: 'floor', kind: 'Below floor', tone: 'danger',
          severity: 200 + (1 - Math.min(1, ratio)) * 100,
          detail: `${formatCurrency(ytdApi)} YTD · ${formatCurrency(Math.max(0, expectedByNow - ytdApi))} behind floor pace`,
          meta: `Floor ${formatCurrency(floor)} · ${pctOfPace}% of expected pace`,
        });
        continue;
      }
      if (ratio < FLOOR_PACE_WARN) {
        exceptions.push({
          ...base,
          type: 'pace', kind: 'Off pace', tone: 'warning',
          severity: 100 + (1 - ratio) * 40,
          detail: `${formatCurrency(ytdApi)} YTD · pace target ${formatCurrency(expectedByNow)}`,
          meta: `Floor ${formatCurrency(floor)} · ${pctOfPace}% of expected pace`,
        });
        continue;
      }
    }

    // 3 — report gaps. An established filer who missed the latest branch week, or
    // an agent who has filed nothing this year while the branch has (latestWeek set).
    if (latestWeek) {
      if (agentSubs.length === 0) {
        exceptions.push({
          ...base,
          type: 'report', kind: 'No reports', tone: 'warning',
          severity: 60,
          detail: 'No weekly reports submitted this year',
          meta: 'Never filed',
        });
        continue;
      }
      const filedLatest = agentSubs.some((s) => (s?.weekStarting ?? '') === latestWeek);
      if (!filedLatest) {
        exceptions.push({
          ...base,
          type: 'report', kind: 'Report late', tone: 'warning',
          severity: 55,
          detail: `No report for week of ${latestWeek}`,
          meta: lastFiledWeek ? `Last filed week of ${lastFiledWeek}` : 'On pace otherwise',
        });
        continue;
      }
    }
  }

  exceptions.sort((x, y) => y.severity - x.severity);
  return exceptions;
}
