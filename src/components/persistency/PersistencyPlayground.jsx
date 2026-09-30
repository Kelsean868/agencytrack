// E3 — Persistency Playground (S3a: two-lever redesign; P4: 24-month levers).
//
// Two primary levers per D2:
//   newBusinessPlanned      → clean API/quarter (adds to gross settled, TTD)
//   newReinstatementsPlanned → policies-saved/month (adds to net only, TTD)
// Two more from P4, wiring what D2/D3 held at zero:
//   goodBusinessFallingOff  → business rolling out of the window (both models)
//   decreasesAnticipated    → premium decreases on in-force policies
//                              (24-month-model months only — see modelOrNull below)
// newOrphansAdopted / newLapsesAnticipated remain out of scope, still held at zero.

import React, { useMemo, useState } from 'react';
import { X, Calculator, ExternalLink, AlertCircle } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import AnnuityRuleSwitch from './AnnuityRuleSwitch';
import { buildLedgerPrefill } from '../../lib/persistency/ledgerPrefill';
import { DEFAULT_ANNUITY_MISSED_PREMIUM_RULE } from '../../lib/persistency/deriveFromLedger';
import { useConfigContext } from '../../context/ConfigProvider';
import {
  projectPersistency,
  calculateShortfall,
  PERS_FLOOR,
  PERS_GATE,
  PERS_FLOOR_PCT,
  PERS_GATE_PCT,
} from '../../lib/persistency/calculations';
import { persistencyModelFor, PERSISTENCY_MODEL_24M_EFFECTIVE_FROM } from '../../lib/persistency/model';
import { formatCurrency } from '../../utils/formatters';
import { roundPersistencyPct, formatPersistencyPct } from '../../lib/persistency/persistencyRounding';

const BASE_LEVERS = [
  {
    id: 'newBusinessPlanned',
    label: 'New Business to Place',
    sublabel: 'clean API / quarter (TTD)',
    min: 0,
    max: 1_000_000,
    step: 5000,
  },
  {
    id: 'newReinstatementsPlanned',
    label: 'Policies Saved / Month',
    sublabel: 'reinstatement value (TTD)',
    min: 0,
    max: 200_000,
    step: 1000,
  },
  {
    id: 'goodBusinessFallingOff',
    label: 'Business Rolling Off',
    sublabel: 'good business leaving the window (TTD)',
    min: 0,
    max: 500_000,
    step: 5000,
  },
];

// Shown only on a 24-month-model month — see modelOrNull / isTwentyFourMonth below.
const DECREASES_LEVER = {
  id: 'decreasesAnticipated',
  label: 'Decreases Expected',
  sublabel: 'premium reductions on in-force policies (TTD)',
  min: 0,
  max: 500_000,
  step: 5000,
};

const ZERO_LEVERS = {
  newBusinessPlanned: 0,
  newReinstatementsPlanned: 0,
  goodBusinessFallingOff: 0,
  decreasesAnticipated: 0,
};

// persistencyModelFor throws on a malformed monthKey (deliberately — see
// lib/persistency/model.js). The Playground is a read-only planning surface,
// not a save path, so an unusable monthKey must degrade to "no model" rather
// than take the modal down: hide the decreases lever, show no model line.
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;
function modelOrNull(monthKey) {
  return MONTH_KEY_RE.test(String(monthKey)) ? persistencyModelFor(monthKey) : null;
}

function formatMonthYear(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return `${new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' })} ${year}`;
}

// Derived from the model object (windowMonths) plus the single dated boundary
// in lib/persistency/model.js, rather than two hand-typed sentence literals —
// so this line cannot drift out of step with persistencyModelFor.
function modelHeaderLine(model) {
  if (!model) return null;
  if (model.id === 'tatil24') {
    return `${model.windowMonths}-month model · ${formatMonthYear(PERSISTENCY_MODEL_24M_EFFECTIVE_FROM)} onwards`;
  }
  const [effYear, effMonth] = PERSISTENCY_MODEL_24M_EFFECTIVE_FROM.split('-').map(Number);
  const priorMonthKey = effMonth === 1
    ? `${effYear - 1}-12`
    : `${effYear}-${String(effMonth - 1).padStart(2, '0')}`;
  return `${model.windowMonths}-month model · through ${formatMonthYear(priorMonthKey)}`;
}

// Ruling R-a: 2 decimals, half up; the band is judged on that same value.
function formatPct(decimal) {
  if (!Number.isFinite(decimal)) return '—';
  return formatPersistencyPct(decimal * 100);
}

function bandClass(decimal) {
  if (!Number.isFinite(decimal)) return 'bg-border/40 text-ink-muted';
  const shown = roundPersistencyPct(decimal * 100);
  if (shown >= PERS_GATE_PCT)  return 'bg-success/15 text-success-ink';
  if (shown >= PERS_FLOOR_PCT) return 'bg-warning/15 text-warning-ink';
  return 'bg-danger/15 text-danger-ink';
}

function shortfallText(value) {
  if (value === Infinity) return 'Not achievable via this lever alone';
  if (value <= 0) return 'Already at or above target';
  return `${formatCurrency(value)} needed`;
}

export default function PersistencyPlayground({
  mode = 'self',
  agentName,
  currentRecord,
  onClose,
  onViewLapsedPolicies,
  // P3 — optional ledger. Absent means the pre-P3 Playground, unchanged.
  ledgerDocs = null,
  ledgerExportDate = null,
}) {
  const modalRef = useFocusTrap({ onEscape: onClose });

  // The annuity rule is LOCAL to the Playground: this is a what-if surface, so
  // flipping it here must never write anything or change what the tab shows.
  const [annuityRule, setAnnuityRule] = useState(DEFAULT_ANNUITY_MISSED_PREMIUM_RULE);

  const ledgerPrefill = useMemo(() => {
    const mk = currentRecord?.monthKey;
    if (!ledgerDocs || !mk || !/^\d{4}-\d{2}$/.test(String(mk))) return null;
    return buildLedgerPrefill(ledgerDocs, {
      monthKey: mk,
      exportDate: ledgerExportDate,
      annuityMissedPremiumRule: annuityRule,
    });
  }, [ledgerDocs, currentRecord, ledgerExportDate, annuityRule]);

  // P5 — how an adopted orphan is counted is a tenant setting, because
  // persistency counting rules vary by carrier. Read from the already-hydrated
  // companyMinimums doc (ConfigProvider), NOT from calculations.js, which stays
  // pure. useConfigContext returns null outside a provider, so the `?.` chain
  // and the `=== true` test both fail closed onto the default: an adopted
  // orphan lifts the numerator only.
  const configCtx = useConfigContext();
  const orphansEnterDenominator =
    configCtx?.docs?.companyMinimums?.orphanAdoptionEntersDenominator === true;

  const current = useMemo(() => ({
    grossSettled:   currentRecord?.grossSettled   ?? 0,
    lapses:         currentRecord?.lapses         ?? 0,
    reinstatements: currentRecord?.reinstatements ?? 0,
    persistency:    currentRecord?.persistency    ?? 0,
  }), [currentRecord]);

  const model = useMemo(() => modelOrNull(currentRecord?.monthKey), [currentRecord]);
  const isTwentyFourMonth = model?.id === 'tatil24';

  const activeLevers = useMemo(
    () => (isTwentyFourMonth ? [...BASE_LEVERS, DECREASES_LEVER] : BASE_LEVERS),
    [isTwentyFourMonth],
  );

  const [levers, setLevers] = useState(ZERO_LEVERS);

  const projection = useMemo(() => projectPersistency({
    currentGrossSettled:      current.grossSettled,
    currentLapses:            current.lapses,
    currentReinstatements:    current.reinstatements,
    goodBusinessFallingOff:   levers.goodBusinessFallingOff,
    newBusinessPlanned:       levers.newBusinessPlanned,
    newReinstatementsPlanned: levers.newReinstatementsPlanned,
    newOrphansAdopted:        0,
    newLapsesAnticipated:     0,
    decreasesAnticipated:     levers.decreasesAnticipated,
    orphansEnterDenominator,
  }), [current, levers, orphansEnterDenominator]);

  const shortfall = useMemo(() => calculateShortfall({
    targetPersistency:      PERS_GATE,
    currentGrossSettled:    current.grossSettled,
    currentLapses:          current.lapses,
    currentReinstatements:  current.reinstatements,
    goodBusinessFallingOff: levers.goodBusinessFallingOff,
    decreasesAnticipated:   levers.decreasesAnticipated,
    orphansEnterDenominator,
  }), [current, levers, orphansEnterDenominator]);

  function handleReset() {
    setLevers(ZERO_LEVERS);
  }

  // P4c — tell "no data yet" apart from "this plan is impossible". With no
  // settled business on record, projectedGross starts at (and stays at) 0
  // regardless of any lever — current.grossSettled never moves when a slider
  // does — so the P4b danger message would fire at rest, before the agent
  // touches anything, and blame them for two sliders they never moved. The
  // discriminator is current.grossSettled, not the projection. See §2 of the
  // P4c brief for the three-state table this implements.
  const isNothingToPlanFrom = current.grossSettled <= 0;

  // P4b — guard the impossible plan. P4's subtractive levers (goodBusinessFallingOff,
  // decreasesAnticipated) can drive projectedGross to zero or below; a negative
  // divided by a negative then renders as a plausible-looking positive ratio
  // (see calculations.js projectPersistency). The condition is projectedGross
  // <= 0, NEVER `persistency > 1` — persistency legitimately exceeds 100% when
  // an orphan reinstatement lands in net without ever being in gross (P-D10 /
  // §2 of the P4b brief), and that case must render normally, un-clamped.
  // Narrowed to `current.grossSettled > 0` per P4c: this message means "the
  // PLAN broke it", so it must not fire when there was nothing to break.
  const isImpossiblePlan = !isNothingToPlanFrom && projection.projectedGrossSettled <= 0;

  const noProjectedFigure = isNothingToPlanFrom || isImpossiblePlan;
  const proj = noProjectedFigure ? NaN : projection.projectedPersistency;
  const curr = current.persistency;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Persistency Playground"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="persistency-playground"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-card rounded-2xl shadow-lg flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                What-If Playground · {mode === 'coaching' ? 'Coaching' : 'My data'}
              </p>
              {model && (
                <p className="text-[11px] text-ink-muted" data-testid="playground-model-line">
                  {modelHeaderLine(model)}
                </p>
              )}
              <p className="text-base font-semibold text-ink">{agentName ?? 'Agent'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 -m-1 rounded-lg hover:bg-card-raised flex items-center justify-center text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!currentRecord && (
          <div className="m-4 mb-0 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning-ink flex items-center gap-2">
            <AlertCircle size={14} /> No persistency record yet — Playground uses zero baselines.
          </div>
        )}

        <div className="p-4 flex flex-col gap-4">

          {/* ── Current vs Projected band ── */}
          <div className="card" data-testid="playground-projection-band">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
              Current vs Projected
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-ink-muted">Current</span>
                <span
                  className={`px-3 py-1.5 rounded-lg text-2xl font-bold tabular-nums ${bandClass(curr)}`}
                  data-testid="playground-current-pct"
                >
                  {formatPct(curr)}
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-1 min-w-[160px]">
                {/* Two-tick band: 80 floor / 90 gate */}
                <div className="relative h-6 rounded-full bg-border/30 overflow-hidden" aria-hidden="true">
                  <div className="absolute inset-y-0 left-0 bg-danger/30" style={{ width: `${PERS_FLOOR * 100}%` }} />
                  <div className="absolute inset-y-0 bg-warning/30" style={{ left: `${PERS_FLOOR * 100}%`, width: `${(PERS_GATE - PERS_FLOOR) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-success/30" style={{ left: `${PERS_GATE * 100}%`, right: 0 }} />
                  {/* Tick at 80% */}
                  <div className="absolute inset-y-0 w-px bg-warning-ink/60" style={{ left: `${PERS_FLOOR * 100}%` }} />
                  {/* Tick at 90% */}
                  <div className="absolute inset-y-0 w-px bg-success-ink/60" style={{ left: `${PERS_GATE * 100}%` }} />
                  {/* Projected marker */}
                  {Number.isFinite(proj) && (
                    <div
                      className="absolute inset-y-0 w-1 rounded-full bg-ink"
                      style={{ left: `${Math.max(0, Math.min(proj, 1)) * 100}%`, transform: 'translateX(-50%)' }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-ink-muted px-0.5">
                  <span>0%</span>
                  <span>{formatPct(PERS_FLOOR)} floor</span>
                  <span>{formatPct(PERS_GATE)} gate</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-ink-muted">Projected</span>
                <span
                  className={`px-3 py-1.5 rounded-lg text-2xl font-bold tabular-nums ${bandClass(proj)}`}
                  data-testid="playground-projected-pct"
                >
                  {formatPct(proj)}
                </span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs" data-testid="persistency-projected-output">
              <div>
                <p className="text-ink-muted">Projected Net Gross</p>
                <p className="font-semibold text-ink tabular-nums">{formatCurrency(projection.projectedGrossSettled)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Projected Net</p>
                <p className="font-semibold text-ink tabular-nums">{formatCurrency(projection.projectedNetSettled)}</p>
              </div>
            </div>
            {isNothingToPlanFrom && (
              <p className="mt-2 text-xs text-ink-muted font-semibold" data-testid="playground-nothing-to-plan-warning">
                No settled business recorded for this month yet — there is nothing to project from.
              </p>
            )}
            {isImpossiblePlan && (
              <p className="mt-2 text-xs text-danger-ink font-semibold" data-testid="playground-negative-denominator-warning">
                This plan drives Net Gross Settled to zero or below — lower Decreases Expected or Business Rolling Off.
              </p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              Projected via: New Business Planned + Reinstatements Planned − Business Rolling Off
              {isTwentyFourMonth ? ' − Decreases Expected' : ''} (TTD) — orphans adopted / new lapses anticipated held at zero.
            </p>
          </div>

          {/* ── Lever sliders ── */}
          <div className="flex flex-col gap-3">
            {activeLevers.map((lv) => (
              <div key={lv.id} className="card flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor={`pg-${lv.id}`} className="text-xs font-semibold text-ink block">{lv.label}</label>
                    <span className="text-xs text-ink-muted">{lv.sublabel}</span>
                  </div>
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {formatCurrency(levers[lv.id])}
                  </span>
                </div>
                <input
                  id={`pg-${lv.id}`}
                  data-testid={`playground-slider-${lv.id}`}
                  type="range"
                  min={lv.min}
                  max={lv.max}
                  step={lv.step}
                  value={levers[lv.id]}
                  onChange={(e) => setLevers((prev) => ({ ...prev, [lv.id]: parseFloat(e.target.value) || 0 }))}
                  className="accent-primary"
                  aria-label={lv.label}
                />
              </div>
            ))}
          </div>

          {/* ── Shortfall cards (D5 — to reach 90% gate) ──
              P4c: suppressed entirely with nothing to plan from (§3.1). During
              an impossible plan, calculateShortfall's baseline <= 0 sentinel
              already returns zeros, and shortfallText(0) reads "Already at or
              above target" — a false statement while the danger message above
              is telling the agent the opposite. Read honestly as "—" instead;
              the danger message already carries the explanation, so this is
              not a second warning sentence (§3.3). */}
          {!isNothingToPlanFrom && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
                Needed to reach {formatPct(PERS_GATE)} (independent per lever)
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="card flex flex-col gap-1" data-testid="playground-shortfall-card-nb">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Via New Business</p>
                  <p className="font-bold text-ink text-sm">
                    {isImpossiblePlan ? '—' : shortfallText(shortfall.nbNeeded)}
                  </p>
                </div>
                <div className="card flex flex-col gap-1" data-testid="playground-shortfall-card-nr">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Via Reinstatements</p>
                  <p className="font-bold text-ink text-sm">
                    {isImpossiblePlan ? '—' : shortfallText(shortfall.nrNeeded)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── D4: lapsed policies link (self mode only) ── */}
          {mode === 'self' && onViewLapsedPolicies && (
            <div className="card flex items-center justify-between gap-3" data-testid="playground-lapsed-link">
              <p className="text-sm text-ink-muted">
                Review your lapsed policies to identify reinstatement opportunities.
              </p>
              <button
                type="button"
                onClick={() => { onClose(); onViewLapsedPolicies(); }}
                className="shrink-0 h-9 px-3 rounded-lg border border-border text-xs font-semibold text-primary hover:bg-card-raised transition-colors flex items-center gap-1.5"
                data-testid="playground-view-lapsed-btn"
              >
                <ExternalLink size={12} /> View Lapsed Policies
              </button>
            </div>
          )}
        </div>

        {/* ── P3: the annuity rule and what it would cost ──────────────── */}
        {ledgerPrefill?.hasLedger && (
          <div className="px-4 pb-4 flex flex-col gap-3" data-testid="playground-annuity-block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                Annuity missed premiums
              </p>
              <AnnuityRuleSwitch value={annuityRule} onChange={setAnnuityRule} />
            </div>

            <div className="p-3 rounded-xl bg-card-raised border border-border" data-testid="playground-at-risk">
              <p className="text-xs font-semibold text-ink mb-1">
                {`At-risk annuities — ${ledgerPrefill.ledger.atRisk.annuities.length}`}
              </p>
              {ledgerPrefill.ledger.atRisk.annuities.length === 0 ? (
                <p className="text-xs text-ink-muted">None behind on premium.</p>
              ) : (
                <>
                  <p className="text-xs text-ink-muted mb-2">
                    {`${formatCurrency(ledgerPrefill.ledger.atRisk.annuityApiTotal)} of API. `}
                    {`Ignored: ${formatPct(ledgerPrefill.ledger.atRisk.persistencyUnderIgnore)} · `}
                    {`counted as lapse: ${formatPct(ledgerPrefill.ledger.atRisk.persistencyUnderLapse)}`}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {ledgerPrefill.ledger.atRisk.annuities.map((a) => (
                      <li key={a.policyNumber} className="flex items-center gap-2 text-xs" data-testid="playground-at-risk-row">
                        <span className="font-mono text-ink flex-1 min-w-0 truncate">{a.policyNumber}</span>
                        <span className="text-ink-muted">paid to {a.paidToDate ?? '—'}</span>
                        <span className="text-ink-muted tabular-nums">{formatCurrency(a.api)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {ledgerPrefill.ledger.atRisk.pendingDeathClaims.length > 0 && (
              <div className="flex gap-2.5 p-3 rounded-xl bg-gold-tint" data-testid="playground-death-claim">
                <AlertCircle size={14} className="text-gold-ink shrink-0 mt-0.5" />
                <p className="text-sm text-gold-ink leading-snug">
                  {`Pending death claim: ${ledgerPrefill.ledger.atRisk.pendingDeathClaims.map((c) => c.policyNumber).join(', ')}. `}
                  <strong>Not a lapse.</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="p-4 border-t border-border flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="h-11 px-4 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-card-raised transition-colors"
            data-testid="playground-reset-btn"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-lg border border-border text-sm font-semibold text-ink hover:bg-card-raised transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
