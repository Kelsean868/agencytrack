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
//
// ABSTENTION RULE (see pass 3 in buildStatusMap): 'ontrack' is the only band
// that makes a POSITIVE claim — "nothing is wrong with this agent". Every other
// band reports something observed. So 'ontrack' requires BOTH gates to have
// actually been evaluated: an agent with no usable persistency reading is
// banded STATUS_NODATA_KEY ('nodata') rather than asserted healthy.
// A surface that abstains is safe; a surface that says "On track" over a
// missing reading is a lie a manager will act on.
//
// 'nodata' is a DATA-AVAILABILITY state, not a sixth verdict. It is a named key
// (not an absence) so the sheet can render and filter it — see its declaration
// for why silent absence would read as a broken surface.

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

// The abstention state. NOT part of the mockup's six-band vocabulary — it is a
// data-availability state, not a performance verdict, and it is deliberately
// worded to say so. An agent lands here when the derivation RAN but had no
// usable persistency reading for them, so 'ontrack' could not be honestly
// asserted (see the abstention rule below).
//
// It is a real key rather than an absence so the surface can SHOW it: a manager
// seeing rows that match no band would read the sheet as broken, and the
// actionable fact — "these agents have no persistency on file, go enter it" —
// would be invisible. Abstention should inform, not look like a gap.
export const STATUS_NODATA_KEY = 'nodata';
export const STATUS_NODATA_LABEL = 'No persistency data';

export const FUNNEL_STATUS_KEYS = [
  ...FUNNEL_STATUS_OPTS.map(([k]) => k),
  STATUS_NODATA_KEY,
];

// ── Row-reachability: why the Master Sheet offers FIVE of the six ───────────
// The Master Sheet is a FILERS-ONLY table — a row exists only for an agent with
// a submission in the selected week (`getWeeklySubmissions`). `funnelFilters.js`
// records the same constraint for the report family ("Missing" is not a row
// here, it is a reality-bar number).
//
// 'quiet' is defined below as `deriveExceptions`' "No reports" — an agent with
// ZERO submissions this year. An agent who filed the selected week necessarily
// has ≥1 submission this year, so a row-holding agent is essentially never
// 'quiet'. Offering the chip anyway would ship a control that always returns an
// empty table — a lying filter, worse than an absent one. (This was caught in
// review on the PR that introduced it; see the CodeRabbit thread.)
//
// So the chip is OMITTED from this surface, exactly as LEVEL and "Missing" are,
// and for the same reason: the row set cannot hold the value. `FUNNEL_STATUS_OPTS`
// keeps the full mockup vocabulary — `exceptionToStatusKey`'s mapping is correct
// and stays intact; it is the SURFACE that cannot express it.
//
// ⚠ OPEN QUESTION FOR THE OPERATOR (do not resolve autonomously): making
// "Gone quiet" meaningful here requires EITHER (a) rendering non-filers as rows
// — a different table, not a filter change — OR (b) redefining it as a recency
// signal ("filed, but not for N weeks"), which needs an N nobody has ruled on.
// Both are out of scope for the read-path work this module was built for.
export const ROW_REACHABLE_STATUS_KEYS = Object.freeze([
  'ontrack', 'pace', 'report', 'persistency', 'floor', STATUS_NODATA_KEY,
]);

// 'nodata' is appended LAST and carries its own label — it is offered as a real
// chip so an operator can pull up exactly the agents whose persistency is
// missing. Rendering should treat it as informational (muted), not as a
// severity band alongside the five verdicts.
export const ROW_REACHABLE_STATUS_OPTS = [
  ...FUNNEL_STATUS_OPTS.filter(([k]) => ROW_REACHABLE_STATUS_KEYS.includes(k)),
  [STATUS_NODATA_KEY, STATUS_NODATA_LABEL],
];

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

  // Every scoped agent starts 'ontrack'; the passes below demote. This is
  // PROVISIONAL — pass 3 revokes it for any agent whose clean bill of health
  // is not actually evidenced.
  for (const u of users ?? []) {
    if (u?.role !== 'agent') continue;
    if (scopeIds && !scopeIds.has(u.id)) continue;
    map[u.id] = 'ontrack';
  }

  // Pass 1 — persistency (lowest priority, so it is applied first and any
  // production band below overwrites it). Also records WHICH agents we hold a
  // usable persistency reading for; pass 3 needs that to tell "measured and
  // fine" apart from "never measured".
  const hasPersReading = new Set();
  if (persistencyByAgent) {
    for (const id of Object.keys(map)) {
      const p = latestPersistency(persistencyByAgent[id]);
      if (p === null) continue;
      hasPersReading.add(id);
      if (p < PERS_FLOOR) map[id] = 'persistency';
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

  // Pass 3 — ABSTAIN rather than assert unevidenced health.
  //
  // 'ontrack' is the only band that is a positive claim about an agent nothing
  // flagged. Reaching it requires clearing BOTH gates, so it may only be
  // asserted when both were actually evaluated. If the persistency read failed
  // (or returned nothing for this agent), the agent is re-banded to the
  // explicit STATUS_NODATA_KEY state instead — never 'ontrack'.
  //
  // It becomes a NAMED state rather than a deletion so the surface can show it.
  // Dropping the key would leave the row matching no chip at all, which reads
  // as a broken sheet and hides the actionable fact ("no persistency on file
  // for these agents"). Abstention should inform, not look like a gap.
  //
  // A band assigned by pass 1 or pass 2 is untouched: those are evidenced
  // findings and stay valid regardless of what else was unavailable. The
  // failure mode being designed against is a below-floor agent silently
  // reading "On track" because the persistency arm never ran.
  for (const id of Object.keys(map)) {
    if (map[id] === 'ontrack' && !hasPersReading.has(id)) map[id] = STATUS_NODATA_KEY;
  }

  return map;
}
