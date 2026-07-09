/**
 * PersistencyV2Shell — flag-gated (`persistencyV2`) SHELL for the v2 rolling
 * persistency model (item 3.4). Mounted inside the agent PersistencyTab; the
 * whole surface is ABSENT unless the flag is ON, so with the flag OFF the tab
 * is byte-identical to its pre-3.4 behavior.
 *
 * Design source: `docs/design-system/screens-v2/persistency-lab.jsx`
 * (v1 ⇄ v2 engine toggle · 24-month self-expiry framing · per-policy weighting
 * list). Live per-policy persistency data does NOT exist yet (v2 engine pending
 * Tatil sign-off), so every figure here is derived from a documented
 * FIXTURE-SHAPE preview book and carried behind an explicit "pending Tatil
 * confirmation" banner — never presented as the agent's real persistency.
 *
 * Four states: loading (PanelSkeleton) · error (Retry) · empty (no preview
 * book) · populated (the interactive preview model).
 */
import React, { useMemo, useState } from 'react';
import { AlertCircle, FlaskConical, Info } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import {
  GATE, FLOOR, PREVIEW_BOOK, deriveRollingModel,
} from '../../lib/persistency/rollingModelV2';

const BAND_TEXT = {
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
};
const BAND_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

function fmtPct(n) {
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}
function fmtTTD(n) {
  const v = Number(n) || 0;
  return `TTD ${Math.round(v).toLocaleString()}`;
}

const FORMULAS = {
  v2: {
    title: 'Active formula · v2',
    body: 'Net impact = credits − debits, time-weighted over 24 months.',
    mono: 'debit = API × max(0, rem(lapse) − rem(reinstate)) ÷ 24\npersistency = (Σ API − Σ debit) ÷ Σ API × 100',
    foot: 'rem(m) = months remaining to 24. Early lapses cost more; reinstating recovers the remaining months; the impact self-expires at 24.',
  },
  v1: {
    title: 'Active formula · v1',
    body: 'Net settled ÷ gross settled — timing-blind.',
    mono: 'net = Σ API − Σ (open lapsed API)\npersistency = net ÷ gross × 100',
    foot: 'A lapse subtracts its full API for the whole reporting window regardless of when it happened. Reinstatement adds it back in full.',
  },
};

function ModelToggle({ model, onChange }) {
  const opts = [
    { v: 'v1', label: 'v1 · Ratio' },
    { v: 'v2', label: 'v2 · Rolling 24-mo' },
  ];
  return (
    <div
      className="inline-flex gap-1 p-1 rounded-xl bg-surface-muted border border-border"
      role="tablist"
      aria-label="Persistency model"
    >
      {opts.map((o) => {
        const on = model === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.v)}
            className={`min-h-[44px] px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              on ? 'bg-card text-ink shadow-sm border border-border' : 'text-ink-muted hover:text-ink'
            }`}
            data-testid={`persistency-v2-model-${o.v}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PersistencyV2Shell({
  book = PREVIEW_BOOK,
  loading = false,
  error = null,
  onRetry,
}) {
  const [model, setModel] = useState('v2');
  const derived = useMemo(() => deriveRollingModel(book, model), [book, model]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="persistency-v2-shell-loading">
        <PanelSkeleton variant="metric-row" count={1} label="Loading model preview…" />
        <PanelSkeleton variant="list" count={3} />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div
        role="alert"
        className="card flex items-center gap-2 text-sm text-danger-ink flex-wrap"
        data-testid="persistency-v2-shell-error"
      >
        <AlertCircle size={16} className="shrink-0" />
        <span className="flex-1">{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // ── Empty ──
  if (!derived) {
    return (
      <div
        className="card text-center py-10 flex flex-col items-center gap-3"
        data-testid="persistency-v2-shell-empty"
      >
        <div className="w-11 h-11 rounded-xl bg-primary-tint text-primary flex items-center justify-center">
          <FlaskConical size={20} aria-hidden="true" />
        </div>
        <p className="font-display font-extrabold text-[15px] text-ink">
          Rolling-model preview unavailable
        </p>
        <p className="text-xs text-ink-muted max-w-sm">
          The v2 rolling-24-month persistency model is pending Tatil confirmation.
          A worked preview appears here once its inputs are wired.
        </p>
      </div>
    );
  }

  const formula = FORMULAS[derived.model];

  // ── Populated (preview) ──
  return (
    <div className="flex flex-col gap-4" data-testid="persistency-v2-shell">
      {/* Header + model toggle */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-primary">
            Persistency model · v2 preview
          </p>
          <p className="text-sm text-ink mt-1">
            Flip the engine and watch the same book re-weight. Illustrative only.
          </p>
        </div>
        <ModelToggle model={model} onChange={setModel} />
      </div>

      {/* Pending-Tatil banner — the honest state */}
      <div
        className="card flex items-start gap-2 bg-warning-tint border-warning/30"
        data-testid="persistency-v2-pending-banner"
      >
        <Info size={16} className="text-warning-ink shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm text-ink">
          <p className="font-semibold">Preview — model pending Tatil confirmation.</p>
          <p className="text-xs text-ink-muted mt-1">
            The v2 rolling-24-month engine is not yet live. The figures below come
            from an illustrative sample book — they are not your persistency.
          </p>
        </div>
      </div>

      {/* NOW / GATE / FLOOR reference */}
      <div className="card flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-surface-muted p-3" data-testid="persistency-v2-now">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">Preview now</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${BAND_DOT[derived.band]}`} />
              <span className={`text-2xl font-bold tabular-nums ${BAND_TEXT[derived.band]}`}>
                {fmtPct(derived.current)}
              </span>
            </div>
            <p className="text-[10px] text-ink-muted font-mono mt-1">{derived.bandLabel}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">Award gate</p>
            <p className="text-2xl font-bold text-ink tabular-nums mt-1">{GATE}%</p>
            <p className="text-[10px] text-ink-muted font-mono mt-1">award-eligible</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">Company floor</p>
            <p className="text-2xl font-bold text-ink tabular-nums mt-1">{FLOOR}%</p>
            <p className="text-[10px] text-ink-muted font-mono mt-1">minimum</p>
          </div>
        </div>

        {/* Same book · both models */}
        <div>
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-2">
            Same book · both models
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { m: 'v1', label: 'Settled ratio', val: derived.v1pct },
              { m: 'v2', label: 'Rolling 24-mo', val: derived.v2pct },
            ].map((x) => {
              const on = derived.model === x.m;
              return (
                <button
                  key={x.m}
                  type="button"
                  onClick={() => setModel(x.m)}
                  aria-pressed={on}
                  className={`min-h-[44px] text-left rounded-xl p-3 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    on ? 'border-primary bg-primary-tint' : 'border-border bg-surface-muted hover:bg-surface'
                  }`}
                  data-testid={`persistency-v2-compare-${x.m}`}
                >
                  <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">{x.label}</p>
                  <p className="text-xl font-bold text-ink tabular-nums mt-1">{fmtPct(x.val)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active formula */}
      <div className="card flex flex-col gap-2" data-testid="persistency-v2-formula">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-primary">{formula.title}</p>
        <p className="text-sm font-semibold text-ink">{formula.body}</p>
        <pre className="text-[11px] leading-relaxed font-mono text-ink-muted bg-surface-muted border border-border rounded-lg p-3 whitespace-pre-wrap overflow-x-auto">
          {formula.mono}
        </pre>
        <p className="text-xs text-ink-muted leading-relaxed">{formula.foot}</p>
      </div>

      {/* Per-policy weighting list */}
      <div className="card flex flex-col gap-2" data-testid="persistency-v2-weighting">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          How each lapse is charged · {derived.model}
        </p>
        <div className="flex flex-col gap-2">
          {derived.weighting.map((w) => (
            <div key={w.id} className="flex items-center gap-3" data-testid={`persistency-v2-weight-${w.id}`}>
              <div className="w-24 shrink-0 min-w-0">
                <p className="text-xs font-semibold text-ink truncate" title={w.name}>{w.name}</p>
                <p className="text-[10px] text-ink-muted font-mono truncate">{fmtTTD(w.api)}</p>
              </div>
              <div className="flex-1 h-4 rounded-md bg-surface-muted overflow-hidden">
                <div
                  className={`h-full ${w.charged > 0 ? 'bg-danger' : 'bg-success'}`}
                  style={{ width: `${Math.max(2, w.pctCharged)}%` }}
                />
              </div>
              <span
                className={`w-24 text-right text-[11px] font-mono tabular-nums ${
                  w.charged > 0 ? 'text-danger-ink' : 'text-success-ink'
                }`}
              >
                −{fmtTTD(w.charged)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-ink-muted font-mono mt-1">
          Bar = share of policy API charged as a debit under {derived.model}.
        </p>
      </div>
    </div>
  );
}
