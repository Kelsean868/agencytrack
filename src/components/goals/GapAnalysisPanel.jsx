import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { computeGapAnalysis } from '../../utils/gapAnalysis';
import { formatCurrency } from '../../utils/formatters';

const LAYER_CONFIG = [
  { key: 'personal',           pctKey: 'ofPersonal',     gapKey: 'toPersonal',     label: 'Personal Commitment', barClass: 'bg-primary'   },
  { key: 'unitTarget',         pctKey: 'ofUnit',         gapKey: 'toUnit',         label: 'Unit Target',         barClass: 'bg-violet-600' },
  { key: 'branchTarget',       pctKey: 'ofBranch',       gapKey: 'toBranch',       label: 'Branch Target',       barClass: 'bg-warning'   },
  { key: 'salesManagerTarget', pctKey: 'ofSalesManager', gapKey: 'toSalesManager', label: 'SM Target',           barClass: 'bg-amber-400', alwaysRender: true },
  { key: 'companyFloor',       pctKey: 'ofFloor',        gapKey: 'toFloor',        label: 'Company Floor',       barClass: 'bg-danger'    },
];

function formatValue(val, isCurrency) {
  if (val === null || val === undefined) return null;
  return isCurrency ? formatCurrency(Math.round(val)) : String(Math.round(val));
}

function GapBadge({ gap, target, isCurrency }) {
  if (gap === null) return null;
  if (gap <= 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success-ink">
        <CheckCircle2 size={10} /> Met
      </span>
    );
  }
  const threshold = target > 0 ? target * 0.2 : Infinity;
  const isClose = gap <= threshold;
  const label = isCurrency ? `${formatCurrency(Math.round(gap))} to go` : `${Math.round(gap)} to go`;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
      isClose ? 'bg-warning/15 text-warning-ink' : 'bg-border/60 text-ink-muted'
    }`}>
      {label}
    </span>
  );
}

function MetricSection({ row, smTierMissing = false }) {
  const { label, isCurrency, actual, gaps, pcts } = row;
  const actualFmt = isCurrency ? formatCurrency(Math.round(actual)) : String(Math.round(actual));

  const layers = LAYER_CONFIG.filter(({ key, alwaysRender }) => alwaysRender || row[key] !== null);

  return (
    <div className="flex flex-col gap-3">
      {/* Metric header */}
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="text-xs text-ink-muted">YTD: <span className="font-semibold text-ink">{actualFmt}</span></p>
      </div>

      {/* Layer bars */}
      <div className="flex flex-col gap-2">
        {layers.map(({ key, pctKey, gapKey, label: layerLabel, barClass, alwaysRender }) => {
          const target    = row[key];
          const fillPct   = pcts[pctKey] ?? 0;
          const gapValue  = gaps[gapKey];
          const targetFmt = formatValue(target, isCurrency);
          const notSet    = alwaysRender && smTierMissing;

          return (
            <div
              key={key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap"
            >
              {/* Label takes its own line < sm so bar/target/badge fit together below */}
              <p className="text-[10px] font-semibold text-ink-muted w-full sm:w-36 sm:shrink-0 sm:truncate">
                {layerLabel}
              </p>
              <div className="flex-1 min-w-0 h-2 rounded-full bg-border/50 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${barClass}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <p className="text-[10px] text-ink-muted shrink-0 text-right sm:w-24">
                {notSet ? 'Not set' : targetFmt}
              </p>
              <div className="flex justify-end shrink-0 sm:w-24">
                {!notSet && <GapBadge gap={gapValue} target={target} isCurrency={isCurrency} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GapAnalysisPanel({ hierarchy, ytdTotals, loading, error = null, title = 'Goal Hierarchy' }) {
  const rows = useMemo(
    () => computeGapAnalysis(hierarchy, ytdTotals),
    [hierarchy, ytdTotals]
  );

  if (loading) {
    return (
      <div className="card flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-border/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{title}</p>
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>
      </div>
    );
  }

  if (!hierarchy || rows.length === 0) {
    return (
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{title}</p>
        <p className="text-sm text-ink-muted italic">No targets have been set yet.</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {LAYER_CONFIG.map(({ key, label, barClass }) => (
            <span key={key} className="flex items-center gap-1 text-[9px] text-ink-muted">
              <span className={`w-2 h-2 rounded-full inline-block ${barClass}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {rows.map((row, i) => (
        <div key={row.metric}>
          {i > 0 && <div className="border-t border-border/50" />}
          <MetricSection row={row} smTierMissing={!hierarchy?.salesManagerTarget} />
        </div>
      ))}
    </div>
  );
}
