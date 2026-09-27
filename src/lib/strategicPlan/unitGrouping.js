import { ttDateParts } from '../../utils/dateInputs';

// Track K — Strategic Plan · unit grouping + producing roster (pure).
//
// Dispatcher RULING 3 (2026-07-17): replaces deriveUnits (which carried
// meeting-specific assumptions — <2-unit [] guard, agent-only filter).
//   • Producing roster = agents PLUS producing Unit/Trainee Managers. A UM's own
//     uid IS their unit id (functions/index.js:233); their production is the
//     unit-head line. Do NOT filter to role === 'agent'.
//   • Single-unit branches render normally (no <2-unit empty path).
//   • "Trainee Manager" is a display title only — it operates as a Unit Manager
//     and surfaces via the title fallback below.

const ROLE_LABELS = {
  agent: 'Agent',
  unit_manager: 'Unit Manager',
  branch_manager: 'Branch Manager',
  sales_manager: 'Sales Manager',
  tenant_admin: 'Tenant Admin',
  platform_admin: 'Platform Admin',
  cro: 'CRO',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Agent';
}

// Title via fallback (existing display pattern, MasterSheet.jsx:158 /
// AgentDashboard.jsx:571): levelTitle → careerLevel → roleLabel(role). Renders
// "Trainee Manager" wherever careerLevel carries it; falls to the role label when
// blank. Blank/whitespace-only strings are treated as absent (a stored ''
// levelTitle must not shadow a real careerLevel). No new user-doc field.
const nonBlank = (s) => (typeof s === 'string' && s.trim() ? s : null);
export function displayTitle(user) {
  return nonBlank(user?.levelTitle) ?? nonBlank(user?.careerLevel) ?? roleLabel(user?.role);
}

// Whole completed years between contractStartDate ("YYYY-MM-DD") and `now`, by
// calendar anniversary (not average-year-length division — that undercounts).
// null when the date is absent/malformed; 0 for a future date.
export function experienceYears(contractStartDate, now = new Date()) {
  if (!contractStartDate || typeof contractStartDate !== 'string') return null;
  const start = new Date(`${contractStartDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  if (now.getTime() < start.getTime()) return 0;
  // TT calendar day of `now` — an anniversary turns over at TT midnight, not UTC.
  const tt = ttDateParts(now);
  if (!tt) return null;
  let years = tt.year - start.getUTCFullYear();
  const monthDelta = (tt.month - 1) - start.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && tt.day < start.getUTCDate())) years -= 1;
  return Math.max(0, years);
}

const PRODUCING_ROLES = new Set(['agent', 'unit_manager']);

/** Producing advisors for a branch: agents + unit/trainee managers (RULING 3). */
export function producingRoster(branchUsers) {
  return (branchUsers || []).filter((u) => PRODUCING_ROLES.has(u.role));
}

// Group the branch roster into units. Unit head = the user whose uid === unitId.
// Advisors = agents whose unitId points at that head. Admins = non-producing,
// non-head users. Units with a head but no agents still render (single-unit
// branches included; no <2-unit empty path).
export function groupByUnit(branchUsers) {
  const users = branchUsers || [];
  const byId = new Map(users.map((u) => [u.id, u]));

  // Unit ids = every UM's own uid + every producing user's unitId.
  const unitIds = new Set();
  for (const u of users) {
    if (u.role === 'unit_manager') unitIds.add(u.id);
    if (PRODUCING_ROLES.has(u.role) && u.unitId) unitIds.add(u.unitId);
  }

  const units = [];
  for (const unitId of unitIds) {
    const head = byId.get(unitId) || null;
    const advisors = users.filter((u) => u.role === 'agent' && u.unitId === unitId);
    units.push({
      unitId,
      head,
      headName: head ? (head.name ?? head.displayName ?? head.email ?? unitId) : null,
      headTitle: head ? displayTitle(head) : null,
      unitName: head?.unitName ?? (head ? `${head.name ?? head.displayName ?? 'Unit'}` : unitId),
      advisors,
      advisorCount: advisors.length,
    });
  }
  units.sort((a, b) => b.advisorCount - a.advisorCount);

  const adminCount = users.filter(
    (u) => !PRODUCING_ROLES.has(u.role) && !unitIds.has(u.id),
  ).length;

  return { units, adminCount, unitCount: units.length };
}
