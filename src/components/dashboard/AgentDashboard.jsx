import React, { useMemo, useState, useEffect } from 'react';
import {
  X, Download, Loader2,
  ClipboardList, FileText, Home, NotebookPen, Wallet, Target, Zap, Repeat, Search, Medal, Shield,
  Star, History, UserCircle, BarChart2, BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatDateDisplay } from '../../utils/formatters';
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
import WizardForm from '../wizard/WizardForm';
import DailyCaptureV2 from '../daily/DailyCaptureV2';
import { getDailyEntry } from '../../services/dailyActivityService';
import GapAnalysisPanel from '../goals/GapAnalysisPanel';
import CareerPortal from '../profile/CareerPortal';
import ProfileScreen from '../profile/ProfileScreen';
import ReportRangeModal from '../ui/ReportRangeModal';
import ProductionLeaderboardSurface from '../leaderboard/ProductionLeaderboardSurface';
import AgentAwardsPanel from '../awards/AgentAwardsPanel';
import SubmissionViewer from '../submissions/SubmissionViewer';
import HistoryTab from '../submissions/HistoryTab';
import { computeEarnedBadges } from '../gamification/BadgeGrid';
import { buildActivityEvents } from '../../utils/buildActivityEvents';
import WelcomeScreen from '../onboarding/WelcomeScreen';
import Shell from '../shell/Shell';
import ProductionReportTab from '../productionReport/ProductionReportTab';
import AgentPersistencyTab from '../agent/PersistencyTab';
import ProspectInfoPanel from '../agent/ProspectInfoPanel';
import PolicyLedgerPanel from '../agent/PolicyLedgerPanel';
import MoneyNeedsPanel from '../agent/MoneyNeedsPanel';
import GamePlanScreen from './GamePlanV2';
import CommissionPlayground from '../goals/CommissionPlayground';
import DailyFAB from '../daily/DailyFAB';
import AgentDashboardHomeV2 from './HomeV2';

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
  // Planning — Game Plan is the Planning parent; Money Needs nests under it as
  // a child (still its own tabId/route). Goals stays a sibling — Game Plan will
  // FEED Goals on commit (deferred slice), it does not nest under it.
  { id: 'game-plan',         label: 'Game Plan',         tabId: 'game-plan',         Icon: BarChart2, sectionLabel: 'Planning', badgeNew: true, testId: 'agent-tab-game-plan' },
  { id: 'money-needs',       label: 'Money Needs',       tabId: 'money-needs',       Icon: Wallet,    child: true,                  testId: 'agent-tab-money-needs' },
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
  // Track J P6 — production-leaderboard takes the old "Leaderboard" slot. The
  // P3/P4 surface (`ProductionLeaderboardSurface`) is now a real primary-nav
  // item; the points-board (`gamification/Leaderboard`) retires from the agent
  // nav atomically with this change. ManagerDashboard retains the points-board
  // nav entry (deferred to P5 alongside role-scope + branch picker).
  { id: 'leaderboard',       label: 'Leaderboard',       tabId: 'production-leaderboard', Icon: Star, testId: 'agent-tab-leaderboard' },
];

// Mobile bottom-nav per mock (lines 2227-2232). The "Submit" item is an
// action, not a tab — it triggers the wizard via the onAction callback.
const BOTTOM_NAV = [
  { id: 'home',        label: 'Home',     tabId: 'dashboard',   Icon: ClipboardList },
  { id: 'submit',      label: 'Submit',   action: 'submit',     Icon: FileText, fab: true },
  { id: 'history',     label: 'History',  tabId: 'history',     Icon: History       },
  // Track J P6 — bottom-nav "Ranks" routes to the production-leaderboard tab.
  { id: 'leaderboard', label: 'Ranks',    tabId: 'production-leaderboard', Icon: Star          },
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
      <DailyCaptureV2
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
      topbarTitle="Dashboard"
      topbarCrumb={(() => {
        const d = new Date();
        const weekday = d.toLocaleDateString('en-TT', { weekday: 'long' });
        const date    = d.toLocaleDateString('en-TT', { day: 'numeric', month: 'long' });
        const start   = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
        return `${displayName} · ${weekday} ${date} · Week ${weekNum}`;
      })()}
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

      {/* ── DASHBOARD TAB (v2 home — Hero + PulseStrip + Recent) ── */}
      {activeTab === 'dashboard' && (
        allSubmissions.length === 0 ? (
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
          <AgentDashboardHomeV2
            ytdTotals={ytdTotals}
            personalAnnualAPI={personalAnnualAPI}
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
            campaignSubs={campaignSubs}
            agentUid={user?.uid}
            showDailyCTA={showDailyCTA}
            todayDailyChecked={todayDailyChecked}
            todayDailyEntry={todayDailyEntry}
            submissionsError={submissionsError}
            onSubmit={() => setShowWizard(true)}
            onLogToday={() => setShowDailyModal(true)}
            onOpenTab={setActiveTab}
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

      {/* ── GAME PLAN HUB (v2 — Planning parent) ── */}
      {activeTab === 'game-plan' && (
        <GamePlanScreen
          committedAnnualAPI={goals?.personalAnnualAPI ?? null}
          onOpenTab={setActiveTab}
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

      {/* ── LEADERBOARD TAB (Track J P6 — production-based, nav-driven) ── */}
      {activeTab === 'production-leaderboard' && <ProductionLeaderboardSurface />}

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
