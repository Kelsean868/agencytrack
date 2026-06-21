import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, RotateCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getMonthlyPlan, createMonthlyPlan, saveMonthlyPlan,
} from '../../services/monthlyPlanService';
import {
  balanceDelta, autoDistributeRemainder, seedEvenSplit,
  monthEditable, bucketActualsByMonth, monthlyPace, ytdDelta, recoveryPace, absorbShortfall,
} from '../../lib/monthlyPlanMath';
import { getTodayTT } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';
import MonthChart from './MonthChart';
import MonthTargetField from './MonthTargetField';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * MonthlyPlanModal — Game Plan Step 3 (Slice 2).
 *
 * Props:
 *   onClose       — close handler
 *   yearPlanAPI   — computed annual anchor from the loaded yearPlan (hub: yearPlanTotalAPI)
 *   submissions   — agent's submissions (hub-loaded, reused for actuals bucketing)
 *   year          — current plan year
 */
export default function MonthlyPlanModal({ onClose, onAfterSave, yearPlanAPI = 0, submissions = [], year, avgPolicyAPI = null }) {
  const { tenantId, user } = useAuth();
  const uid = user?.uid;

  const panelRef = useRef(null);
  const [phase, setPhase] = useState('loading'); // loading | no-yearPlan | allocating
  const [loadError, setLoadError] = useState('');
  const [targets, setTargets] = useState(null);
  const [split, setSplit] = useState('even');
  const [staleAnchor, setStaleAnchor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const todayTT = getTodayTT();
  const currentMonthIndex = parseInt(todayTT.split('-')[1], 10) - 1;
  const actuals = bucketActualsByMonth(submissions, year);
  // 3.8 — targets can be set before any production exists. Surface an honest
  // "actuals will fill in" state rather than a chart of silent zeros.
  const hasActuals = actuals.some((a) => (parseFloat(a) || 0) > 0);

  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    if (!yearPlanAPI) {
      setPhase('no-yearPlan');
      return;
    }
    setPhase('loading');
    setLoadError('');
    try {
      let plan = await getMonthlyPlan(tenantId, uid, year);
      if (!plan) {
        plan = await createMonthlyPlan(tenantId, uid, year, yearPlanAPI);
      }
      setTargets([...plan.targets]);
      setSplit(plan.split ?? 'even');
      setStaleAnchor(
        plan.anchorAPI > 0 && yearPlanAPI > 0 && plan.anchorAPI !== yearPlanAPI,
      );
      setPhase('allocating');
    } catch {
      setLoadError('Could not load your monthly plan. Check your connection and try again.');
    }
  }, [tenantId, uid, year, yearPlanAPI]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const delta = targets ? balanceDelta(targets, yearPlanAPI) : 0;
  const canSave = phase === 'allocating' && targets !== null && delta === 0 && !saving;

  // Compute whether we're behind on settled months (for Absorb button enable state)
  let isBehindOnSettled = false;
  if (targets && currentMonthIndex > 0) {
    let settledActuals = 0;
    let settledTargets = 0;
    for (let i = 0; i < currentMonthIndex; i++) {
      settledActuals += parseFloat(actuals[i]) || 0;
      settledTargets += parseFloat(targets[i]) || 0;
    }
    isBehindOnSettled = settledActuals < settledTargets - 0.01; // epsilon for float comparison
  }
  const canAbsorb = phase === 'allocating' && targets !== null && isBehindOnSettled;

  const handleFieldChange = useCallback((i, val) => {
    setTargets((prev) => { const next = [...prev]; next[i] = val; return next; });
    setSplit('custom');
    setSaveError('');
  }, []);

  const handleAutoDistribute = useCallback(() => {
    if (!targets) return;
    setTargets(autoDistributeRemainder(targets, yearPlanAPI, currentMonthIndex));
    setSaveError('');
  }, [targets, yearPlanAPI, currentMonthIndex]);

  const handleResetEven = useCallback(() => {
    setTargets(seedEvenSplit(yearPlanAPI));
    setSplit('even');
    setSaveError('');
  }, [yearPlanAPI]);

  const handleAbsorbShortfall = useCallback(() => {
    if (!targets) return;
    setTargets(absorbShortfall(targets, yearPlanAPI, actuals, currentMonthIndex));
    setSaveError('');
  }, [targets, yearPlanAPI, actuals, currentMonthIndex]);

  const handleResyncAnchor = useCallback(() => {
    setTargets(seedEvenSplit(yearPlanAPI));
    setSplit('even');
    setStaleAnchor(false);
    setSaveError('');
  }, [yearPlanAPI]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError('');
    try {
      await saveMonthlyPlan(tenantId, uid, year, targets, split);
      onClose();
      onAfterSave?.();
    } catch {
      setSaveError('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }, [canSave, tenantId, uid, year, targets, split, onClose, onAfterSave]);

  const currentPace = phase === 'allocating' && targets
    ? monthlyPace(targets[currentMonthIndex], year, currentMonthIndex, actuals[currentMonthIndex], todayTT, avgPolicyAPI ?? undefined)
    : null;
  const ytd = phase === 'allocating' && targets
    ? ytdDelta(actuals, targets, currentMonthIndex)
    : 0;
  const recovery = phase === 'allocating' && targets
    ? recoveryPace(yearPlanAPI, actuals, currentMonthIndex)
    : null;

  const deltaAbs = Math.abs(delta);
  const balanceLabel =
    delta === 0
      ? `= ${formatCurrency(yearPlanAPI)} ✓`
      : delta > 0
      ? `${formatCurrency(deltaAbs)} over — place elsewhere`
      : `${formatCurrency(deltaAbs)} remaining to place`;
  const balanceClass =
    delta === 0
      ? 'text-primary dark:text-primary-dark'
      : 'text-danger-ink';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Monthly Plan ${year}`}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface-raised shadow-xl outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 pb-4 pt-5">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              Step 3
            </p>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
              Monthly Plan {year}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close monthly plan"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">

          {/* Loading */}
          {phase === 'loading' && !loadError && (
            <div className="flex items-center justify-center gap-2 py-16 text-ink-muted">
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <span className="text-sm">Loading your plan…</span>
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-10 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/10 text-danger-ink">
                <AlertCircle size={22} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-ink">Couldn&apos;t load</p>
                <p className="mt-0.5 text-sm text-ink-muted">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={load}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 dark:bg-primary-dark dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCw size={15} aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          {/* No Year Plan */}
          {phase === 'no-yearPlan' && (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-4 py-12 text-center"
              data-testid="no-yearplan-state"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-muted">
                <span className="font-display text-xl font-extrabold text-ink-muted">3</span>
              </div>
              <div>
                <p className="font-semibold text-ink">Nothing to split yet — do your Year Plan first</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Complete Step 2 to set your annual API target, then return here to split it across months.
                </p>
              </div>
            </div>
          )}

          {/* Allocating */}
          {phase === 'allocating' && targets && (
            <>
              {/* Anchor strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-xs text-ink-muted">Annual target</p>
                  <p className="font-display text-lg font-extrabold text-ink">
                    {formatCurrency(yearPlanAPI)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-muted">Per month avg</p>
                  <p className="font-display text-lg font-extrabold text-ink">
                    {formatCurrency(Math.round(yearPlanAPI / 12))}
                  </p>
                </div>
              </div>

              {/* Stale anchor banner */}
              {staleAnchor && (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 dark:bg-amber-900/20"
                  data-testid="stale-anchor-banner"
                >
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Your annual target changed — reset to the new {formatCurrency(yearPlanAPI)}?
                  </p>
                  <button
                    type="button"
                    onClick={handleResyncAnchor}
                    className="shrink-0 text-sm font-semibold text-amber-700 hover:underline dark:text-amber-400 focus-visible:outline-none"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Chart */}
              <MonthChart
                targets={targets}
                actuals={actuals}
                year={year}
                currentMonthIndex={currentMonthIndex}
                todayTT={todayTT}
              />

              {/* Honest-empty actuals (3.8) — targets set, no production yet */}
              {!hasActuals && (
                <div
                  className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-center"
                  data-testid="no-actuals-state"
                >
                  <p className="text-sm font-semibold text-ink">Targets set — actuals will fill in</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    Your monthly bars fill in as you submit weekly reports.
                  </p>
                </div>
              )}

              {/* Readouts row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {/* To-finish */}
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    {MONTH_NAMES[currentMonthIndex]} — to finish
                  </p>
                  {currentPace ? (
                    <>
                      <p className="mt-1 font-display text-base font-extrabold text-ink">
                        {formatCurrency(currentPace.toFinishAPI)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {currentPace.toFinishApps > 0
                          ? `≈ ${currentPace.toFinishApps.toFixed(1)} apps`
                          : 'Target reached'}
                        {' · '}
                        <span
                          className={
                            currentPace.state === 'ahead'
                              ? 'font-semibold text-amber-600 dark:text-amber-400'
                              : currentPace.state === 'on-track'
                              ? 'font-semibold text-primary dark:text-primary-dark'
                              : 'font-semibold text-danger-ink'
                          }
                        >
                          {currentPace.state === 'ahead'
                            ? 'Ahead'
                            : currentPace.state === 'on-track'
                            ? 'On track'
                            : 'Behind'}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-ink-muted">Set in your plan</p>
                  )}
                </div>

                {/* YTD delta */}
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    YTD vs pace
                  </p>
                  <p
                    className={`mt-1 font-display text-base font-extrabold ${
                      ytd >= 0
                        ? 'text-primary dark:text-primary-dark'
                        : 'text-danger-ink'
                    }`}
                  >
                    {ytd >= 0 ? '+' : ''}{formatCurrency(ytd)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {currentMonthIndex > 0
                      ? `Over ${currentMonthIndex} completed month${currentMonthIndex === 1 ? '' : 's'}`
                      : 'No completed months yet'}
                  </p>
                </div>

                {/* Recovery pace */}
                {recovery && (
                  <div
                    className={`rounded-xl border px-4 py-3 ${
                      recovery.isStretch
                        ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-border bg-card'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      Recovery pace
                    </p>
                    <p
                      className={`mt-1 font-display text-base font-extrabold ${
                        recovery.isStretch
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-ink'
                      }`}
                    >
                      {formatCurrency(recovery.pacePerMonth)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {recovery.remainingCount > 0
                        ? `Needed across ${recovery.remainingCount} remaining month${recovery.remainingCount === 1 ? '' : 's'}`
                        : 'No months remaining'}
                    </p>
                    {recovery.isStretch && (
                      <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        This is a stretch — consider resetting your annual.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Month target grid */}
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-muted">Monthly targets</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {targets.map((t, i) => (
                    <MonthTargetField
                      key={i}
                      monthIndex={i}
                      target={t}
                      actual={actuals[i]}
                      editable={monthEditable(i, currentMonthIndex)}
                      onChange={(val) => handleFieldChange(i, val)}
                    />
                  ))}
                </div>
              </div>

              {/* Balance pill + assists */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <p
                  className={`text-sm font-semibold ${balanceClass}`}
                  data-testid="balance-pill"
                >
                  {balanceLabel}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAutoDistribute}
                    disabled={delta === 0}
                    title={delta === 0
                      ? 'Already balanced — nothing to distribute.'
                      : 'Splits the remaining annual evenly across the months still at 0. Months you have already filled are left as-is.'}
                    aria-disabled={delta === 0}
                    data-testid="auto-distribute-btn"
                    className="min-h-[36px] rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Fill empty months
                  </button>
                  <button
                    type="button"
                    onClick={handleAbsorbShortfall}
                    disabled={!canAbsorb}
                    title={
                      !canAbsorb
                        ? currentMonthIndex === 0
                          ? 'No settled months yet.'
                          : "You're on or ahead of pace — nothing to absorb."
                        : undefined
                    }
                    aria-disabled={!canAbsorb}
                    className="min-h-[36px] rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Absorb shortfall
                  </button>
                  <button
                    type="button"
                    onClick={handleResetEven}
                    className="min-h-[36px] rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Reset to even
                  </button>
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-danger-ink" role="alert">{saveError}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {phase === 'allocating' && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-primary-dark dark:hover:bg-primary-dark/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Save draft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
