import { useMemo, useState, useEffect } from 'react';
import {
  X, Eye, Download, Loader2,
  ClipboardList, FileText, TrendingUp, Trophy, Star, History, UserCircle, BarChart2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency, formatDateDisplay } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { getDraft, getAgentSubmissions } from '../../services/submissionService';
import { getGoals, getCompanyMinimums, getGoalHierarchy } from '../../services/goalsService';
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
import GoalCarousel from './GoalCarousel';
import KPICard from './KPICard';
import ActivityFeed from './ActivityFeed';
import BadgeGrid, { computeEarnedBadges } from '../gamification/BadgeGrid';
import { buildActivityEvents } from '../../utils/buildActivityEvents';
import WelcomeScreen from '../onboarding/WelcomeScreen';
import Shell from '../shell/Shell';
import ProductionReportTab from '../productionReport/ProductionReportTab';

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
// existing surfaces and are intentionally omitted from the rendered
// sidebar (Submit Report stays as the bottom-nav action item below).
const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   tabId: 'dashboard',   Icon: ClipboardList, sectionLabel: 'Workspace' },
  { id: 'career',      label: 'Career',      tabId: 'career',      Icon: TrendingUp },
  { id: 'awards',             label: 'Awards',            tabId: 'awards',             Icon: Trophy },
  { id: 'production-report', label: 'Production Report', tabId: 'production-report', Icon: BarChart2 },
  { id: 'leaderboard',       label: 'Leaderboard',       tabId: 'leaderboard',       Icon: Star },
  { id: 'history',     label: 'History',     tabId: 'history',     Icon: History },
  { id: 'profile',     label: 'Profile',     tabId: 'profile',     Icon: UserCircle },
];

// Mobile bottom-nav per mock (lines 2227-2232). The "Submit" item is an
// action, not a tab — it triggers the wizard via the onAction callback.
const BOTTOM_NAV = [
  { id: 'home',        label: 'Home',     tabId: 'dashboard',   Icon: ClipboardList },
  { id: 'submit',      label: 'Submit',   action: 'submit',     Icon: FileText      },
  { id: 'history',     label: 'History',  tabId: 'history',     Icon: History       },
  { id: 'leaderboard', label: 'Ranks',    tabId: 'leaderboard', Icon: Star          },
  { id: 'profile',     label: 'Profile',  tabId: 'profile',     Icon: UserCircle    },
];

export default function AgentDashboard() {
  const { user, userProfile, role, tenantId } = useAuth();

  const [activeTab, setActiveTab]             = useState('dashboard');
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
  const [loading, setLoading]                  = useState(true);
  const [activeCampaigns, setActiveCampaigns]   = useState([]);
  const [campaignSubs, setCampaignSubs]         = useState({});
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [hierarchy, setHierarchy]               = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError]     = useState(null);
  const [showWelcome, setShowWelcome]           = useState(false);

  const currentWeek  = useMemo(() => getMostRecentSunday(), []);
  const thisYear     = new Date().getFullYear();
  const displayName  = userProfile?.name ?? userProfile?.email ?? 'Agent';
  const roleLabel    = getRoleLabel(role);

  // Show welcome screen on first login (agents only)
  useEffect(() => {
    if (userProfile && userProfile.hasSeenWelcome === false && role === 'agent') {
      setShowWelcome(true);
    }
  }, [userProfile, role]);

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setLoading(true);
    Promise.all([
      getDraft(user.uid, currentWeek).catch(() => null),
      getAgentSubmissions(user.uid).catch(() => []),
      getGoals(tenantId, user.uid).catch(() => null),
      getAgentHistory(user.uid, 12).catch(() => []),
      getSettlements(tenantId, user.uid, thisYear).catch(() => []),
      getCompanyMinimums(tenantId).catch(() => null),
    ]).then(([weekSub, subs, agentGoals, pers, setts, mins]) => {
      setCurrentWeekSub(weekSub);
      setAllSubmissions(subs);
      setGoals(agentGoals);
      setPersistency(pers);
      setSettlements(setts);
      setCompanyMinimums(mins);
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
    getDailyEntry(user.uid, today)
      .then(setTodayDailyEntry)
      .catch(() => setTodayDailyEntry(null))
      .finally(() => setTodayDailyChecked(true));
  }, [user?.uid, today, showDailyCTA]);

  const refreshDailyEntry = () => {
    if (!user?.uid) return;
    getDailyEntry(user.uid, today).then(setTodayDailyEntry).catch(() => {});
  };

  // Fetch goal hierarchy for gap analysis
  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setHierarchyLoading(true);
    setHierarchyError(null);
    getGoalHierarchy(tenantId, userProfile?.unitId ?? null, new Date().getFullYear(), user.uid)
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
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onAction={handleAction}
      userProfile={userProfile}
      roleLabel={roleLabel}
      topbarTitle={`Welcome back, ${displayName}`}
      topbarCrumb={`Week of ${formatDateDisplay(currentWeek)}`}
      onSignOut={handleSignOut}
    >
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

          {/* Goal carousel hero (Design System v2 — B2). Replaces the
              YTD API Progress card and the previous MotivationalCarousel
              top-of-dashboard slot. */}
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
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
                Activity Trend — Last {kpiData.length} Week{kpiData.length !== 1 ? 's' : ''}
              </p>
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
            </div>
          )}

          {/* Goals section */}
          <div className="card mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Goals</p>
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
          </div>

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
            />
          </div>
        )
      )}

      {/* ── PRODUCTION REPORT TAB ── */}
      {activeTab === 'production-report' && <ProductionReportTab userRole={role} />}

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' && <Leaderboard />}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && <ProfileScreen />}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3">
          {!loading && allSubmissions.length > 0 && (
            <button
              onClick={handleOpenReportModal}
              disabled={generating}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 size={15} className="animate-spin" /> Generating…</>
              ) : (
                <><Download size={15} /> Download Report</>
              )}
            </button>
          )}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-border/40 animate-pulse" />
              ))}
            </div>
          )}
          {!loading && allSubmissions.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-sm text-ink-muted">No submissions yet.</p>
            </div>
          )}
          {!loading &&
            allSubmissions.map((s) => (
              <button
                key={s.id ?? s.weekStarting}
                onClick={() => setViewingSubmission(s)}
                className="card flex items-center justify-between gap-4 text-left w-full hover:bg-surface/70 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">Week of {formatDateDisplay(s.weekStarting)}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {formatCurrency(extractTotalProductionCredit(s))} API &nbsp;·&nbsp;
                    {extractFields(s).applicationsSold} apps
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                    s.status === 'submitted'
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/15 text-warning'
                  }`}>
                    {s.status === 'submitted' ? 'Submitted' : 'Draft'}
                  </span>
                  <Eye size={15} className="text-ink-muted" />
                </div>
              </button>
            ))}
        </div>
      )}
    </Shell>
  );
}
