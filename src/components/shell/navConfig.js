// ─────────────────────────────────────────────────────────────────────────────
// navConfig — single source of truth for per-role sidebar nav (Nav redesign PR-1).
//
// Centralizes the grouped sidebar nav for the producing-side roles:
//   • agent            → AGENT_NAV
//   • unit_manager     ┐
//   • branch_manager   ┘→ PRODUCING_MANAGER_NAV  (one config; branch-only items
//                          gated via `roles` so UM/BM each keep exactly the
//                          destinations they have today — no-regression guard)
//   • manager          → MANAGER_NAV  (DEFINED per build-spec §2 but assigned to
//                          NO role this track — reserved for a future non-producing
//                          manager role; never resolved by App routing in PR-1)
//
// sales_manager / tenant_admin / platform_admin are deliberately NOT handled here —
// their existing inline nav in ManagerDashboard / TenantAdminDashboard renders
// unchanged. Only UM/BM are routed through getNavConfig('producingManager', …).
//
// Item shape (consumed by Sidebar.jsx + MobileNavDrawer.jsx):
//   { id, label, Icon, tabId? | action?, sectionLabel?, child?, scope?,
//     soon?, disabled?, roles?, testId?, badge* }
//   • tabId   → clicking sets activeTab (routing identical to today's nav)
//   • action  → clicking calls onAction(action) (e.g. 'submit', 'log-today')
//   • scope   → 'MINE' | 'TEAM' | 'BOTH' — renders a NON-interactive chip
//               (PR-1: presentation only; does not change routing)
//   • child   → indented under the preceding item (Money Needs under Game Plan)
//   • soon / COMING_SOON_TABS membership → rendered disabled with a "Soon" badge
//   • roles   → gates the item to specific roles within a multi-role config
//
// Every tabId below points at a route that already exists in the dashboards'
// activeTab render-switch — navConfig adds NO new screens (PR-1 is nav IA +
// presentation only).
// ─────────────────────────────────────────────────────────────────────────────
import {
  // agent
  Home, NotebookPen, History, BarChart2, Wallet, Target, Zap, Repeat,
  BookOpen, Search, Medal, Shield, Star, CalendarCheck, CalendarClock,
  // producing manager / manager (reuse the dashboards' existing icon set)
  ClipboardList, Activity, UserPlus, Users, Gift, LineChart, Trophy,
  CheckCircle2, TrendingUp, LayoutList, FileCheck, ClipboardCheck, Tv, Award,
  Presentation, Banknote, FileText,
} from 'lucide-react';
import { COMING_SOON_TABS } from '../../config/comingSoonTabs';

// ── agent ────────────────────────────────────────────────────────────────────
// Groups: Today · Planning · Tools · Recognition.
// Daily Log carries `dailyOnly` — resolved out for weekly-mode agents so it
// mirrors the DailyFAB's existing visibility predicate exactly (no-regression).
const AGENT_NAV = [
  // Today
  { id: 'dashboard',         label: 'Dashboard',         tabId: 'dashboard',              Icon: Home,        sectionLabel: 'Today', testId: 'agent-tab-dashboard' },
  { id: 'daily-log',         label: 'Daily Log',         action: 'log-today',             Icon: CalendarCheck, dailyOnly: true,      testId: 'agent-tab-daily-log' },
  { id: 'wizard',            label: 'Weekly Report',     action: 'submit',                Icon: NotebookPen, testId: 'agent-tab-wizard' },
  { id: 'history',           label: 'History',           tabId: 'history',                Icon: History,     testId: 'agent-tab-history' },
  // Planning — Game Plan renders with NO "New" tag (badgeNew removed per nav-PR1
  // decision #4). Money Needs nests under it as a child (own route). Goals is a
  // sibling. Planner is the only SOON item (gated via COMING_SOON_TABS).
  { id: 'game-plan',         label: 'Game Plan',         tabId: 'game-plan',              Icon: BarChart2,   sectionLabel: 'Planning', testId: 'agent-tab-game-plan' },
  { id: 'money-needs',       label: 'Money Needs',       tabId: 'money-needs',            Icon: Wallet,      child: true,            testId: 'agent-tab-money-needs' },
  { id: 'goals',             label: 'Goals',             tabId: 'goals',                  Icon: Target,      testId: 'agent-tab-goals' },
  { id: 'planner',           label: 'Planner',           tabId: 'planner',                Icon: CalendarClock, testId: 'agent-tab-planner' },
  // Tools — Prospect Prep stays SOON (it is in COMING_SOON_TABS today; the
  // disabling below preserves that, un-gating is out of scope for PR-1).
  { id: 'commission',        label: 'Commission',        tabId: 'commission',             Icon: Zap,         sectionLabel: 'Tools', testId: 'agent-tab-commission' },
  { id: 'persistency',       label: 'Persistency',       tabId: 'persistency',            Icon: Repeat,      testId: 'agent-tab-persistency' },
  { id: 'policy-ledger',     label: 'Policy Ledger',     tabId: 'policy-ledger',          Icon: BookOpen,    testId: 'agent-tab-policy-ledger' },
  // Track K · K9 — read-only financing self-view. Always present; the component
  // renders a neutral "not on financing" empty state for non-financed agents
  // (financed = financingTerms doc exists + status past not_on_financing).
  { id: 'financing',         label: 'Financing',         tabId: 'financing',              Icon: Banknote,    testId: 'agent-tab-financing' },
  { id: 'prospect-info',     label: 'Prospect Prep',     tabId: 'prospect-info',          Icon: Search,      testId: 'agent-tab-prospect-info' },
  { id: 'production-report', label: 'Production Report', tabId: 'production-report',      Icon: BarChart2,   testId: 'agent-tab-production-report' },
  // Tier 1 · 1.2 — live, in-app twin of the Agent Performance Report PDF.
  { id: 'agent-report',      label: 'Report',            tabId: 'agent-report',           Icon: FileText,    testId: 'agent-tab-report' },
  // Recognition
  { id: 'leaderboard',       label: 'Leaderboard',       tabId: 'production-leaderboard', Icon: Star,        sectionLabel: 'Recognition', testId: 'agent-tab-leaderboard' },
  { id: 'awards',            label: 'Awards',            tabId: 'awards',                 Icon: Medal,       testId: 'agent-tab-awards' },
  { id: 'career',            label: 'Career Portal',     tabId: 'career',                 Icon: Shield,      testId: 'agent-tab-career' },
];

// ── producing manager (unit_manager + branch_manager) ─────────────────────────
// Route-faithful mapping (dispatcher ruling 2026-06-22): every item points at an
// existing manager tabId; the per-item `roles` mirror the shared NAV_ITEMS gating
// byte-for-byte so neither UM nor BM gains or loses a destination.
//   • roles: ['branch_manager'] — items the shared array gated to BM+ (UM excluded):
//       Weekly WARs (team-wars), Agent of Month (agent-of-month), Kiosk (kiosk).
//   • all other items had no `roles` (UM+BM both saw them) → no `roles` here.
// Profile is intentionally absent (reached via the Sidebar footer avatar, same as
// the agent config) — the 'profile' destination is NOT lost.
const PRODUCING_MANAGER_NAV = [
  // My Production (own producer surfaces)
  { id: 'mp-report',             label: 'Weekly Report',  tabId: 'mp-report',             Icon: NotebookPen,  sectionLabel: 'My Production' },
  { id: 'mp-commission',         label: 'Commission',     tabId: 'mp-commission',         Icon: Zap },
  { id: 'mp-policies',           label: 'Policy Ledger',  tabId: 'mp-policies',           Icon: BookOpen },
  { id: 'my-war',                label: 'My WAR',         tabId: 'my-war',                Icon: ClipboardList },
  { id: 'mp-history',            label: 'History',        tabId: 'mp-history',            Icon: History },
  // Track K · K9 — financed-UM own financing self-view (agent-style, scoped to the
  // UM's own uid). Own-half of the composite; the unit-management half is K10.
  // No `roles` → both UM+BM producing managers see it (either may be financed).
  { id: 'mp-financing',          label: 'Financing',      tabId: 'mp-financing',          Icon: Banknote,     testId: 'mp-tab-financing' },
  // Planning
  { id: 'mp-game-plan',          label: 'Game Plan',      tabId: 'mp-game-plan',          Icon: BarChart2,    sectionLabel: 'Planning' },
  { id: 'mp-money-needs',        label: 'Money Needs',    tabId: 'mp-money-needs',        Icon: Wallet,       child: true },
  { id: 'mp-goals',              label: 'Goals',          tabId: 'mp-goals',              Icon: Target,       scope: 'MINE' },
  { id: 'planner',               label: 'Planner',        tabId: 'planner',               Icon: CalendarClock },
  // My Team (team management surfaces)
  { id: 'overview',              label: 'Team Dashboard', tabId: 'overview',              Icon: BarChart2,    sectionLabel: 'My Team' },
  { id: 'team',                  label: 'Team',           tabId: 'team',                  Icon: Users },
  { id: 'mastersheet',           label: 'Master Sheet',   tabId: 'mastersheet',           Icon: ClipboardList },
  { id: 'team-wars',             label: 'Weekly WARs',    tabId: 'team-wars',             Icon: Activity,     roles: ['branch_manager'] },
  { id: 'monthly-recruiting',    label: 'Recruiting',     tabId: 'monthly-recruiting',    Icon: UserPlus },
  { id: 'goals',                 label: 'Team Goals',     tabId: 'goals',                 Icon: Award,        scope: 'TEAM' },
  // PR-GPM1 — Team Plans (consent-shared Money Needs reader). UM+BM only: the
  // G5 rules arms grant no TA/PA read, so the nav gate matches the rules layer
  // exactly (this config is already UM/BM-only; the explicit roles document it).
  { id: 'team-game-plans',       label: 'Team Plans',     tabId: 'team-game-plans',       Icon: Wallet,       roles: ['unit_manager', 'branch_manager'] },
  { id: 'persistency',           label: 'Persistency Entry', tabId: 'persistency',        Icon: TrendingUp,   scope: 'TEAM' },
  { id: 'compliance',            label: 'Compliance',     tabId: 'compliance',            Icon: CheckCircle2 },
  { id: 'campaigns',             label: 'Campaigns',      tabId: 'campaigns',             Icon: Gift },
  { id: 'production-report',     label: 'Team Reports',   tabId: 'production-report',     Icon: LineChart,    scope: 'TEAM' },
  { id: 'awards',                label: 'Team Awards',    tabId: 'awards',                Icon: Trophy,       scope: 'TEAM' },
  { id: 'team-perf',             label: 'Team Roster',    tabId: 'team-perf',             Icon: LayoutList },
  { id: 'settlements',           label: 'Settlements',    tabId: 'settlements',           Icon: FileCheck },
  // Track K · K1 — financing terms setup. BM-and-up only (unit_manager excluded
  // per contract 5.3) via the existing per-item roles gate.
  { id: 'financing',             label: 'Financing',      tabId: 'financing',             Icon: Banknote, roles: ['branch_manager'] },
  // Track K · K10a — Unit Financing (UM view + coach, read-only). UM-ONLY: a
  // SEPARATE tabId from the BM `financing` tab, never a reuse. Gated to
  // unit_manager because getTenantUsers only UNIT-scopes for a UM (a BM would get
  // a branch-wide list mislabeled "unit").
  { id: 'unit-financing',        label: 'Unit Financing', tabId: 'unit-financing',        Icon: Banknote, roles: ['unit_manager'] },
  { id: 'policy-reconciliation', label: 'Reconciliation', tabId: 'policy-reconciliation', Icon: ClipboardCheck },
  { id: 'agent-of-month',        label: 'Agent of Month', tabId: 'agent-of-month',        Icon: Trophy,       roles: ['branch_manager'] },
  { id: 'kiosk',                 label: 'Kiosk Mode',     tabId: 'kiosk',                 Icon: Tv,           roles: ['branch_manager'] },
  // Recognition
  { id: 'leaderboard',           label: 'Leaderboard',    tabId: 'leaderboard',           Icon: Star,         sectionLabel: 'Recognition', scope: 'BOTH' },
];

// ── manager (DEFINED, UNASSIGNED this track) ──────────────────────────────────
// Per build-spec §2. Reserved for a future non-producing manager role; not
// resolved by any role in PR-1. Items map to existing tabIds where one exists;
// Meetings and Career Portal have no manager route today, so they carry
// `soon: true` (rendered disabled) rather than fabricating a destination.
const MANAGER_NAV = [
  // Team
  { id: 'overview',              label: 'Team Dashboard', tabId: 'overview',              Icon: BarChart2,    sectionLabel: 'Team' },
  { id: 'mastersheet',           label: 'Master Sheet',   tabId: 'mastersheet',           Icon: ClipboardList },
  { id: 'team-wars',             label: 'Weekly WARs',    tabId: 'team-wars',             Icon: Activity },
  { id: 'goals',                 label: 'Team Goals',     tabId: 'goals',                 Icon: Award },
  { id: 'production-report',     label: 'Reports',        tabId: 'production-report',     Icon: LineChart },
  // Grow
  { id: 'monthly-recruiting',    label: 'Recruiting',     tabId: 'monthly-recruiting',    Icon: UserPlus,     sectionLabel: 'Grow' },
  { id: 'campaigns',             label: 'Campaigns',      tabId: 'campaigns',             Icon: Gift },
  { id: 'meetings',              label: 'Meetings',       Icon: Presentation,             soon: true },
  { id: 'planner',               label: 'Planner',        tabId: 'planner',               Icon: CalendarClock },
  // Oversight
  { id: 'compliance',            label: 'Compliance',     tabId: 'compliance',            Icon: CheckCircle2, sectionLabel: 'Oversight' },
  { id: 'persistency',           label: 'Persistency',    tabId: 'persistency',           Icon: TrendingUp },
  { id: 'policy-reconciliation', label: 'Reconciliation', tabId: 'policy-reconciliation', Icon: ClipboardCheck },
  // Recognition
  { id: 'leaderboard',           label: 'Leaderboard',    tabId: 'leaderboard',           Icon: Star,         sectionLabel: 'Recognition' },
  { id: 'awards',                label: 'Awards',         tabId: 'awards',                Icon: Trophy },
  { id: 'kiosk',                 label: 'Kiosk Mode',     tabId: 'kiosk',                 Icon: Tv },
  { id: 'career',                label: 'Career Portal',  Icon: Shield,                   soon: true },
];

const CONFIGS = {
  agent:            AGENT_NAV,
  producingManager: PRODUCING_MANAGER_NAV,
  manager:          MANAGER_NAV,
};

// Mark coming-soon items disabled — mirrors the dashboards' previous inline
// `.map(item => COMING_SOON_TABS.has(item.tabId) ? {...item, disabled:true} : item)`
// and also honors an explicit `soon: true` on the item.
function applyComingSoon(items) {
  // Always return a fresh object so callers never receive (and cannot mutate)
  // a reference into the module-level config arrays — keeps the source of truth
  // immutable (Gemini review, PR-1).
  return items.map((item) => {
    const isSoon = item.soon === true || (item.tabId != null && COMING_SOON_TABS.has(item.tabId));
    return isSoon ? { ...item, disabled: true } : { ...item };
  });
}

/**
 * Resolve the grouped sidebar nav for a config key.
 *
 * @param {'agent'|'producingManager'|'manager'} configKey
 * @param {{ role?: string, showDailyCapture?: boolean }} [opts]
 *   - role: actual role (producingManager) — filters items whose `roles` list
 *     excludes it (branch-only gating).
 *   - showDailyCapture: agent only — when false, the Daily Log item (dailyOnly)
 *     is omitted, mirroring the DailyFAB visibility predicate.
 * @returns {Array} ordered nav items in Sidebar's item shape.
 */
export function getNavConfig(configKey, opts = {}) {
  const base = CONFIGS[configKey];
  if (!base) return [];

  let items = base;

  // Agent Daily Log: present only when daily capture is enabled for the agent.
  if (configKey === 'agent' && !opts.showDailyCapture) {
    items = items.filter((item) => !item.dailyOnly);
  }

  // Role gating within a multi-role config (producingManager branch-only items).
  if (opts.role) {
    items = items.filter((item) => !item.roles || item.roles.includes(opts.role));
  }

  return applyComingSoon(items);
}

/**
 * Resolve the human page title for the active tab from a flat nav-item list
 * (as returned by getNavConfig). Used to drive the topbar `<h1>` per screen so
 * it names the active surface instead of a static "Dashboard" (UX-101), and so
 * every screen has exactly one semantic heading (A11Y-001).
 *
 * Falls back when the active tab has no matching descriptor — e.g. a surface
 * reached via the avatar/profile route or one whose activeTab value differs
 * from any nav tabId.
 *
 * @param {Array<{tabId?: string, label?: string}>} items
 * @param {string} activeTab
 * @param {string} [fallback='Dashboard']
 * @returns {string}
 */
export function tabTitleFromItems(items, activeTab, fallback = 'Dashboard') {
  if (!Array.isArray(items)) return fallback;
  const match = items.find((it) => it.tabId === activeTab);
  return match?.label || fallback;
}

// ── ★ Pinned-zone seeds (Nav redesign PR-2) ──────────────────────────────────
// Per-role default pins, by navConfig item id. Validated at resolve time against
// the role's full nav id set — any id that no longer resolves is DROPPED (not
// stubbed). The producing-manager spec's "Log Today" has no manager route and is
// intentionally absent here (deferred to PR-3 Quick-Add).
const PINNED_SEEDS = {
  agent:            ['daily-log', 'wizard', 'policy-ledger', 'goals', 'planner'],
  producingManager: ['mp-report', 'mastersheet', 'monthly-recruiting', 'mp-goals', 'planner'],
  manager:          [],
};

/**
 * Validated per-role seed pin ids. Drops any seed id absent from the role's
 * navConfig (agent validated against the daily-capture-enabled superset so
 * `daily-log` resolves; the per-render resolver drops it for weekly-mode agents).
 *
 * @param {'agent'|'producingManager'|'manager'} configKey
 * @returns {string[]}
 */
export function getPinnedSeed(configKey) {
  const seed = PINNED_SEEDS[configKey] ?? [];
  const validIds = new Set(getNavConfig(configKey, { showDailyCapture: true }).map((i) => i.id));
  return seed.filter((id) => validIds.has(id));
}

// ── ★ Nav order (Fable Tier 1 · 1.4 — desktop sidebar drag-reorder) ───────────
/**
 * Apply a saved per-config nav order to a resolved nav-item list — WITHIN each
 * section only (locked decision #1: cross-section moves are never produced or
 * applied). Sections are the same contiguous `sectionLabel`-led groups Sidebar's
 * `groupBySection` derives.
 *
 * Semantics (locked decision #5):
 *   - Within a section, items whose id appears in `orderIds` come first, ordered
 *     by their index in `orderIds`.
 *   - Items NOT in `orderIds` (e.g. a newly shipped nav item) keep their default
 *     relative position, appended after the ordered ones at the section's end.
 *   - The section header travels with whichever item ends up first in the section:
 *     the new lead receives `sectionLabel`, every other row in the section has it
 *     stripped — so `groupBySection` still reconstructs exactly one header per
 *     section after reorder (a moved original-lead never spawns a phantom section).
 *
 * No saved order (empty/absent `orderIds`) returns `items` unchanged by reference,
 * so the default nav renders byte-identical to today.
 *
 * @param {Array} items    resolved nav items (getNavConfig / getWorkspaceGroups output)
 * @param {string[]} orderIds  saved order of nav-item ids for this config
 * @returns {Array} reordered nav items in Sidebar's item shape
 */
export function applyNavOrder(items, orderIds) {
  if (!Array.isArray(items) || items.length === 0) return items;
  if (!Array.isArray(orderIds) || orderIds.length === 0) return items;

  const rank = new Map();
  orderIds.forEach((id, i) => { if (!rank.has(id)) rank.set(id, i); });

  // Group into contiguous sections (same rule as Sidebar.groupBySection).
  const sections = [];
  let current = null;
  for (const item of items) {
    if (item.sectionLabel || current == null) {
      current = { label: item.sectionLabel ?? null, items: [] };
      sections.push(current);
    }
    current.items.push(item);
  }

  const out = [];
  for (const section of sections) {
    const ordered = section.items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => {
        const ra = rank.has(a.item.id) ? rank.get(a.item.id) : Infinity;
        const rb = rank.has(b.item.id) ? rank.get(b.item.id) : Infinity;
        if (ra !== rb) return ra - rb;       // both/one ordered → by saved index
        return a.i - b.i;                    // both unordered → default order (stable)
      })
      .map(({ item }) => item);

    ordered.forEach((item, idx) => {
      const copy = { ...item };
      if (idx === 0) {
        if (section.label != null) copy.sectionLabel = section.label;
        else delete copy.sectionLabel;
      } else {
        delete copy.sectionLabel;
      }
      out.push(copy);
    });
  }
  return out;
}

// ── Workspace / Both layouts (Nav redesign PR-4) ──────────────────────────────
// `workspace` and `both` are alternative PRESENTATIONS of the same producingManager
// item set above — NOT a new item set (the governing invariant). The partition
// below references existing PRODUCING_MANAGER_NAV items BY ID (route-faithful — no
// route is redefined here); getWorkspaceGroups resolves each id against the live
// config. Two action items (Daily Log, Meetings) have no pinned-nav route — they
// are PR-3 actions (`log-today` → setShowMpDailyModal, `start-meeting` →
// handleStartMeeting), defined inline and injected at the top of their workspace.
//
// Partition (dispatcher ruling 2026-06-22, PR-4 Phase 0):
//   • My Work  = the shipped "My Production" + "Planning" sub-sections (preserved
//                as sub-headers — Decision B) + the Daily Log action atop My Production.
//   • My Team  = the shipped "My Team" section (flat) + the Meetings action atop it.
//   • Recognition (leaderboard, scope BOTH) = a PERSISTENT group rendered below the
//     active workspace's groups in BOTH toggle states (Decision A) — single instance,
//     no duplication/testid collision.
// Invariant: My Work ∪ My Team ∪ Recognition destinations == the pinned-layout
// producingManager destinations, per role (enforced by unit test).
const WORKSPACE_WORK_SECTIONS = [
  { label: 'My Production', ids: ['mp-report', 'mp-commission', 'mp-policies', 'my-war', 'mp-history', 'mp-financing'] },
  { label: 'Planning',      ids: ['mp-game-plan', 'mp-money-needs', 'mp-goals', 'planner'] },
];
const WORKSPACE_TEAM_SECTIONS = [
  { label: 'My Team', ids: [
    'overview', 'team', 'mastersheet', 'team-wars', 'monthly-recruiting', 'goals',
    'team-game-plans', 'persistency', 'compliance', 'campaigns', 'production-report', 'awards',
    'team-perf', 'settlements', 'financing', 'unit-financing', 'policy-reconciliation', 'agent-of-month', 'kiosk',
  ] },
];
const WORKSPACE_RECOGNITION_IDS = ['leaderboard'];

// Action items injected into the workspace layouts (no pinned-nav route).
const DAILY_LOG_ACTION = { id: 'mp-daily-log', label: 'Daily Log', action: 'log-today', Icon: CalendarCheck, testId: 'mp-tab-daily-log' };
const MEETINGS_ACTION  = { id: 'mp-meetings',  label: 'Meetings',  action: 'start-meeting', Icon: Presentation,  testId: 'mp-tab-meetings' };

/**
 * Resolve the workspace-partitioned producingManager nav for one workspace.
 *
 * Returns a FLAT item array in Sidebar's shape (sectionLabel demarcates groups —
 * consumed by the existing groupBySection), so render needs no new grouping path.
 * Role gating (branch-only items) and coming-soon disabling are applied exactly
 * as getNavConfig does. The persistent Recognition group is appended for BOTH
 * workspaces, so it survives the My Work ⇄ My Team toggle (Decision A).
 *
 * @param {'producingManager'} configKey  (only producingManager has workspaces)
 * @param {{ role?: string, workspace?: 'work'|'team' }} [opts]
 * @returns {Array} ordered nav items (sectionLabel-grouped)
 */
export function getWorkspaceGroups(configKey, opts = {}) {
  if (configKey !== 'producingManager') return [];
  const { role, workspace = 'work' } = opts;
  const byId = new Map(PRODUCING_MANAGER_NAV.map((i) => [i.id, i]));
  const out = [];

  // Push a section: the section label is carried by the first SURVIVING row
  // (lead action if present, else the first id that passes role gating) so a
  // role-gated-out lead never orphans the header.
  const pushSection = (label, ids, leadAction) => {
    let labelAssigned = false;
    if (leadAction) {
      out.push({ ...leadAction, sectionLabel: label });
      labelAssigned = true;
    }
    ids.forEach((id) => {
      const item = byId.get(id);
      if (!item) return; // route-faithful: drop an id with no descriptor
      if (item.roles && role && !item.roles.includes(role)) return; // branch-only gating
      const copy = { ...item };
      if (labelAssigned) delete copy.sectionLabel; // header already emitted
      else { copy.sectionLabel = label; labelAssigned = true; }
      out.push(copy);
    });
  };

  if (workspace === 'team') {
    WORKSPACE_TEAM_SECTIONS.forEach((s, i) =>
      pushSection(s.label, s.ids, i === 0 ? MEETINGS_ACTION : undefined));
  } else {
    WORKSPACE_WORK_SECTIONS.forEach((s, i) =>
      pushSection(s.label, s.ids, i === 0 ? DAILY_LOG_ACTION : undefined));
  }
  // Persistent Recognition group — both workspaces (Decision A).
  pushSection('Recognition', WORKSPACE_RECOGNITION_IDS);

  return applyComingSoon(out);
}

export default getNavConfig;
