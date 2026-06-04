import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertTriangle, ShieldAlert, ChevronRight, Flame } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatDateFriendly } from '../../utils/formatters';
import { parseDateOnlyTT } from '../../utils/dateInputs';
import { cbttComplianceFlag } from '../../utils/cbttCompliance';
import { classifyWeek, onTimeStreak } from '../../utils/complianceDerive';
import StatusPill from '../ui/StatusPill';
import CoachingNotesModal from './CoachingNotesModal';

const STREAK_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// 8 covered-week Sundays ending at `weekStart`, most-recent-first. Each entry
// is TT-midnight (04:00 UTC) of its Sunday, so toISOString().slice(0,10) yields
// the correct YYYY-MM-DD calendar day (the +4h offset stays on the same date).
function weekWindow(weekStart, n) {
  const base = parseDateOnlyTT(weekStart);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(new Date(base.getTime() - i * 7 * DAY_MS).toISOString().slice(0, 10));
  }
  return out;
}

function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toJsDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatSubmittedTime(ts) {
  const d = toJsDate(ts);
  if (!d) return '';
  return d.toLocaleString('en-TT', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

const PILL_VARIANT = { 'on-time': 'success', late: 'warning', 'not-in': 'danger' };
const PILL_LABEL   = { 'on-time': 'On-time', late: 'Late', 'not-in': 'Not in' };

export default function CompliancePanel({ selectedWeek, setSelectedWeek }) {
  const { tenantId } = useAuth();
  const [weekData, setWeekData]   = useState([]); // [{ weekStart, subs: [] }] most-recent-first
  const [users, setUsers]         = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [notesAgent, setNotesAgent] = useState(null);

  const sundays = getLastNSundays(8);

  const loadData = () => {
    setLoading(true);
    setError('');
    setLoaded(false);
    const weeks = weekWindow(selectedWeek, STREAK_WEEKS); // weeks[0] === selectedWeek
    Promise.all([
      ...weeks.map((w) => getWeeklySubmissions(tenantId, w)),
      getTenantUsers(tenantId),
    ])
      .then((results) => {
        const userList = results[results.length - 1];
        const subsByWeek = results.slice(0, weeks.length);
        setUsers(userList.filter((u) => u.role === 'agent'));
        setWeekData(weeks.map((w, i) => ({ weekStart: w, subs: subsByWeek[i] })));
        setLoaded(true);
      })
      .catch((e) => {
        console.error('[CompliancePanel] load failed:', e);
        setError('Failed to load data. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedWeek, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-agent, per-week submission index + derived filing status / streak.
  const roster = useMemo(() => {
    const byAgentWeek = {}; // agentId -> { [weekStart]: submission }
    weekData.forEach(({ weekStart, subs }) => {
      (subs ?? []).forEach((s) => {
        const aid = s.agentId ?? s.userId;
        if (!aid) return;
        (byAgentWeek[aid] ??= {})[weekStart] = s;
      });
    });

    const weeks = weekData.map((d) => d.weekStart);
    return users
      .map((u) => {
        const perWeek = weeks.map((w) => ({ weekStart: w, submission: byAgentWeek[u.id]?.[w] ?? null }));
        const current = byAgentWeek[u.id]?.[selectedWeek] ?? null;
        const status  = classifyWeek(current, selectedWeek);
        const lastFiled = perWeek.find((e) => e.submission?.status === 'submitted')?.weekStart ?? null;
        return {
          id:        u.id,
          name:      u.name ?? u.email ?? u.id,
          unit:      u.unitName ?? '',
          unitId:    u.unitId ?? null,
          status,
          submittedAt: current?.submittedAt ?? null,
          streak:    onTimeStreak(perWeek, STREAK_WEEKS),
          perWeek,
          lastFiled,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, weekData, selectedWeek]);

  const counts = useMemo(() => {
    let onTime = 0, late = 0, notIn = 0;
    roster.forEach((r) => {
      if (r.status === 'on-time') onTime += 1;
      else if (r.status === 'late') late += 1;
      else notIn += 1;
    });
    const total = roster.length;
    return { onTime, late, notIn, total, filed: onTime + late };
  }, [roster]);

  const exceptions = useMemo(() => roster.filter((r) => r.status === 'not-in'), [roster]);

  const cbttFlags = useMemo(() => {
    return users
      .map((u) => {
        const flag = cbttComplianceFlag(u);
        if (!flag) return null;
        return { id: u.id, name: u.name ?? u.email ?? u.id, flag };
      })
      .filter(Boolean)
      .sort((a, b) => a.flag.daysRemaining - b.flag.daysRemaining);
  }, [users]);

  const pct = (n) => (counts.total > 0 ? (n / counts.total) * 100 : 0);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="compliance-loading">
        <div className="h-10 w-48 rounded-lg bg-border/40 animate-pulse" />
        <div className="h-24 rounded-xl bg-border/40 animate-pulse" />
        <div className="h-40 rounded-xl bg-border/40 animate-pulse" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center">
        <AlertTriangle size={28} className="text-danger" aria-hidden="true" />
        <p className="text-sm text-danger font-medium">{error}</p>
        <button
          onClick={loadData}
          className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Coaching drawer — per-agent, reused (no rebuild) */}
      {notesAgent && (
        <CoachingNotesModal
          agentId={notesAgent.agentId}
          agentName={notesAgent.agentName}
          agentUnitId={notesAgent.agentUnitId}
          onClose={() => setNotesAgent(null)}
        />
      )}

      {/* Week selector */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Week"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {sundays.map((d, i) => (
            <option key={d} value={d}>{i === 0 ? `This week — ${formatDateFriendly(d)}` : formatDateFriendly(d)}</option>
          ))}
        </select>
        <span className="text-xs text-ink-muted">{counts.total} agent{counts.total !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Reality bar (filing lens) ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid="compliance-reality-bar">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Filing reality · this week</span>
          <span className="ml-auto text-[11px] text-ink-muted">Sun 23:59 AST deadline</span>
        </div>

        {counts.total === 0 ? (
          <p className="text-sm text-ink-muted py-3" data-testid="compliance-empty-roster">No agents in scope for this week.</p>
        ) : (
          <>
            <div className="flex h-9 rounded-lg overflow-hidden border border-border" role="img"
                 aria-label={`${counts.onTime} on-time, ${counts.late} late, ${counts.notIn} not in, of ${counts.total}`}>
              {counts.onTime > 0 && (
                <div className="flex items-center justify-center bg-success text-white text-[11px] font-semibold whitespace-nowrap overflow-hidden"
                     style={{ width: `${pct(counts.onTime)}%` }}>
                  {pct(counts.onTime) >= 14 ? `${Math.round(pct(counts.onTime))}% on-time` : ''}
                </div>
              )}
              {counts.late > 0 && (
                <div className="flex items-center justify-center bg-warning text-white text-[11px] font-semibold whitespace-nowrap overflow-hidden"
                     style={{ width: `${pct(counts.late)}%` }}>
                  {pct(counts.late) >= 14 ? `${Math.round(pct(counts.late))}% late` : ''}
                </div>
              )}
              {counts.notIn > 0 && (
                <div className="flex items-center justify-center bg-danger text-white text-[11px] font-semibold whitespace-nowrap overflow-hidden"
                     style={{ width: `${pct(counts.notIn)}%` }}>
                  {pct(counts.notIn) >= 14 ? `${Math.round(pct(counts.notIn))}% not in` : ''}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
              <Stat label="Filed" testid="compliance-stat-filed" value={`${counts.filed} / ${counts.total} · ${Math.round(pct(counts.filed))}%`} dotClass="bg-ink" />
              <Stat label="On-time" testid="compliance-stat-ontime" value={counts.onTime} dotClass="bg-success" />
              <Stat label="Late" testid="compliance-stat-late" value={counts.late} dotClass="bg-warning" />
              <Stat label="Not in" testid="compliance-stat-notin" value={counts.notIn} dotClass="bg-danger" />
            </div>
          </>
        )}
      </div>

      {/* ── Exception-first: haven't filed ──────────────────────────────────── */}
      <div className="rounded-2xl border border-danger/30 bg-card overflow-hidden" data-testid="compliance-exception-list">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-danger/5">
          <span className="text-sm font-bold text-ink">Haven't filed</span>
          <span className="text-[11px] font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
            {exceptions.length} agent{exceptions.length !== 1 ? 's' : ''}
          </span>
        </div>
        {counts.total > 0 && exceptions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="compliance-all-filed">
            <CheckCircle size={28} className="text-success" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">Everyone's in</p>
            <p className="text-xs text-ink-muted">{counts.filed} of {counts.total} filed this week.</p>
          </div>
        ) : (
          exceptions.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0" data-testid="compliance-exception-row">
              <Avatar name={r.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.name}</p>
                <p className="text-xs text-ink-muted">
                  {r.unit ? `${r.unit} · ` : ''}
                  {r.lastFiled ? `last filed ${formatDateFriendly(r.lastFiled)}` : 'never filed'}
                </p>
              </div>
              {/* Reserved row-action area — Nudge ships in S2 (no re-layout). */}
              <div className="w-[96px] shrink-0" aria-hidden="true" />
            </div>
          ))
        )}
      </div>

      {/* ── Filing roster ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden" data-testid="compliance-roster">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-sm font-bold text-ink">Filing roster · {counts.total}</span>
          <span className="ml-auto text-[11px] text-ink-muted hidden sm:inline">click a row → coaching ↗</span>
        </div>
        {counts.total === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted">No agents in scope.</p>
        ) : (
          roster.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setNotesAgent({ agentId: r.id, agentName: r.name, agentUnitId: r.unitId })}
              data-testid="compliance-roster-row"
              data-status={r.status}
              className="w-full min-h-[44px] grid grid-cols-[1fr_auto] sm:grid-cols-[1.6fr_110px_120px_1fr] gap-3 items-center px-4 py-2.5 border-b border-border last:border-b-0 text-left hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
            >
              <span className="flex items-center gap-3 min-w-0">
                <Avatar name={r.name} small />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">{r.name}</span>
                  {r.unit && <span className="block text-[11px] text-ink-muted">{r.unit}</span>}
                </span>
              </span>
              <span className="justify-self-start sm:justify-self-auto">
                <StatusPill variant={PILL_VARIANT[r.status]} label={PILL_LABEL[r.status]} />
              </span>
              <span className="hidden sm:block text-xs text-ink-muted">
                {r.status === 'not-in' ? '—' : formatSubmittedTime(r.submittedAt)}
              </span>
              <span className="hidden sm:flex items-center justify-end gap-2">
                <StreakChip streak={r.streak} perWeek={r.perWeek} />
                <ChevronRight size={14} className="text-ink-muted" aria-hidden="true" />
              </span>
            </button>
          ))
        )}
      </div>

      {/* ── CBTT License Compliance (regulatory — kept as its own section) ───── */}
      <div className="rounded-2xl border border-warning/30 bg-card p-4 sm:p-5" data-testid="compliance-cbtt-section">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={16} className="text-warning" aria-hidden="true" />
          <h3 className="text-sm font-bold text-ink">CBTT License Compliance</h3>
          {cbttFlags.length > 0 && (
            <span className="ml-auto text-xs text-ink-muted">
              {cbttFlags.length} provisional agent{cbttFlags.length !== 1 ? 's' : ''} tracked
            </span>
          )}
        </div>
        {!loaded ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : cbttFlags.length === 0 ? (
          <p className="text-sm text-ink-muted">No provisional agents with a contract start date.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {cbttFlags.map(({ id, name, flag }) => {
              const rowCls = flag.daysRemaining <= 0
                ? 'border-danger/40 bg-danger/5'
                : flag.atRisk ? 'border-warning/40 bg-warning/5' : 'border-border';
              const badgeCls = flag.daysRemaining <= 0
                ? 'text-danger font-semibold'
                : flag.atRisk ? 'text-warning font-semibold' : 'text-ink-muted';
              const daysLabel = flag.daysRemaining <= 0
                ? 'Overdue'
                : `${flag.daysRemaining} day${flag.daysRemaining !== 1 ? 's' : ''} remaining`;
              const deadlineLabel = flag.deadline.toLocaleDateString('en-TT', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <div key={id} className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border ${rowCls}`}>
                  <div>
                    <p className="text-sm font-medium text-ink">{name}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Deadline: {deadlineLabel}{flag.extended ? ' · extended to 24 mo' : ''}
                    </p>
                  </div>
                  <span className={`text-xs shrink-0 mt-0.5 ${badgeCls}`}>{daysLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Presentational helpers ──────────────────────────────────────────────────

function Stat({ label, value, dotClass, testid }) {
  return (
    <div className="flex items-center gap-2.5" data-testid={testid} data-value={value}>
      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${dotClass}`} aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
        <span className="text-base font-bold text-ink">{value}</span>
      </span>
    </div>
  );
}

function Avatar({ name, small }) {
  const size = small ? 'w-8 h-8 text-[11px]' : 'w-9 h-9 text-xs';
  return (
    <span className={`${size} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function StreakChip({ streak, perWeek }) {
  // Dots: oldest → newest (left → right). Filled = on-time week, ring = miss.
  const dots = [...perWeek].reverse().map((e, i) => {
    const on = classifyWeek(e.submission, e.weekStart) === 'on-time';
    return (
      <span
        key={i}
        className={`w-[5px] h-[5px] rounded-full ${on ? 'bg-success' : 'bg-danger/15 ring-1 ring-inset ring-danger/50'}`}
      />
    );
  });
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink" title={`${streak}-week on-time streak`}>
      {streak > 0 && <Flame size={12} className="text-warning" aria-hidden="true" />}
      <span>{streak} wk</span>
      <span className="flex gap-0.5" aria-hidden="true">{dots}</span>
    </span>
  );
}
