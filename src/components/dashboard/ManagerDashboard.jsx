import { useMemo, useState } from 'react';
import { LogOut, Users, TrendingUp, FileCheck, AlertCircle, Sun, Moon, Presentation } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { getWeeklySubmissions } from '../../services/managerService';
import WizardForm from '../wizard/WizardForm';
import MasterSheet from '../manager/MasterSheet';
import CompliancePanel from '../manager/CompliancePanel';
import PersistencyPanel from '../manager/PersistencyPanel';
import MeetingMode from '../manager/MeetingMode';

const TABS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'mastersheet',  label: 'Master Sheet' },
  { id: 'compliance',   label: 'Compliance' },
  { id: 'persistency',  label: 'Persistency' },
];

function StatCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className={`card flex items-start gap-4 ${accent ? 'border-l-4 border-primary' : ''}`}>
      <div className="p-2 rounded-lg bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-ink">{value}</p>
        <p className="text-sm font-medium text-ink">{label}</p>
        {sub && <p className="text-xs text-ink-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const { userProfile, role } = useAuth();
  const [showWizard, setShowWizard]       = useState(false);
  const [activeTab, setActiveTab]         = useState('overview');
  const [selectedWeek, setSelectedWeek]   = useState(getMostRecentSunday());
  const [meetingActive, setMeetingActive] = useState(false);
  const [meetingSubmissions, setMeetingSubmissions] = useState([]);

  const stats = useMemo(() => ({
    totalAgents: 8,
    submittedThisWeek: 5,
    pendingSubmissions: 3,
    teamYTDAPI: 384000,
    teamAPIGoal: 960000,
  }), []);

  const displayName = userProfile?.name ?? userProfile?.email ?? 'Manager';
  const roleLabel = getRoleLabel(role);
  const complianceRate = Math.round((stats.submittedThisWeek / stats.totalAgents) * 100);

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  const toggleDark = () => document.documentElement.classList.toggle('dark');

  const handleStartMeeting = async () => {
    try {
      const subs = await getWeeklySubmissions(selectedWeek);
      setMeetingSubmissions(subs);
      setMeetingActive(true);
    } catch (e) {
      console.error('Failed to load meeting data:', e);
    }
  };

  if (showWizard) {
    return <WizardForm onClose={() => setShowWizard(false)} />;
  }

  return (
    <>
      {meetingActive && (
        <MeetingMode
          submissions={meetingSubmissions}
          selectedWeek={selectedWeek}
          onClose={() => setMeetingActive(false)}
        />
      )}

      <div className="min-h-screen bg-surface px-4 py-6 max-w-5xl mx-auto">

        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">AgencyTrack</h1>
            <p className="text-sm text-ink-muted">{roleLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartMeeting}
              className="h-10 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors"
            >
              <Presentation size={16} />
              Start Meeting
            </button>
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

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-max h-9 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-3 ${
                activeTab === t.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="mb-6">
              <p className="text-ink-muted text-sm">Welcome back,</p>
              <h2 className="text-xl font-bold text-ink">{displayName}</h2>
            </div>

            <div className="card mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Team YTD API</p>
              <p className="text-3xl font-bold text-ink mb-1">{formatCurrency(stats.teamYTDAPI)}</p>
              <div className="w-full bg-surface rounded-full h-2 mb-1">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(Math.round((stats.teamYTDAPI / stats.teamAPIGoal) * 100), 100)}%` }}
                />
              </div>
              <p className="text-sm text-ink-muted">
                {Math.round((stats.teamYTDAPI / stats.teamAPIGoal) * 100)}% of {formatCurrency(stats.teamAPIGoal)} goal
              </p>
            </div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted mb-3">This Week</h3>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <StatCard icon={Users} label="Total Agents" value={stats.totalAgents} />
              <StatCard
                icon={FileCheck} label="Reports Submitted"
                value={stats.submittedThisWeek}
                sub={`${complianceRate}% compliance`}
                accent
              />
              <StatCard
                icon={AlertCircle} label="Pending Reports"
                value={stats.pendingSubmissions}
                sub="Not yet submitted"
              />
              <StatCard
                icon={TrendingUp} label="Team API Goal"
                value={`${Math.round((stats.teamYTDAPI / stats.teamAPIGoal) * 100)}%`}
                sub="YTD progress"
              />
            </div>

            <button className="btn-primary w-full" onClick={() => setShowWizard(true)}>
              Submit Weekly Report
            </button>
          </div>
        )}

        {/* Master Sheet tab */}
        {activeTab === 'mastersheet' && (
          <MasterSheet selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {/* Compliance tab */}
        {activeTab === 'compliance' && (
          <CompliancePanel selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
        )}

        {/* Persistency tab */}
        {activeTab === 'persistency' && (
          <PersistencyPanel />
        )}
      </div>
    </>
  );
}
