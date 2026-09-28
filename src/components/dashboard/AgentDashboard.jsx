import React, { useMemo, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  X, Download, Loader2, ArrowRight,
  ClipboardList, FileText, Star, History, UserCircle, Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatDateDisplay } from '../../utils/formatters';
import { getMostRecentSunday, weekNumber } from '../../utils/dateHelpers';
import { getDraft, getAgentSubmissions } from '../../services/submissionService';
import { getGoals, getCompanyMinimums, getGoalHierarchy, getSalesManagerUid } from '../../services/goalsService';
import { getMergedAwardsRuleset } from '../../services/awardsRulesetService';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';
import { resolveWeeklyAPIFloor, FLAT_WEEKLY_API_FALLBACK } from '../../utils/tenureFloors';
import { getAgentHistory } from '../../services/persistencyService';
import { getSettlements } from '../../services/settlementService';
import { extractFields, extractTotalProductionCredit } from '../../utils/extractFields';
import { generateAgentPDF } from '../../services/exportService';
import { getActiveCampaignsForAgent, getCampaignSubmissions } from '../../services/campaignService';
import WizardForm from '../wizard/WizardForm';
import { resolvePath } from '../wizard/WizardForm.helpers';
import DailyCaptureV2 from '../daily/DailyCaptureV2';
import { getDailyEntry, getDailyEntriesForWeek } from '../../services/dailyActivityService';
import { getWeeklyPlan } from '../../services/weeklyPlanService';
import { prefetchGamePlanYearDocs } from '../../services/gamePlanPrefetch';
import CareerPortal from '../profile/CareerPortal';
import ProfileScreen from '../profile/ProfileScreen';
import CallSourcesTab from '../callSources/CallSourcesTab';
import SettingsScreen from '../settings/SettingsScreen';
import ReportRangeModal from '../ui/ReportRangeModal';
import ProductionLeaderboardSurface from '../leaderboard/ProductionLeaderboardSurface';
import AgentAwardsPanel from '../awards/AgentAwardsPanel';
import HistoryTab from '../submissions/HistoryTab';
import { computeEarnedBadges } from '../gamification/BadgeGrid';
import { buildActivityEvents } from '../../utils/buildActivityEvents';
import WelcomeScreen from '../onboarding/WelcomeScreen';
import Shell from '../shell/Shell';
import ProductionReportTab from '../productionReport/ProductionReportTab';
import AgentPersistencyTab from '../agent/PersistencyTab';
import PolicyLedgerPanel from '../agent/PolicyLedgerPanel';
import CommissionAnchorStrip from '../agent/CommissionAnchorStrip';
import { getOwnPolicies } from '../../services/policiesService';
import { excludeImported } from '../../lib/portfolioImport/excludeImported';
import { deriveYearProduction } from '../../lib/ledgerProduction';
import LedgerLoadError from '../goals/LedgerLoadError';
import GamePlanScreen from './GamePlanV2';
import CommissionPlayground from '../goals/CommissionPlayground';
import DailyFAB from '../daily/DailyFAB';
import QuickAddMenu from '../shell/QuickAddMenu';
import { getQuickAddActions } from '../shell/quickAddConfig';
import AgentDashboardHomeV2 from './HomeV2';
import { formatHomeHeaderDate } from './HomeV2/homeDerivations';
import Avatar from '../ui/Avatar';
import { getTodayTT } from '../../utils/dateInputs';
import NewAgentEmptyState from './NewAgentEmptyState';
import AgentPlannerPanel from '../planner/AgentPlannerPanel';
import ProspectInfoPanel from '../agent/ProspectInfoPanel';
import { getNavConfig, tabTitleFromItems } from '../shell/navConfig';
import usePinnedNav from '../../hooks/usePinnedNav';
import useNavOrder from '../../hooks/useNavOrder';
import useMenuLayout from '../../hooks/useMenuLayout';
import MoneyNeedsPanel from '../agent/MoneyNeedsPanel';
import GapAnalysisPanel from '../goals/GapAnalysisPanel';
import GoalsCelebration from '../goals/GoalsCelebration';
import { resolveGoalsCelebration } from '../../lib/celebrations';
import {
  getGoalsCelebrated,
  setGoalsAnnualCelebrated,
  setGoalsStreakCelebratedMax,
} from '../../lib/celebrationPrefs';
import DerivedIncomePanel from '../goals/DerivedIncomePanel';
import AwardsReachPanel from '../goals/AwardsReachPanel';
import MdrtTracker from '../goals/MdrtTracker';
import FinancingSelfViewSkeleton from '../financing/FinancingSelfViewSkeleton';
import AgentReportView from '../profile/AgentReportView';
import { PERS_GATE_PCT } from '../../lib/persistency/calculations';
// FR agent redesign (docs/briefs/fr-agent-redesign-program.md) — FR-1 shell.
import useLook from '../../hooks/useLook';
import FrSidebar from '../fr/shell/FrSidebar';
import FrHubHeader from '../fr/shell/FrHubHeader';
import { frIconComponent } from '../fr/shell/frIconComponent';
import { FR_TABBAR, frFlatItems, frTitleFor } from '../fr/shell/frNav';

// PERF-01 — lazy-loaded: the financing tab is not the default view for most
// agent sessions, so its component + service reads stay out of the entry
// chunk until the tab is actually opened. FinancingSelfViewSkeleton (above)
// is a separate, tiny, eagerly-imported file so the Suspense fallback below
// renders instantly rather than waiting on the very chunk it stands in for.
const FinancingSelfView = lazy(() => import('../financing/FinancingSelfView'));

// Agent sidebar nav is centralized in shell/navConfig.js (Nav redesign PR-1) —
// resolved per-render via getNavConfig('agent', { showDailyCapture }) so the
// Daily Log item appears only for daily/hybrid-mode agents (mirrors DailyFAB).
// Coming-soon gating (prospect-info, planner) is applied inside getNavConfig.

// Mobile bottom-nav — 5-slot v2 layout: 2 tabs · center ＋ · 1 tab · More
// (the "More" button is auto-appended by MobileBottomNav when drawerNavItems is
// non-empty, so it is the 5th slot and the FAB sits dead-center). Center ＋ is
// "Create" (Quick-Add, PR-3); its dot is computed reactively below so the amber
// not-logged-today nudge mirrors the DailyFAB predicate exactly. Profile moved
// OUT of the bottom nav INTO the More drawer (v2 nav reorder) — injected in
// drawerNavItems below because AGENT_NAV has no profile row.
const BOTTOM_NAV = [
  { id: 'home',        label: 'Home',     tabId: 'dashboard',             Icon: ClipboardList },
  { id: 'history',     label: 'History',  tabId: 'history',               Icon: History       },
  { id: 'create',      label: 'Create',   action: 'quick-add',            Icon: FileText, fab: true },
  // Track J P6 — bottom-nav "Ranks" routes to the production-leaderboard tab.
  { id: 'leaderboard', label: 'Ranks',    tabId: 'production-leaderboard', Icon: Star          },
];

// Profile row for the mobile "More" drawer (v2 nav reorder). AGENT_NAV has no
// profile item (desktop reaches Profile via the sidebar avatar), so removing
// Profile from the bottom nav would strand it on mobile — this drawer row is its
// mobile home. Routes to the existing activeTab === 'profile' screen, which hosts
// its own Sign Out.
const PROFILE_NAV_ITEM = { id: 'profile', label: 'Profile', tabId: 'profile', Icon: UserCircle, sectionLabel: 'Account' };
// Settings v2 (Tier 2 · 2.4) — mobile More-drawer entry (desktop reaches Settings
// via the sidebar-foot gear). No sectionLabel so it joins Profile's Account group.
const SETTINGS_NAV_ITEM = { id: 'settings', label: 'Settings', tabId: 'settings', Icon: Settings };

// Tabs that need the agent's own policies: commission totals, the home
// delivery strip + production hero, and the Goals panels (production, H1).
const POLICY_TABS = new Set(['commission', 'dashboard', 'goals']);

export default function AgentDashboard() {
  const { user, userProfile, role, tenantId, branchId } = useAuth();
  // FR-D3: 'fr' only for an agent who opted in; everything below that reads
  // `fr` is a no-op otherwise, so the Nexus dashboard renders exactly as before.
  const fr = useLook() === 'fr';

  const [activeTab, setActiveTab]             = useState('dashboard');
  // Planner → Daily Capture handoff seed (screen 9). Set when the agent taps
  // "Carry into today's log"; blank-fills DailyCaptureV2 for today, then cleared.
  const [plannerSeed, setPlannerSeed]         = useState(null);
  const [prefillPolicy, setPrefillPolicy]     = useState(null);
  const [policyLedgerFilter, setPolicyLedgerFilter] = useState(null);
  const [showWizard, setShowWizard]           = useState(false);
  const [wizardWeek, setWizardWeek]           = useState(null);
  const [wizardInitialStep, setWizardInitialStep] = useState(1);
  const [wizardInitialScreen, setWizardInitialScreen] = useState(null);
  const [showDailyModal, setShowDailyModal]   = useState(false);
  const [showQuickAdd,   setShowQuickAdd]     = useState(false);
  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [todayDailyEntry, setTodayDailyEntry] = useState(null);
  const [todayDailyChecked, setTodayDailyChecked] = useState(false);

  const [currentWeekSub, setCurrentWeekSub]   = useState(null);
  const [allSubmissions, setAllSubmissions]    = useState([]);
  const [goals, setGoals]                      = useState(null);
  const [companyMinimums, setCompanyMinimums]  = useState(null);
  // E3: persistency now an array of E3-shaped records (oldest-first, ≤12 months).
  const [persistency, setPersistency]          = useState([]);
  const [settlements, setSettlements]          = useState([]);
  const [awardsRuleset, setAwardsRuleset]       = useState(DEFAULT_RULESET_2026);
  const [loading, setLoading]                  = useState(true);
  const [activeCampaigns, setActiveCampaigns]   = useState([]);
  const [campaignSubs, setCampaignSubs]         = useState({});
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [hierarchy, setHierarchy]               = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError]     = useState(null);
  // Goals-surface celebration takeover (annual hit / weekly-target streak).
  // null = none showing. Fires once per marker (persisted per uid+year).
  const [goalsCelebration, setGoalsCelebration] = useState(null);
  const [showWelcome, setShowWelcome]           = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);
  // S3b — committed plan + daily docs for the Standard drawer's plan-vs-actual rows.
  // undefined = loading, null = no plan committed for this week.
  const [committedPlan, setCommittedPlan]     = useState(undefined);
  const [weekDailyDocs, setWeekDailyDocs]     = useState([]);

  // Commission AnchorStrip — loaded lazily on first Commission tab visit.
  const [policies, setPolicies]               = useState(null);
  // The SAME fetch, unfiltered. The campaign card decides eligibility by
  // dateIssued, not by importSource (C-D10), so it must see imported docs —
  // and the operator's book is 100% imported, so the filtered array is empty
  // for exactly the agent whose campaign figure matters. Stored beside the
  // filtered one rather than re-fetched.
  const [policiesAll, setPoliciesAll]         = useState(null);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError]     = useState(false);
  const playgroundRef = useRef(null);

  const currentWeek  = useMemo(() => getMostRecentSunday(), []);
  const thisYear     = new Date().getFullYear();
  const displayName  = userProfile?.name ?? userProfile?.email ?? 'Agent';
  const roleLabel    = getRoleLabel(role);

  // E6 — logging mode: 'weekly' | 'daily' | 'hybrid'. Existing agents have no
  // field; default to hybrid per planning decision. Drives both the Daily Log
  // nav item and the DailyFAB visibility (same predicate).
  const loggingMode = userProfile?.loggingMode ?? 'hybrid';
  const showDailyCTA = loggingMode === 'daily' || loggingMode === 'hybrid';

  // Agent sidebar nav — centralized in shell/navConfig.js. Daily Log appears
  // only for daily/hybrid-mode agents (mirrors the DailyFAB predicate above).
  const navItems = useMemo(
    () => getNavConfig('agent', { showDailyCapture: showDailyCTA }),
    [showDailyCTA]
  );

  // Mobile More-drawer items: every nav entry whose tabId isn't already in
  // BOTTOM_NAV. Filtered by tabId — action items (Daily Log, Weekly Report)
  // have no tabId and are intentionally excluded from the drawer. Profile is
  // appended (v2 nav reorder): it left the bottom nav and AGENT_NAV has no
  // profile row, so it must be injected here or mobile users would strand it.
  // Guarded so it never duplicates if a profile row ever enters navItems.
  const drawerNavItems = useMemo(
    () => {
      const derived = navItems.filter(
        (item) => item.tabId && !BOTTOM_NAV.find((b) => b.tabId === item.tabId)
      );
      const withProfile = derived.some((i) => i.tabId === 'profile') ? derived : [...derived, PROFILE_NAV_ITEM];
      return withProfile.some((i) => i.tabId === 'settings') ? withProfile : [...withProfile, SETTINGS_NAV_ITEM];
    },
    [navItems]
  );

  // Mobile center ＋ dot — amber nudge when today not yet logged (PR-3).
  // Matches the DailyFAB predicate exactly: only on daily/hybrid loggingMode
  // and only once the today-check resolves (todayDailyChecked = true).
  const bottomNavItems = useMemo(
    () => BOTTOM_NAV.map((item) =>
      item.fab
        ? { ...item, dot: showDailyCTA && todayDailyChecked && !todayDailyEntry }
        : item
    ),
    [showDailyCTA, todayDailyChecked, todayDailyEntry]
  );

  // FR-1 nav (FR-D9): flat rows for the palette + More sheet, the phone tab bar,
  // and the More sheet minus what the tab bar already holds. Hub subs (Money)
  // are covered by the tab bar's `matchTabs`, so they stay out of the sheet.
  const frItems = useMemo(
    () => frFlatItems().map((i) => ({ ...i, Icon: frIconComponent(i.frIcon) })),
    []
  );
  const frBottomItems = useMemo(
    () => FR_TABBAR.map((i) => ({
      ...i,
      Icon: frIconComponent(i.frIcon),
      ...(i.fab ? { dot: showDailyCTA && todayDailyChecked && !todayDailyEntry } : {}),
    })),
    [showDailyCTA, todayDailyChecked, todayDailyEntry]
  );
  const frDrawerItems = useMemo(() => {
    const onBar = new Set(FR_TABBAR.flatMap((b) => [b.tabId, ...(b.matchTabs ?? [])]).filter(Boolean));
    const rows = frItems.filter((i) => !onBar.has(i.tabId));
    return [...rows, { ...SETTINGS_NAV_ITEM, sectionLabel: undefined }];
  }, [frItems]);

  // ★ Pinned-nav (Nav redesign PR-2) — seeds + persistence + pin/unpin.
  const { pinnedItems, isPinned, pin, unpin } = usePinnedNav({
    tenantId, uid: user?.uid, configKey: 'agent', navItems,
  });

  // ★ Sidebar drag-reorder (Fable Tier 1 · 1.4) — persisted per-config order.
  const { orderIds: navOrderIds, reorder: onNavReorder } = useNavOrder({
    tenantId, uid: user?.uid, configKey: 'agent',
  });

  // Menu layout (Nav redesign PR-4) — agents are clamped to `pinned` at the
  // resolver, so this is effectively a no-op for rendering (the agent shell has
  // no workspace path); the value is passed to ProfileScreen so the layout card
  // renders with workspace/both disabled. Defense-in-depth: even a forced
  // `workspace` pref returns `pinned` here.
  const { menuLayout, setMenuLayout } = useMenuLayout({ role, tenantId, uid: user?.uid });

  // Show welcome screen on first login (agents only)
  useEffect(() => {
    if (userProfile && userProfile.hasSeenWelcome === false && !userProfile.onboardingComplete && role === 'agent') {
      setShowWelcome(true);
    }
  }, [userProfile, role]);

  // Clear prefill + filter if agent navigates away from policy-ledger.
  useEffect(() => {
    if (activeTab !== 'policy-ledger') {
      setPrefillPolicy(null);
      setPolicyLedgerFilter(null);
    }
  }, [activeTab]);

  function handleOpenLapsedPolicies() {
    setPolicyLedgerFilter('lapsed');
    setActiveTab('policy-ledger');
  }

  // Home "Do next" → the Policy Ledger opened on one of its own filter chips.
  function handleOpenLedgerFilter(filter) {
    setPolicyLedgerFilter(filter);
    setActiveTab('policy-ledger');
  }

  const loadCoreData = useCallback(() => {
    if (!user?.uid || !tenantId) return;
    setLoading(true);
    setSubmissionsError(null);
    return Promise.all([
      getDraft(tenantId, user.uid, currentWeek).catch(() => null),
      getAgentSubmissions(tenantId, user.uid).catch((err) => {
        setSubmissionsError(err?.code === 'permission-denied' ? 'permission-denied' : 'load-error');
        return [];
      }),
      getGoals(tenantId, user.uid).catch(() => null),
      getAgentHistory(tenantId, user.uid, 12).catch(() => []),
      getSettlements(tenantId, user.uid, thisYear).catch(() => []),
      getCompanyMinimums(tenantId).catch(() => null),
      getMergedAwardsRuleset(tenantId, thisYear).catch(() => DEFAULT_RULESET_2026),
    ]).then(([weekSub, subs, agentGoals, pers, setts, mins, ruleset]) => {
      setCurrentWeekSub(weekSub);
      setAllSubmissions(subs);
      setGoals(agentGoals);
      setPersistency(pers);
      setSettlements(setts);
      setCompanyMinimums(mins);
      setAwardsRuleset(ruleset);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user?.uid, tenantId, currentWeek, thisYear]);

  useEffect(() => { loadCoreData(); }, [loadCoreData]);

  // POC (feat/gp-prefetch): warm Game Plan's 3 year-docs during dashboard idle so
  // the gated Game Plan entrance (feat/gp-data-gated-entrance) lands on populated
  // content — beating the 400ms cap even on field networks (see gamePlanPrefetch.js
  // for why listeners, not a one-time getDoc). AgentDashboard-only — the same opt-in
  // surface as the gated entrance; ManagerDashboard / the default GamePlanScreen path
  // are untouched. Background, non-blocking, failure-silent; Game Plan still fetches
  // on mount as the fallback. AgentDashboard stays mounted across tab switches, so the
  // listeners stay warm until the user opens Game Plan; torn down on unmount.
  useEffect(() => {
    if (!user?.uid || !tenantId) return undefined;
    let unsub = () => {};
    // Best-effort; the prefetch helper is already failure-silent, but wrap the call
    // too so nothing here can ever break the dashboard.
    const run = () => {
      try { unsub = prefetchGamePlanYearDocs(tenantId, user.uid, thisYear); } catch { /* noop */ }
    };
    const hasIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
    let cancel;
    if (hasIdle) {
      const handle = window.requestIdleCallback(run, { timeout: 2000 });
      cancel = () => { if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle); };
    } else {
      const handle = setTimeout(run, 400);
      cancel = () => clearTimeout(handle);
    }
    return () => { cancel(); if (typeof unsub === 'function') unsub(); };
  }, [user?.uid, tenantId, thisYear]);

  // Pull-to-refresh — enabled on data-feed tabs only.
  // Explicitly excluded: game-plan, money-needs, and all planning/tool tabs
  // where an accidental pull mid-entry could feel disruptive.
  const [ptrRevision, setPtrRevision] = useState(0);
  const PTR_AGENT_TABS = new Set(['dashboard', 'production-leaderboard', 'policy-ledger']);
  const onPullRefresh = useCallback(() => {
    if (activeTab === 'dashboard') return loadCoreData();
    setPtrRevision((r) => r + 1);
  }, [activeTab, loadCoreData]);

  // S3b — fetch committed plan + daily docs for the Standard drawer. Each
  // degrades gracefully (null plan / empty docs) so a fetch error never blocks
  // the dashboard render. Exposed as a named callback so GamePlanV2 can trigger
  // a refetch after a same-session commit or delete (prevents in-session staleness
  // where the Standard drawer would still show the old state until a full page reload).
  const loadWeekPlanData = useCallback(() => {
    if (!tenantId || !user?.uid) return;
    Promise.all([
      getWeeklyPlan(tenantId, user.uid, currentWeek).catch(() => null),
      getDailyEntriesForWeek(tenantId, user.uid, currentWeek).catch(() => []),
    ]).then(([plan, docs]) => {
      setCommittedPlan(plan ?? null);
      setWeekDailyDocs(Array.isArray(docs) ? docs : []);
    });
  }, [tenantId, user?.uid, currentWeek]);

  useEffect(() => {
    setCommittedPlan(undefined); // reset to loading on week/auth change
    loadWeekPlanData();
  }, [loadWeekPlanData]);

  // Load own policies lazily when the Commission tab is first visited.
  const loadPolicies = useCallback(async () => {
    if (!tenantId || !user?.uid) return;
    setPoliciesLoading(true);
    setPoliciesError(false);
    try {
      // `policies` feeds CommissionAnchorStrip (commission totals) and the v2
      // home DeliveryStripCard (settled/undelivered) — both are aggregate or
      // delivery surfaces, so neither wants imported docs (ruling 5e). The
      // ledger list is PolicyLedgerPanel's own fetch and is NOT filtered.
      //
      // `policiesAll` is the same response, unfiltered, for the campaign card
      // and for `deriveYearProduction` (the production heroes, H1 · R5: current-
      // year production is decided by date, not origin). One fetch, two views:
      // filtering at the consumer rather than at the reader is what lets those
      // paths apply the date test while every other consumer keeps ruling 5e.
      // The raw list itself never reaches a new child — the heroes receive the
      // derived figures, and the prop-provenance guard pins both.
      const own = await getOwnPolicies(tenantId, user.uid);
      setPoliciesAll(own);
      setPolicies(excludeImported(own));
    } catch {
      setPoliciesError(true);
    } finally {
      setPoliciesLoading(false);
    }
  }, [tenantId, user?.uid]);

  // Load own policies lazily on the Commission tab, the v2 home ('dashboard')
  // and Goals — the home DeliveryStripCard needs settled/undelivered policies,
  // and the home hero plus every Goals panel read production from the ledger.
  // Fires at most once (the `policies === null` guard); reuses the same fetch.
  useEffect(() => {
    if (POLICY_TABS.has(activeTab) && policies === null) loadPolicies();
  }, [activeTab, loadPolicies, policies]);

  // Resolved personal annual API: agent's own commitment if set, else the
  // tenant company-floor minimum, else 200000 (matches getCompanyMinimums
  // default in goalsService.js). The chain mirrors the kickoff brief's S1
  // resolution.
  const personalAnnualAPI = useMemo(
    () => goals?.personalAnnualAPI || companyMinimums?.annualAPI || 200000,
    [goals?.personalAnnualAPI, companyMinimums?.annualAPI]
  );

  // Tenure-resolved weekly API floor for the Weekly Standard card's API row.
  // Spreads companyMinimums and overrides weeklyActivityFloors.api with the
  // resolved value so WeeklyStandardCard reads through its existing prop
  // shape without needing to know about tenure. Missing contractStartDate
  // → flat 4800 fallback (default already in DEFAULT_WEEKLY_ACTIVITY_FLOORS).
  const resolvedMinimums = useMemo(() => {
    if (!companyMinimums) return companyMinimums;
    const resolvedWeeklyApi = resolveWeeklyAPIFloor({
      contractStartDate: userProfile?.contractStartDate ?? null,
      tenureApiFloors: companyMinimums.tenureApiFloors,
      fallback: FLAT_WEEKLY_API_FALLBACK,
    });
    return {
      ...companyMinimums,
      weeklyActivityFloors: {
        ...(companyMinimums.weeklyActivityFloors ?? {}),
        api: resolvedWeeklyApi,
      },
    };
  }, [companyMinimums, userProfile?.contractStartDate]);

  // Stable "now" so the AgentAwardsPanel currentDate prop + the activityEvents
  // memo keep a constant identity across renders (EFF-009).
  const now = useMemo(() => new Date(), []);

  // Activity feed events (B3). Submission events + 3 weekly-criteria
  // badge events, derived client-side from already-loaded data. Capped
  // at 25 items in the last 7 days inside the util.
  const earnedBadges = useMemo(
    () => computeEarnedBadges(allSubmissions),
    [allSubmissions]
  );
  const activityEvents = useMemo(
    () => buildActivityEvents(allSubmissions, earnedBadges, now),
    [allSubmissions, earnedBadges, now]
  );

  // Production for the year, from the LEDGER (H1 · R1). null until the policy
  // fetch lands, so no hero ever shows a confident TTD 0 while it is loading.
  const ledgerProduction = useMemo(
    () => (policiesAll
      ? deriveYearProduction(policiesAll, { year: thisYear, weekStarting: currentWeek, submissions: allSubmissions })
      : null),
    [policiesAll, thisYear, currentWeek, allSubmissions],
  );
  const ledgerPending = policiesAll === null && !policiesError;

  // Weekly reports are ACTIVITY (R1). `activityApps` is the self-reported apps
  // count, kept under its own name; `api` and `apps` are the ledger's settled
  // figures, so every panel that reads `ytdTotals.api` reads the ledger.
  const ytdTotals = useMemo(() => {
    const yearSubs = allSubmissions.filter(
      (s) => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
    );
    const activity = yearSubs.reduce((acc, s) => {
      const f = extractFields(s);
      acc.activityApps += parseFloat(f.applicationsSold) || 0;
      acc.ffiConducted += parseFloat(f.ffiConducted)     || 0;
      acc.ciConducted  += parseFloat(f.ciConducted)      || 0;
      acc.dials        += parseFloat(f.totalTelAttempts)  || 0;
      return acc;
    }, { activityApps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 });
    return {
      ...activity,
      api:  ledgerProduction?.settled.api ?? 0,
      apps: ledgerProduction?.settled.apps ?? 0,
    };
  }, [allSubmissions, thisYear, ledgerProduction]);

  const ytdPersistency = useMemo(
    () => persistency[persistency.length - 1]?.persistency ?? null,
    [persistency],
  );

  // Last 4 submitted weeks for KPI sparklines (oldest → newest)
  const kpiData = useMemo(() => {
    return allSubmissions
      .filter((s) => s.status === 'submitted')
      .sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? ''))
      .slice(0, 4)
      .reverse()
      .map((s) => ({ ...extractFields(s), totalProductionCredit: extractTotalProductionCredit(s) }));
  }, [allSubmissions]);

  // Fetch active campaigns for this agent
  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setCampaignsLoading(true);
    getActiveCampaignsForAgent(tenantId, user.uid, userProfile?.unitId ?? null)
      .then(async (camps) => {
        setActiveCampaigns(camps);
        const subsMap = {};
        await Promise.all(
          camps.map(async (c) => {
            // Own-scoped read: the submissions list rule only allows an agent
            // query constrained to their own agentId. Progress renders from own
            // rows; cross-agent ranks stay unavailable for agents by design.
            const subs = await getCampaignSubmissions(tenantId, c.startDate, c.endDate, { agentId: user.uid })
              .catch((e) => { console.error('[AgentDashboard] campaign submissions load failed:', e); return []; });
            subsMap[c.id] = subs;
          })
        );
        setCampaignSubs(subsMap);
      })
      .catch(console.error)
      .finally(() => setCampaignsLoading(false));
  }, [user?.uid, tenantId, userProfile?.unitId]);

  // Today's date in agent's local time — same convention as the modal.
  const today = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Pre-flight: is today's daily entry already logged? Drives the
  // "haven't logged today" dashboard banner (v1 nudge fallback while
  // push notifications are deferred to a follow-up PR).
  useEffect(() => {
    if (!user?.uid || !showDailyCTA) {
      setTodayDailyChecked(true);
      return;
    }
    getDailyEntry(tenantId, user.uid, today)
      .then(setTodayDailyEntry)
      .catch(() => setTodayDailyEntry(null))
      .finally(() => setTodayDailyChecked(true));
  }, [user?.uid, today, showDailyCTA, tenantId]);

  const refreshDailyEntry = () => {
    if (!user?.uid) return;
    getDailyEntry(tenantId, user.uid, today).then(setTodayDailyEntry).catch(() => {});
  };

  // Fetch goal hierarchy for gap analysis (includes SM tier when SM exists)
  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setHierarchyLoading(true);
    setHierarchyError(null);
    getSalesManagerUid(tenantId)
      .catch(() => null)
      .then((smUid) =>
        getGoalHierarchy(tenantId, userProfile?.unitId ?? null, new Date().getFullYear(), user.uid, smUid)
      )
      .then(setHierarchy)
      .catch((e) => {
        console.error(e);
        setHierarchyError('Failed to load goal hierarchy.');
      })
      .finally(() => setHierarchyLoading(false));
  }, [user?.uid, tenantId, userProfile?.unitId]);

  // Goals celebration trigger — evaluate once data is ready + the Goals tab is
  // open. Fire-and-forget: persist the marker so each moment fires ONCE (annual
  // per year, streak per milestone). resolveGoalsCelebration returns null on the
  // next pass once the marker is set, so this never loops. Quarter is skip-
  // logged (no per-quarter target in the hierarchy — see GoalsCelebration).
  useEffect(() => {
    if (activeTab !== 'goals' || hierarchyLoading || !hierarchy || !user?.uid) return;
    // ytdTotals.api is the ledger's settled API (H1); wait for it rather than
    // judging the annual goal against a figure that has not loaded yet.
    if (!ledgerProduction) return;
    if (goalsCelebration) return; // already showing one
    const weeklyTarget = resolvedMinimums?.weeklyActivityFloors?.api ?? 4800;
    const celebrated = getGoalsCelebrated(user.uid, thisYear);
    const result = resolveGoalsCelebration({
      hierarchy,
      ytdTotals,
      submissions: allSubmissions,
      year: thisYear,
      weeklyTarget,
      celebrated,
    });
    if (!result) return;
    if (result.type === 'annual') setGoalsAnnualCelebrated(user.uid, thisYear);
    else if (result.type === 'streak') setGoalsStreakCelebratedMax(user.uid, thisYear, result.milestone);
    setGoalsCelebration(result);
  }, [
    activeTab, hierarchyLoading, hierarchy, ytdTotals, allSubmissions,
    user?.uid, thisYear, resolvedMinimums, goalsCelebration, ledgerProduction,
  ]);

  // R4 — the reconciliation note links to the ledger's create form. An empty
  // prefill object opens PolicyLedgerPanel on its form view.
  const openLedgerCreate = () => {
    setPrefillPolicy({});
    setActiveTab('policy-ledger');
  };
  const retryPolicies = () => { setPolicies(null); setPoliciesError(false); };

  // The Policy Ledger wrote a policy. Mark our copy stale: `policies === null`
  // makes the lazy-load effect refetch the next time a POLICY_TABS tab opens,
  // so returning to Home re-derives the hero with no page reload. `policiesAll`
  // is kept until the refetch lands, so the hero never flashes to empty.
  const markPoliciesStale = useCallback(() => { setPolicies(null); }, []);

  // Unlock banner
  const showUnlockBanner =
    !unlockDismissed &&
    currentWeekSub?.status === 'draft' &&
    !!currentWeekSub?.unlockedBy;

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  // Bottom-nav + Quick-Add action dispatch.
  // 'quick-add' opens the QuickAddMenu (from the center ＋ on mobile or the
  // desktop pencil FAB). 'submit' / 'log-today' preserve existing modal paths.
  // Tab-based actions ('policy-ledger', 'goals') route via setActiveTab.
  const handleAction = (action) => {
    if (action === 'quick-add') {
      setShowQuickAdd(true);
    } else if (action === 'submit') {
      if (loggingMode === 'daily') {
        setShowDailyModal(true);
      } else {
        setShowWizard(true);
      }
    } else if (action === 'log-today') {
      setShowDailyModal(true);
    } else if (action === 'policy-ledger') {
      setActiveTab('policy-ledger');
    } else if (action === 'goals') {
      setActiveTab('goals');
    }
  };

  const openWizardForWeek = (week, draft = null) => {
    const path = resolvePath(loggingMode, draft);
    // Fast path lands on the Confirm screen (Wizard v3 Phase 1); it advances to
    // step 10 (Rate) on confirm. Full path opens at step 1 with no Confirm.
    setWizardInitialStep(path === 'fast' ? 10 : 1);
    setWizardInitialScreen(path === 'fast' ? 'confirm' : null);
    setWizardWeek(week);
    setShowWizard(true);
  };

  // ── PDF report modal ───────────────────────────────────────────────────
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [generating,      setGenerating]      = useState(false);

  const handleOpenReportModal = () => setReportModalOpen(true);
  const handleReportGenerate  = async (weekRange) => {
    setReportModalOpen(false);
    setGenerating(true);
    try {
      await generateAgentPDF({
        agentInfo: {
          displayName,
          email: userProfile?.email ?? user?.email ?? '',
          role: roleLabel,
          careerLevel: userProfile?.levelTitle ?? userProfile?.careerLevel ?? 'Agent',
        },
        submissions: allSubmissions,
        goals,
        weekRange,
        confirmedSettlements: settlements,
        agentProfile: userProfile,
        persistency,
        ruleset: awardsRuleset,
        companyMinimums,
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (showWizard) {
    return <WizardForm initialWeek={wizardWeek} initialStep={wizardInitialStep} initialScreen={wizardInitialScreen} goal={goals} floors={resolvedMinimums?.weeklyActivityFloors} onClose={() => { setShowWizard(false); setWizardWeek(null); setWizardInitialStep(null); setWizardInitialScreen(null); }} />;
  }

  if (showDailyModal) {
    return (
      <DailyCaptureV2
        seedCounts={plannerSeed}
        onClose={() => {
          setShowDailyModal(false);
          setPlannerSeed(null);
          refreshDailyEntry();
        }}
        onReviewSubmit={(week, draftHint) => {
          setShowDailyModal(false);
          // Phase 1.2 (brief premise corrected — see PR description): route on the
          // REVIEWED (completed) week's real aggregation, which DailyCaptureV2
          // computes from its weekDocs and passes through here. Do NOT use
          // currentWeekSub — on Sunday (the only day this deep-link appears) it is
          // the *current* (new, empty) week's draft, not the reviewed week.
          // resolvePath → 'fast' (→ Confirm) when the reviewed week has daily
          // entries; 'full' otherwise.
          openWizardForWeek(week, draftHint);
        }}
      />
    );
  }

  return (
    <Shell
      navItems={fr ? frItems : navItems}
      bottomNavItems={fr ? frBottomItems : bottomNavItems}
      drawerNavItems={fr ? frDrawerItems : drawerNavItems}
      showWorkspaceToggle={menuLayout !== 'pinned'}
      showPinnedZone={!fr}
      sidebar={fr ? (
        <FrSidebar
          activeTab={activeTab}
          onNavigate={setActiveTab}
          onAction={handleAction}
          report={currentWeekSub?.status === 'submitted'
            ? { done: true, title: 'Weekly report is in', sub: 'Tap to review it' }
            : { done: false, title: 'Weekly report', sub: 'Submit when your week is done' }}
          user={{ name: displayName, roleLabel, photoURL: userProfile?.photoURL }}
          onSignOut={handleSignOut}
        />
      ) : undefined}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onAction={handleAction}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={fr
        ? frTitleFor(activeTab, activeTab === 'profile' ? 'Me' : 'AgencyTrack')
        : activeTab === 'dashboard'
        ? 'Home'
        : tabTitleFromItems(navItems, activeTab, activeTab === 'settings' ? 'Settings' : activeTab === 'profile' ? 'Profile' : 'Dashboard')}
      // Home redesign R1: a 56px mobile header (avatar · Home · mono date ·
      // notifications) and, at >= 1024px, the Submit button in the page header.
      topbarVariant={activeTab === 'dashboard' ? 'home' : undefined}
      topbarAvatar={activeTab === 'dashboard'
        ? <Avatar src={userProfile?.photoURL} name={userProfile?.name ?? ''} size="md" />
        : undefined}
      topbarMobileCrumb={activeTab === 'dashboard' ? formatHomeHeaderDate(getTodayTT()) : undefined}
      topbarActions={activeTab === 'dashboard' && !loading && allSubmissions.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="hidden lg:inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-[18px] text-sm font-bold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-primary-dark"
        >
          Submit weekly report
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      ) : undefined}
      topbarCrumb={(() => {
        const d = new Date();
        const weekday = d.toLocaleDateString('en-TT', { weekday: 'long' });
        const date    = d.toLocaleDateString('en-TT', { day: 'numeric', month: 'long' });
        const weekNum = weekNumber(d);
        return `${displayName} · ${weekday} ${date} · Week ${weekNum}`;
      })()}
      onSignOut={handleSignOut}
      onPullRefresh={PTR_AGENT_TABS.has(activeTab) ? onPullRefresh : undefined}
      navScopeId={user?.uid}
      quickAddActions={getQuickAddActions('agent')}
      pinnedItems={pinnedItems}
      isPinned={isPinned}
      onPin={pin}
      onUnpin={unpin}
      navOrderIds={navOrderIds}
      onNavReorder={onNavReorder}
    >
      {/* Quick-Add FAB (desktop pencil) — opens popover on click. Hidden on
          mobile (<768px) via hidden md:flex in DailyFAB; the mobile center ＋
          triggers the sheet variant instead (via BOTTOM_NAV 'quick-add' action). */}
      {showDailyCTA && (
        <DailyFAB
          onClick={() => setShowQuickAdd(true)}
          todayLogged={todayDailyChecked ? !!todayDailyEntry : true}
        />
      )}

      {/* Quick-Add menu — popover on desktop, sheet on mobile */}
      {showQuickAdd && (
        <QuickAddMenu
          actions={getQuickAddActions('agent')}
          onSelect={handleAction}
          onClose={() => setShowQuickAdd(false)}
          todayLogged={todayDailyChecked ? !!todayDailyEntry : true}
        />
      )}

      {/* Welcome / onboarding overlay */}
      {showWelcome && (
        <WelcomeScreen onComplete={() => setShowWelcome(false)} />
      )}

      {/* Report range modal */}
      {reportModalOpen && (
        <ReportRangeModal
          onGenerate={handleReportGenerate}
          onClose={() => setReportModalOpen(false)}
        />
      )}

      {/* Unlock banner */}
      {showUnlockBanner && (
        <button
          onClick={() => openWizardForWeek(currentWeekSub.weekStarting, currentWeekSub)}
          className="w-full text-left mb-4 flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-ink">Report Unlocked</p>
            <p className="text-xs text-warning-ink/80 mt-0.5">
              Your report for week of {formatDateDisplay(currentWeekSub.weekStarting)} was unlocked by{' '}
              {currentWeekSub.unlockedByName ?? 'your manager'}. Tap to review and resubmit.
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setUnlockDismissed(true); }}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-warning/60 hover:text-warning transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </button>
      )}

      {/* ── Screen-enter (redesign-addendum §2): the tab-content region fades +
          rises 8px on tab navigation. Keyed on activeTab so the CSS animation
          replays each switch. Wraps ONLY the tab blocks — the fixed overlays
          (DailyFAB, QuickAddMenu, modals) above stay outside so the transform
          never reparents their containing block. Gated + degrades in index.css. */}
      {/* POC (data-gated entrance): Game Plan OWNS its own entrance internally,
          held until its data is ready (see GamePlanV2/index.jsx gatedEntrance).
          Suppress the dashboard-level screen-enter for game-plan ONLY so the fade
          plays once on populated content instead of firing on the skeleton — all
          other tabs are unchanged. */}
      {/* FR-1: hub section chips (Money, Numbers) — outside the keyed wrapper so
          they stay put while the section below changes. Null for non-hub routes. */}
      {fr && <FrHubHeader activeTab={activeTab} onNavigate={setActiveTab} />}
      <div key={activeTab} className={activeTab === 'game-plan' ? undefined : 'screen-enter'}>
      {/* ── DASHBOARD TAB (v2 home — Hero + PulseStrip + Recent) ── */}
      {activeTab === 'dashboard' && (
        loading ? (
          // Guard the empty-vs-populated branch until data has loaded —
          // allSubmissions starts [] while loading, which would briefly flash
          // the new-agent empty state to an agent who actually has submissions
          // (Gemini #715). Skeleton matches the other tabs' loading treatment.
          <div className="space-y-4" data-testid="agent-dashboard-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-border/40 animate-pulse" />
            ))}
          </div>
        ) : allSubmissions.length === 0 ? (
          <NewAgentEmptyState
            firstName={userProfile?.name?.trim()?.split(/\s+/)[0] || ''}
            committedGoal={goals?.personalAnnualAPI ?? null}
            onStart={() => setShowWizard(true)}
          />
        ) : (
          <AgentDashboardHomeV2
            ytdTotals={ytdTotals}
            ledgerProduction={ledgerProduction}
            ledgerPending={ledgerPending}
            ledgerError={policiesError}
            onRetryLedger={retryPolicies}
            onOpenLedgerCreate={openLedgerCreate}
            personalAnnualAPI={personalAnnualAPI}
            personalGoalAPI={goals?.personalAnnualAPI ?? null}
            kpiData={kpiData}
            allSubmissions={allSubmissions}
            resolvedMinimums={resolvedMinimums}
            currentWeekSub={currentWeekSub}
            persistency={persistency}
            settlements={settlements}
            awardsRuleset={awardsRuleset}
            agentProfile={userProfile}
            activityEvents={activityEvents}
            activeCampaigns={activeCampaigns}
            campaignsLoading={campaignsLoading}
            campaignPolicies={policiesAll}
            campaignSubs={campaignSubs}
            agentUid={user?.uid}
            policies={policies}
            showDailyCTA={showDailyCTA}
            todayDailyChecked={todayDailyChecked}
            todayDailyEntry={todayDailyEntry}
            submissionsError={submissionsError}
            committedPlan={committedPlan}
            weekDailyDocs={weekDailyDocs}
            weekStart={currentWeek}
            onSubmit={() => setShowWizard(true)}
            onLogToday={() => setShowDailyModal(true)}
            onOpenTab={setActiveTab}
            onOpenLedgerFilter={handleOpenLedgerFilter}
          />
        )
      )}

      {/* ── CAREER TAB ── */}
      {activeTab === 'career' && (
        loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-border/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <CareerPortal
            submissions={allSubmissions}
            user={userProfile}
            persistencyData={persistency}
            hierarchy={hierarchy}
            hierarchyLoading={hierarchyLoading}
            hierarchyError={hierarchyError}
            ytdTotals={ytdTotals}
          />
        )
      )}

      {/* ── AWARDS TAB ── */}
      {activeTab === 'awards' && (
        loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-border/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleOpenReportModal}
              disabled={generating}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 size={15} className="animate-spin" /> Generating…</>
              ) : (
                <><Download size={15} /> Download My Performance Report</>
              )}
            </button>
            <AgentAwardsPanel
              activeCampaigns={activeCampaigns}
              submissions={allSubmissions}
              confirmedSettlements={settlements}
              agentProfile={userProfile}
              currentDate={now}
              ruleset={awardsRuleset}
              persistency={persistency}
            />
          </div>
        )
      )}

      {/* ── PROSPECT INFO (Joint-Call Prep) TAB — un-gated item 3.5 ── */}
      {activeTab === 'prospect-info' && <ProspectInfoPanel />}

      {activeTab === 'call-sources' && <CallSourcesTab />}

      {/* ── PLANNER TAB (item 3.2 — agent Planner & Scheduler) ── */}
      {activeTab === 'planner' && (
        <AgentPlannerPanel
          tenantId={tenantId}
          agentId={user?.uid}
          agentUnitId={userProfile?.unitId ?? ''}
          agentBranchId={branchId ?? ''}
          callerRole={role}
          weeklyFloors={resolvedMinimums?.weeklyActivityFloors}
          onCarryToDaily={(seed) => { setPlannerSeed(seed); setShowDailyModal(true); }}
        />
      )}

      {/* ── POLICY LEDGER TAB ── */}
      {activeTab === 'policy-ledger' && (
        <PolicyLedgerPanel
          key={ptrRevision}
          initialForm={prefillPolicy}
          onPrefillConsumed={() => setPrefillPolicy(null)}
          initialFilter={policyLedgerFilter}
          onPoliciesChanged={markPoliciesStale}
          ruleset={awardsRuleset}
          persistency={persistency}
        />
      )}

      {/* ── GAME PLAN HUB (v2 — Planning parent) ── */}
      {activeTab === 'game-plan' && (
        <GamePlanScreen
          gatedEntrance
          committedAnnualAPI={goals?.personalAnnualAPI ?? null}
          onOpenTab={setActiveTab}
          avgPolicyAPI={goals?.playgroundAvgPolicyAPI ?? null}
          prospectRatio={goals?.playgroundProspectRatio ?? null}
          submissions={allSubmissions}
          weeklyActivityFloors={resolvedMinimums?.weeklyActivityFloors ?? null}
          dataLoading={loading}
          dataError={Boolean(submissionsError)}
          onRetry={loadCoreData}
          onPlanChanged={loadWeekPlanData}
        />
      )}

      {activeTab === 'money-needs' && <MoneyNeedsPanel onOpenTab={setActiveTab} />}

      {/* ── GOALS TAB ── */}
      {activeTab === 'goals' && (
        <>
          {policiesError && (
            <LedgerLoadError onRetry={retryPolicies} />
          )}
          <GapAnalysisPanel
            hierarchy={hierarchy}
            ytdTotals={ytdTotals}
            loading={hierarchyLoading || ledgerPending}
            error={hierarchyError}
            ytdPersistency={ytdPersistency}
            persistencyFloor={companyMinimums?.persistency ?? PERS_GATE_PCT}
            contractStartDate={userProfile?.contractStartDate}
          />
          <div className="mt-4 border-t border-border pt-4">
            <DerivedIncomePanel
              hierarchy={hierarchy}
              ytdTotals={ytdTotals}
              commissionRate={parseFloat(userProfile?.commissionRate) || null}
              loading={hierarchyLoading || ledgerPending}
            />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <AwardsReachPanel
              submissions={allSubmissions}
              confirmedSettlements={settlements}
              agentProfile={userProfile}
              ruleset={awardsRuleset}
            />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <MdrtTracker
              ytdTotals={ytdTotals}
              loading={loading || ledgerPending}
            />
          </div>
        </>
      )}

      {/* Goals celebration takeover (annual hit / weekly-target streak) */}
      {goalsCelebration && (
        <GoalsCelebration
          celebration={goalsCelebration}
          annualTarget={Number(hierarchy?.personal?.api) || 0}
          ytdApi={Number(ytdTotals?.api) || 0}
          streak={goalsCelebration.type === 'streak' ? goalsCelebration.milestone : 0}
          onClose={() => setGoalsCelebration(null)}
        />
      )}

      {/* ── COMMISSION TAB ── */}
      {activeTab === 'commission' && (
        <div className="flex flex-col gap-4">
          <CommissionAnchorStrip
            policies={policies || []}
            loading={policiesLoading}
            error={policiesError}
            onRetry={() => { setPolicies(null); setPoliciesError(false); }}
            persistencyHistory={persistency}
            committedAnnualAPI={goals?.personalAnnualAPI ?? null}
            commissionRate={parseFloat(userProfile?.commissionRate) || 35}
            onScrollToPlayground={() => playgroundRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />
          <div ref={playgroundRef}>
            <CommissionPlayground
              submissions={allSubmissions}
              agentId={user?.uid}
              tenantId={tenantId}
              currentGoal={goals?.personalAnnualAPI ?? null}
              onGoalSaved={() => getGoals(tenantId, user.uid).then(setGoals)}
            />
          </div>
        </div>
      )}

      {/* ── PERSISTENCY TAB ── */}
      {activeTab === 'persistency' && <AgentPersistencyTab onViewLapsedPolicies={handleOpenLapsedPolicies} activeCampaigns={activeCampaigns} />}

      {/* ── PRODUCTION REPORT TAB ── */}
      {activeTab === 'production-report' && (
        <ProductionReportTab userRole={role} onDownloadPDF={handleOpenReportModal} generating={generating} />
      )}

      {/* ── REPORT TAB (Tier 1 · 1.2 — live twin of the Performance Report PDF) ── */}
      {activeTab === 'agent-report' && (
        <AgentReportView
          layout="wide"
          submissions={allSubmissions}
          settlements={settlements}
          goals={goals}
          persistency={persistency}
          ruleset={awardsRuleset}
          agentProfile={userProfile}
          displayName={displayName}
          roleLabel={roleLabel}
          loading={loading}
          error={Boolean(submissionsError)}
          onRetry={loadCoreData}
          onDownloadPDF={handleOpenReportModal}
          generating={generating}
          now={now}
        />
      )}

      {/* ── FINANCING SELF-VIEW TAB (Track K · K9 — read-only, own uid) ── */}
      {activeTab === 'financing' && (
        <Suspense fallback={<FinancingSelfViewSkeleton />}>
          <FinancingSelfView tenantId={tenantId} subjectUid={user?.uid} />
        </Suspense>
      )}

      {/* ── LEADERBOARD TAB (Track J P6 — production-based, nav-driven) ── */}
      {activeTab === 'production-leaderboard' && <ProductionLeaderboardSurface key={ptrRevision} />}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <ProfileScreen menuLayout={menuLayout} onMenuLayoutChange={setMenuLayout} />
      )}

      {/* ── SETTINGS TAB (Tier 2 · 2.4) ── */}
      {activeTab === 'settings' && (
        <SettingsScreen
          role={role}
          roleLabel={roleLabel}
          userProfile={userProfile}
          tenantId={tenantId}
          uid={user?.uid}
          onOpenProfile={() => setActiveTab('profile')}
        />
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <HistoryTab
          submissions={allSubmissions}
          loading={loading}
          onDownload={handleOpenReportModal}
          generating={generating}
          weeklyTarget={resolvedMinimums?.weeklyActivityFloors?.api ?? 4800}
          onStartReport={() => setShowWizard(true)}
          onEditWeek={(weekStarting, sub) => openWizardForWeek(weekStarting, sub)}
        />
      )}
      </div>
    </Shell>
  );
}
