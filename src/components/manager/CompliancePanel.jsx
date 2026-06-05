import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertTriangle, ShieldAlert, ChevronRight, Flame, Bell, Eye, Unlock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatDateFriendly } from '../../utils/formatters';
import { parseDateOnlyTT } from '../../utils/dateInputs';
import { cbttComplianceFlag } from '../../utils/cbttCompliance';
import { classifyWeek, onTimeStreak } from '../../utils/complianceDerive';
import { sendComplianceNudge, getNudgeRecords, NUDGE_TYPE, PLAN_NUDGE_TYPE } from '../../services/nudgeService';
import { getWeeklyPlan } from '../../services/weeklyPlanService';
import { unlockSubmission } from '../../services/unlockService';
import useToast from '../../hooks/useToast';
import StatusPill from '../ui/StatusPill';
import ConfirmDialog from '../ui/ConfirmDialog';
import CoachingNotesModal from './CoachingNotesModal';
import SubmissionViewer from '../submissions/SubmissionViewer';

const STREAK_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // re-nudge re-enables after 24h

// Short relative time for the cooldown chip ("just now" / "2h ago").
function relativeShort(ms) {
  const diff = Date.now() - ms;
  if (diff < 60 * 1000) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

// Lens → nudge type. Plan nudges dedupe independently of filing nudges (an
// agent can receive both in one week — that is correct).
const LENS_NUDGE_TYPE = { filing: NUDGE_TYPE, plan: PLAN_NUDGE_TYPE };

export default function CompliancePanel({ selectedWeek, setSelectedWeek }) {
  const { tenantId, user, userProfile, role } = useAuth();
  const toast = useToast();
  const managerUid  = user?.uid ?? null;
  const managerName = userProfile?.name ?? user?.displayName ?? 'Manager';
  const [weekData, setWeekData]   = useState([]); // [{ weekStart, subs: [] }] most-recent-first
  const [users, setUsers]         = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [notesAgent, setNotesAgent] = useState(null);
  // Nudge (S2)
  const [nudgeRecords, setNudgeRecords] = useState({});       // uid -> createdAt millis | null
  const [nudgingUids, setNudgingUids]   = useState(() => new Set());
  const [nudgeAllOpen, setNudgeAllOpen] = useState(false);
  const [nudgeAllBusy, setNudgeAllBusy] = useState(false);
  // Unlock / view re-home (S2)
  const [unlockTarget, setUnlockTarget] = useState(null);     // { submissionId, agentName }
  const [unlocking, setUnlocking]       = useState(false);
  const [viewerSub, setViewerSub]       = useState(null);     // submission object for SubmissionViewer
  // Lens + plan adoption (S3)
  const [lens, setLens]           = useState('filing');       // 'filing' | 'plan'
  const [plans, setPlans]         = useState({});             // uid -> plan object | null (null = not committed)
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [plansError, setPlansError]   = useState(false);

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
          submission: current,
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

  // ── Plan adoption (S3) — locked deterministic-ID get-fan-out, no list/index ────
  // For each roster agent, GET weeklyPlans/{uid}_{weekStart}; absent (or a denied
  // out-of-scope GET) = not committed. The #471 uplineCanReadPlan rule authorizes
  // UM/BM/SM/TA reads and returns clean not-found for an in-scope agent with no plan.
  const rosterUids = useMemo(() => roster.map((r) => r.id), [roster]);
  const rosterKey  = rosterUids.join(',');

  useEffect(() => {
    if (!tenantId || rosterUids.length === 0) { setPlans({}); setPlansLoaded(true); return; }
    let cancelled = false;
    setPlansLoaded(false);
    setPlansError(false);
    Promise.all(rosterUids.map((uid) =>
      getWeeklyPlan(tenantId, uid, selectedWeek).then((p) => [uid, p]).catch(() => [uid, null]),
    ))
      .then((entries) => { if (!cancelled) { setPlans(Object.fromEntries(entries)); setPlansLoaded(true); } })
      .catch(() => { if (!cancelled) { setPlansError(true); setPlansLoaded(true); } });
    return () => { cancelled = true; };
  }, [rosterKey, selectedWeek, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const planCounts = useMemo(() => {
    const total = roster.length;
    const committed = roster.reduce((acc, r) => acc + (plans[r.id] ? 1 : 0), 0);
    return { committed, notCommitted: total - committed, total };
  }, [roster, plans]);

  // Gated on plansLoaded so we never flash "everyone not committed" (or fan out
  // cooldown reads over the whole roster) before the plan GETs resolve.
  const planExceptions = useMemo(
    () => (plansLoaded ? roster.filter((r) => !plans[r.id]) : []),
    [roster, plans, plansLoaded],
  );

  // ── Active lens selection ─────────────────────────────────────────────────────
  const activeExceptions = lens === 'plan' ? planExceptions : exceptions;
  const activeType = LENS_NUDGE_TYPE[lens];
  const activeUids = useMemo(() => activeExceptions.map((e) => e.id), [activeExceptions]);
  const activeKey  = activeUids.join(',');

  // Cooldown reads for the ACTIVE lens's exception set (deterministic-ID GET
  // fan-out, type-scoped; never a list query). Refetches on lens switch.
  useEffect(() => {
    if (!tenantId || activeUids.length === 0) { setNudgeRecords({}); return; }
    let cancelled = false;
    getNudgeRecords(tenantId, activeUids, selectedWeek, activeType)
      .then((rec) => { if (!cancelled) setNudgeRecords(rec); })
      .catch(() => { if (!cancelled) setNudgeRecords({}); });
    return () => { cancelled = true; };
  }, [activeKey, activeType, selectedWeek, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scopeLabel = role === 'unit_manager'
    ? (userProfile?.unitName || 'your unit')
    : role === 'branch_manager'
      ? (userProfile?.branchName || 'your branch')
      : 'the company';

  const handleNudge = async (uid) => {
    setNudgingUids((s) => new Set(s).add(uid));
    try {
      await sendComplianceNudge([uid], selectedWeek, activeType);
      setNudgeRecords((r) => ({ ...r, [uid]: Date.now() }));
    } catch (e) {
      console.error('[CompliancePanel] nudge failed:', e);
      toast.show({ variant: 'error', message: 'Nudge failed. Please try again.' });
    } finally {
      setNudgingUids((s) => { const n = new Set(s); n.delete(uid); return n; });
    }
  };

  const handleNudgeAll = async () => {
    if (activeUids.length === 0) return;
    setNudgeAllBusy(true);
    try {
      await sendComplianceNudge(activeUids, selectedWeek, activeType);
      const now = Date.now();
      setNudgeRecords((r) => {
        const n = { ...r };
        activeUids.forEach((u) => { n[u] = now; });
        return n;
      });
      toast.show({ variant: 'success', message: `${activeUids.length} nudge${activeUids.length !== 1 ? 's' : ''} sent` });
      setNudgeAllOpen(false);
    } catch (e) {
      console.error('[CompliancePanel] nudge-all failed:', e);
      toast.show({ variant: 'error', message: 'Nudge all failed. Please try again.' });
    } finally {
      setNudgeAllBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!unlockTarget) return;
    setUnlocking(true);
    try {
      await unlockSubmission(tenantId, unlockTarget.submissionId, managerUid, managerName);
      toast.show({ variant: 'success', message: 'Report unlocked.' });
      setUnlockTarget(null);
      loadData();
    } catch (e) {
      console.error('[CompliancePanel] unlock failed:', e);
      toast.show({ variant: 'error', message: 'Unlock failed. Please try again.' });
    } finally {
      setUnlocking(false);
    }
  };

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

  // ── Lens-driven reality bar config ────────────────────────────────────────────
  const realityBar = useMemo(() => {
    if (lens === 'plan') {
      const t = planCounts.total;
      const cpct = (n) => (t > 0 ? Math.round((n / t) * 100) : 0);
      return {
        headerLabel: 'Plan adoption · this week',
        headerRight: 'weekly plan committed',
        total: t,
        ariaLabel: `Plan adoption: ${planCounts.committed} committed, ${planCounts.notCommitted} not committed, of ${t} agents`,
        segments: [
          { cls: 'bg-success', n: planCounts.committed },
          { cls: 'bg-danger',  n: planCounts.notCommitted },
        ],
        stats: [
          { label: 'Committed',     testid: 'compliance-stat-committed',    value: `${planCounts.committed} / ${t} · ${cpct(planCounts.committed)}%`, dotClass: 'bg-success' },
          { label: 'Not committed', testid: 'compliance-stat-notcommitted', value: planCounts.notCommitted, dotClass: 'bg-danger' },
        ],
      };
    }
    const t = counts.total;
    const fpct = (n) => (t > 0 ? Math.round((n / t) * 100) : 0);
    return {
      headerLabel: 'Filing reality · this week',
      headerRight: 'Sun 23:59 AST deadline',
      total: t,
      ariaLabel: `Filing: ${counts.onTime} on-time, ${counts.late} late, ${counts.notIn} not in, of ${t} agents`,
      segments: [
        { cls: 'bg-success', n: counts.onTime },
        { cls: 'bg-warning', n: counts.late },
        { cls: 'bg-danger',  n: counts.notIn },
      ],
      stats: [
        { label: 'Filed',   testid: 'compliance-stat-filed',  value: `${counts.filed} / ${t} · ${fpct(counts.filed)}%`, dotClass: 'bg-ink' },
        { label: 'On-time', testid: 'compliance-stat-ontime', value: counts.onTime, dotClass: 'bg-success' },
        { label: 'Late',    testid: 'compliance-stat-late',   value: counts.late,   dotClass: 'bg-warning' },
        { label: 'Not in',  testid: 'compliance-stat-notin',  value: counts.notIn,  dotClass: 'bg-danger' },
      ],
    };
  }, [lens, counts, planCounts]);

  const exHeader  = lens === 'plan' ? "Haven't committed a plan" : "Haven't filed";
  const planBusy  = lens === 'plan' && !plansLoaded;

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

      {/* Submission viewer — re-homed from S2 (re-mount only, no new logic) */}
      {viewerSub && (
        <SubmissionViewer submission={viewerSub} onClose={() => setViewerSub(null)} />
      )}

      {/* Nudge-all confirm — names count + scope before firing (never a silent blast) */}
      <ConfirmDialog
        open={nudgeAllOpen}
        onConfirm={handleNudgeAll}
        onCancel={() => setNudgeAllOpen(false)}
        title={`Nudge ${activeUids.length} agent${activeUids.length !== 1 ? 's' : ''}?`}
        message={`Sends a reminder to everyone who ${lens === 'plan' ? "hasn't committed a plan" : "hasn't filed"} for the week of ${formatDateFriendly(selectedWeek)} — ${scopeLabel}. Each agent gets an in-app notification and an email.`}
        confirmLabel={`Send ${activeUids.length} nudge${activeUids.length !== 1 ? 's' : ''}`}
        variant="primary"
        loading={nudgeAllBusy}
      />

      {/* Unlock confirm — re-homed unlockSubmission (existing service, confirm retained) */}
      <ConfirmDialog
        open={!!unlockTarget}
        onConfirm={handleUnlock}
        onCancel={() => setUnlockTarget(null)}
        title="Unlock report for editing?"
        message={unlockTarget ? `${unlockTarget.agentName}'s report will return to draft so they can edit and resubmit. They'll be notified.` : ''}
        confirmLabel="Unlock"
        variant="warning"
        loading={unlocking}
      />

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

      {/* ── Lens toggle — Filing ⇄ Plan adoption (swaps bar + exception list) ─── */}
      <div className="inline-flex gap-1 p-1 rounded-xl bg-surface border border-border w-fit" data-testid="compliance-lens-toggle">
        <LensTab
          active={lens === 'filing'}
          onClick={() => setLens('filing')}
          label="Filing"
          count={`${counts.notIn} not in`}
          testid="compliance-lens-filing"
        />
        <LensTab
          active={lens === 'plan'}
          onClick={() => setLens('plan')}
          label="Plan adoption"
          count={plansLoaded ? `${planCounts.notCommitted} no plan` : '…'}
          testid="compliance-lens-plan"
        />
      </div>

      {/* ── Reality bar (lens-driven) ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid="compliance-reality-bar">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{realityBar.headerLabel}</span>
          <span className="ml-auto text-[11px] text-ink-muted">{realityBar.headerRight}</span>
        </div>

        {planBusy ? (
          <p className="text-sm text-ink-muted py-3" data-testid="compliance-plan-loading">Loading plan commitments…</p>
        ) : plansError && lens === 'plan' ? (
          <p className="text-sm text-danger py-3" data-testid="compliance-plan-error">Couldn't load plan data. Try reloading.</p>
        ) : realityBar.total === 0 ? (
          <p className="text-sm text-ink-muted py-3" data-testid="compliance-empty-roster">No agents in scope for this week.</p>
        ) : (
          <>
            {/* Decorative segmented bar — numbers live in the stat chips below.
                role="img" + aria-label carry the meaning; no in-segment text
                (white-on-tint failed AA in dark; accessibility over decoration). */}
            <div className="flex h-9 rounded-lg overflow-hidden border border-border" role="img" aria-label={realityBar.ariaLabel}>
              {realityBar.segments.map((s, i) => (
                s.n > 0 && <div key={i} className={`${s.cls} h-full`} style={{ width: `${(s.n / realityBar.total) * 100}%` }} />
              ))}
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
              {realityBar.stats.map((st) => (
                <Stat key={st.testid} label={st.label} testid={st.testid} value={st.value} dotClass={st.dotClass} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Exception-first list (lens-driven) ──────────────────────────────── */}
      <div className="rounded-2xl border border-danger/30 bg-card overflow-hidden" data-testid="compliance-exception-list">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-danger/5">
          <span className="text-sm font-bold text-ink">{exHeader}</span>
          <span className="text-[11px] font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
            {activeExceptions.length} agent{activeExceptions.length !== 1 ? 's' : ''}
          </span>
          {activeExceptions.length > 0 && (
            <button
              type="button"
              onClick={() => setNudgeAllOpen(true)}
              data-testid="compliance-nudge-all"
              className="ml-auto inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-lg bg-primary dark:bg-primary-dark text-white text-xs font-bold hover:bg-primary/90 dark:hover:bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <Bell size={13} aria-hidden="true" />
              Nudge all {activeExceptions.length}
            </button>
          )}
        </div>
        {planBusy ? (
          <p className="px-4 py-6 text-sm text-ink-muted">Loading plan commitments…</p>
        ) : realityBar.total > 0 && activeExceptions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="compliance-all-clear">
            <CheckCircle size={28} className="text-success" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">{lens === 'plan' ? "Everyone's committed" : "Everyone's in"}</p>
            <p className="text-xs text-ink-muted">
              {lens === 'plan'
                ? `${planCounts.committed} of ${planCounts.total} committed a plan this week.`
                : `${counts.filed} of ${counts.total} filed this week.`}
            </p>
          </div>
        ) : (
          activeExceptions.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0" data-testid="compliance-exception-row" data-uid={r.id}>
              <Avatar name={r.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.name}</p>
                <p className="text-xs text-ink-muted">
                  {r.unit ? `${r.unit} · ` : ''}
                  {lens === 'plan'
                    ? 'no plan this week'
                    : (r.lastFiled ? `last filed ${formatDateFriendly(r.lastFiled)}` : 'never filed')}
                </p>
              </div>
              {/* Row-action area — Nudge / cooldown chip (S2; type per active lens). */}
              <NudgeAction
                busy={nudgingUids.has(r.id)}
                nudgedAt={nudgeRecords[r.id] ?? null}
                onNudge={() => handleNudge(r.id)}
              />
            </div>
          ))
        )}
      </div>

      {/* ── Filing-lens-only sections: streak roster + CBTT (filing artifacts per D2) ── */}
      {lens === 'filing' && (
      <>
      {/* ── Filing roster ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden" data-testid="compliance-roster">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-sm font-bold text-ink">Filing roster · {counts.total}</span>
          <span className="ml-auto text-[11px] text-ink-muted hidden sm:inline">click a row → coaching ↗</span>
        </div>
        {counts.total === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted">No agents in scope.</p>
        ) : (
          roster.map((r) => {
            const submitted = r.status !== 'not-in' && !!r.submission?.id;
            return (
              <div
                key={r.id}
                data-testid="compliance-roster-row"
                data-status={r.status}
                className="flex items-stretch border-b border-border last:border-b-0 hover:bg-surface transition-colors"
              >
                {/* Main info → coaching drawer on click (S1 behavior preserved). */}
                <button
                  type="button"
                  onClick={() => setNotesAgent({ agentId: r.id, agentName: r.name, agentUnitId: r.unitId })}
                  className="flex-1 min-w-0 min-h-[44px] grid grid-cols-[1fr_auto] sm:grid-cols-[1.6fr_110px_120px_1fr] gap-3 items-center px-4 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
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

                {/* Submitted rows → compact View + Unlock actions (re-homed). */}
                {submitted && (
                  <div className="flex items-center gap-1 pr-2 shrink-0" data-testid="compliance-row-actions">
                    <button
                      type="button"
                      onClick={() => setViewerSub(r.submission)}
                      aria-label={`View ${r.name}'s report`}
                      data-testid="compliance-view-btn"
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-card-raised transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <Eye size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnlockTarget({ submissionId: r.submission.id, agentName: r.name })}
                      aria-label={`Unlock ${r.name}'s report`}
                      data-testid="compliance-unlock-btn"
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted hover:text-warning hover:bg-card-raised transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <Unlock size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
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
      </>
      )}
    </div>
  );
}

// ── Presentational helpers ──────────────────────────────────────────────────

function LensTab({ active, onClick, label, count, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testid}
      className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        active ? 'bg-primary dark:bg-primary-dark text-white' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${active ? 'bg-white/25 text-white' : 'bg-border/60 text-ink-muted'}`}>
        {count}
      </span>
    </button>
  );
}

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

function NudgeAction({ busy, nudgedAt, onNudge }) {
  const onCooldown = nudgedAt != null && (Date.now() - nudgedAt) < COOLDOWN_MS;

  if (onCooldown) {
    return (
      <span
        data-testid="compliance-cooldown-chip"
        className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg bg-card-raised border border-border text-[11px] font-semibold text-ink-muted whitespace-nowrap"
      >
        <CheckCircle size={13} className="text-success" aria-hidden="true" />
        Nudged {relativeShort(nudgedAt)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onNudge}
      disabled={busy}
      data-testid="compliance-nudge-btn"
      className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary/10 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <Bell size={13} aria-hidden="true" />
      {busy ? 'Nudging…' : 'Nudge'}
    </button>
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
