// AgentDrillDrawer — manager coaching drill (Fable 1.5, ported from screens-v2
// manager-v2-drill.jsx AgentDrill). Opening an exception (or roster row) drills
// into ONE agent's coaching view.
//
// A NEW drawer rather than an extension of AgentPlanDrawer: that drawer is the
// clarity-masked Money-Needs *plan* review (Overview/Year/Monthly tabs, a
// suggest-back write). This is a read-only *performance coaching* surface with a
// disjoint tab set (Overview coaching / Report / Goals cascade) hosting the fresh
// AgentReportView. Cramming both domains into one component would hurt clarity;
// the shared contract that matters — the §4 dialog behaviour — is honoured here
// via the recently-hardened useFocusTrap (Escape, focus-return, 44px close).
//
// Read-light: the agent's submissions arrive as a prop (already-loaded ytdSubs,
// via useBranchOverview.submissionsByAgent). Per-agent settlements / goals /
// persistency / goal-cascade that the manager context lacks are lazy-loaded ONCE
// on open (AgentPlanDrawer precedent — ≤4 deterministic reads), each wrapped so a
// rules-denied read degrades to a neutral "unavailable" slice, never an alarm.
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Lock, AlertTriangle, Target, FileWarning } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { formatCurrency, initials as toInitials } from '../../utils/formatters';
import { getSettlements } from '../../services/settlementService';
import { getGoals, getGoalHierarchy } from '../../services/goalsService';
import { getAgentHistory } from '../../services/persistencyService';
import AgentReportView from '../profile/AgentReportView';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'report', label: 'Report' },
  { id: 'goals', label: 'Goals' },
];

const TYPE_ICON = { floor: AlertTriangle, pace: Target, report: FileWarning };

// ── Overview (coaching) ─────────────────────────────────────────────────────
function DrillOverview({ agent }) {
  const { ytdApi = 0, floor = 0, expectedByNow = 0, spark = [] } = agent;
  const pacePct = expectedByNow > 0 ? Math.round((ytdApi / expectedByNow) * 100) : null;
  const behind = Math.max(0, expectedByNow - ytdApi);

  // Trajectory direction from the spark (last vs first of the recent window).
  let trend = null;
  if (spark.length >= 2) {
    const first = spark[0];
    const last = spark[spark.length - 1];
    trend = last < first ? 'down' : last > first ? 'up' : 'flat';
  }

  const reasons = [];
  if (pacePct !== null && pacePct < 100) {
    reasons.push({
      t: 'Behind floor pace',
      s: `${formatCurrency(ytdApi)} YTD · ${pacePct}% of the ${formatCurrency(expectedByNow)} expected by now`,
    });
  }
  if (trend === 'down') {
    reasons.push({ t: 'Production trending down', s: `Recent weekly API is falling over the last ${spark.length} weeks` });
  }
  if (agent.type === 'report') {
    reasons.push({ t: 'Reporting gap', s: agent.meta || 'A recent weekly report is missing' });
  }
  if (reasons.length === 0) {
    reasons.push({ t: 'Flagged for review', s: agent.detail || 'Open the Report tab for the full picture' });
  }

  const danger = agent.tone === 'danger';

  return (
    <div className="flex flex-col gap-4">
      {/* Mini hero — YTD vs pace/floor */}
      <div className={`rounded-xl p-4 border ${danger ? 'bg-danger/10 border-danger/30' : 'bg-warning/10 border-warning/30'}`} data-testid="drill-overview-hero">
        <p className={`text-[10px] font-bold font-mono uppercase tracking-widest ${danger ? 'text-danger-ink' : 'text-warning-ink'}`}>
          YTD API · vs floor pace
        </p>
        <div className="flex items-end gap-3 mt-1.5 flex-wrap">
          <p className="font-display text-3xl font-extrabold text-ink tracking-tight leading-none tabular-nums">
            {formatCurrency(ytdApi)}
          </p>
          {behind > 0 && (
            <p className="text-xs text-ink-muted pb-1">{formatCurrency(behind)} behind pace</p>
          )}
        </div>
        <div className="mt-3 w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full ${danger ? 'bg-danger' : 'bg-warning'}`}
            style={{ width: `${Math.min(100, pacePct ?? 0)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] font-mono text-ink-muted">
          <span>{pacePct !== null ? `${pacePct}% of pace` : '—'}</span>
          <span>Floor · {formatCurrency(floor)}</span>
        </div>
      </div>

      {/* Why flagged */}
      <div>
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-2">Why flagged</p>
        <div className="flex flex-col gap-2">
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card-raised">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{r.t}</p>
                <p className="text-xs text-ink-muted mt-0.5">{r.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-ink-muted">
        Read-only coaching view — {agent.name?.split(' ')[0] || 'the agent'} authors these numbers. Use the Report tab for the
        full week→year breakdown and the Goals tab for the cascade.
      </p>
    </div>
  );
}

// ── Goals cascade ───────────────────────────────────────────────────────────
function NeutralCard({ title, body, testId }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card-raised text-center" data-testid={testId}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs text-ink-muted mt-1">{body}</p>
    </div>
  );
}

function DrillGoals({ hierarchy, loading, firstName }) {
  if (loading) {
    return <div className="h-40 rounded-xl bg-surface-muted motion-safe:animate-pulse" aria-hidden="true" data-testid="drill-goals-loading" />;
  }
  if (!hierarchy) {
    return <NeutralCard title="Goals unavailable" body="This agent's goal cascade isn't available to you right now." testId="drill-goals-unavailable" />;
  }
  const rows = [
    { label: 'Personal commitment', value: hierarchy.personal?.api, note: `${firstName}'s own target`, empty: !(hierarchy.personal?.api > 0) },
    { label: 'Unit recommendation', value: hierarchy.unitTarget?.api, note: 'Set by the unit manager' },
    { label: 'Branch target', value: hierarchy.branchTarget?.api, note: 'Branch baseline' },
    { label: 'Company floor', value: hierarchy.companyFloor?.api, note: 'Tenure minimum' },
  ];
  return (
    <div className="flex flex-col gap-2" data-testid="drill-goals-cascade">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 p-3 rounded-xl border ${r.empty ? 'border-dashed border-border' : 'border-border'} bg-card`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{r.label}</p>
            <p className="text-xs text-ink-muted mt-0.5">{r.note}</p>
          </div>
          <p className="font-display text-base font-extrabold text-ink tabular-nums" data-testid={`drill-goal-${i}`}>
            {r.value > 0 ? formatCurrency(r.value) : 'Not set'}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AgentDrillDrawer({ agent, submissions = [], tenantId, onClose }) {
  const modalRef = useFocusTrap({ onEscape: onClose });
  const [tab, setTab] = useState('overview');
  const [dataState, setDataState] = useState({ status: 'loading' });
  const loadSeq = useRef(0);

  const year = new Date().getFullYear();

  const load = useCallback(async () => {
    if (!tenantId || !agent?.agentId) return;
    const seq = ++loadSeq.current;
    setDataState({ status: 'loading' });
    try {
      // Each read is independently guarded — a rules-denied slice degrades to a
      // neutral null (Report renders from submissions; Goals shows "unavailable").
      const [settlements, goals, persistency, hierarchy] = await Promise.all([
        getSettlements(tenantId, agent.agentId, year).catch(() => []),
        getGoals(tenantId, agent.agentId).catch(() => null),
        getAgentHistory(tenantId, agent.agentId).catch(() => []),
        getGoalHierarchy(tenantId, agent.unitId ?? null, year, agent.agentId).catch(() => null),
      ]);
      if (seq !== loadSeq.current) return;
      setDataState({ status: 'ready', settlements, goals, persistency, hierarchy });
    } catch (e) {
      if (seq !== loadSeq.current) return;
      console.error('[AgentDrillDrawer] load failed', e);
      setDataState({ status: 'error' });
    }
  }, [tenantId, agent?.agentId, agent?.unitId, year]);

  useEffect(() => { load(); }, [load]);

  const reportLoading = dataState.status === 'loading';
  const reportError = dataState.status === 'error';
  const firstName = useMemo(() => (agent?.name?.trim().split(' ')[0]) || 'this agent', [agent?.name]);

  if (!agent) return null;

  const Icon = TYPE_ICON[agent.type] || AlertTriangle;
  const danger = agent.tone === 'danger';
  const agentProfile = { contractStartDate: agent.contractStartDate ?? null };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-drill-title"
          data-testid="agent-drill-drawer"
          className="w-screen max-w-md h-full flex flex-col bg-card border-l border-border shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-base">
              {agent.initials || toInitials(agent.name)}
            </div>
            <div className="min-w-0">
              <h2 id="agent-drill-title" className="font-display font-extrabold text-base text-ink truncate">
                {agent.name}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5 truncate">
                {[agent.unitId ? `Unit ${agent.unitId}` : null, 'Coaching view'].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wide border ${danger ? 'bg-danger/10 border-danger/30 text-danger-ink' : 'bg-warning/10 border-warning/30 text-warning-ink'}`}>
              <Icon size={11} aria-hidden="true" /> {agent.kind}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close coaching view"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Ownership banner */}
          <div className="mx-5 mt-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-gold/10 border border-gold/40 flex-shrink-0">
            <Lock size={13} className="text-gold-ink mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] text-ink-muted leading-relaxed">
              <span className="font-semibold text-ink">Read-only.</span> You&rsquo;re acting on {firstName}&rsquo;s behalf —
              coach the gaps and pull the report; the numbers stay theirs.
            </p>
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="Coaching sections" className="flex items-stretch gap-1 px-5 pt-3 border-b border-border flex-shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                data-testid={`drill-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`min-h-[44px] px-4 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-primary text-ink bg-card-raised'
                    : 'border-transparent text-ink-muted hover:text-ink hover:bg-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === 'overview' && <DrillOverview agent={agent} />}
            {tab === 'report' && (
              <AgentReportView
                layout="narrow"
                submissions={submissions}
                settlements={dataState.settlements ?? []}
                goals={dataState.goals ?? null}
                persistency={dataState.persistency ?? []}
                agentProfile={agentProfile}
                displayName={agent.name}
                roleLabel="Agent"
                loading={reportLoading}
                error={reportError}
                onRetry={load}
              />
            )}
            {tab === 'goals' && (
              <DrillGoals hierarchy={dataState.hierarchy} loading={reportLoading} firstName={firstName} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
