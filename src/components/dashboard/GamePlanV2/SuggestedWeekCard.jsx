import React, { useMemo, useState } from 'react';
import { Clock, AlertCircle, RotateCw, ChevronDown, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { statusToken } from '../../../lib/policyStatusTokens';
import {
  decomposeFromAPI,
  deriveRatiosFromHistory,
  roundToWhole,
  WEEKLY_DIVISOR,
  DEFAULT_DECOMPOSITION_INPUTS,
} from '../../../utils/goalDecomposition';

/**
 * SuggestedWeekCard — Game Plan v2 Weekly Planner, Slice 1 (NEW chrome, read-only).
 *
 * A "This week" cascade rung in the Game Plan hub. Composition over the existing
 * Commission Playground decomposition engine (utils/goalDecomposition.js) — it
 * NEVER recomputes the chain and NEVER stores a plan. The derived weekly line
 * shows the three engine-derivable metrics (dials · CIs · apps); the full chain
 * (incl. prospects) appears only in the tap-to-expand derivation reveal.
 *
 * Honest-framing resolution (never a fabricated target):
 *   loading                          → skeleton
 *   error                            → error + retry
 *   no committed API anchor          → "set a plan" prompt + CTA
 *   anchor but < 8 weeks history     → company-floor fallback, flagged
 *   anchor + ≥ 8 weeks history       → derived weekly line (teal) + reveal
 *
 * Contacts/FFIs do NOT appear on the derived path — the engine doesn't model
 * them. They appear on the floor fallback (the floor carries those columns).
 * A future product decision adds a contacts/FFI weekly derivation (see the
 * "Weekly-activity planner — remaining slices" follow-up).
 *
 * statusToken roles (locked decision 6): suggested target = 'in-flight' (teal);
 * floor baseline = 'closed' (thin neutral reference).
 */

// The floor fallback maps the shipped weeklyActivityFloors keys to the card's
// five metric concepts (all five render on the floor path; see the asymmetry
// note above). Order mirrors the build annotation's floor state.
const FLOOR_METRICS = [
  { key: 'callsMade',             label: 'Dials' },
  { key: 'contactsMade',          label: 'Contacts' },
  { key: 'factFindsCompleted',    label: 'FFIs' },
  { key: 'closingInterviewsKept', label: 'CIs' },
  { key: 'applicationsSubmitted', label: 'Apps' },
];

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
}) {
  const [expanded, setExpanded] = useState(null); // which metric's chain is revealed
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

  const eyebrow = (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${teal.text}`}>
        Suggested weekly plan{weekLabel ? ` · ${weekLabel}` : ''}
      </span>
      <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">
        Read-only
      </span>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
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

      {/* ── floor fallback ── */}
      {!loading && !error && resolution.mode === 'floor' && (
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
        </div>
      )}

      {/* ── derived ── */}
      {!loading && !error && resolution.mode === 'derived' && (
        <div className="mt-3" data-testid="suggested-week-derived">
          <p className="font-display text-base font-extrabold leading-snug tracking-tight text-ink">
            To stay on your <span className={teal.text}>{formatCurrency(resolution.anchor)}</span> plan, your week looks like:
          </p>

          {(() => {
            const chips = [
              { key: 'dials', label: 'Dials', value: resolution.weekly.dials, basis: `${resolution.dialsToCIRatio}× per CI` },
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
        </div>
      )}
    </section>
  );
}
