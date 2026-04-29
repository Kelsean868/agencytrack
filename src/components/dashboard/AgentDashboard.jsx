import { useMemo } from 'react';
import { LogOut, Phone, Calendar, FileText, TrendingUp, Users, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../services/authService';
import { getRoleLabel, formatCurrency, formatPercent } from '../../utils/formatters';

// --- Progress Ring ---
function ProgressRing({ percent, size = 120, stroke = 10, color = 'var(--color-primary)' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// --- KPI Card ---
function KPICard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card flex items-start gap-4">
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

// --- Main ---
export default function AgentDashboard() {
  const { userProfile, role } = useAuth();

  // Mock data — replaced with real Firestore queries in Phase 3
  const metrics = useMemo(() => ({
    ytdAPI: 48500,
    ytdAPIGoal: 120000,
    weekCalls: 22,
    weekAppointments: 8,
    weekFFIs: 4,
    weekCIs: 2,
    weekSales: 1,
    weekNewClients: 1,
  }), []);

  const apiPercent = formatPercent(metrics.ytdAPI, metrics.ytdAPIGoal);
  const displayName = userProfile?.name ?? userProfile?.email ?? 'Agent';
  const roleLabel = getRoleLabel(role);

  const handleSignOut = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  const toggleDark = () => document.documentElement.classList.toggle('dark');

  return (
    <div className="min-h-screen bg-surface px-4 py-6 max-w-2xl mx-auto">

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

      {/* YTD API Progress */}
      <div className="card mb-6 flex items-center gap-6">
        <div className="relative flex-shrink-0">
          <ProgressRing percent={apiPercent} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-ink">{apiPercent}%</span>
            <span className="text-xs text-ink-muted">of goal</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">YTD API</p>
          <p className="text-2xl font-bold text-ink">{formatCurrency(metrics.ytdAPI)}</p>
          <p className="text-sm text-ink-muted">Goal: {formatCurrency(metrics.ytdAPIGoal)}</p>
          <p className="text-sm text-ink-muted mt-1">
            {formatCurrency(metrics.ytdAPIGoal - metrics.ytdAPI)} remaining
          </p>
        </div>
      </div>

      {/* This Week KPIs */}
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted mb-3">This Week</h3>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <KPICard icon={Phone} label="Calls" value={metrics.weekCalls} />
        <KPICard icon={Calendar} label="Appointments" value={metrics.weekAppointments} />
        <KPICard icon={FileText} label="FFIs" value={metrics.weekFFIs} />
        <KPICard icon={FileText} label="Closing Interviews" value={metrics.weekCIs} />
        <KPICard icon={TrendingUp} label="Sales" value={metrics.weekSales} />
        <KPICard icon={Users} label="New Clients" value={metrics.weekNewClients} />
      </div>

      {/* Submit Week Button — placeholder until Wizard is built in Phase 3 */}
      <button className="btn-primary w-full" disabled>
        Submit Weekly Report (Phase 3)
      </button>

    </div>
  );
}