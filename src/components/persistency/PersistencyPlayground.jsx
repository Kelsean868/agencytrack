// E3 — Persistency Playground.
//
// Interactive what-if calculator. Used by both agents (own data, mode='self')
// and managers (any agent's data, mode='coaching'). Sliders update a projection
// in real time via projectPersistency(); three "shortfall" cards show the
// minimum lever value to reach the target, isolated per lever, via
// calculateShortfall().

import React, { useMemo, useState } from 'react';
import { X, Calculator, Target, AlertCircle } from 'lucide-react';
import { projectPersistency, calculateShortfall } from '../../lib/persistency/calculations';
import { formatCurrency } from '../../utils/formatters';

const SLIDERS = [
  { id: 'goodBusinessFallingOff',  label: 'Good Business Falling Off',  min: 0, max: 1_000_000, step: 5000 },
  { id: 'newBusinessPlanned',      label: 'New Business to Place',      min: 0, max: 1_000_000, step: 5000 },
  { id: 'newReinstatementsPlanned',label: 'New Reinstatements',         min: 0, max: 200_000,   step: 1000 },
  { id: 'newOrphansAdopted',       label: 'New Orphans Adopted',        min: 0, max: 500_000,   step: 5000 },
  { id: 'newLapsesAnticipated',    label: 'New Lapses Anticipated',     min: 0, max: 500_000,   step: 5000 },
];

function formatPct(decimal) {
  if (!Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

function badgeClass(decimal) {
  if (!Number.isFinite(decimal)) return 'bg-border/40 text-ink-muted';
  if (decimal >= 0.90) return 'bg-success/15 text-success';
  if (decimal >= 0.80) return 'bg-warning/15 text-warning';
  return 'bg-danger/15 text-danger';
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
}) {
  const current = useMemo(() => ({
    grossSettled:   currentRecord?.grossSettled   ?? 0,
    lapses:         currentRecord?.lapses         ?? 0,
    reinstatements: currentRecord?.reinstatements ?? 0,
    persistency:    currentRecord?.persistency    ?? 0,
  }), [currentRecord]);

  const [target, setTarget]   = useState(0.92);
  const [levers, setLevers]   = useState({
    goodBusinessFallingOff:  0,
    newBusinessPlanned:      0,
    newReinstatementsPlanned: 0,
    newOrphansAdopted:       0,
    newLapsesAnticipated:    0,
  });

  const projection = useMemo(() => projectPersistency({
    currentGrossSettled:   current.grossSettled,
    currentLapses:         current.lapses,
    currentReinstatements: current.reinstatements,
    ...levers,
  }), [current, levers]);

  const shortfall = useMemo(() => calculateShortfall({
    targetPersistency:     target,
    currentGrossSettled:   current.grossSettled,
    currentLapses:         current.lapses,
    currentReinstatements: current.reinstatements,
    goodBusinessFallingOff: levers.goodBusinessFallingOff,
  }), [target, current, levers.goodBusinessFallingOff]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Persistency Playground"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="persistency-playground"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-auto bg-card rounded-2xl shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Persistency Playground · {mode === 'coaching' ? 'Coaching' : 'My data'}
              </p>
              <p className="text-base font-semibold text-ink">{agentName ?? 'Agent'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-card-raised flex items-center justify-center text-ink-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!currentRecord && (
          <div className="m-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning flex items-center gap-2">
            <AlertCircle size={14} /> No persistency record yet for this agent — Playground uses zero baselines.
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 p-4">
          {/* Current state */}
          <div className="card flex flex-col gap-2" data-testid="playground-current-state">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Current state</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-ink-muted">Gross Settled</p>
                <p className="font-semibold text-ink">{formatCurrency(current.grossSettled)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Lapses</p>
                <p className="font-semibold text-ink">{formatCurrency(current.lapses)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Reinstatements</p>
                <p className="font-semibold text-ink">{formatCurrency(current.reinstatements)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Persistency</p>
                <p className="font-semibold text-ink">{formatPct(current.persistency)}</p>
              </div>
            </div>
          </div>

          {/* Target */}
          <div className="card flex flex-col gap-2" data-testid="playground-target">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted flex items-center gap-1.5">
              <Target size={12} /> Target persistency
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.80"
                max="1.00"
                step="0.005"
                value={target}
                onChange={(e) => setTarget(parseFloat(e.target.value))}
                className="flex-1 accent-[color:var(--color-primary)]"
                data-testid="playground-target-slider"
                aria-label="Target persistency"
              />
              <span className="font-bold text-ink text-base w-16 text-right tabular-nums">
                {formatPct(target)}
              </span>
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-3 p-4 pt-0">
          {SLIDERS.map((s) => (
            <div key={s.id} className="card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor={`pg-${s.id}`} className="text-xs font-semibold text-ink">{s.label}</label>
                <span className="text-xs font-semibold text-ink tabular-nums">
                  {formatCurrency(levers[s.id])}
                </span>
              </div>
              <input
                id={`pg-${s.id}`}
                data-testid={`playground-slider-${s.id}`}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={levers[s.id]}
                onChange={(e) => setLevers({ ...levers, [s.id]: parseFloat(e.target.value) || 0 })}
                className="accent-[color:var(--color-primary)]"
              />
            </div>
          ))}
        </div>

        {/* Output */}
        <div className="p-4 pt-0 flex flex-col gap-3">
          <div className="card flex flex-col gap-1" data-testid="persistency-projected-output">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Projected persistency</p>
            <div className="flex items-baseline gap-3">
              <span
                className={`px-3 py-1.5 rounded-lg text-3xl font-bold ${badgeClass(projection.projectedPersistency)}`}
              >
                {formatPct(projection.projectedPersistency)}
              </span>
              <span className="text-xs text-ink-muted">
                vs. target {formatPct(target)} — {projection.projectedPersistency >= target ? 'on track' : 'short'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mt-1">
              <div>
                <p className="text-ink-muted">Projected Gross Settled</p>
                <p className="font-semibold text-ink">{formatCurrency(projection.projectedGrossSettled)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Projected Net Settled</p>
                <p className="font-semibold text-ink">{formatCurrency(projection.projectedNetSettled)}</p>
              </div>
            </div>
          </div>

          {/* Shortfall cards */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card flex flex-col gap-1" data-testid="playground-shortfall-card-nb">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Via New Business</p>
              <p className="font-bold text-ink text-base">{shortfallText(shortfall.nbNeeded)}</p>
            </div>
            <div className="card flex flex-col gap-1" data-testid="playground-shortfall-card-nr">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Via Reinstatements</p>
              <p className="font-bold text-ink text-base">{shortfallText(shortfall.nrNeeded)}</p>
            </div>
            <div className="card flex flex-col gap-1" data-testid="playground-shortfall-card-no">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Via Orphan Adoption</p>
              <p className="font-bold text-ink text-base">{shortfallText(shortfall.noNeeded)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-border text-sm font-semibold text-ink hover:bg-card-raised transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
