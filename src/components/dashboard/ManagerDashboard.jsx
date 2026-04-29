import { useMemo } from 'react';
import { LogOut, Users, TrendingUp, FileCheck, AlertCircle, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency } from '../../utils/formatters';

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

  // Mock data — replaced with real Firestore queries in Phase 3
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

  return (
    <div className="min-h-screen bg-surface px-4 py-6 max-w-3xl mx-auto">

      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">AgencyTrack</h1>
          <p className="text-sm text-ink-muted">{roleLabel}</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Welcome */}
      <div className="mb-6">
        <p className="text-ink-muted text-sm">Welcome back,</p>
        <h2 className="text-xl font-bold text-ink">{displayName}</h2>
      </div>

      {/* Team API Progress */}
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

      {/* Stats Grid */}
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
        <StatCard icon={TrendingUp} label="Team API Goal" value={`${Math.round((stats.teamYTDAPI / stats.teamAPIGoal) * 100)}%`} sub="YTD progress" />
      </div>

      {/* Placeholder for Master Sheet — Phase 4 */}
      <button className="btn-primary w-full" disabled>
        View Master Sheet (Phase 4)
      </button>

    </div>
  );
}