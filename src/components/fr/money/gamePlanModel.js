/**
 * gamePlanModel — the FR Game plan's view model (R2-8), PURE.
 *
 * Presentation only: every figure is one the Game plan hub
 * (dashboard/GamePlanV2/index.jsx) already derives from its existing reads
 * (moneyNeeds, yearPlan, monthlyPlan, submissions). Nothing is re-derived
 * here from raw data and nothing is written — this only arranges the hub's
 * own values into the canvas layout (D3M-GamePlan / M3-GamePlan). The step
 * gating mirrors StepRail exactly; the checklist is the same commitChecklist.
 *
 * FR-D10 honest numbers: a figure the hub does not have renders as a word
 * ("Not started", "Not set yet"), never as a fake 0.
 */
import { formatCurrency } from '../../../utils/formatters';
import { allocationSegments, commitChecklist, commitReady } from '../../../lib/planCascadeViz';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Line → FR chart series (fixed order, never cycled — FR-D1).
const LINE_CHART = { life: 'bg-chart-1', ah: 'bg-chart-2', general: 'bg-chart-3' };

const num = (v) => parseFloat(v) || 0;

/**
 * SuggestedWeekCard is written for the solid-teal Nexus hero and reads the
 * --hero-* ink tokens. On an FR card those are re-pointed at the FR ink
 * tokens (Tailwind arbitrary properties — no inline style, no new CSS), the
 * same move FrTodayView makes for the reconciliation note.
 *
 * The committed view's "Clear" text button is 17px tall in the Nexus card
 * (banked as a follow-up — fixing it there changes the Nexus look). On the
 * FR surface it gets the 44px target through a descendant variant, so the
 * Nexus card is untouched.
 */
export const FR_SUGGESTED_WEEK_SURFACE = [
  'rounded-[18px] border border-border bg-card p-5',
  '[--hero-ink:rgb(var(--text-channels))] [--hero-ink-muted-teal:rgb(var(--text-muted-channels))]',
  '[--hero-accent:rgb(var(--fr-accent-channels))] [--hero-chip-border:rgb(var(--border-channels))]',
  '[&_[data-testid=weekly-plan-clear]]:inline-flex [&_[data-testid=weekly-plan-clear]]:min-h-[44px] [&_[data-testid=weekly-plan-clear]]:items-center [&_[data-testid=weekly-plan-clear]]:px-2',
].join(' ');

/** Same TT-local date the Nexus cascade prints ("1 Sept 2026"). */
export function formatSeal(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-TT', {
    timeZone: 'America/Port_of_Spain',
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
}

/** The Nexus cascade's YTD badge copy, verbatim. */
export function ytdLabel(delta) {
  if (delta > 0) return `+${formatCurrency(delta)} ahead`;
  if (delta < 0) return `${formatCurrency(Math.abs(delta))} behind`;
  return 'on pace';
}

/**
 * @param {object} i  the hub's derived values (see GamePlanV2/index.jsx)
 * @param {number} i.year
 * @param {number} i.afterTaxNeed
 * @param {number} i.renewalsCover
 * @param {number} i.grossNeed
 * @param {number} i.commissionNeed
 * @param {boolean} i.moneyNeedsFilled
 * @param {boolean} i.loopEnabled          GAME_PLAN_LOOP_ENABLED
 * @param {boolean} i.yearPlanFilled
 * @param {number} i.yearPlanTotalAPI
 * @param {object|null} i.yearPlanLines
 * @param {string[]} i.lineKeys
 * @param {boolean} i.monthlyPlanFilled
 * @param {number} i.monthlyPlanTotal
 * @param {number[]} i.monthlyTargets
 * @param {number[]} i.monthlyActuals
 * @param {number} i.currentMonthIndex
 * @param {number} i.monthlyYtdDelta
 * @param {boolean} i.committed
 * @param {Date|null} i.committedAt
 * @param {number|null} i.committedAnnualAPI
 * @param {number} i.stepsBuilt
 * @param {number} i.totalSteps
 * @param {number} i.planBuiltPct
 */
export function gamePlanModel(i) {
  const loop = Boolean(i.loopEnabled);
  const apiSet = typeof i.committedAnnualAPI === 'number' && i.committedAnnualAPI > 0;

  // ── Steps (gating = StepRail, copy = canvas where the state maps) ──────────
  const step1Done = Boolean(i.yearPlanFilled);
  const step2Active = loop;
  const step2Done = step2Active && Boolean(i.monthlyPlanFilled);
  const step3Active = loop && Boolean(i.monthlyPlanFilled);
  const step3Done = loop && Boolean(i.committed);

  const steps = [
    {
      id: 'money-needs',
      n: '1',
      title: 'Money needs',
      kicker: step1Done ? 'Done' : i.moneyNeedsFilled ? 'In progress' : 'Start',
      done: step1Done,
      value: i.moneyNeedsFilled ? `${formatCurrency(i.commissionNeed)} commission to earn` : 'Not started',
      sub: step1Done
        ? `${formatCurrency(i.yearPlanTotalAPI)} API allocated by line`
        : 'What you need & how you write it',
      actionLabel: 'Open Money needs',
      active: true,
    },
    {
      id: 'monthly',
      n: '2',
      title: 'Monthly plan',
      kicker: step2Active ? (step2Done ? 'Done' : step1Done ? 'Start' : 'Next') : 'Coming',
      done: step2Done,
      value: step2Done ? `${formatCurrency(num(i.monthlyPlanTotal) / 12)} a month` : step2Active ? 'Not split yet' : 'Coming soon',
      sub: step2Done ? ytdLabel(i.monthlyYtdDelta) : step2Active ? 'Split into months' : 'Coming soon',
      actionLabel: step2Active ? 'Open monthly plan' : 'Coming soon',
      active: step2Active,
    },
    {
      id: 'review',
      n: '3',
      title: 'Review and commit',
      kicker: step3Done ? 'Done' : step3Active ? 'Review' : 'Coming',
      done: step3Done,
      value: step3Done ? 'Committed' : step3Active ? 'Ready' : 'Locked',
      sub: step3Done
        ? (i.committedAt ? `Committed · ${formatSeal(i.committedAt)} TT` : 'Plan committed')
        : step3Active
          ? 'Review & commit your plan'
          : loop ? 'Finish your monthly plan first' : 'Coming soon',
      actionLabel: step3Done ? 'Review your plan' : step3Active ? 'Review & commit' : 'Locked',
      active: step3Active,
    },
  ];

  // ── Personal commitment strip + the Money Needs chain ──────────────────────
  const commitment = {
    apiLabel: apiSet ? formatCurrency(i.committedAnnualAPI) : 'Not set yet',
    apiSet,
    progressPct: Math.max(0, Math.min(100, Math.round(num(i.planBuiltPct)))),
    progressLabel: `${i.stepsBuilt} of ${i.totalSteps} steps built`,
    tag: step3Done
      ? (i.committedAt ? `Committed ${formatSeal(i.committedAt)}` : 'Committed')
      : 'Draft · not committed yet',
    committed: step3Done,
  };

  const chain = i.moneyNeedsFilled
    ? [
      { key: 'after', label: 'After-tax need', value: formatCurrency(i.afterTaxNeed) },
      { key: 'gross', label: 'Gross need', value: formatCurrency(i.grossNeed) },
      { key: 'renewals', label: 'Renewals cover', value: formatCurrency(i.renewalsCover) },
      { key: 'commission', label: 'Commission need', value: formatCurrency(i.commissionNeed) },
    ]
    : null;

  // ── Monthly plan (read-only here; the existing modal edits it) ─────────────
  const targets = Array.from({ length: 12 }, (_, m) => num(i.monthlyTargets?.[m]));
  const actuals = Array.from({ length: 12 }, (_, m) => num(i.monthlyActuals?.[m]));
  const current = Number.isInteger(i.currentMonthIndex) ? i.currentMonthIndex : 0;
  const months = MONTH_LABELS.map((label, m) => ({
    key: label,
    label,
    plan: targets[m],
    actual: m <= current ? actuals[m] : null,
    current: m === current,
  }));

  const { segments } = allocationSegments(i.yearPlanLines, i.lineKeys);
  const byLine = segments.map((s) => ({
    key: s.key,
    label: s.label,
    amount: formatCurrency(s.targetAPI),
    pct: Math.round(s.pct),
    width: s.pct,
    fill: LINE_CHART[s.key] ?? 'bg-chart-5',
  }));

  const monthly = {
    enabled: loop,
    filled: Boolean(i.monthlyPlanFilled),
    total: num(i.monthlyPlanTotal),
    totalLabel: formatCurrency(num(i.monthlyPlanTotal)),
    perMonthLabel: formatCurrency(num(i.monthlyPlanTotal) / 12),
    ytdLabel: ytdLabel(i.monthlyYtdDelta),
    ytdTone: i.monthlyYtdDelta > 0 ? 'ahead' : i.monthlyYtdDelta < 0 ? 'behind' : 'even',
    ytdTitle: i.monthlyYtdDelta > 0
      ? `${formatCurrency(i.monthlyYtdDelta)} ahead of your monthly plan so far`
      : i.monthlyYtdDelta < 0
        ? `${formatCurrency(Math.abs(i.monthlyYtdDelta))} behind your monthly plan so far`
        : 'On pace with your monthly plan so far',
    months,
    currentLabel: MONTH_LABELS[current],
  };

  const yearPlan = {
    enabled: loop,
    filled: Boolean(i.yearPlanFilled),
    totalLabel: formatCurrency(num(i.yearPlanTotalAPI)),
    byLine,
  };

  // ── Review and commit (same checklist + CTA copy as PlanCommitCard) ────────
  const flags = { moneyNeedsFilled: i.moneyNeedsFilled, yearPlanFilled: i.yearPlanFilled, monthlyPlanFilled: i.monthlyPlanFilled };
  const ready = commitReady(flags);
  const commit = {
    enabled: loop,
    committed: Boolean(i.committed),
    ready,
    checklist: commitChecklist(flags),
    title: i.committed ? 'Your plan is committed' : 'Lock your plan to set your Goals',
    sub: i.committed
      ? 'Managers can see your target — only you can change it.'
      : 'Committing writes your Personal Commitment to your Goals page.',
    ctaLabel: i.committed ? 'Review your plan' : ready ? 'Review & commit your plan' : 'Review your plan',
    hint: !i.committed && !ready ? 'Finish the steps above to commit.' : null,
    apiLine: apiSet && i.committed ? `Personal commitment · ${formatCurrency(i.committedAnnualAPI)}` : null,
  };

  return {
    year: i.year,
    badge: {
      label: `${i.stepsBuilt}/${i.totalSteps} steps built · ${commitment.progressPct}%`,
      complete: i.stepsBuilt === i.totalSteps,
    },
    steps,
    commitment,
    chain,
    monthly,
    yearPlan,
    commit,
  };
}
