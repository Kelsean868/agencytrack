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
  Presentation,
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
  { id: 'prospect-info',     label: 'Prospect Prep',     tabId: 'prospect-info',          Icon: Search,      testId: 'agent-tab-prospect-info' },
  { id: 'production-report', label: 'Production Report', tabId: 'production-report',      Icon: BarChart2,   testId: 'agent-tab-production-report' },
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
  { id: 'persistency',           label: 'Persistency Entry', tabId: 'persistency',        Icon: TrendingUp,   scope: 'TEAM' },
  { id: 'compliance',            label: 'Compliance',     tabId: 'compliance',            Icon: CheckCircle2 },
  { id: 'campaigns',             label: 'Campaigns',      tabId: 'campaigns',             Icon: Gift },
  { id: 'production-report',     label: 'Team Reports',   tabId: 'production-report',     Icon: LineChart,    scope: 'TEAM' },
  { id: 'awards',                label: 'Team Awards',    tabId: 'awards',                Icon: Trophy,       scope: 'TEAM' },
  { id: 'team-perf',             label: 'Team Roster',    tabId: 'team-perf',             Icon: LayoutList },
  { id: 'settlements',           label: 'Settlements',    tabId: 'settlements',           Icon: FileCheck },
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
  return items.map((item) => {
    const isSoon = item.soon === true || (item.tabId != null && COMING_SOON_TABS.has(item.tabId));
    return isSoon ? { ...item, disabled: true } : item;
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

export default getNavConfig;
