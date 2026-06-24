import React, { useState } from 'react';
import useFocusTrap from '../../../hooks/useFocusTrap';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { commitPlan } from '../../../services/commitPlanService';
import { setGoals } from '../../../services/goalsService';
import { deriveAnnualApps } from '../../../lib/deriveApps';
import { formatCurrency } from '../../../utils/formatters';

const LINE_META = [
  { key: 'life',    label: 'Life'    },
  { key: 'ah',      label: 'A&H'     },
  { key: 'general', label: 'General' },
];

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function tsToDate(ts) {
  if (!ts) return new Date();
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function trinidadDate(d) {
  return new Intl.DateTimeFormat('en-TT', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(tsToDate(d));
}

// ── Modal shell (matches YearPlanModal / MonthlyPlanModal chrome) ─────────────

function ModalShell({ title, subtitle, onClose, children, footer, saving = false }) {
  const modalRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={modalRef} className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
              Step 3 — Review &amp; Commit
            </p>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink mt-0.5">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── GoalsCascade — explanatory 5-layer visual (no async data needed) ──────────

function GoalsCascade({ plannedAPI }) {
  const tiers = [
    { label: 'Company Floor',        note: 'Set by Tatil Life',             highlight: false },
    { label: 'Sales Manager Target', note: 'Set by your sales manager',     highlight: false },
    { label: 'Branch Target',        note: 'Set by your branch manager',    highlight: false },
    { label: 'Unit Target',          note: 'Set by your unit manager',      highlight: false },
    {
      label: 'Personal Commitment',
      note: plannedAPI ? formatCurrency(plannedAPI) : '—',
      highlight: true,
    },
  ];

  return (
    <div className="space-y-1.5" aria-label="5-layer goal hierarchy">
      {tiers.map((tier, i) => (
        <div
          key={tier.label}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
            tier.highlight
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-card'
          }`}
          style={{ marginLeft: `${i * 10}px` }}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink">{tier.label}</span>
            <span
              className={`block text-[10px] ${
                tier.highlight ? 'text-primary font-bold' : 'text-ink-muted'
              }`}
            >
              {tier.note}
            </span>
          </span>
          {tier.highlight && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary/80">
              YOU
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── View: PlanReview ──────────────────────────────────────────────────────────

function PlanReview({
  yearPlan, monthlyPlan,
  yearPlanFilled, monthlyPlanFilled,
  yearPlanTotalAPI, avgPolicyAPI,
  onOpenMoneyNeeds, onOpenMonthlyPlan,
}) {
  const appsDerived =
    yearPlanFilled && avgPolicyAPI
      ? deriveAnnualApps(yearPlanTotalAPI, avgPolicyAPI)
      : null;

  const planComplete = yearPlanFilled && monthlyPlanFilled;

  return (
    <div className="space-y-4">
      {/* Annual hero */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">
          Annual API target
        </p>
        <p
          className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink"
          data-testid="review-api"
        >
          {yearPlanFilled ? formatCurrency(yearPlanTotalAPI) : '—'}
        </p>
        {appsDerived !== null && (
          <p className="mt-0.5 text-xs text-ink-muted">
            {appsDerived.toFixed(1)} apps · avg{' '}
            {formatCurrency(avgPolicyAPI)} per policy
          </p>
        )}
        {yearPlanFilled && appsDerived === null && (
          <p className="mt-0.5 text-xs text-ink-muted">
            Average policy size not set — you&apos;ll be prompted before committing
          </p>
        )}
      </div>

      {/* Year plan incomplete */}
      {!yearPlanFilled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Plan not allocated yet
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
            Allocate your Money Needs before committing.
          </p>
          {onOpenMoneyNeeds && (
            <button
              type="button"
              onClick={onOpenMoneyNeeds}
              className="mt-1.5 text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              Go to Year Plan →
            </button>
          )}
        </div>
      )}

      {/* Year plan lines */}
      {yearPlanFilled && (
        <div>
          <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">
            By line
          </p>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {LINE_META.map(({ key, label }) => {
              const line = yearPlan?.lines?.[key];
              if (!line || line.enabled === false) return null;
              return (
                <div key={key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-ink-muted">{label}</span>
                  <span className="font-semibold text-ink">
                    {formatCurrency(line.targetAPI ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly plan */}
      {monthlyPlanFilled && monthlyPlan?.targets && (
        <div>
          <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">
            Monthly shape
          </p>
          <div className="grid grid-cols-6 gap-1">
            {monthlyPlan.targets.slice(0, 12).map((v, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card px-2 py-2 text-center"
              >
                <p className="font-mono text-[9px] text-ink-muted">{MONTH_LABELS[i]}</p>
                <p className="mt-0.5 text-[10px] font-bold text-ink">
                  {Math.round(parseFloat(v) || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly plan incomplete */}
      {yearPlanFilled && !monthlyPlanFilled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Monthly Plan not drafted
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
            Complete Step 2 to break your plan into months.
          </p>
          {onOpenMonthlyPlan && (
            <button
              type="button"
              onClick={onOpenMonthlyPlan}
              className="mt-1.5 text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              Go to Monthly Plan →
            </button>
          )}
        </div>
      )}

      {planComplete && (
        <p className="text-xs text-ink-muted">
          All steps drafted. Review the plan above, then continue to commit it.
        </p>
      )}
    </div>
  );
}

// ── View: CommitConsequence ───────────────────────────────────────────────────

function CommitConsequence({ year, yearPlanTotalAPI }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink">
        Committing sets your{' '}
        <span className="font-bold">Personal Commitment</span> for {year} to{' '}
        <span className="font-bold text-primary">{formatCurrency(yearPlanTotalAPI)}</span> — the one layer of the 5-layer goal hierarchy only you write.
      </p>
      <p className="text-sm leading-relaxed text-ink-muted">
        No manager approval needed. Your managers can see your commitment once it&apos;s
        set, but only you can change it.
      </p>
      <div>
        <p className="mb-2.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">
          Goal Hierarchy
        </p>
        <GoalsCascade plannedAPI={yearPlanTotalAPI} />
      </div>
    </div>
  );
}

// ── View: CommitConfirm ───────────────────────────────────────────────────────

function CommitConfirm({
  year, yearPlanTotalAPI, isRecommit, prevAPI,
  committing, errorKind, errorData,
  avgInput, setAvgInput, avgSaving, avgError,
  onSaveAvgAndRecommit,
  onOpenMoneyNeeds,
}) {
  return (
    <div className="space-y-5">
      {/* Recap */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">
          {isRecommit ? 'Updating commitment' : 'Committing'}
        </p>
        <p
          className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink"
          data-testid="confirm-api"
        >
          {formatCurrency(yearPlanTotalAPI)}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Your {year} Personal Commitment
          {isRecommit && prevAPI
            ? ` · replaces ${formatCurrency(prevAPI)}`
            : ''}
        </p>
      </div>

      {/* Error states */}
      {errorKind === 'below-api' && errorData && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950/20">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">
              Plan is below your API floor
            </p>
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              Your plan ({formatCurrency(errorData.planTotal)}) is below your floor
              ({formatCurrency(errorData.floor)}). Raise it in Money Needs.
            </p>
            {onOpenMoneyNeeds && (
              <button
                type="button"
                onClick={onOpenMoneyNeeds}
                className="mt-1.5 text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                Go to Money Needs →
              </button>
            )}
          </div>
        </div>
      )}

      {errorKind === 'below-apps' && errorData && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950/20">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">
              Plan is below the apps floor
            </p>
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              Your plan works out to {errorData.actual?.toFixed(1)} apps, below the minimum
              of {errorData.floor}. Plan more or smaller policies, or raise your API in Money Needs.
            </p>
            {onOpenMoneyNeeds && (
              <button
                type="button"
                onClick={onOpenMoneyNeeds}
                className="mt-1.5 text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                Go to Money Needs →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inline avg-policy capture */}
      {errorKind === 'avg-missing' && (
        <div
          className="rounded-xl border border-border bg-card px-4 py-4 space-y-3"
          data-testid="avg-capture"
        >
          <div>
            <p className="text-xs font-semibold text-ink">
              Your average policy size is needed to check the apps floor
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Set it once here — we&apos;ll save it to your Playground assumptions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="avg-policy-input" className="shrink-0 text-xs text-ink-muted">
              Avg policy (TTD)
            </label>
            <input
              id="avg-policy-input"
              type="number"
              min="1"
              step="1000"
              value={avgInput}
              onChange={(e) => setAvgInput(e.target.value)}
              placeholder="e.g. 10 000"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="avg-policy-input"
            />
          </div>
          {avgError && (
            <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
              {avgError}
            </p>
          )}
          <button
            type="button"
            onClick={onSaveAvgAndRecommit}
            disabled={avgSaving || committing}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-primary dark:bg-primary-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-primary/90 dark:hover:bg-primary-dark/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid="save-avg-btn"
          >
            {(avgSaving || committing) && (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            )}
            Save &amp; check floor
          </button>
        </div>
      )}

      {errorKind === 'failed' && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950/20">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">
              Something went wrong
            </p>
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              The transaction rolled back — nothing was changed. Try again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── View: CommittedDone ───────────────────────────────────────────────────────

function CommittedDone({ year, committedResult, onReopen }) {
  const dateStr = committedResult?.date
    ? trinidadDate(committedResult.date)
    : trinidadDate(new Date());

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 py-8 text-center"
      data-testid="committed-done"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Check size={28} className="text-primary" strokeWidth={3} aria-hidden="true" />
      </div>
      <div>
        <p
          className="font-display text-2xl font-extrabold tracking-tight text-ink"
          data-testid="done-api"
        >
          Committed {formatCurrency(committedResult?.api ?? 0)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{dateStr}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1">
          <span className="font-mono text-xs font-bold text-primary">3 / 3</span>
          <span className="text-[10px] text-ink-muted">steps built · 100%</span>
        </div>
      </div>
      <p className="max-w-xs text-xs text-ink-muted">
        Your {year} plan is committed. Managers can see your target — only you can change it.
      </p>
      <button
        type="button"
        onClick={onReopen}
        className="text-xs font-semibold text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
        data-testid="reopen-btn"
      >
        Change your mind? Re-open your plan
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewCommitModal({
  onClose,
  year,
  yearPlan,
  monthlyPlan,
  yearPlanFilled,
  monthlyPlanFilled,
  yearPlanTotalAPI,
  avgPolicyAPI,
  committedAnnualAPI,
  onAfterCommit,
  onOpenMoneyNeeds,
  onOpenMonthlyPlan,
}) {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;
  const displayName = user?.displayName ?? '';

  const alreadyCommitted = yearPlan?.status === 'committed';
  const initResult = alreadyCommitted
    ? { api: committedAnnualAPI ?? yearPlanTotalAPI, date: tsToDate(yearPlan.committedAt) }
    : null;

  const [view, setView] = useState(alreadyCommitted ? 'done' : 'review');
  const [committing, setCommitting] = useState(false);
  const [errorKind, setErrorKind] = useState(null);
  const [errorData, setErrorData] = useState(null);
  const [localAvgPolicyAPI, setLocalAvgPolicyAPI] = useState(avgPolicyAPI);
  const [avgInput, setAvgInput] = useState('');
  const [avgSaving, setAvgSaving] = useState(false);
  const [avgError, setAvgError] = useState('');
  const [committedResult, setCommittedResult] = useState(initResult);

  const planComplete = yearPlanFilled && monthlyPlanFilled;

  const handleCommit = async () => {
    if (committing) return;
    setCommitting(true);
    setErrorKind(null);
    setErrorData(null);
    try {
      const apps = deriveAnnualApps(yearPlanTotalAPI, localAvgPolicyAPI ?? 0);
      await commitPlan(tenantId, uid, year, { annualAPI: yearPlanTotalAPI, annualApps: apps });
      setCommittedResult({ api: yearPlanTotalAPI, date: new Date() });
      setView('done');
      onAfterCommit?.();
    } catch (err) {
      if (err.name === 'BelowApiFloorError') {
        setErrorKind('below-api'); setErrorData(err);
      } else if (err.name === 'AvgPolicyMissingError') {
        setErrorKind('avg-missing');
      } else if (err.name === 'BelowAppsFloorError') {
        setErrorKind('below-apps'); setErrorData(err);
      } else {
        setErrorKind('failed');
      }
    } finally {
      setCommitting(false);
    }
  };

  const handleSaveAvgAndRecommit = async () => {
    const val = parseFloat(avgInput);
    if (!val || val <= 0) { setAvgError('Enter a positive amount'); return; }

    setAvgSaving(true);
    setAvgError('');
    let savedOk = false;
    try {
      await setGoals(tenantId, uid, { playgroundAvgPolicyAPI: val }, uid, displayName);
      setLocalAvgPolicyAPI(val);
      setErrorKind(null);
      savedOk = true;
    } catch (err) {
      setAvgError(err.message || 'Failed to save — try again');
    } finally {
      setAvgSaving(false);
    }

    if (!savedOk) return;

    setCommitting(true);
    try {
      const apps = deriveAnnualApps(yearPlanTotalAPI, val);
      await commitPlan(tenantId, uid, year, { annualAPI: yearPlanTotalAPI, annualApps: apps });
      setCommittedResult({ api: yearPlanTotalAPI, date: new Date() });
      setView('done');
      onAfterCommit?.();
    } catch (err) {
      if (err.name === 'BelowAppsFloorError') {
        setErrorKind('below-apps'); setErrorData(err);
      } else if (err.name === 'BelowApiFloorError') {
        setErrorKind('below-api'); setErrorData(err);
      } else {
        setErrorKind('failed');
      }
    } finally {
      setCommitting(false);
    }
  };

  // ── View: review ─────────────────────────────────────────────────────────────

  if (view === 'review') {
    return (
      <ModalShell
        title="Review your plan"
        subtitle="Check every step before you commit."
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline transition-colors"
            >
              Not yet
            </button>
            {planComplete && (
              <button
                type="button"
                onClick={() => setView('consequence')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary dark:bg-primary-dark px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="review-continue-btn"
              >
                Continue →
              </button>
            )}
          </>
        }
      >
        <PlanReview
          yearPlan={yearPlan}
          monthlyPlan={monthlyPlan}
          yearPlanFilled={yearPlanFilled}
          monthlyPlanFilled={monthlyPlanFilled}
          yearPlanTotalAPI={yearPlanTotalAPI}
          avgPolicyAPI={localAvgPolicyAPI}
          onOpenMoneyNeeds={onOpenMoneyNeeds}
          onOpenMonthlyPlan={onOpenMonthlyPlan}
        />
      </ModalShell>
    );
  }

  // ── View: consequence ─────────────────────────────────────────────────────────

  if (view === 'consequence') {
    return (
      <ModalShell
        title="What committing means"
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              onClick={() => setView('review')}
              className="text-sm font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setView('confirm')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary dark:bg-primary-dark px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid="consequence-continue-btn"
            >
              Continue →
            </button>
          </>
        }
      >
        <CommitConsequence year={year} yearPlanTotalAPI={yearPlanTotalAPI} />
      </ModalShell>
    );
  }

  // ── View: confirm ─────────────────────────────────────────────────────────────

  if (view === 'confirm') {
    const isRecommit = alreadyCommitted || !!initResult;
    const prevAPI = committedAnnualAPI && committedAnnualAPI !== yearPlanTotalAPI
      ? committedAnnualAPI
      : null;

    return (
      <ModalShell
        title="Confirm commitment"
        subtitle="This is the deliberate moment — no taking it back without re-opening."
        onClose={onClose}
        saving={committing || avgSaving}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setErrorKind(null);
                setErrorData(null);
                // Re-commit re-opens from done; first commit goes back to consequence
                setView(isRecommit ? 'done' : 'consequence');
              }}
              className="text-sm font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline transition-colors"
            >
              Not yet
            </button>
            {errorKind !== 'avg-missing' && (
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary dark:bg-primary-dark px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:hover:bg-primary-dark/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="commit-btn"
              >
                {committing && (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                )}
                {isRecommit ? 'Yes, update my plan' : 'Yes, commit my plan'}
              </button>
            )}
          </>
        }
      >
        <CommitConfirm
          year={year}
          yearPlanTotalAPI={yearPlanTotalAPI}
          isRecommit={isRecommit}
          prevAPI={prevAPI}
          committing={committing}
          errorKind={errorKind}
          errorData={errorData}
          avgInput={avgInput}
          setAvgInput={setAvgInput}
          avgSaving={avgSaving}
          avgError={avgError}
          onSaveAvgAndRecommit={handleSaveAvgAndRecommit}
          onOpenMoneyNeeds={onOpenMoneyNeeds}
        />
      </ModalShell>
    );
  }

  // ── View: done ────────────────────────────────────────────────────────────────

  return (
    <ModalShell
      title="Plan committed"
      onClose={onClose}
      footer={
        <>
          <span />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary dark:bg-primary-dark px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Done
          </button>
        </>
      }
    >
      <CommittedDone
        year={year}
        committedResult={committedResult}
        onReopen={() => {
          setErrorKind(null);
          setErrorData(null);
          setView('confirm');
        }}
      />
    </ModalShell>
  );
}
