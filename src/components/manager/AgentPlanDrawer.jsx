// PR-GPM1 — AgentPlanDrawer (read-only per-agent plan review).
// PR-B2 — extended into the whole-plan review: tabs (Overview / Year Plan /
// Monthly), read-only plan-health checklist, dynamic focus trap.
//
// Overview tab: ONLY the SHOWN projection the service produced
// (projectSharedWorksheet allow-list) — unchanged from GPM1. The household
// budget itself never reaches this component.
//
// Year Plan / Monthly tabs (B2): lazy per-drawer-open reads through the Fork B1
// unconditional-upline rules arms (planReviewService). A permission-denied read
// renders a NEUTRAL "Plan unavailable" state — never an error alarm
// (pre-B1-deploy every read denies; post-deploy a denial means out-of-scope).
// A missing doc renders a neutral empty state. Read-only throughout — the
// suggest-back card is B3, not here. No write affordances of any kind: the
// single action is Coach (CoachingNotesModal via onCoach).
//
// Fetch contract (dispatcher-ruled): the ROSTER row contract is unchanged; the
// drawer fetches on OPEN (not per-tab) — ≤4 deterministic-ID gets, no per-tab
// loading jank, and the Year Plan tab's health checklist needs plan+floor
// together anyway.
//
// Clarity (#786): ALL tab content renders inside the existing masked panel div
// (data-clarity-mask="True") — masked by inheritance, no guard/doc edits.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Lock, MessageSquare, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatCurrency, initials } from '../../utils/formatters';
import { getAgentYearPlan, getAgentMonthlyPlan, getAgentAnnualFloor } from '../../services/planReviewService';
import { checkAboveFloor, checkLineMix, checkNotOverCommitted } from '../../utils/planHealth';
import { enumerateFocusables } from '../../utils/focusables';

const LINE_LABELS = { life: 'Life', ah: 'A&H', property: 'Property', motor: 'Motor' };
const PLAN_LINE_LABELS = { life: 'Life', ah: 'A&H', general: 'General' };
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// updatedAt arrives as a Firestore Timestamp (or null). House format: DD-MM-YYYY.
function formatTimestampDDMMYYYY(ts) {
  const d = ts?.toDate?.() ?? (ts instanceof Date ? ts : null);
  if (!d || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function Stat({ label, value, testId }) {
  return (
    <div className="flex-1 min-w-[120px] rounded-lg border border-border bg-card-raised p-3 text-center">
      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-base font-extrabold text-ink" data-testid={testId}>{value}</p>
    </div>
  );
}

// Neutral per-tab states — "unavailable" is deliberately calm (never an alarm).
function NeutralCard({ title, body, testId }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card-raised text-center" data-testid={testId}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs text-ink-muted mt-1">{body}</p>
    </div>
  );
}

function TabLoading() {
  return (
    <div className="flex flex-col gap-3" data-testid="tpd-tab-loading" aria-busy="true">
      <div className="h-20 rounded-xl bg-border/30 animate-pulse" />
      <div className="h-32 rounded-xl bg-border/30 animate-pulse" />
    </div>
  );
}

function HealthRow({ ok, label, note, testId }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5" data-testid={testId} data-ok={ok ? 'true' : 'false'}>
      {ok ? (
        <CheckCircle2 size={16} className="text-success shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle size={16} className="text-warning shrink-0" aria-hidden="true" />
      )}
      <span className="text-sm font-semibold text-ink flex-1">{label}</span>
      {note && (
        <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-ink-muted">{note}</span>
      )}
    </div>
  );
}

export default function AgentPlanDrawer({ row, tenantId, onClose, onCoach }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const [tab, setTab] = useState('overview');
  const [planState, setPlanState] = useState({ status: 'loading' });

  const planYear = row?.plan?.year ?? new Date().getFullYear();

  const loadPlans = useCallback(async () => {
    if (!tenantId || !row?.agentId) return;
    setPlanState({ status: 'loading' });
    try {
      const [yearRes, monthlyRes, floor] = await Promise.all([
        getAgentYearPlan(tenantId, row.agentId, planYear),
        getAgentMonthlyPlan(tenantId, row.agentId, planYear),
        getAgentAnnualFloor(tenantId, row.agentId),
      ]);
      setPlanState({ status: 'ready', year: yearRes, monthly: monthlyRes, floor });
    } catch (e) {
      console.error('[AgentPlanDrawer] plan fetch failed', e);
      setPlanState({ status: 'error' });
    }
  }, [tenantId, row?.agentId, planYear]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { closeRef.current?.focus(); }, []);

  // Focus trap (B2 dynamic rework): cycle Tab/Shift+Tab across ALL visible
  // tabbables inside the panel — enumerated at keydown time so tab buttons,
  // Retry, and future B3 controls are always inside the cycle.
  useEffect(() => {
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const els = enumerateFocusables(panelRef.current);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, []);

  if (!row?.plan) return null;
  const { plan } = row;
  const updatedLabel = formatTimestampDDMMYYYY(plan.updatedAt);

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'year', label: 'Year Plan' },
    { id: 'monthly', label: 'Monthly' },
  ];

  const yearRes = planState.status === 'ready' ? planState.year : null;
  const monthlyRes = planState.status === 'ready' ? planState.monthly : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-plans-drawer-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        {/* Clarity mask — personal financial data (shared Money Needs projection
            + production plans); do not remove. All tab content inherits it. */}
        <div
          ref={panelRef}
          data-clarity-mask="True"
          className="w-full max-w-lg max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-lg border border-border overflow-hidden pointer-events-auto"
          data-testid="team-plans-drawer"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm shrink-0">
              {initials(row.agentName)}
            </div>
            <div className="min-w-0">
              <h2 id="team-plans-drawer-title" className="font-display font-extrabold text-base text-ink truncate">
                {row.agentName}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Money Needs · {plan.year ?? '—'}{updatedLabel ? ` · updated ${updatedLabel}` : ''}
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wide bg-surface-muted text-ink-muted border border-border">
              <Lock size={11} aria-hidden="true" /> Read-only
            </span>
            <button
              ref={closeRef}
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              aria-label="Close plan detail"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab strip (B2) */}
          <div role="tablist" aria-label="Plan sections" className="flex items-stretch gap-1 px-5 pt-3 border-b border-border flex-shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                aria-controls={`tpd-panel-${t.id}`}
                data-testid={`tpd-tab-${t.id}`}
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
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {/* ── Overview tab — SHOWN projection only (GPM1, unchanged) ── */}
            {tab === 'overview' && (
              <div id="tpd-panel-overview" role="tabpanel" className="flex flex-col gap-4">
                {/* Commissions-required hero */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center" data-testid="team-plans-drawer-hero">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">First-year commissions required</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-ink" data-testid="tpd-fyc-required">
                    {formatCurrency(plan.firstYearCommissionsRequired)}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">What this agent's plan needs from new business this year.</p>
                </div>

                {/* Targets by line */}
                <div data-testid="team-plans-drawer-targets">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-2">First-year commission targets by line</p>
                  <div className="flex items-stretch gap-2 flex-wrap">
                    {Object.entries(LINE_LABELS).map(([key, label]) => (
                      <Stat key={key} label={label} value={formatCurrency(plan.firstYearCommissionsTargets?.[key])} testId={`tpd-target-${key}`} />
                    ))}
                  </div>
                </div>

                {/* Renewal estimate */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card-raised border border-border" data-testid="team-plans-drawer-renewal">
                  <div>
                    <p className="text-sm font-semibold text-ink">Estimated renewal income</p>
                    <p className="text-xs text-ink-muted mt-0.5">Recurring income already working for the plan.</p>
                  </div>
                  <p className="font-display text-lg font-extrabold text-ink" data-testid="tpd-renewal-total">
                    {formatCurrency(plan.estimatedRenewalIncome?.total)}
                  </p>
                </div>

                {/* Income aggregates */}
                <div data-testid="team-plans-drawer-income">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-2">Income need · aggregates only</p>
                  <div className="flex items-stretch gap-2 flex-wrap">
                    <Stat label="Annual after tax" value={formatCurrency(plan.totalAnnualAfterTax)} testId="tpd-after-tax" />
                    <Stat label="PAYE" value={formatCurrency(plan.computedPAYE)} testId="tpd-paye" />
                    <Stat label="Annual pre-tax" value={formatCurrency(plan.totalAnnualPreTax)} testId="tpd-pre-tax" />
                  </div>
                  <p className="mt-2 text-[11px] text-ink-muted">
                    The worksheet's line items stay private to the agent — you coach on the derived need, not the household budget.
                  </p>
                </div>
              </div>
            )}

            {/* ── Year Plan tab (B2) ── */}
            {tab === 'year' && (
              <div id="tpd-panel-year" role="tabpanel" className="flex flex-col gap-4">
                {planState.status === 'loading' && <TabLoading />}
                {planState.status === 'error' && (
                  <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center justify-between gap-3 flex-wrap" data-testid="tpd-year-error">
                    <span>Couldn't load this plan right now.</span>
                    <button
                      type="button"
                      onClick={loadPlans}
                      className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
                    >
                      <RefreshCw size={14} aria-hidden="true" /> Retry
                    </button>
                  </div>
                )}
                {yearRes?.unavailable && (
                  <NeutralCard
                    title="Plan unavailable"
                    body="This agent's year plan isn't available to you right now."
                    testId="tpd-year-unavailable"
                  />
                )}
                {yearRes?.empty && (
                  <NeutralCard
                    title="No year plan yet"
                    body={`${row.agentName.split(' ')[0]} hasn't built a ${planYear} year plan.`}
                    testId="tpd-year-empty"
                  />
                )}
                {yearRes?.plan && (
                  <>
                    <div className="flex items-center gap-2 flex-wrap" data-testid="tpd-year-meta">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                        Year plan · {yearRes.plan.year ?? planYear}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-surface-muted text-ink-muted border border-border"
                        data-testid="tpd-year-status"
                      >
                        {yearRes.plan.status === 'committed' ? 'Committed' : 'Draft'}
                      </span>
                      {formatTimestampDDMMYYYY(yearRes.plan.updatedAt) && (
                        <span className="text-[11px] text-ink-muted">updated {formatTimestampDDMMYYYY(yearRes.plan.updatedAt)}</span>
                      )}
                    </div>

                    {/* Targets by line (API + share + derived commission) */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      {Object.entries(PLAN_LINE_LABELS).map(([key, label]) => {
                        const l = yearRes.plan.lines[key];
                        return (
                          <div key={key} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0" data-testid={`tpd-line-${key}`}>
                            <span className="text-sm font-semibold text-ink w-20">{label}</span>
                            <span className="text-xs text-ink-muted">{l.pct ? `${l.pct}%` : '—'}</span>
                            <span className="ml-auto font-display text-sm font-extrabold text-ink" data-testid={`tpd-line-${key}-api`}>
                              {formatCurrency(l.targetAPI)}
                            </span>
                            <span className="text-[11px] text-ink-muted w-28 text-right">
                              {formatCurrency(l.derivedCommission)} comm.
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Plan health — read-only checklist (locked THREE checks) */}
                    <PlanHealth
                      lines={yearRes.plan.lines}
                      floor={planState.floor}
                      shared={row.shared === true}
                      firstYearCommissionsRequired={plan.firstYearCommissionsRequired}
                    />
                  </>
                )}
              </div>
            )}

            {/* ── Monthly tab (B2) ── */}
            {tab === 'monthly' && (
              <div id="tpd-panel-monthly" role="tabpanel" className="flex flex-col gap-4">
                {planState.status === 'loading' && <TabLoading />}
                {planState.status === 'error' && (
                  <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center justify-between gap-3 flex-wrap" data-testid="tpd-monthly-error">
                    <span>Couldn't load this plan right now.</span>
                    <button
                      type="button"
                      onClick={loadPlans}
                      className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
                    >
                      <RefreshCw size={14} aria-hidden="true" /> Retry
                    </button>
                  </div>
                )}
                {monthlyRes?.unavailable && (
                  <NeutralCard
                    title="Plan unavailable"
                    body="This agent's monthly plan isn't available to you right now."
                    testId="tpd-monthly-unavailable"
                  />
                )}
                {monthlyRes?.empty && (
                  <NeutralCard
                    title="No monthly plan yet"
                    body={`${row.agentName.split(' ')[0]} hasn't split a ${planYear} plan into months.`}
                    testId="tpd-monthly-empty"
                  />
                )}
                {monthlyRes?.plan && (
                  <>
                    <div className="flex items-center gap-2 flex-wrap" data-testid="tpd-monthly-meta">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                        Monthly split · {monthlyRes.plan.year ?? planYear}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-surface-muted text-ink-muted border border-border">
                        {monthlyRes.plan.split === 'custom' ? 'Custom split' : 'Even split'}
                      </span>
                      <span className="ml-auto text-[11px] text-ink-muted">
                        Anchor <span className="font-semibold text-ink" data-testid="tpd-monthly-anchor">{formatCurrency(monthlyRes.plan.anchorAPI)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="tpd-monthly-grid">
                      {monthlyRes.plan.targets.slice(0, 12).map((t, i) => (
                        <div key={MONTH_LABELS[i]} className="rounded-lg border border-border bg-card-raised px-3 py-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">{MONTH_LABELS[i]}</span>
                          <span className="font-display text-sm font-extrabold text-ink" data-testid={`tpd-month-${i}`}>{formatCurrency(t)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer — Coach is the only action */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border flex-shrink-0">
            <button
              type="button"
              onClick={() => onCoach(row)}
              data-testid="team-plans-drawer-coach"
              className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <MessageSquare size={14} aria-hidden="true" /> Coach
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Read-only plan-health checklist (Year Plan tab). Exactly three checks per
// the locked design; check 3 renders ONLY when the worksheet is shared —
// otherwise silently omitted (not an "unknown" alarm). "Renewals realistic"
// is dropped (no data source).
function PlanHealth({ lines, floor, shared, firstYearCommissionsRequired }) {
  const floorCheck = checkAboveFloor(lines, floor);
  const mixCheck = checkLineMix(lines);
  const commitCheck = shared ? checkNotOverCommitted(lines, firstYearCommissionsRequired) : null;

  return (
    <div className="rounded-xl border border-border bg-card-raised p-4" data-testid="tpd-plan-health">
      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">Plan health</p>
      <HealthRow
        ok={floorCheck.ok}
        label="Above company floor"
        note={floorCheck.ok ? formatCurrency(floorCheck.floor) : `floor ${formatCurrency(floorCheck.floor)}`}
        testId="tpd-health-floor"
      />
      <HealthRow
        ok={mixCheck.ok}
        label="Line mix"
        note={mixCheck.ok ? undefined : mixCheck.note}
        testId="tpd-health-mix"
      />
      {commitCheck && (
        <HealthRow
          ok={commitCheck.ok}
          label="Not over-committed"
          note={commitCheck.ok ? undefined : `plan short ${formatCurrency(commitCheck.required - commitCheck.planCommission)}`}
          testId="tpd-health-commit"
        />
      )}
      <p className="mt-2 text-[11px] text-ink-muted">
        Read-only signals from the plan and the company floor — coach on them, the agent commits the plan themselves.
      </p>
    </div>
  );
}
