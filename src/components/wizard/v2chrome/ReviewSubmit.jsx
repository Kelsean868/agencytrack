import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import {
  totalProductionAPI,
  totalApps,
  ciConv,
  totalCalls,
  totalNames,
  estCommission,
  deriveLastWeek,
} from '../../../lib/schema/wizardLive.computations';
import { computeLumpsumCredit } from '../../../lib/schema/weeklyReport.computations';

/**
 * Wizard v2 PR3 — Step 12 Review & submit.
 *
 * Reuses the PR2 compute lib end-to-end: the displayed totals (Production API,
 * total apps, conversion %, est. commission, calls, names) come from the SAME
 * pure functions the WeekSoFarPanel uses. This is what makes the Review↔panel
 * parity assertion trivially true — no re-derivation, no parallel formulas.
 *
 * Each section header carries an "Edit · Step N" pill (a real <button> for
 * a11y) that calls `onEditStep(N)` — the parent (WizardForm) navigates and
 * arms a "return to review" gate so the agent can Back-to-Review after.
 *
 * Goals are DISPLAYED, not seeded. Goal-seeding stays the deferred decision-A
 * FU. Brief decision: passive display of what the agent entered in step 11.
 */
export default function ReviewSubmit({
  data,
  lastWeekData,
  commissionRate,
  onEditStep,
}) {
  const liveAPI    = totalProductionAPI(data);
  const liveApps   = totalApps(data);
  const liveConv   = ciConv(data);
  const liveCalls  = totalCalls(data);
  const liveNames  = totalNames(data);
  const liveComm   = estCommission(data, commissionRate);
  const lumpsumCredit = computeLumpsumCredit(data?.lumpsums?.grossAmount ?? 0);

  const lastWeek = deriveLastWeek(lastWeekData);
  const apiDelta = lastWeek?.api ? liveAPI - lastWeek.api : null;

  return (
    <div
      data-testid="wizard-v2-review"
      className="flex flex-col gap-4"
    >
      {/* Hero — Production + Commission */}
      <section
        className="relative overflow-hidden rounded-2xl bg-card border border-gold/30 px-5 py-4 shadow-md"
        aria-label="Production + commission summary"
      >
        <div
          className="absolute -top-16 -right-16 w-56 h-56 pointer-events-none rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-gold-tint) 0%, transparent 65%)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-gold">
              Your week
            </p>
            <p
              data-testid="wizard-v2-review-api"
              className="text-3xl sm:text-4xl font-display font-bold text-ink leading-none mt-2"
              style={{ letterSpacing: '-0.028em' }}
            >
              {formatCurrency(liveAPI)}
            </p>
            <p className="text-[11px] text-ink-muted mt-1">
              Production API · {liveApps} apps · {data.livesSold ?? 0} lives
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-primary">
              Est. commission
            </p>
            <p
              data-testid="wizard-v2-review-comm"
              className="text-xl sm:text-2xl font-display font-bold text-primary leading-none mt-2"
              style={{ letterSpacing: '-0.022em' }}
            >
              {formatCurrency(liveComm)}
            </p>
            <p className="text-[10px] font-mono text-ink-muted mt-1">
              at {commissionRate}% rate
              {apiDelta != null && apiDelta !== 0 && (
                <> · {apiDelta > 0 ? '+' : ''}{formatCurrency(apiDelta)} vs last wk</>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Production section — backToStep 7 */}
      <ReviewSection
        eyebrow="PRODUCTION"
        backToStep={7}
        testid="wizard-v2-review-section-production"
        onEditStep={onEditStep}
      >
        <RowList
          rows={[
            {
              label: 'New business',
              value: `${data?.newBusiness?.apps ?? 0} apps · ${formatCurrency(data?.newBusiness?.api ?? 0)}`,
              emphasize: true,
            },
            {
              label: 'PPP increases',
              value: `${data?.pppIncreases?.apps ?? 0} app${(data?.pppIncreases?.apps ?? 0) === 1 ? '' : 's'} · ${formatCurrency(data?.pppIncreases?.apiIncrease ?? 0)} API`,
            },
            {
              label: `Lumpsums (10% of ${formatCurrency(data?.lumpsums?.grossAmount ?? 0)})`,
              value: formatCurrency(lumpsumCredit),
            },
          ]}
        />
      </ReviewSection>

      {/* Activity section — backToStep 3 */}
      <ReviewSection
        eyebrow="ACTIVITY"
        backToStep={3}
        testid="wizard-v2-review-section-activity"
        onEditStep={onEditStep}
      >
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <Tile eyebrow="CALLS" value={liveCalls} sub="across 5 categories" testid="wizard-v2-review-tile-calls" />
          <Tile eyebrow="NAMES" value={liveNames} sub="new prospects added" testid="wizard-v2-review-tile-names" />
          <Tile
            eyebrow="CIs"
            value={data?.ciConducted ?? 0}
            sub={`${data?.newCIBooked ?? 0} new + ${data?.oldCIBooked ?? 0} old booked`}
            testid="wizard-v2-review-tile-cis"
          />
          <Tile eyebrow="CONV." value={`${liveConv}%`} sub="CI → app" testid="wizard-v2-review-tile-conv" />
        </div>
      </ReviewSection>

      {/* Reflection section — backToStep 10 */}
      <ReviewSection
        eyebrow="REFLECTION"
        backToStep={10}
        testid="wizard-v2-review-section-reflection"
        onEditStep={onEditStep}
      >
        <div className="flex gap-1.5 mt-1">
          {[
            { lbl: 'Plan',     val: data?.ratingPlanning ?? 0 },
            { lbl: 'Time',     val: data?.ratingTimeManagement ?? 0 },
            { lbl: 'Sales',    val: data?.ratingSalesPerformance ?? 0 },
            { lbl: 'Prospect', val: data?.ratingProspecting ?? 0 },
            { lbl: 'Overall',  val: data?.ratingOverall ?? 0, hero: true },
          ].map((r) => (
            <div
              key={r.lbl}
              className={`flex-1 text-center px-1 py-2 rounded-lg border ${
                r.hero
                  ? 'bg-primary-tint border-primary/30'
                  : 'bg-surface-raised border-border/60'
              }`}
            >
              <p
                className={`text-[8.5px] font-bold font-mono uppercase tracking-widest ${
                  r.hero ? 'text-primary' : 'text-ink-faint'
                }`}
              >
                {r.lbl.toUpperCase()}
              </p>
              <p
                className={`text-lg font-display font-bold mt-1 leading-none ${
                  r.hero ? 'text-primary' : 'text-ink'
                }`}
                style={{ letterSpacing: '-0.018em' }}
              >
                {r.val}
                <span className="text-[10px] font-mono font-semibold text-ink-faint ml-px">
                  /10
                </span>
              </p>
            </div>
          ))}
        </div>
        {data?.notes && data.notes.trim().length > 0 && (
          <p
            data-testid="wizard-v2-review-notes"
            className="text-[11px] text-ink-muted mt-2 px-2.5 py-2 italic leading-snug rounded-lg bg-surface-raised"
          >
            &ldquo;{data.notes}&rdquo;
          </p>
        )}
      </ReviewSection>

      {/* Next Week Goals section — backToStep 11 */}
      <ReviewSection
        eyebrow="NEXT WEEK GOALS"
        backToStep={11}
        testid="wizard-v2-review-section-goals"
        onEditStep={onEditStep}
      >
        <div className="grid grid-cols-4 gap-2 mt-0.5">
          <Tile eyebrow="CALLS" value={data?.targetTelContacts ?? 0} sub={null} testid="wizard-v2-review-goal-calls" tight />
          <Tile eyebrow="FFI"   value={data?.targetFFI ?? 0}         sub={null} testid="wizard-v2-review-goal-ffi" tight />
          <Tile eyebrow="CI"    value={data?.targetCI ?? 0}          sub={null} testid="wizard-v2-review-goal-ci" tight />
          <Tile eyebrow="API"   value={formatCurrency(data?.targetAPI ?? 0)} sub={null} testid="wizard-v2-review-goal-api" tight />
        </div>
        {data?.goalNotes && data.goalNotes.trim().length > 0 && (
          <p
            data-testid="wizard-v2-review-goal-notes"
            className="text-[11px] text-ink-muted mt-2 px-2.5 py-2 italic leading-snug rounded-lg bg-surface-raised"
          >
            &ldquo;{data.goalNotes}&rdquo;
          </p>
        )}
      </ReviewSection>
    </div>
  );
}

// ─── ReviewSection ──────────────────────────────────────────────────────────

function ReviewSection({ eyebrow, backToStep, children, testid, onEditStep }) {
  return (
    <section
      data-testid={testid}
      className="rounded-xl bg-card border border-border/60 px-4 py-3.5"
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          {eyebrow}
        </p>
        <button
          type="button"
          onClick={() => onEditStep?.(backToStep)}
          data-testid={`${testid}-edit`}
          aria-label={`Edit step ${backToStep}`}
          className="h-11 inline-flex items-center gap-1.5 px-3 rounded-full bg-primary-tint text-primary text-[10px] font-bold font-mono tracking-wide border border-primary/20 hover:bg-primary/15 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Edit · Step {backToStep}
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  );
}

// ─── Atoms ─────────────────────────────────────────────────────────────────

function RowList({ rows }) {
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex items-center justify-between py-2 ${
            i < rows.length - 1 ? 'border-b border-border/60' : ''
          }`}
        >
          <span className="text-xs text-ink-muted">{r.label}</span>
          <span
            className={`text-xs font-bold text-ink ${r.emphasize ? 'font-display' : ''}`}
            style={{ letterSpacing: '-0.005em' }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Tile({ eyebrow, value, sub, testid, tight = false }) {
  return (
    <div
      data-testid={testid}
      className={`rounded-lg bg-surface-raised border border-border/60 ${tight ? 'px-2.5 py-2 text-center' : 'px-3 py-2.5'}`}
    >
      <p
        className={`text-[9px] font-bold font-mono uppercase tracking-widest text-ink-faint ${tight ? '' : ''}`}
      >
        {eyebrow}
      </p>
      <p
        data-testid={`${testid}-value`}
        className={`font-display font-bold text-ink leading-none ${tight ? 'text-sm mt-1' : 'text-lg mt-1.5'}`}
        style={{ letterSpacing: '-0.018em' }}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}
