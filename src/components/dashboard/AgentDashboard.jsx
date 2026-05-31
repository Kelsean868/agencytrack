import React, { useMemo, useState, useEffect } from 'react';
import {
  X, Download, Loader2, AlertTriangle,
  ClipboardList, FileText, Home, NotebookPen, Wallet, Target, Zap, Repeat, Search, Medal, Shield,
  Star, History, UserCircle, BarChart2, BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { getDraft, getAgentSubmissions } from '../../services/submissionService';
import { getGoals, getCompanyMinimums, getGoalHierarchy, getSalesManagerUid } from '../../services/goalsService';
import { getAwardsRuleset } from '../../services/awardsRulesetService';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';
import { resolveWeeklyAPIFloor, FLAT_WEEKLY_API_FALLBACK } from '../../utils/tenureFloors';
import { getAgentHistory } from '../../services/persistencyService';
import { getSettlements } from '../../services/settlementService';
import { extractFields, extractTotalProductionCredit } from '../../utils/extractFields';
import { generateAgentPDF } from '../../services/exportService';
import { getActiveCampaignsForAgent, getCampaignSubmissions } from '../../services/campaignService';
import { aggregateAPI } from '../../utils/aggregateAPI';
import WizardForm from '../wizard/WizardForm';
import DailyEntryModal from '../daily/DailyEntryModal';
import { getDailyEntry } from '../../services/dailyActivityService';
import GapAnalysisPanel from '../goals/GapAnalysisPanel';
import CampaignCard from '../campaigns/CampaignCard';
import CareerPortal from '../profile/CareerPortal';
import ProfileScreen from '../profile/ProfileScreen';
import ReportRangeModal from '../ui/ReportRangeModal';
import Leaderboard from '../gamification/Leaderboard';
import AgentAwardsPanel from '../awards/AgentAwardsPanel';
import SubmissionViewer from '../submissions/SubmissionViewer';
import HistoryTab from '../submissions/HistoryTab';
import GoalCarousel from './GoalCarousel';
import KPICard from './KPICard';
import ActivityFeed from './ActivityFeed';
import WeeklyStandardCard from './WeeklyStandardCard';
import BadgeGrid, { computeEarnedBadges } from '../gamification/BadgeGrid';
import { buildActivityEvents } from '../../utils/buildActivityEvents';
import WelcomeScreen from '../onboarding/WelcomeScreen';
import Shell from '../shell/Shell';
import ProductionReportTab from '../productionReport/ProductionReportTab';
import AgentPersistencyTab from '../agent/PersistencyTab';
import ProspectInfoPanel from '../agent/ProspectInfoPanel';
import PolicyLedgerPanel from '../agent/PolicyLedgerPanel';
import MoneyNeedsPanel from '../agent/MoneyNeedsPanel';
import CommissionPlayground from '../goals/CommissionPlayground';
import DailyFAB from '../daily/DailyFAB';

const KPIS = [
  { key: 'dials',    label: 'Dials',         field: 'totalTelAttempts', isCurrency: false },
  { key: 'contacts', label: 'Tel Contacts',   field: 'telContacts',      isCurrency: false },
  { key: 'f2f',      label: 'F2F Approaches', field: 'f2fAttempts',      isCurrency: false },
  { key: 'ffi',      label: 'FFI',            field: 'ffiConducted',     isCurrency: false },
  { key: 'ci',       label: 'CI',             field: 'ciConducted',      isCurrency: false },
  { key: 'apps',     label: 'Applications',   field: 'applicationsSold',    isCurrency: false },
  { key: 'api',      label: 'API',            field: 'totalProductionCredit', isCurrency: true  },
];

// Sidebar nav items for the agent role. Mirrors the live dashboard tabs
// 1:1 — no fabricated items (per kickoff Decisions: "mirrors the existing
// TabBar TABS array — no fabricated items"). The mock's "Submit Report",
// "Commission Calc", and standalone "Goals" sidebar items don't map to
// v2 nav IA — 4 groups fed into Sidebar's groupBySection() helper.
// Profile is removed from the sidebar list; the footer avatar navigates to
// the profile tab instead (see Sidebar.jsx footer-avatar button).
const NAV_ITEMS = [
  // Ungrouped (no section header)
  { id: 'dashboard',         label: 'Dashboard',         tabId: 'dashboard',         Icon: Home,      testId: 'agent-tab-dashboard' },
  { id: 'wizard',            label: 'Weekly Report',     action: 'submit',            Icon: NotebookPen, testId: 'agent-tab-wizard' },
  { id: 'history',           label: 'History',           tabId: 'history',           Icon: History,   testId: 'agent-tab-history' },
  // Planning
  { id: 'money-needs',       label: 'Money Needs',       tabId: 'money-needs',       Icon: Wallet,    sectionLabel: 'Planning',     testId: 'agent-tab-money-needs' },
  { id: 'goals',             label: 'Goals',             tabId: 'goals',             Icon: Target,    testId: 'agent-tab-goals' },
  // Tools
  { id: 'commission',        label: 'Commission',        tabId: 'commission',        Icon: Zap,       sectionLabel: 'Tools',        testId: 'agent-tab-commission' },
  { id: 'persistency',       label: 'Persistency',       tabId: 'persistency',       Icon: Repeat,    testId: 'agent-tab-persistency' },
  { id: 'policy-ledger',     label: 'Policy Ledger',     tabId: 'policy-ledger',     Icon: BookOpen,  testId: 'agent-tab-policy-ledger' },
  { id: 'prospect-info',     label: 'Prospect Prep',     tabId: 'prospect-info',     Icon: Search,    testId: 'agent-tab-prospect-info' },
  { id: 'production-report', label: 'Production Report', tabId: 'production-report', Icon: BarChart2, testId: 'agent-tab-production-report' },
  // Recognition
  { id: 'awards',            label: 'Awards',            tabId: 'awards',            Icon: Medal,     sectionLabel: 'Recognition',  testId: 'agent-tab-awards' },
  { id: 'career',            label: 'Career Portal',     tabId: 'career',            Icon: Shield,    testId: 'agent-tab-career' },
  { id: 'leaderboard',       label: 'Leaderboard',       tabId: 'leaderboard',       Icon: Star,      testId: 'agent-tab-leaderboard' },
];

// Mobile bottom-nav per mock (lines 2227-2232). The "Submit" item is an
// action, not a tab — it triggers the wizard via the onAction callback.
const BOTTOM_NAV = [
  { id: 'home',        label: 'Home',     tabId: 'dashboard',   Icon: ClipboardList },
  { id: 'submit',      label: 'Submit',   action: 'submit',     Icon: FileText, fab: true },
  { id: 'history',     label: 'History',  tabId: 'history',     Icon: History       },
  { id: 'leaderboard', label: 'Ranks',    tabId: 'leaderboard', Icon: Star          },
  { id: 'profile',     label: 'Profile',  tabId: 'profile',     Icon: UserCircle    },
];

export default function AgentDashboard() {
  const { user, userProfile, role, tenantId } = useAuth();

  const [activeTab, setActiveTab]             = useState('dashboard');
  const [prefillPolicy, setPrefillPolicy]     = useState(null);
  const [showWizard, setShowWizard]           = useState(false);
  const [wizardWeek, setWizardWeek]           = useState(null);
  const [showDailyModal, setShowDailyModal]   = useState(false);
  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState(null);
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
  const [showWelcome, setShowWelcome]           = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);

  const currentWeek  = useMemo(() => getMostRecentSunday(), []);
  const thisYear     = new Date().getFullYear();
  const displayName  = userProfile?.name ?? userProfile?.email ?? 'Agent';
  const roleLabel    = getRoleLabel(role);

  // Mobile More-drawer items: every NAV_ITEMS entry whose tabId isn't already
  // in BOTTOM_NAV. Filtered by tabId (not id) because BOTTOM_NAV's 'home'
  // item maps to the 'dashboard' tabId — id-only filtering would wrongly
  // include Dashboard in the drawer.
  const drawerNavItems = useMemo(
    () => NAV_ITEMS.filter(
      (item) => item.tabId && !BOTTOM_NAV.find((b) => b.tabId === item.tabId)
    ),
    []
  );

  // Show welcome screen on first login (agents only)
  useEffect(() => {
    if (userProfile && userProfile.hasSeenWelcome === false && role === 'agent') {
      setShowWelcome(true);
    }
  }, [userProfile, role]);

  // Clear prefill if agent navigates away from policy-ledger without saving.
  useEffect(() => {
    if (activeTab !== 'policy-ledger') setPrefillPolicy(null);
  }, [activeTab]);

  function handleCreatePolicyFromPrep(prep) {
    setPrefillPolicy({
      ownerName:        prep.clientName,
      sourceOfProspect: prep.prospectingSource,
      socialPlatform:   prep.prospectingSource === 'social-media' ? (prep.socialPlatform ?? null) : null,
    });
    setActiveTab('policy-ledger');
  }

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setLoading(true);
    setSubmissionsError(null);
    Promise.all([
      getDraft(tenantId, user.uid, currentWeek).catch(() => null),
      getAgentSubmissions(tenantId, user.uid).catch((err) => {
        setSubmissionsError(err?.code === 'permission-denied' ? 'permission-denied' : 'load-error');
        return [];
      }),
      getGoals(tenantId, user.uid).catch(() => null),
      getAgentHistory(tenantId, user.uid, 12).catch(() => []),
      getSettlements(tenantId, user.uid, thisYear).catch(() => []),
      getCompanyMinimums(tenantId).catch(() => null),
      getAwardsRuleset(tenantId, thisYear).catch(() => DEFAULT_RULESET_2026),
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

  // Most recent submission — surfaced in the Goals "My Commitment" card
  // so the agent's most recently submitted personal targets stay visible.
  const latestSub = useMemo(() => allSubmissions[0] ?? null, [allSubmissions]);

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

  // Period totals for the goal carousel hero. Pure derivation from
  // already-loaded submissions — no Firestore reads inside the util.
  const goalData = useMemo(
    () => aggregateAPI(allSubmissions, new Date(), personalAnnualAPI),
    [allSubmissions, personalAnnualAPI]
  );

  // Activity feed events (B3). Submission events + 3 weekly-criteria
  // badge events, derived client-side from already-loaded data. Capped
  // at 25 items in the last 7 days inside the util.
  const earnedBadges = useMemo(
    () => computeEarnedBadges(allSubmissions),
    [allSubmissions]
  );
  const activityEvents = useMemo(
    () => buildActivityEvents(allSubmissions, earnedBadges, new Date()),
    [allSubmissions, earnedBadges]
  );

  const ytdTotals = useMemo(() => {
    const yearSubs = allSubmissions.filter(
      (s) => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
    );
    return yearSubs.reduce((acc, s) => {
      const f = extractFields(s);
      acc.api          += extractTotalProductionCredit(s);
      acc.apps         += parseFloat(f.applicationsSold) || 0;
      acc.ffiConducted += parseFloat(f.ffiConducted)     || 0;
      acc.ciConducted  += parseFloat(f.ciConducted)      || 0;
      acc.dials        += parseFloat(f.totalTelAttempts)  || 0;
      return acc;
    }, { api: 0, apps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 });
  }, [allSubmissions, thisYear]);

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
            const subs = await getCampaignSubmissions(tenantId, c.startDate, c.endDate).catch(() => []);
            subsMap[c.id] = subs;
          })
        );
        setCampaignSubs(subsMap);
      })
      .catch(console.error)
      .finally(() => setCampaignsLoading(false));
  }, [user?.uid, tenantId, userProfile?.unitId]);

  // E6 — logging mode: 'weekly' | 'daily' | 'hybrid'. Existing agents have
  // no field; default to hybrid per planning decision.
  const loggingMode = userProfile?.loggingMode ?? 'hybrid';
  const showDailyCTA = loggingMode === 'daily' || loggingMode === 'hybrid';
  const showWeeklyCTA = loggingMode === 'weekly' || loggingMode === 'hybrid';

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

  // Unlock banner
  const showUnlockBanner =
    !unlockDismissed &&
    currentWeekSub?.status === 'draft' &&
    !!currentWeekSub?.unlockedBy;

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  // Bottom-nav action dispatch. The agent's 'submit' item is not a tab;
  // it opens the wizard at the most-recent Sunday week. In daily-only mode
  // it opens the daily entry modal instead.
  const handleAction = (action) => {
    if (action === 'submit') {
      if (loggingMode === 'daily') {
        setShowDailyModal(true);
      } else {
        setShowWizard(true);
      }
    } else if (action === 'log-today') {
      setShowDailyModal(true);
    }
  };

  const openWizardForWeek = (week) => {
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
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (showWizard) {
    return <WizardForm initialWeek={wizardWeek} onClose={() => { setShowWizard(false); setWizardWeek(null); }} />;
  }

  if (showDailyModal) {
    return (
      <DailyEntryModal
        onClose={() => {
          setShowDailyModal(false);
          refreshDailyEntry();
        }}
      />
    );
  }

  return (
    <Shell
      navItems={NAV_ITEMS}
      bottomNavItems={BOTTOM_NAV}
      drawerNavItems={drawerNavItems}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onAction={handleAction}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={`Welcome back, ${displayName}`}
      topbarCrumb={`Week of ${formatDateDisplay(currentWeek)}`}
      onSignOut={handleSignOut}
    >
      {/* Daily entry FAB — visible on all agent tabs when daily/hybrid mode.
          Hidden when the modal/wizard takes full-screen (those branches return
          early, so the FAB is never rendered alongside them). */}
      {showDailyCTA && (
        <DailyFAB
          onClick={() => setShowDailyModal(true)}
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

      {/* Submission viewer drawer */}
      {viewingSubmission && (
        <SubmissionViewer
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
        />
      )}

      {/* Unlock banner */}
      {showUnlockBanner && (
        <button
          onClick={() => openWizardForWeek(currentWeekSub.weekStarting)}
          className="w-full text-left mb-4 flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning">Report Unlocked</p>
            <p className="text-xs text-warning/80 mt-0.5">
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

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && (
        <div>
          <div className="mb-4">
            <p className="text-ink-muted text-sm">Welcome back,</p>
            <h2 className="text-xl font-bold text-ink">{displayName}</h2>
          </div>

          {/* Submissions load-error banner — surfaces permission-denied and
              other query failures that would otherwise render silently as an
              empty dashboard. */}
          {submissionsError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 p-3 rounded-xl bg-danger-tint border border-danger/20 text-danger"
            >
              <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm font-medium">
                {submissionsError === 'permission-denied'
                  ? 'Could not load your activity data — permission denied. Contact your manager if this persists.'
                  : 'Could not load your activity data. Check your connection and refresh.'}
              </p>
            </div>
          )}

          {/* Goal carousel hero (Design System v2 — B2). Replaces the
              YTD API Progress card at the top-of-dashboard slot. */}
          <div className="mb-6">
            {allSubmissions.length === 0 ? (
              <div className="role-hero">
                <div className="goal-period">Get Started</div>
                <div className="goal-value" style={{ fontSize: 24, lineHeight: 1.2 }}>
                  Welcome to AgencyTrack
                </div>
                <div className="goal-target" style={{ marginTop: 10 }}>
                  Submit your first weekly report to start tracking your goal progress.
                </div>
                <button
                  type="button"
                  onClick={() => setShowWizard(true)}
                  className="mt-4 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-white text-primary dark:text-primary-dark font-semibold text-sm hover:bg-white/95 transition-colors min-h-[44px]"
                >
                  Submit your first report
                </button>
              </div>
            ) : (
              <GoalCarousel data={goalData} />
            )}
          </div>

          {/* Active Campaigns */}
          {campaignsLoading ? (
            <div className="mb-4 h-28 rounded-xl bg-border/30 animate-pulse" />
          ) : activeCampaigns.length > 0 && (
            <div className="flex flex-col gap-3 mb-4">
              {activeCampaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  submissions={campaignSubs[c.id] ?? []}
                  agentId={user?.uid}
                />
              ))}
            </div>
          )}

          {/* KPI Activity Grid */}
          {kpiData.length > 0 && (
            <section aria-labelledby="agent-dashboard-kpi-heading" className="mb-6">
              <h3
                id="agent-dashboard-kpi-heading"
                className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3"
              >
                Activity Trend — Last {kpiData.length} Week{kpiData.length !== 1 ? 's' : ''}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-3">
                {KPIS.map((kpi) => (
                  <KPICard
                    key={kpi.key}
                    label={kpi.label}
                    values={kpiData.map((f) => f[kpi.field] ?? 0)}
                    isCurrency={kpi.isCurrency}
                  />
                ))}
              </div>

              {/* Week-over-week comparison strip */}
              {kpiData.length >= 2 && (
                <div className="flex flex-wrap gap-1.5">
                  {KPIS.map((kpi) => {
                    const cur   = kpiData[kpiData.length - 1][kpi.field] ?? 0;
                    const prev  = kpiData[kpiData.length - 2][kpi.field] ?? 0;
                    const delta = cur - prev;
                    const colorClass =
                      delta > 0 ? 'bg-success/10 text-success border-success/20' :
                      delta < 0 ? 'bg-danger/10 text-danger border-danger/20' :
                      'bg-surface text-ink-muted border-border';
                    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
                    return (
                      <span
                        key={kpi.key}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-semibold ${colorClass}`}
                      >
                        {kpi.label} {arrow}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Weekly Standard — Expected vs Actual (Tatil workshop 2026-05-19,
              Appendix A). 10-row floor comparison against the current week's
              submission. Per-row status: green ≥ floor / amber ≥ 70% / red.
              The API row (#9) is resolved per-agent from contractStartDate
              via the tenure band table (head-of-sales slide 2026-05-19,
              provisional); the other nine floors stay flat. */}
          <WeeklyStandardCard
            minimums={resolvedMinimums}
            currentWeekSub={currentWeekSub}
            loading={loading}
            error={null}
          />

          {/* Goals section */}
          <section aria-labelledby="agent-dashboard-goals-heading" className="card mb-6">
            <h3
              id="agent-dashboard-goals-heading"
              className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3"
            >
              Goals
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-ink-muted mb-2">My Commitment</p>
                {latestSub?.targetAPI ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">API:</span> {formatCurrency(parseFloat(latestSub.targetAPI))}
                    </p>
                    {latestSub.targetAppsSold > 0 && (
                      <p className="text-sm text-ink">
                        <span className="font-semibold">Apps:</span> {latestSub.targetAppsSold}
                      </p>
                    )}
                    {latestSub.targetDials > 0 && (
                      <p className="text-sm text-ink">
                        <span className="font-semibold">Dials:</span> {latestSub.targetDials}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted italic">Set targets in Step 9 of your next report.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-ink-muted mb-2">Manager Target</p>
                {goals?.targetWeeklyAPI ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">Weekly API:</span> {formatCurrency(goals.targetWeeklyAPI)}
                    </p>
                    {goals.targetWeeklyApps > 0 && (
                      <p className="text-sm text-ink">
                        <span className="font-semibold">Apps:</span> {goals.targetWeeklyApps}
                      </p>
                    )}
                    {goals.targetWeeklyDials > 0 && (
                      <p className="text-sm text-ink">
                        <span className="font-semibold">Dials:</span> {goals.targetWeeklyDials}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted italic">Your manager hasn't set targets yet.</p>
                )}
              </div>
            </div>
          </section>

          {/* Activity feed + Achievement badges (B4 — g4-mix 2-col layout
              absorbed from the deferred B3 deliverable). At ≥1024px these
              render side-by-side (1.6fr 1fr); below 1024px they stack
              vertically. ActivityFeed self-wraps as a .card; the badge
              section keeps its labelled <section> for a11y parity with
              the CareerPortal call site. */}
          <div className="g4-mix mb-6">
            <ActivityFeed
              events={activityEvents}
              onViewAll={() => setActiveTab('history')}
            />
            <section
              aria-labelledby="agent-dashboard-achievements-heading"
              className="card"
            >
              <h3
                id="agent-dashboard-achievements-heading"
                className="text-sm font-semibold text-ink mb-3"
              >
                Achievement Badges
              </h3>
              <BadgeGrid submissions={allSubmissions} />
            </section>
          </div>

          {/* Goal hierarchy / gap analysis */}
          <div className="mb-6">
            <GapAnalysisPanel
              hierarchy={hierarchy}
              ytdTotals={ytdTotals}
              loading={hierarchyLoading}
              error={hierarchyError}
              title="Goal Hierarchy"
            />
          </div>

          {/* E6 daily nudge banner — only when daily/hybrid mode and the
              agent hasn't logged today yet. v1 fallback until push
              notifications ship. */}
          {showDailyCTA && todayDailyChecked && !todayDailyEntry && (
            <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">You haven't logged today yet</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Capture your activity in 30 seconds. We'll roll it up into your weekly report on Sunday.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDailyModal(true)}
                className="shrink-0 px-3 h-9 rounded-lg bg-primary dark:bg-primary-dark text-white text-xs font-semibold hover:bg-primary/90 dark:hover:bg-primary transition-colors"
              >
                Log today
              </button>
            </div>
          )}

          {/* CTA — adapts to logging mode. weekly: weekly only. daily:
              daily only. hybrid: both, stacked. */}
          <div className="flex flex-col gap-2">
            {showDailyCTA && (
              <button
                className={showWeeklyCTA ? 'btn-secondary w-full' : 'btn-primary w-full'}
                onClick={() => setShowDailyModal(true)}
              >
                {todayDailyEntry ? 'Update today’s log' : 'Log today'}
              </button>
            )}
            {showWeeklyCTA && (
              <button
                className="btn-primary w-full"
                onClick={() => setShowWizard(true)}
              >
                Submit Weekly Report
              </button>
            )}
          </div>
        </div>
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
              submissions={allSubmissions}
              confirmedSettlements={settlements}
              agentProfile={userProfile}
              currentDate={new Date()}
              ruleset={awardsRuleset}
            />
          </div>
        )
      )}

      {/* ── PROSPECT INFO (Joint-Call Prep) TAB ── */}
      {activeTab === 'prospect-info' && (
        <ProspectInfoPanel onCreatePolicyFromPrep={handleCreatePolicyFromPrep} />
      )}

      {/* ── POLICY LEDGER TAB ── */}
      {activeTab === 'policy-ledger' && (
        <PolicyLedgerPanel
          initialForm={prefillPolicy}
          onPrefillConsumed={() => setPrefillPolicy(null)}
        />
      )}

      {activeTab === 'money-needs' && <MoneyNeedsPanel />}

      {/* ── GOALS TAB ── */}
      {activeTab === 'goals' && (
        <GapAnalysisPanel
          hierarchy={hierarchy}
          ytdTotals={ytdTotals}
          loading={hierarchyLoading}
          error={hierarchyError}
          title="Goals"
        />
      )}

      {/* ── COMMISSION TAB ── */}
      {activeTab === 'commission' && (
        <CommissionPlayground
          submissions={allSubmissions}
          agentId={user?.uid}
          tenantId={tenantId}
        />
      )}

      {/* ── PERSISTENCY TAB ── */}
      {activeTab === 'persistency' && <AgentPersistencyTab />}

      {/* ── PRODUCTION REPORT TAB ── */}
      {activeTab === 'production-report' && <ProductionReportTab userRole={role} />}

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' && <Leaderboard />}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && <ProfileScreen />}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <HistoryTab
          submissions={allSubmissions}
          onView={setViewingSubmission}
          loading={loading}
          onDownload={handleOpenReportModal}
          generating={generating}
          weeklyTarget={resolvedMinimums?.weeklyActivityFloors?.api ?? 4800}
        />
      )}
    </Shell>
  );
}
