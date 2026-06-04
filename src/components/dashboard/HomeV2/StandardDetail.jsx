import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { X, ArrowRight } from 'lucide-react';
import {
  WEEKLY_ACTIVITY_FLOOR_ROWS,
  DEFAULT_WEEKLY_ACTIVITY_FLOORS,
  deriveWeeklyFloorActuals,
} from '../../../utils/weeklyActivityFloors';
import { extractFields } from '../../../utils/extractFields';
import { buildPaceRows, PLAN_METRIC_KEYS, SOURCE_CHIP } from '../../../utils/planVariance';
import { statusToken } from '../../../lib/policyStatusTokens';
import { getTodayTT } from '../../../utils/dateInputs';
import StandardRow from './StandardRow';

/**
 * StandardDetail — slide-in drawer body for the "Standard" Pulse chip.
 *
 * Three honest states (brief D4):
 *   1. Plan committed — the 5 plan-metric rows show the mini pace-track grammar
 *      (floor tick + plan cap + variance fill + optional pace marker); all other
 *      rows remain unchanged floor-only Expected-vs-Actual.
 *   2. No plan committed — today's floor-only presentation verbatim + a quiet
 *      "Commit a plan in Game Plan →" nudge.
 *   3. Final (submitted week) — same as committed but from the submission; no
 *      live pace marker; calls resolves to the 5-sum.
 *
 * Semantics (D2/D3) come from planVariance.js AS-IS — no fork. D5: no
 * text-ink-faint on any text element.
 */

const PLAN_METRIC_KEY_SET = new Set(PLAN_METRIC_KEYS);

// ─── Variance colours (matches S3a SuggestedWeekCard) ────────────────────────
const VARIANCE_FILL = {
  ahead:      'bg-success',
  'on-track': 'bg-success opacity-60',
  behind:     'bg-warning',
};
const VARIANCE_TEXT = {
  ahead:      'text-success',
  'on-track': 'text-success',
  behind:     'text-warning',
};

// ─── Compact plan-metric mini-track row ──────────────────────────────────────
function PlanMetricRow({ row }) {
  const {
    key, label, plan, actual, fillPct, floorPct, pacePct,
    showPace, variance, noDailySource,
  } = row;

  return (
    <li
      className="py-2.5 border-b border-border/40 last:border-b-0 min-h-[44px] flex flex-col justify-center"
      data-testid={`drawer-plan-row-${key}`}
    >
      {/* label + readout */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink">{label}</span>
        {noDailySource ? (
          <span className="font-mono text-[9px] text-ink-muted" data-testid={`drawer-nodaily-${key}`}>
            weekly only
          </span>
        ) : (
          <span className="font-mono text-[11px]" data-testid={`drawer-actual-${key}`}>
            <span className={variance ? VARIANCE_TEXT[variance] : 'text-ink'}>
              {actual ?? '—'}
            </span>
            <span className="text-ink-muted"> / {plan}</span>
          </span>
        )}
      </div>

      {/* mini track (9px) */}
      <div
        className="mt-1.5 relative h-2 rounded-full bg-surface-muted overflow-visible"
        aria-hidden="true"
      >
        {noDailySource ? (
          <div className="absolute inset-0 rounded-full bg-[repeating-linear-gradient(90deg,var(--color-surface-muted),var(--color-surface-muted)_6px,var(--color-border)_6px,var(--color-border)_8px)]" />
        ) : (
          <>
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${VARIANCE_FILL[variance] ?? ''}`}
              style={{ width: `${fillPct}%` }}
            />
            {showPace && (
              <div
                className="absolute top-1/2 -translate-y-1/2 text-ink text-[7px] leading-none"
                style={{ left: `${pacePct}%`, transform: 'translateX(-50%) translateY(-50%)' }}
              >
                ▾
              </div>
            )}
          </>
        )}
        {/* floor tick (neutral baseline) */}
        <div
          className="absolute -top-px -bottom-px w-px bg-ink-muted"
          style={{ left: `${floorPct}%` }}
        />
        {/* plan cap (target — right edge of scale) */}
        <div className="absolute -top-px -bottom-px right-0 w-px bg-primary" />
      </div>
    </li>
  );
}

// ─── Main drawer ─────────────────────────────────────────────────────────────
export default function StandardDetail({
  minimums,
  currentWeekSub,
  committedPlan,
  dailyDocs,
  weekStart,
  onClose,
  onSubmit,
  onOpenGamePlan,
}) {
  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const floors = useMemo(
    () => ({ ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, ...(minimums?.weeklyActivityFloors ?? {}) }),
    [minimums?.weeklyActivityFloors],
  );

  // Floor actuals (for non-plan rows and the no-plan state).
  const actuals = useMemo(
    () => deriveWeeklyFloorActuals(currentWeekSub ? extractFields(currentWeekSub) : null),
    [currentWeekSub],
  );

  // Whether a submitted weekly report exists for the plan's week (final source).
  const weekSubmission = currentWeekSub?.status === 'submitted' ? currentWeekSub : null;

  // buildPaceRows drives all plan-metric rows; null when no plan committed.
  const paceResult = useMemo(() => {
    if (!committedPlan?.targets) return null;
    return buildPaceRows({
      committedPlan,
      weekSubmission,
      dailyDocs: dailyDocs ?? [],
      floors,
      weekStart,
      todayTT: getTodayTT(),
    });
  }, [committedPlan, weekSubmission, dailyDocs, floors, weekStart]);

  // Quick lookup: key → pace row object.
  const paceRowMap = useMemo(
    () => (paceResult ? Object.fromEntries(paceResult.rows.map((r) => [r.key, r])) : {}),
    [paceResult],
  );

  const hasPlan = !!committedPlan?.targets;
  const planLoading = committedPlan === undefined; // undefined = still fetching
  const sourceChip = paceResult ? statusToken(SOURCE_CHIP[paceResult.source].role) : null;

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        style={{ backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Weekly Standard — Expected vs Actual"
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-card"
        style={{
          width: '100%',
          maxWidth: 480,
          borderLeft: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border border-border text-sm font-bold text-ink bg-surface hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={13} aria-hidden="true" /> Close
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <p className="text-xs font-bold tracking-widest uppercase text-warning font-mono">
            Week in progress
          </p>
          <h2
            className="text-ink mt-1.5"
            style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em',
              fontFamily: '"Cabinet Grotesk", system-ui, sans-serif',
            }}
          >
            Weekly Standard
          </h2>
          {/* Source chip (committed state only) */}
          {paceResult && (
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${sourceChip.tint} ${sourceChip.text}`}
              data-testid="standard-drawer-source-chip"
            >
              {paceResult.source === 'final' ? '✓' : '◷'} {SOURCE_CHIP[paceResult.source].label}
            </span>
          )}
          {!hasPlan && !planLoading && (
            <p className="text-xs text-ink-muted mt-1.5">
              Expected vs Actual — the 10 floors that define a complete week.
            </p>
          )}
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4" data-testid="standard-drawer-rows">
          {planLoading ? (
            // Skeleton while plan fetch is in-flight
            <ul className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="h-10 rounded-lg bg-surface-muted animate-pulse" />
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col" data-testid="standard-drawer-list">
              {WEEKLY_ACTIVITY_FLOOR_ROWS.map((row) => {
                if (hasPlan && PLAN_METRIC_KEY_SET.has(row.key)) {
                  const paceRow = paceRowMap[row.key];
                  if (!paceRow) return null;
                  return <PlanMetricRow key={row.key} row={paceRow} />;
                }
                return (
                  <StandardRow
                    key={row.key}
                    row={row}
                    expected={floors[row.key] ?? 0}
                    actual={actuals[row.key] ?? 0}
                  />
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-muted flex items-center justify-between gap-3 shrink-0">
          {hasPlan ? (
            <p className="text-xs text-ink-muted leading-snug">
              Submit this week to close any gaps.
            </p>
          ) : (
            <p className="text-xs text-ink-muted leading-snug">
              Showing the company floor.{' '}
              {onOpenGamePlan && (
                <button
                  type="button"
                  onClick={onOpenGamePlan}
                  className="inline-flex items-center gap-1 text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  data-testid="standard-drawer-game-plan-nudge"
                >
                  Commit a plan in Game Plan <ArrowRight size={11} aria-hidden="true" />
                </button>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-bold hover:bg-primary-dark dark:hover:bg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Open weekly report
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
