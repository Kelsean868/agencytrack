import React, { useEffect, useMemo, useState } from 'react';
import { Clock, AlertCircle, RotateCw, ChevronDown, ArrowRight, Minus, Plus, Loader2, Pencil } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { statusToken } from '../../../lib/policyStatusTokens';
import {
  decomposeFromAPI,
  deriveRatiosFromHistory,
  roundToWhole,
  WEEKLY_DIVISOR,
  DEFAULT_DECOMPOSITION_INPUTS,
} from '../../../utils/goalDecomposition';
import { assembleSuggestion, stepTarget } from '../../../utils/weeklyPlanAssembly';
import { buildPaceRows, PACE_WORKING_DAYS } from '../../../utils/planVariance';
import { getTodayTT } from '../../../utils/dateInputs';

/**
 * SuggestedWeekCard — Game Plan v2 Weekly Planner.
 *
 * Slice 1 (read-only): composes the goal-decomposition engine over the agent's
 * committed API anchor + history-derived ratios to show a suggested week. Never
 * recomputes the chain.
 *
 * Slice 2 (this change): the suggestion becomes a committable plan. When planning
 * is enabled (an `onCommit` handler is supplied and the resolution is derived or
 * floor — never no-anchor), the card gains:
 *   · a "Plan this week" affordance → EDIT mode (5 floor-clamped steppers, each
 *     labelled with its provenance: Personal / Floor / Custom) → Commit + Reset
 *   · a COMMITTED view ("Your weekly plan": the 5 values + provenance chips +
 *     committed-date + Edit) once a plan exists for the week
 *
 * Pre-fill is honest (decision 2): dials/CIs/apps from the derived chain;
 * contacts/FFIs from the company floor; in the floor state all five from the
 * floor. Any value the agent changes flips its provenance to 'agent'. The
 * stepper floor clamp + weeklyPlanService re-validation block below-floor commits.
 *
 * Without `onCommit` (Slice-1 callers / tests) the card is byte-for-byte the
 * read-only S1 surface — the planning UI is fully gated behind the new props.
 *
 * statusToken roles (locked decision 6): suggested target = 'in-flight' (teal);
 * floor baseline = 'closed' (thin neutral reference).
 */

// The floor fallback maps the shipped weeklyActivityFloors keys to the card's
// five metric concepts (all five render on the floor path; see the asymmetry
// note above). Order mirrors the build annotation's floor state.
const FLOOR_METRICS = [
  { key: 'callsMade',             label: 'Prospecting calls' },
  { key: 'contactsMade',          label: 'Contacts' },
  { key: 'factFindsCompleted',    label: 'FFIs' },
  { key: 'closingInterviewsKept', label: 'CIs' },
  { key: 'applicationsSubmitted', label: 'Apps' },
];

// Honest provenance chip copy — never presents a floor value as personal.
const PROVENANCE_CHIP = {
  derived: 'Personal',
  floor:   'Floor',
  agent:   'Custom',
};

function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading your suggested week">
      <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
      <div className="flex gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 flex-1 animate-pulse rounded-xl bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}

function formatCommittedDate(committedAt) {
  // Firestore Timestamp → "Jun 4". Tolerates a pending serverTimestamp (null).
  const d = committedAt?.toDate ? committedAt.toDate() : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

export default function SuggestedWeekCard({
  committedAnnualAPI = null,
  avgPolicyAPI = null,
  prospectRatio = null,
  submissions = [],
  floors = null,
  loading = false,
  error = false,
  onRetry,
  onBuildPlan,
  weekLabel,
  // ── Slice 2 (all optional — absence = read-only S1 surface) ──
  committedPlan = null,
  onCommit,
  planBusy = false,
  planError = false,
  onDeletePlan,        // optional — renders a "Clear plan" link in the committed view
  // ── Slice 3a (committed-view actuals + variance) ──
  weekStart = null,        // this week's Sunday (YYYY-MM-DD) — pace week membership
  weekSubmission = null,   // the week's submitted report (final source), or null
  dailyDocs = [],          // the week's dailyActivity docs (mid-week source)
}) {
  const [expanded, setExpanded] = useState(null); // which metric's chain is revealed
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState(null); // { targets, provenance }
  const teal = statusToken('in-flight');
  const neutral = statusToken('closed');

  const resolution = useMemo(() => {
    const anchor =
      typeof committedAnnualAPI === 'number' && committedAnnualAPI > 0 ? committedAnnualAPI : null;
    if (!anchor) return { mode: 'no-anchor' };

    const { autoCiToSale, autoDialsToCI, hasHistory, weeksUsed } = deriveRatiosFromHistory(submissions);
    if (!hasHistory) return { mode: 'floor', weeksUsed };

    // Match the Playground's 2-decimal ratio rounding so the two surfaces agree.
    const ciToSaleRatio = parseFloat(autoCiToSale.toFixed(2));
    const dialsToCIRatio = parseFloat(autoDialsToCI.toFixed(2));
    const avg = avgPolicyAPI > 0 ? avgPolicyAPI : DEFAULT_DECOMPOSITION_INPUTS.avgPolicyAPI;
    const pRatio = prospectRatio > 0 ? prospectRatio : DEFAULT_DECOMPOSITION_INPUTS.prospectRatio;

    const annual = decomposeFromAPI({
      apiToWrite: anchor,
      avgPolicyAPI: avg,
      ciToSaleRatio,
      dialsToCIRatio,
      prospectRatio: pRatio,
    });
    const weekly = {
      applications: roundToWhole(annual.applications / WEEKLY_DIVISOR),
      ci: roundToWhole(annual.ci / WEEKLY_DIVISOR),
      dials: roundToWhole(annual.dials / WEEKLY_DIVISOR),
      prospects: roundToWhole(annual.prospects / WEEKLY_DIVISOR),
    };
    return { mode: 'derived', anchor, avg, ciToSaleRatio, dialsToCIRatio, prospectRatio: pRatio, weekly, weeksUsed };
  }, [committedAnnualAPI, submissions, avgPolicyAPI, prospectRatio]);

  // Planning is only offered on the derived/floor states, and only when a commit
  // handler is wired (Slice-1 callers pass none → pure read-only surface).
  const planningEnabled =
    typeof onCommit === 'function' && (resolution.mode === 'derived' || resolution.mode === 'floor');
  const showCommitted = planningEnabled && committedPlan && !editing;

  // Slice 3a — the committed view's value rows become PACE ROWS: plan cap + floor
  // tick + variance-coloured actual fill + a live pace marker. The pure
  // planVariance module owns all derivation (source switch, calls 5-sum, variance,
  // TT-safe elapsed days); the card is presentation only. Returns null for a
  // malformed committed doc (no targets) → the footer-only fallback still renders.
  const paceResult = useMemo(
    () =>
      showCommitted
        ? buildPaceRows({ committedPlan, weekSubmission, dailyDocs, floors, weekStart, todayTT: getTodayTT() })
        : null,
    [showCommitted, committedPlan, weekSubmission, dailyDocs, floors, weekStart],
  );
  const sourceChip = paceResult ? statusToken(paceResult.chip.role) : null;

  // If the committed plan changes underneath us (refetch after commit/delete),
  // leave edit mode so the fresh state shows.
  useEffect(() => { setEditing(false); }, [committedPlan]);

  const openEditFromSuggestion = () => {
    setEditState(assembleSuggestion(resolution, floors));
    setEditing(true);
  };
  const openEditFromCommitted = () => {
    // Defensive: a malformed committed doc (missing targets/provenance) falls back
    // to the freshly-assembled suggestion rather than seeding undefined steppers.
    if (committedPlan?.targets && committedPlan?.provenance) {
      setEditState({ targets: { ...committedPlan.targets }, provenance: { ...committedPlan.provenance } });
    } else {
      setEditState(assembleSuggestion(resolution, floors));
    }
    setEditing(true);
  };
  const handleStep = (key, delta) =>
    setEditState((s) => stepTarget(s, key, delta, floors));
  const handleReset = () => setEditState(assembleSuggestion(resolution, floors));
  // Cancel exits edit mode WITHOUT writing — stepper changes are discarded and the
  // prior view (committed plan or read-only suggestion) returns (decision-5 amendment).
  const handleCancel = () => {
    setEditState(null);
    setEditing(false);
  };
  const handleCommit = async () => {
    if (!editState) return;
    try {
      await onCommit(editState.targets, editState.provenance, committedAnnualAPI);
      // committedPlan refetch drives the effect above out of edit mode; clearing
      // here too in case the parent keeps the same committedPlan reference.
      setEditing(false);
    } catch {
      // Parent surfaces planError; stay in edit mode so the agent can retry.
    }
  };

  const eyebrow = (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${teal.text}`}>
        {showCommitted ? 'Your weekly plan' : 'Suggested weekly plan'}{weekLabel ? ` · ${weekLabel}` : ''}
      </span>
      {!planningEnabled && (
        <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">
          Read-only
        </span>
      )}
    </div>
  );

  // ── shell ──────────────────────────────────────────────────────────────────
  return (
    <section
      className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm"
      data-testid="suggested-week-card"
      aria-label="Suggested weekly plan"
    >
      {eyebrow}

      {loading && <div className="mt-4"><Skeleton /></div>}

      {!loading && error && (
        <div
          className="mt-4 flex flex-col items-center justify-center gap-2.5 py-6 text-center"
          data-testid="suggested-week-error"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger-ink">
            <AlertCircle size={20} aria-hidden="true" />
          </div>
          <p className="font-display text-sm font-extrabold text-ink">Couldn&apos;t load your suggested plan</p>
          <p className="text-xs text-ink-muted">The rest of the hub stays usable.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RotateCw size={14} aria-hidden="true" /> Retry
            </button>
          )}
        </div>
      )}

      {/* ── no anchor ── */}
      {!loading && !error && resolution.mode === 'no-anchor' && (
        <div
          className="mt-4 flex flex-col items-center justify-center gap-2.5 py-6 text-center"
          data-testid="suggested-week-no-anchor"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${teal.tint} ${teal.text}`}>
            <Clock size={20} aria-hidden="true" />
          </div>
          <p className="font-display text-sm font-extrabold text-ink">Set a plan to see your week</p>
          <p className="max-w-xs text-xs leading-relaxed text-ink-muted">
            You haven&apos;t committed an annual target yet, so there&apos;s nothing to derive a weekly plan from.
          </p>
          {onBuildPlan && (
            <button
              type="button"
              onClick={onBuildPlan}
              className="mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary dark:bg-primary-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark dark:hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Build your Game Plan <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* ── committed plan view → pace rows (Slice 3a) ── */}
      {!loading && !error && showCommitted && (
        <div className="mt-4 space-y-3.5" data-testid="weekly-plan-committed">
          {paceResult && (
            <>
              {/* source / provenance chip + live pace readout */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${sourceChip.tint} ${sourceChip.text}`}
                  data-testid="weekly-plan-source-chip"
                >
                  {paceResult.source === 'final' ? '✓' : '◷'} {paceResult.chip.label}
                </span>
                {paceResult.source === 'daily' && (
                  <span className="font-mono text-[9px] text-ink-muted" data-testid="weekly-plan-pace-readout">
                    Day {paceResult.elapsed} of {PACE_WORKING_DAYS} → you should be at{' '}
                    {Math.round(paceResult.paceFraction * 100)}% of plan
                  </span>
                )}
              </div>

              {/* the five pace rows */}
              <div className="space-y-3.5" data-testid="weekly-plan-pace-rows">
                {paceResult.rows.map((r) => (
                  <PaceRow key={r.key} row={r} />
                ))}
              </div>
            </>
          )}

          {/* committed-date + Clear + Edit (preserved from Slice 2) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-ink-muted">
                {formatCommittedDate(committedPlan.committedAt)
                  ? `Committed ${formatCommittedDate(committedPlan.committedAt)}`
                  : 'Committed'}
              </span>
              {onDeletePlan && (
                <button
                  type="button"
                  onClick={onDeletePlan}
                  disabled={planBusy}
                  data-testid="weekly-plan-clear"
                  className="text-[11px] text-danger-ink hover:underline disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={openEditFromCommitted}
              data-testid="weekly-plan-edit-btn"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Pencil size={14} aria-hidden="true" /> Edit
            </button>
          </div>
        </div>
      )}

      {/* ── edit mode (Slice 2): 5 floor-clamped steppers ── */}
      {!loading && !error && planningEnabled && editing && editState && (
        <div className="mt-4 space-y-2.5" data-testid="weekly-plan-edit">
          {FLOOR_METRICS.map((m) => {
            const floorMin = typeof floors?.[m.key] === 'number' ? floors[m.key] : 0;
            const value = editState.targets?.[m.key] ?? 0;
            const atFloor = value <= floorMin;
            return (
              <div
                key={m.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2"
                data-testid={`plan-step-${m.key}`}
              >
                <div className="flex flex-col">
                  <span className="font-display text-sm font-extrabold tracking-tight text-ink">{m.label}</span>
                  <span className="font-mono text-[8px] font-bold uppercase tracking-wide text-ink-muted">
                    {PROVENANCE_CHIP[editState.provenance?.[m.key]] ?? ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStep(m.key, -1)}
                    disabled={atFloor}
                    aria-label={`Decrease ${m.label}`}
                    data-testid={`plan-step-${m.key}-dec`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-ink transition-colors hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <span
                    className="w-10 text-center font-display text-xl font-extrabold tracking-tight text-ink"
                    data-testid={`plan-step-${m.key}-value`}
                  >
                    {value}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStep(m.key, 1)}
                    aria-label={`Increase ${m.label}`}
                    data-testid={`plan-step-${m.key}-inc`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}

          {planError && (
            <p className="text-xs text-danger-ink" data-testid="weekly-plan-error" role="alert">
              Couldn&apos;t save your plan — check your connection and try again.
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCommit}
              disabled={planBusy}
              data-testid="weekly-plan-commit"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-primary dark:bg-primary-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark dark:hover:bg-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {planBusy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {planBusy ? 'Committing…' : 'Commit'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={planBusy}
              data-testid="weekly-plan-reset"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={planBusy}
              data-testid="weekly-plan-cancel"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── floor fallback (read-only suggestion) ── */}
      {!loading && !error && !showCommitted && !editing && resolution.mode === 'floor' && (
        <div className="mt-4 space-y-3" data-testid="suggested-week-floor">
          <div className="grid grid-cols-5 gap-2">
            {FLOOR_METRICS.map((m) => (
              <div
                key={m.key}
                className="rounded-lg border border-border bg-surface-raised px-1.5 py-2.5 text-center"
              >
                <div className="font-display text-lg font-extrabold tracking-tight text-ink-muted">
                  {floors?.[m.key] ?? '—'}
                </div>
                <div className="mt-1 font-mono text-[8px] font-bold uppercase tracking-wide text-ink-muted">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
          <div className={`flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2.5 border-l-[3px] ${neutral.text}`}>
            <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wide text-ink-muted">
              ⎯ Company floor
            </span>
            <span className="text-[11px] leading-snug text-ink-muted">
              Based on the company floor until you have 8 weeks of history
              {typeof resolution.weeksUsed === 'number' ? ` (you have ${resolution.weeksUsed})` : ''}
              {' '}— then we&apos;ll personalise it from your own ratios.
            </span>
          </div>
          {planningEnabled && (
            <PlanThisWeekButton onClick={openEditFromSuggestion} />
          )}
        </div>
      )}

      {/* ── derived (read-only suggestion) ── */}
      {!loading && !error && !showCommitted && !editing && resolution.mode === 'derived' && (
        <div className="mt-3" data-testid="suggested-week-derived">
          <p className="font-display text-base font-extrabold leading-snug tracking-tight text-ink">
            To stay on your <span className={teal.text}>{formatCurrency(resolution.anchor)}</span> plan, your week looks like:
          </p>

          {(() => {
            const chips = [
              { key: 'dials', label: 'Prospecting calls', value: resolution.weekly.dials, basis: `${resolution.dialsToCIRatio}× per CI` },
              { key: 'ci', label: 'CIs', value: resolution.weekly.ci, basis: `${resolution.ciToSaleRatio}× per app` },
              { key: 'apps', label: 'Apps', value: resolution.weekly.applications, basis: `÷ ${formatCurrency(resolution.avg)} avg policy` },
            ];
            return (
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {chips.map((c) => {
                  const open = expanded === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setExpanded(open ? null : c.key)}
                      aria-expanded={open}
                      aria-label={`${c.label}: ${c.value} per week. ${open ? 'Hide' : 'Show'} how this is derived.`}
                      className={`flex min-h-[44px] flex-col items-start rounded-xl border bg-surface-raised p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        open ? 'border-primary/50' : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex w-full items-start justify-between">
                        <span className={`font-display text-2xl font-extrabold leading-none tracking-tight ${teal.text}`}>
                          {c.value}
                        </span>
                        <ChevronDown
                          size={14}
                          aria-hidden="true"
                          className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      </div>
                      <span className="mt-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                        {c.label}
                      </span>
                      <span className="mt-1.5 w-full border-t border-dashed border-border pt-1.5 font-mono text-[9px] text-ink-muted">
                        {c.basis}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {expanded && (
            <div className={`mt-3 rounded-xl border border-primary/25 ${teal.tint} p-3.5`} data-testid="suggested-week-reveal">
              <div className={`font-mono text-[9px] font-bold uppercase tracking-wide ${teal.text}`}>
                ↳ How we got your week
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
                {[
                  { v: `${formatCurrency(resolution.anchor)}`, l: 'annual API', op: null, focus: false },
                  { v: `${resolution.weekly.applications}`, l: 'apps / wk', op: `÷ ${formatCurrency(resolution.avg)}`, focus: expanded === 'apps' },
                  { v: `${resolution.weekly.ci}`, l: 'CIs / wk', op: `× ${resolution.ciToSaleRatio}`, focus: expanded === 'ci' },
                  { v: `${resolution.weekly.dials}`, l: 'dials / wk', op: `× ${resolution.dialsToCIRatio}`, focus: expanded === 'dials' },
                  { v: `${resolution.weekly.prospects}`, l: 'prospects / wk', op: `× ${resolution.prospectRatio}`, focus: false },
                ].map((node, i) => (
                  <React.Fragment key={node.l}>
                    {node.op && (
                      <span className="rounded-md border border-border bg-card px-1.5 py-1 font-mono text-[9px] text-ink-muted">
                        {node.op}
                      </span>
                    )}
                    <span className={i > 0 ? `font-bold ${teal.text}` : 'text-ink-muted'} aria-hidden="true">
                      {i > 0 ? '→' : ''}
                    </span>
                    <span className="flex flex-col">
                      <span className={`font-display text-sm font-extrabold tracking-tight ${node.focus ? teal.text : 'text-ink'}`}>
                        {node.v}
                      </span>
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wide text-ink-muted">
                        {node.l}
                      </span>
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] leading-snug text-ink-muted">
                Weekly targets across a ~{WEEKLY_DIVISOR}-week production year. Your CI-to-sale and dials-to-CI ratios are
                auto-filled from your last {resolution.weeksUsed} weeks of submitted reports.
              </p>
            </div>
          )}

          {planningEnabled && (
            <div className="mt-3">
              <PlanThisWeekButton onClick={openEditFromSuggestion} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Variance → Nexus token classes (success = ahead/on-track, warning = behind).
// On-track is the softer success fill (annotation grammar); all derive from the
// statusToken families — no raw palette colours.
const VARIANCE_TONE = {
  ahead:      { fill: 'bg-success',            text: 'text-success-ink', chip: 'bg-success-tint text-success-ink', icon: '▲', label: 'Ahead' },
  'on-track': { fill: 'bg-success opacity-60', text: 'text-success-ink', chip: 'bg-success-tint text-success-ink', icon: '●', label: 'On track' },
  behind:     { fill: 'bg-warning',            text: 'text-warning-ink', chip: 'bg-warning-tint text-warning-ink', icon: '▼', label: 'Behind' },
};

/**
 * PaceRow — one committed metric as a plan-vs-actual track:
 *   floor tick (neutral) · plan cap (teal, right edge = 100% scale) · actual fill
 *   (variance-coloured) · pace marker (where you should be today).
 *
 * The hatched "weekly only · no daily pace" state renders for metrics Daily
 * Capture can't supply mid-week (calls). All bar geometry is data-driven inline
 * positioning (the codebase's progress-bar idiom); colours stay tokenised. The
 * plan value retains the Slice-2 `plan-committed-${key}-value` testid + the
 * provenance chip so the S2 plan tests stay green.
 */
function PaceRow({ row }) {
  const tone = row.variance ? VARIANCE_TONE[row.variance] : null;
  const summary = row.noDailySource
    ? `${row.label}: weekly only, no daily pace. Floor ${row.floor}, plan ${row.plan}.`
    : `${row.label}: ${row.actual} of ${row.plan}${tone ? `, ${tone.label}` : ''}. Floor ${row.floor}.`;

  return (
    <div className="grid grid-cols-[84px_1fr_88px] items-center gap-3 sm:grid-cols-[116px_1fr_104px]" data-testid={`pace-row-${row.key}`}>
      {/* label + floor/plan/provenance meta */}
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-ink">{row.label}</div>
        {row.clarifier && (
          <div className="truncate font-mono text-[8px] tracking-wide text-ink-muted">{row.clarifier}</div>
        )}
        <div className="mt-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-ink-muted">
          FLOOR {row.floor} · PLAN{' '}
          <span data-testid={`plan-committed-${row.key}-value`}>{row.plan}</span>
          {' · '}
          <span className="text-ink-muted">{PROVENANCE_CHIP[row.provenance] ?? ''}</span>
        </div>
      </div>

      {/* track */}
      <div className="relative h-6 overflow-visible rounded-lg bg-surface-muted" role="img" aria-label={summary}>
        {row.noDailySource ? (
          <div
            className="absolute inset-0 rounded-lg bg-[repeating-linear-gradient(90deg,var(--color-surface-muted),var(--color-surface-muted)_6px,var(--color-border)_6px,var(--color-border)_8px)]"
            aria-hidden="true"
          />
        ) : (
          <>
            <div
              className={`absolute inset-y-0 left-0 rounded-lg ${tone?.fill ?? ''}`}
              style={{ width: `${row.fillPct}%` }}
              aria-hidden="true"
            />
            {row.showPace && (
              <div
                className="absolute -top-1 h-0 w-0 border-l-4 border-r-4 border-t-[7px] border-l-transparent border-r-transparent border-t-ink"
                style={{ left: `${row.pacePct}%`, transform: 'translateX(-4px)' }}
                aria-hidden="true"
              />
            )}
          </>
        )}
        {/* floor tick (neutral baseline) */}
        <div
          className="absolute -bottom-0.5 -top-0.5 w-0.5 bg-ink-faint"
          style={{ left: `${row.floorPct}%` }}
          aria-hidden="true"
        />
        {/* plan cap (target — right edge of the scale) */}
        <div className="absolute -bottom-0.5 -top-0.5 right-0 w-0.5 bg-primary" aria-hidden="true" />
      </div>

      {/* readout */}
      <div className="text-right">
        {row.noDailySource ? (
          <span className="font-mono text-[8.5px] font-bold leading-tight text-ink-muted" data-testid={`pace-nodaily-${row.key}`}>
            weekly only · no daily pace
          </span>
        ) : (
          <>
            <div className="leading-none">
              <span className={`font-display text-base font-extrabold ${tone?.text ?? 'text-ink'}`} data-testid={`pace-actual-${row.key}`}>
                {row.actual}
              </span>
              <span className="font-mono text-[10px] text-ink-muted"> / {row.plan}</span>
            </div>
            {tone && (
              <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold ${tone.chip}`} data-testid={`pace-variance-${row.key}`}>
                {tone.icon} {tone.label}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlanThisWeekButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="plan-this-week"
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary dark:bg-primary-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark dark:hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      Plan this week <ArrowRight size={15} aria-hidden="true" />
    </button>
  );
}
