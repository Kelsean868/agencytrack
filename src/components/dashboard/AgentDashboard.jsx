import { useMemo, useState, useEffect } from 'react';
import { LogOut, Sun, Moon, X, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency, formatPercent } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { getDraft, getAgentSubmissions } from '../../services/submissionService';
import { getGoals } from '../../services/goalsService';
import { getAgentPersistency } from '../../services/persistencyService';
import { getSettlements } from '../../services/settlementService';
import WizardForm from '../wizard/WizardForm';
import NotificationBell from '../ui/NotificationBell';
import CareerPortal from '../profile/CareerPortal';
import Leaderboard from '../gamification/Leaderboard';
import AgentAwardsPanel from '../awards/AgentAwardsPanel';
import SubmissionViewer from '../submissions/SubmissionViewer';
import MotivationalCarousel from './MotivationalCarousel';

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

const TABS = [
  { id: 'dashboard',   label: 'Dashboard'   },
  { id: 'career',      label: 'Career'      },
  { id: 'awards',      label: 'Awards'      },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'history',     label: 'History'     },
];

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border mb-6 overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 min-w-max h-9 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-3 ${
            active === t.id
              ? 'bg-white text-primary shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ProgressRing({ percent, size = 120, stroke = 10 }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--color-primary)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

export default function AgentDashboard() {
  const { user, userProfile, role } = useAuth();

  const [activeTab, setActiveTab]             = useState('dashboard');
  const [showWizard, setShowWizard]           = useState(false);
  const [wizardWeek, setWizardWeek]           = useState(null);
  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState(null);

  const [currentWeekSub, setCurrentWeekSub]   = useState(null);
  const [allSubmissions, setAllSubmissions]    = useState([]);
  const [goals, setGoals]                      = useState(null);
  const [persistency, setPersistency]          = useState({});
  const [settlements, setSettlements]          = useState([]);
  const [loading, setLoading]                  = useState(true);

  const currentWeek  = useMemo(() => getMostRecentSunday(), []);
  const thisYear     = new Date().getFullYear();
  const displayName  = userProfile?.name ?? userProfile?.email ?? 'Agent';
  const roleLabel    = getRoleLabel(role);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    Promise.all([
      getDraft(user.uid, currentWeek).catch(() => null),
      getAgentSubmissions(user.uid).catch(() => []),
      getGoals(TENANT_ID, user.uid).catch(() => null),
      getAgentPersistency(user.uid, thisYear).catch(() => ({})),
      getSettlements(TENANT_ID, user.uid, thisYear).catch(() => []),
    ]).then(([weekSub, subs, agentGoals, pers, setts]) => {
      setCurrentWeekSub(weekSub);
      setAllSubmissions(subs);
      setGoals(agentGoals);
      setPersistency(pers);
      setSettlements(setts);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user?.uid, currentWeek, thisYear]);

  // YTD metrics derived from real submissions
  const { ytdAPI, ytdAPIGoal, latestSub } = useMemo(() => {
    const yearSubs = allSubmissions.filter(
      (s) => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
    );
    const ytdAPI = yearSubs.reduce((sum, s) => sum + (parseFloat(s.apiSold) || 0), 0);
    const ytdAPIGoal = goals?.targetAnnualAPI ?? 120000;
    const latestSub = allSubmissions[0] ?? null;
    return { ytdAPI, ytdAPIGoal, latestSub };
  }, [allSubmissions, goals, thisYear]);

  const apiPercent = formatPercent(ytdAPI, ytdAPIGoal);

  // Unlock banner
  const showUnlockBanner =
    !unlockDismissed &&
    currentWeekSub?.status === 'draft' &&
    !!currentWeekSub?.unlockedBy;

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  const toggleDark = () => document.documentElement.classList.toggle('dark');

  const openWizardForWeek = (week) => {
    setWizardWeek(week);
    setShowWizard(true);
  };

  if (showWizard) {
    return <WizardForm initialWeek={wizardWeek} onClose={() => { setShowWizard(false); setWizardWeek(null); }} />;
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-6 max-w-2xl mx-auto">

      {/* Submission viewer drawer */}
      {viewingSubmission && (
        <SubmissionViewer
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">AgencyTrack</h1>
          <p className="text-sm text-ink-muted">{roleLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={toggleDark}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white dark:bg-ink/10 text-ink-muted hover:text-ink transition-colors"
            aria-label="Toggle dark mode"
          >
            <Sun size={18} className="dark:hidden" />
            <Moon size={18} className="hidden dark:block" />
          </button>
          <button
            onClick={handleSignOut}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white dark:bg-ink/10 text-ink-muted hover:text-danger transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Unlock banner */}
      {showUnlockBanner && (
        <button
          onClick={() => openWizardForWeek(currentWeekSub.weekStarting)}
          className="w-full text-left mb-4 flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning">Report Unlocked</p>
            <p className="text-xs text-warning/80 mt-0.5">
              Your report for week of {currentWeekSub.weekStarting} was unlocked by{' '}
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

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && (
        <div>
          <div className="mb-4">
            <p className="text-ink-muted text-sm">Welcome back,</p>
            <h2 className="text-xl font-bold text-ink">{displayName}</h2>
          </div>

          {/* Motivational carousel */}
          <MotivationalCarousel
            role={role}
            submissions={allSubmissions}
            confirmedSettlements={settlements}
            goals={goals}
            agentProfile={userProfile}
            currentDate={new Date()}
          />

          {/* YTD API Progress */}
          <div className="card mb-6 flex items-center gap-6">
            <div className="relative shrink-0">
              <ProgressRing percent={apiPercent} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-ink">{apiPercent}%</span>
                <span className="text-xs text-ink-muted">of goal</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">YTD API</p>
              <p className="text-2xl font-bold text-ink">{formatCurrency(ytdAPI)}</p>
              <p className="text-sm text-ink-muted">Goal: {formatCurrency(ytdAPIGoal)}</p>
              <p className="text-sm text-ink-muted mt-0.5">
                {formatCurrency(Math.max(0, ytdAPIGoal - ytdAPI))} remaining
              </p>
            </div>
          </div>

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

          <button
            className="btn-primary w-full"
            onClick={() => setShowWizard(true)}
          >
            Submit Weekly Report
          </button>
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
          <AgentAwardsPanel
            submissions={allSubmissions}
            confirmedSettlements={settlements}
            agentProfile={userProfile}
            currentDate={new Date()}
          />
        )
      )}

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' && <Leaderboard />}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3">
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
                  <p className="text-sm font-semibold text-ink">Week of {s.weekStarting}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {formatCurrency(parseFloat(s.apiSold) || 0)} API &nbsp;·&nbsp;
                    {s.applicationsSold ?? 0} apps
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
    </div>
  );
}
