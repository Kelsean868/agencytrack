// ExceptionLeadPanel — the exception-first LEAD on the Team Dashboard
// (Fable 1.5, ported from screens-v2 manager-v2-shared.jsx ExceptionList).
//
// Agents needing attention surface FIRST, above the general roster/stats. Each
// row is a coaching entry point: click opens the AgentDrill coaching drawer.
// All values are pre-derived by deriveExceptions (canonical helpers only).
//
// Four states (§1): loading skeleton · error + Retry · honest "all clear" empty ·
// the ranked list. Rows are keyboard-operable (button semantics, 44px targets).
import React from 'react';
import { AlertTriangle, Clock, Target, FileWarning, ChevronRight, CheckCircle2 } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';

const TYPE_ICON = {
  floor: AlertTriangle,
  pace: Target,
  quiet: Clock,
  report: FileWarning,
};

// Reduced-motion-safe inline sparkline (trajectory of the at-risk metric).
// Theme-aware via currentColor set on the wrapper by tone.
function MiniSpark({ values }) {
  if (!values || values.length < 2) return <div className="w-14" aria-hidden="true" />;
  const W = 54;
  const H = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (W - 3) + 1.5;
      const y = H - 3 - ((v - min) / range) * (H - 5) + 1.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

function ExceptionRow({ e, onDrill }) {
  const Icon = TYPE_ICON[e.type] || AlertTriangle;
  const danger = e.tone === 'danger';
  const toneText = danger ? 'text-danger-ink' : 'text-warning-ink';
  const toneBg = danger ? 'bg-danger/10 border-danger/30' : 'bg-warning/10 border-warning/30';
  return (
    <button
      type="button"
      onClick={() => onDrill?.(e)}
      data-testid={`exception-row-${e.agentId}`}
      data-type={e.type}
      className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border bg-card text-left hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm">
        {e.initials}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink truncate">{e.name}</span>
        </span>
        <span className="block text-xs text-ink-muted mt-0.5 truncate">{e.detail}</span>
      </span>
      <span className={`shrink-0 ${toneText}`}>
        <MiniSpark values={e.spark} />
      </span>
      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${toneBg}`}>
        <Icon size={12} className={toneText} aria-hidden="true" />
        <span className={`text-[9px] font-bold font-mono uppercase tracking-wider ${toneText}`}>{e.kind}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-ink-muted" aria-hidden="true" />
    </button>
  );
}

export default function ExceptionLeadPanel({
  exceptions = [],
  loading = false,
  error = null,
  onRetry,
  onDrill,
}) {
  return (
    <div className="card mb-6" data-testid="exception-lead-panel">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-warning-ink">
          Needs attention · {loading ? '—' : exceptions.length}
        </p>
        <p className="text-[11px] text-ink-muted">Clears when the underlying state resolves</p>
      </div>

      {loading ? (
        <PanelSkeleton variant="list" count={3} label="Loading exceptions…" />
      ) : error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm"
          data-testid="exception-lead-error"
        >
          <span>Couldn&apos;t load the attention list.</span>
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
      ) : exceptions.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 p-8 rounded-xl bg-card border border-border text-center"
          data-testid="exception-lead-empty"
        >
          <CheckCircle2 size={26} className="text-success-ink" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">All clear</p>
          <p className="text-xs text-ink-muted max-w-xs">
            No agents are behind pace or missing reports right now. Recognition and stats are below.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 stagger" data-testid="exception-lead-list">
          {exceptions.map((e) => (
            <ExceptionRow key={e.id} e={e} onDrill={onDrill} />
          ))}
        </div>
      )}
    </div>
  );
}
