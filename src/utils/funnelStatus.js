// Master Sheet — FUNNEL STATUS band derivation. Pure, framework-free.
//
// Closes the deliberate deferral recorded in `funnelFilters.js` (the STATUS
// chips were omitted because the sheet was a single-week, read-light surface).
// MasterSheet now loads YTD submissions + companyMinimums + persistency, so the
// six-band taxonomy the mockup names is honestly derivable per row.
//
// DESIGN AUTHORITY for the chip keys + labels:
//   docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner/
//     mockups/mastersheet-funnel-scenes.jsx  →  FUNNEL_STATUS_OPTS
// The mockup is presentational (its rows carry a hardcoded `flag`); it defines
// the vocabulary, not the derivation. The derivation below therefore reuses the
// app's ALREADY-SHIPPED engines rather than inventing a second math path:
//
//   • `deriveExceptions` (utils/managerExceptions.js) — the single source of
//     truth for "which agents need attention". It already produces, in this
//     exact severity order, the four production bands:
//         type 'floor'  kind 'Below floor'  → 'floor'
//         type 'pace'   kind 'Off pace'     → 'pace'
//         type 'report' kind 'No reports'   → 'quiet'
//         type 'report' kind 'Report late'  → 'report'
//     It is mutually exclusive per agent (each arm `continue`s), and its pace
//     bands are pro-rated against `resolveAnnualAPIFloor` — the tenure floor
//     the STATUS chips require. Nothing here re-ranks or re-implements it.
//   • `PERS_FLOOR` (lib/persistency/calculations.js) — the canonical 0.80
//     below-floor persistency threshold. Persistency is a DECIMAL in [0,1+],
//     never a percentage (see that module's header).
//
// SEMANTIC JUDGEMENT — the one mapping choice made here, flagged for review:
// the mockup's "Gone quiet" has no in-repo derivation. `MeetingMode.helpers.js`
// glosses it as "daily-recency" but explicitly declines to derive it. Rather
// than invent a recency threshold, 'quiet' is mapped to `deriveExceptions`'
// existing "No reports" kind — an agent who has filed NOTHING all year while
// the branch has been filing. That is the quietest honest signal available, it
// invents no constant, and it preserves the shipped severity ordering (the
// engine already ranks "No reports" 60 above "Report late" 55).
//
// Bands are mutually exclusive and priority-ordered:
//   floor > pace > quiet > report > persistency > ontrack
// Production bands come first and keep `deriveExceptions`' own ordering
// verbatim; persistency is a lagging quality signal applied only to an agent
// who is otherwise production-clean. 'ontrack' is the residue — and it is
// assigned ONLY when the derivation actually ran (see `statusAvailable`).

import { deriveExceptions } from './managerExceptions';
import { PERS_FLOOR } from '../lib/persistency/calculations';

// Chip vocabulary — keys + labels ported verbatim from the mockup's
// FUNNEL_STATUS_OPTS. Order is the mockup's order (display), NOT the
// priority order (derivation) documented above.
export const FUNNEL_STATUS_OPTS = [
  ['ontrack', 'On track'],
  ['pace', 'Off pace'],
  ['quiet', 'Gone quiet'],
  ['report', 'Report late'],
  ['persistency', 'Pers. ↓'],
  ['floor', 'Below floor'],
];

export const FUNNEL_STATUS_KEYS = FUNNEL_STATUS_OPTS.map(([k]) => k);

// `deriveExceptions` result → status band key. Returns null for any shape this
// module does not claim (defensive: a future exception type must be mapped
// explicitly here rather than silently colouring rows).
export function exceptionToStatusKey(ex) {
  if (!ex) return null;
  if (ex.type === 'floor') return 'floor';
  if (ex.type === 'pace') return 'pace';
  if (ex.type === 'report') {
    if (ex.kind === 'No reports') return 'quiet';
    if (ex.kind === 'Report late') return 'report';
  }
  return null;
}

// Most recent E3 persistency record for one agent, as a decimal in [0,1+].
// Records are `{ year, month, persistency }` (persistencyService). Returns null
// when there is no usable record — an ABSENT reading is never a failing one.
//
// Takes the latest single month's stored value. It never averages percentages
// across months (see the anti-average warning in lib/persistency/calculations).
export function latestPersistency(records = []) {
  if (!Array.isArray(records) || records.length === 0) return null;
  let best = null;
  for (const r of records) {
    const y = Number(r?.year);
    const m = Number(r?.month);
    const p = Number(r?.persistency);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(p)) continue;
    const ord = y * 12 + m;
    if (best === null || ord > best.ord) best = { ord, persistency: p };
  }
  return best ? best.persistency : null;
}

/**
 * Build `{ agentId: statusKey }` for every scoped agent.
 *
 * @param {object} opts
 * @param {Array}  opts.users              tenant user docs (agents + managers)
 * @param {Array}  opts.ytdSubs            YTD submission docs
 * @param {object} [opts.companyMins]      config/companyMinimums (tenureApiFloors)
 * @param {object} [opts.persistencyByAgent] `{ agentId: [E3 record, ...] }`
 * @param {Set}    [opts.scopeIds]         agent ids in scope; null = all agents
 * @param {Date}   [opts.now]
 * @returns {object} agentId → one of FUNNEL_STATUS_KEYS
 */
export function buildStatusMap({
  users = [],
  ytdSubs = [],
  companyMins = null,
  persistencyByAgent = null,
  scopeIds = null,
  now = new Date(),
} = {}) {
  const map = {};

  // Every scoped agent starts 'ontrack'; the passes below demote.
  for (const u of users ?? []) {
    if (u?.role !== 'agent') continue;
    if (scopeIds && !scopeIds.has(u.id)) continue;
    map[u.id] = 'ontrack';
  }

  // Pass 1 — persistency (lowest priority, so it is applied first and any
  // production band below overwrites it).
  if (persistencyByAgent) {
    for (const id of Object.keys(map)) {
      const p = latestPersistency(persistencyByAgent[id]);
      if (p !== null && p < PERS_FLOOR) map[id] = 'persistency';
    }
  }

  // Pass 2 — production bands from the shipped exception engine. Its own
  // per-agent mutual exclusivity means at most one applies.
  const exceptions = deriveExceptions({
    users, subs: ytdSubs, companyMins, scopeIds, now,
  });
  for (const ex of exceptions) {
    const key = exceptionToStatusKey(ex);
    if (key && ex.agentId in map) map[ex.agentId] = key;
  }

  return map;
}
