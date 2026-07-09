// Meeting Mode v2 — pure derivation helpers.
//
// Every number the phased run-of-show deck projects is derived HONESTLY from
// data already available on the manager surface: this week's `submissions`
// (prop), the branch's YTD submissions, the tenant users, and the monthly
// persistency map. No fabricated demo data reaches the deck — a scene with no
// honest data source is dropped from MEETING_ORDER (see deriveDeck).
//
// Design intent: docs/design-system/screens-v2/meeting-v2-*.jsx (MEETING_ORDER,
// scene bodies). The mockup's hardcoded RUN/MEETING_SHEET/CHAMPS are looks-only.

import { extractFields, computeRatios } from '../../utils/extractFields';
import {
  DEFAULT_WEEKLY_ACTIVITY_FLOORS,
  deriveWeeklyFloorActuals,
} from '../../utils/weeklyActivityFloors';

// ── Small date utilities (weekStarting / contractStartDate are YYYY-MM-DD) ──

/** Parse a YYYY-MM-DD string to a UTC Date, or null when malformed. */
export function parseYMD(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map((p) => parseInt(p, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Format a UTC Date as YYYY-MM-DD. */
export function toYMD(dt) {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** The n most-recent Sunday weekStartings ending AT `selectedWeek` (oldest first). */
export function lastNWeekStartings(selectedWeek, n) {
  const end = parseYMD(selectedWeek);
  if (!end) return [];
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(end.getTime());
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(toYMD(d));
  }
  return out;
}

/** 1-based month of a YYYY-MM-DD week (0 when malformed). */
export function monthOf(weekStarting) {
  const d = parseYMD(weekStarting);
  return d ? d.getUTCMonth() + 1 : 0;
}
/** 1-based quarter (1..4) of a YYYY-MM-DD week (0 when malformed). */
export function quarterOf(weekStarting) {
  const m = monthOf(weekStarting);
  return m ? Math.floor((m - 1) / 3) + 1 : 0;
}
export function yearOf(weekStarting) {
  const d = parseYMD(weekStarting);
  return d ? d.getUTCFullYear() : 0;
}

// ── Floor tiles (met / at / below vs company weekly floor) ──

// The 8 activity-input floors projected as agent tiles. API + Applications are
// the RESULT (shown in the agent hero), so they are excluded from the tiles.
export const FLOOR_TILE_ROWS = [
  { key: 'callsMade',             label: 'Calls Made' },
  { key: 'telContacts',           label: 'Contacts Made' },
  { key: 'appointmentsScheduled', label: 'Appointments' },
  { key: 'interviewsKept',        label: 'Interviews Kept' },
  { key: 'factFindsCompleted',    label: 'Fact Finds' },
  { key: 'closingInterviewsKept', label: 'Closing Interviews' },
  { key: 'clientsSold',           label: 'Clients Sold' },
  { key: 'referralsNewLeads',     label: 'Referrals' },
];

/** met (>= floor) · at (>= 90% of floor) · below. Floor 0 → met. */
export function kpiStatus(actual, floor) {
  const a = Number(actual) || 0;
  const f = Number(floor) || 0;
  if (f <= 0) return 'met';
  if (a >= f) return 'met';
  if (a >= f * 0.9) return 'at';
  return 'below';
}

/** Build the 8 met/at/below tiles for one agent's floor actuals. */
export function floorTiles(actuals, floors = DEFAULT_WEEKLY_ACTIVITY_FLOORS) {
  return FLOOR_TILE_ROWS.map((row) => {
    const actual = Number(actuals?.[row.key]) || 0;
    const floor = Number(floors?.[row.key]) || 0;
    return { key: row.key, label: row.label, actual, floor, status: kpiStatus(actual, floor) };
  });
}

// ── Flag taxonomy (honestly derivable from the manager surface) ──
//   report      — not submitted this week
//   floor       — submitted but ≥5 of the 8 activity floors below floor
//   persistency — latest persistency < 80%
//   (else)      — on pace
// "Off pace" (annual-commitment gap) and "gone quiet" (daily-recency) are NOT
// derivable from the meeting's read-light load and are intentionally not faked.
export const FLAG_ORDER = ['report', 'floor', 'persistency', null];

export function classifyFlag({ submitted, tiles, persistency }) {
  if (!submitted) {
    return { key: 'report', label: 'Report late', tone: 'warning', reason: 'Week report not submitted.' };
  }
  const below = tiles.filter((t) => t.status === 'below').length;
  if (below >= 5) {
    return {
      key: 'floor', label: 'Below floor', tone: 'danger',
      reason: `${below} of ${tiles.length} activity standards below floor this week.`,
    };
  }
  if (persistency != null && persistency < 80) {
    return {
      key: 'persistency', label: 'Persistency', tone: 'warning',
      reason: `${Math.round(persistency)}% persistency · below the 80% threshold.`,
    };
  }
  return { key: null, label: 'On pace', tone: 'success', reason: '' };
}

/** Rank helper for exception-first ordering (lower = earlier in the deck). */
export function flagRank(flagKey) {
  const i = FLAG_ORDER.indexOf(flagKey);
  return i < 0 ? FLAG_ORDER.length : i;
}

// ── Persistency helpers ──

/** Latest (highest-month) persistency % for an agent from the E3 record array. */
export function latestPersistency(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  let best = null;
  records.forEach((r) => {
    const m = Number(r.month) || 0;
    if (!best || m > best.month) best = { month: m, pct: Number(r.persistency) };
  });
  return best ? best.pct : null;
}

/** Average latest persistency across a set of agentIds (null when none). */
export function avgLatestPersistency(agentIds, persMap) {
  const vals = agentIds
    .map((id) => latestPersistency(persMap?.[id]))
    .filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ── Identity ──

export function resolveName(sub, users) {
  if (sub.agentName) return sub.agentName;
  const uid = sub.agentId ?? sub.userId ?? '';
  const u = users?.find((x) => x.id === uid);
  if (u) return u.name ?? u.displayName ?? u.email ?? `Agent ${uid.slice(-6)}`;
  return uid ? `Agent ${uid.slice(-6)}` : 'Unknown';
}

export function initialsOf(name) {
  return (name ?? 'A')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Branch scorecard windows (WTD / MTD / QTD / YTD × API / Apps / Persistency) ──

function sumWindow(subs) {
  let api = 0, apps = 0, ffi = 0;
  subs.forEach((s) => {
    const f = extractFields(s);
    api += f.apiSold;
    apps += f.applicationsSold;
    ffi += f.ffiConducted;
  });
  return { api, apps, ffi };
}

/** This week's headline pulse from the `submissions` prop. */
export function deriveWeekPulse(submissions) {
  return sumWindow(submissions || []);
}

/**
 * Branch scorecard rows. WTD comes from this week's `submissions`; MTD/QTD/YTD
 * from `ytdSubs` windowed by the month/quarter/year of `selectedWeek`.
 * Persistency is monthly (null for WTD).
 */
export function deriveBranchWindows(submissions, ytdSubs, persMap, selectedWeek, agentIds) {
  const subs = submissions || [];
  const ytd = ytdSubs || [];
  const m = monthOf(selectedWeek);
  const q = quarterOf(selectedWeek);

  const monthSubs = ytd.filter((s) => monthOf(s.weekStarting) === m);
  const quarterSubs = ytd.filter((s) => quarterOf(s.weekStarting) === q);

  const wtd = sumWindow(subs);
  const mtd = sumWindow(monthSubs.length ? monthSubs : subs);
  const qtd = sumWindow(quarterSubs.length ? quarterSubs : subs);
  const ytdT = sumWindow(ytd.length ? ytd : subs);

  const persYtd = avgLatestPersistency(agentIds || [], persMap);

  return [
    { k: 'WTD', name: 'This week', label: 'the week so far', api: wtd.api, apps: wtd.apps, pers: null },
    { k: 'MTD', name: 'This month', label: 'month so far', api: mtd.api, apps: mtd.apps, pers: persYtd },
    { k: 'QTD', name: 'This quarter', label: 'quarter so far', api: qtd.api, apps: qtd.apps, pers: persYtd },
    { k: 'YTD', name: 'This year', label: 'the year so far', api: ytdT.api, apps: ytdT.apps, pers: persYtd, hero: true },
  ];
}

// ── Units (side-by-side) ──

/** Group agents by unitId and roll up YTD/window API. Manager name resolved
 *  from users where id === unitId. Returns [] when fewer than 2 units. */
export function deriveUnits(users, ytdSubs, submissions) {
  const agents = (users || []).filter((u) => u.role === 'agent' && u.unitId);
  const byUnit = new Map();
  agents.forEach((a) => {
    if (!byUnit.has(a.unitId)) byUnit.set(a.unitId, []);
    byUnit.get(a.unitId).push(a.id);
  });
  if (byUnit.size < 2) return [];

  const ytd = ytdSubs || [];
  const wk = submissions || [];
  const units = [];
  byUnit.forEach((ids, unitId) => {
    const idSet = new Set(ids);
    const uYtd = ytd.filter((s) => idSet.has(s.agentId ?? s.userId));
    const uWk = wk.filter((s) => idSet.has(s.agentId ?? s.userId));
    const mgr = (users || []).find((u) => u.id === unitId);
    units.push({
      id: unitId,
      label: mgr ? (mgr.name ?? mgr.displayName ?? `Unit ${unitId.slice(-4)}`) : `Unit ${unitId.slice(-4)}`,
      agents: ids.length,
      ytdApi: sumWindow(uYtd).api,
      wtdApi: sumWindow(uWk).api,
      ytdApps: sumWindow(uYtd).apps,
    });
  });
  units.sort((a, b) => b.ytdApi - a.ytdApi);
  units.forEach((u, i) => { u.rank = i + 1; });
  return units;
}

// ── Per-agent run objects (the drill) ──

export function sixWeekSpark(agentId, ytdSubs, selectedWeek) {
  const weeks = lastNWeekStartings(selectedWeek, 6);
  const byWeek = {};
  (ytdSubs || []).forEach((s) => {
    if ((s.agentId ?? s.userId) !== agentId) return;
    byWeek[s.weekStarting] = extractFields(s).apiSold;
  });
  return weeks.map((w) => byWeek[w] ?? 0);
}

/** Activity score = total funnel touches (rewards effort). */
export function activityScore(actuals) {
  if (!actuals) return 0;
  return FLOOR_TILE_ROWS.reduce((sum, row) => sum + (Number(actuals[row.key]) || 0), 0);
}

/** Build the ordered (exception-first) run of agents from this week's subs. */
export function deriveAgentRuns(submissions, ytdSubs, users, persMap, selectedWeek) {
  const runs = (submissions || []).map((sub) => {
    const agentId = sub.agentId ?? sub.userId ?? '';
    const fields = extractFields(sub);
    const actuals = deriveWeeklyFloorActuals(fields);
    const tiles = floorTiles(actuals);
    const submitted = (sub.status ?? 'draft') === 'submitted';
    const persistency = latestPersistency(persMap?.[agentId]);
    const flag = classifyFlag({ submitted, tiles, persistency });
    const name = resolveName(sub, users);
    const u = (users || []).find((x) => x.id === agentId);
    return {
      id: agentId,
      name,
      initials: initialsOf(name),
      unit: u?.unitId ? `Unit ${String(u.unitId).slice(-4)}` : '',
      submitted,
      flag,
      persistency,
      weekApi: fields.apiSold,
      apps: fields.applicationsSold,
      tiles,
      actuals,
      activityScore: activityScore(actuals),
      spark: sixWeekSpark(agentId, ytdSubs, selectedWeek),
      ratios: computeRatios(fields),
      evals: [
        { label: 'Planning', value: fields.planningEffectiveness },
        { label: 'Time Mgmt', value: fields.timeManagement },
        { label: 'Sales Perf.', value: fields.salesPerformance },
        { label: 'Prospecting', value: fields.prospectingEffort },
        { label: 'Overall', value: fields.overallRating },
      ],
      evalNote: fields.evaluationNotes,
    };
  });

  runs.sort((a, b) => flagRank(a.flag.key) - flagRank(b.flag.key) || b.weekApi - a.weekApi || a.name.localeCompare(b.name));
  return runs;
}

export function deriveExceptions(runs) {
  return runs.filter((r) => r.flag.key !== null);
}

/** Recognition: top-3 producers by week API + top-5 most active. */
export function deriveRecognition(runs) {
  const producers = runs
    .filter((r) => r.weekApi > 0)
    .slice()
    .sort((a, b) => b.weekApi - a.weekApi)
    .slice(0, 3)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const active = runs
    .filter((r) => r.activityScore > 0)
    .slice()
    .sort((a, b) => b.activityScore - a.activityScore)
    .slice(0, 5);
  return { producers, active, available: producers.length > 0 };
}

// ── Celebrations — WORK ANNIVERSARIES only (no DOB field exists on user docs,
//    so birthdays are not derivable and are skip-logged). Anniversary = the
//    contractStartDate month/day falling within the meeting week window. ──

export function deriveAnniversaries(users, selectedWeek) {
  const start = parseYMD(selectedWeek);
  if (!start) return [];
  const windowDays = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    windowDays.push(`${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  const meetingYear = start.getUTCFullYear();
  const out = [];
  (users || []).forEach((u) => {
    const csd = u.contractStartDate;
    const d = parseYMD(csd);
    if (!d) return;
    const md = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const idx = windowDays.indexOf(md);
    if (idx < 0) return;
    const years = meetingYear - d.getUTCFullYear();
    if (years < 1) return;
    const name = u.name ?? u.displayName ?? u.email ?? 'Advisor';
    out.push({
      id: u.id,
      name,
      initials: initialsOf(name),
      years,
      dateLabel: `${csd.slice(5)}`,
      unit: u.unitId ? `Unit ${String(u.unitId).slice(-4)}` : '',
    });
  });
  out.sort((a, b) => b.years - a.years);
  return out;
}

// ── Active campaigns (within [startDate, endDate] today) ──

export function deriveActiveCampaigns(campaigns, today) {
  const t = typeof today === 'string' ? today : toYMD(new Date());
  return (campaigns || []).filter((c) => {
    const s = typeof c.startDate === 'string' ? c.startDate.slice(0, 10) : null;
    const e = typeof c.endDate === 'string' ? c.endDate.slice(0, 10) : null;
    if (!s || !e) return false;
    return s <= t && t <= e;
  });
}

// ── The deck — scene availability drives MEETING_ORDER ──

export const SCENE_SEQUENCE = [
  'opening', 'branch', 'units', 'activity', 'production',
  'exceptions', 'agents', 'recognition', 'celebrations', 'campaign', 'close',
];

/**
 * Given the derived model, produce the ordered scene-id list (agents expanded
 * to one scene per run) plus a skip log naming every dropped scene + why.
 */
export function deriveDeck({ runs, units, exceptions, recognition, anniversaries, activeCampaigns, submissions }) {
  const scenes = [];
  const skipped = [];
  const hasSubs = (submissions || []).length > 0;

  scenes.push('opening');
  scenes.push('branch');

  if (units.length >= 2) scenes.push('units');
  else skipped.push({ id: 'units', reason: 'fewer than 2 units in scope' });

  if (hasSubs) scenes.push('activity');
  else skipped.push({ id: 'activity', reason: 'no submissions this week' });

  if (hasSubs) scenes.push('production');
  else skipped.push({ id: 'production', reason: 'no submissions this week' });

  if (exceptions.length > 0) scenes.push('exceptions');
  else skipped.push({ id: 'exceptions', reason: 'no agents flagged for attention' });

  runs.forEach((r) => scenes.push(`agent:${r.id}`));
  if (!runs.length) skipped.push({ id: 'agents', reason: 'no agent submissions this week' });

  if (recognition.available) scenes.push('recognition');
  else skipped.push({ id: 'recognition', reason: 'no producers with API this week' });

  if (anniversaries.length > 0) scenes.push('celebrations');
  else skipped.push({ id: 'celebrations', reason: 'no work anniversaries this week (birthdays not derivable — no DOB on user docs)' });

  if (activeCampaigns.length > 0) scenes.push('campaign');
  else skipped.push({ id: 'campaign', reason: 'no active campaigns' });

  scenes.push('close');
  return { scenes, skipped };
}
