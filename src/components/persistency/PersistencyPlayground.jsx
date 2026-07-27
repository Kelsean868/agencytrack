// E3 — Persistency Playground (S3a: two-lever redesign).
//
// Two primary levers only per D2:
//   newBusinessPlanned      → clean API/quarter (adds to gross settled, TTD)
//   newReinstatementsPlanned → policies-saved/month (adds to net only, TTD)
// goodBusinessFallingOff / newOrphansAdopted / newLapsesAnticipated held at zero;
// named in the provenance line per D3.

import React, { useMemo, useState } from 'react';
import { X, Calculator, ExternalLink, AlertCircle } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import {
  projectPersistency,
  calculateShortfall,
  PERS_FLOOR,
  PERS_GATE,
} from '../../lib/persistency/calculations';
import { formatCurrency } from '../../utils/formatters';

const LEVERS = [
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
];

const ZERO_LEVERS = { newBusinessPlanned: 0, newReinstatementsPlanned: 0 };

function formatPct(decimal) {
  if (!Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

function bandClass(decimal) {
  if (!Number.isFinite(decimal)) return 'bg-border/40 text-ink-muted';
  if (decimal >= PERS_GATE)  return 'bg-success/15 text-success-ink';
  if (decimal >= PERS_FLOOR) return 'bg-warning/15 text-warning-ink';
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
}) {
  const modalRef = useFocusTrap({ onEscape: onClose });

  const current = useMemo(() => ({
    grossSettled:   currentRecord?.grossSettled   ?? 0,
    lapses:         currentRecord?.lapses         ?? 0,
    reinstatements: currentRecord?.reinstatements ?? 0,
    persistency:    currentRecord?.persistency    ?? 0,
  }), [currentRecord]);

  const [levers, setLevers] = useState(ZERO_LEVERS);

  const projection = useMemo(() => projectPersistency({
    currentGrossSettled:      current.grossSettled,
    currentLapses:            current.lapses,
    currentReinstatements:    current.reinstatements,
    goodBusinessFallingOff:   0,
    newBusinessPlanned:       levers.newBusinessPlanned,
    newReinstatementsPlanned: levers.newReinstatementsPlanned,
    newOrphansAdopted:        0,
    newLapsesAnticipated:     0,
  }), [current, levers]);

  const shortfall = useMemo(() => calculateShortfall({
    targetPersistency:     PERS_GATE,
    currentGrossSettled:   current.grossSettled,
    currentLapses:         current.lapses,
    currentReinstatements: current.reinstatements,
    goodBusinessFallingOff: 0,
  }), [current]);

  function handleReset() {
    setLevers(ZERO_LEVERS);
  }

  const proj = projection.projectedPersistency;
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
                <p className="text-ink-muted">Projected Gross</p>
                <p className="font-semibold text-ink tabular-nums">{formatCurrency(projection.projectedGrossSettled)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Projected Net</p>
                <p className="font-semibold text-ink tabular-nums">{formatCurrency(projection.projectedNetSettled)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Projected via: New Business Planned (TTD) + Reinstatements Planned (TTD) — goodBusinessFallingOff / orphansAdopted / newLapses held at zero.
            </p>
          </div>

          {/* ── Lever sliders ── */}
          <div className="flex flex-col gap-3">
            {LEVERS.map((lv) => (
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

          {/* ── Shortfall cards (D5 — to reach 90% gate) ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
              Needed to reach {formatPct(PERS_GATE)} (independent per lever)
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="card flex flex-col gap-1" data-testid="playground-shortfall-card-nb">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Via New Business</p>
                <p className="font-bold text-ink text-sm">{shortfallText(shortfall.nbNeeded)}</p>
              </div>
              <div className="card flex flex-col gap-1" data-testid="playground-shortfall-card-nr">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Via Reinstatements</p>
                <p className="font-bold text-ink text-sm">{shortfallText(shortfall.nrNeeded)}</p>
              </div>
            </div>
          </div>

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
