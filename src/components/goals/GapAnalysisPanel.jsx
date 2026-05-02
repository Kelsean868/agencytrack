import { useMemo } from 'react';
import { computeGapAnalysis } from '../../utils/gapAnalysis';
import { formatCurrency } from '../../utils/formatters';

const LAYER_CONFIG = [
  { key: 'personal',    pctKey: 'ofPersonal', gapKey: 'toPersonal', label: 'Personal Commitment', barClass: 'bg-primary'   },
  { key: 'unitTarget',  pctKey: 'ofUnit',     gapKey: 'toUnit',     label: 'Unit Target',         barClass: 'bg-[#7c3aed]' },
  { key: 'branchTarget',pctKey: 'ofBranch',   gapKey: 'toBranch',   label: 'Branch Target',       barClass: 'bg-warning'   },
  { key: 'companyFloor',pctKey: 'ofFloor',    gapKey: 'toFloor',    label: 'Company Floor',       barClass: 'bg-danger'    },
];

function formatValue(val, isCurrency) {
  if (val === null || val === undefined) return null;
  return isCurrency ? formatCurrency(Math.round(val)) : String(Math.round(val));
}

function GapBadge({ gap, target, isCurrency }) {
  if (gap === null) return null;
  if (gap <= 0) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success">✓ Met</span>
    );
  }
  const threshold = target > 0 ? target * 0.2 : Infinity;
  const isClose = gap <= threshold;
  const label = isCurrency ? `${formatCurrency(Math.round(gap))} to go` : `${Math.round(gap)} to go`;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
      isClose ? 'bg-warning/15 text-warning' : 'bg-border/60 text-ink-muted'
    }`}>
      {label}
    </span>
  );
}

function MetricSection({ row }) {
  const { label, isCurrency, actual, gaps, pcts } = row;
  const actualFmt = isCurrency ? formatCurrency(Math.round(actual)) : String(Math.round(actual));

  const layers = LAYER_CONFIG.filter(({ key }) => row[key] !== null);

  return (
    <div className="flex flex-col gap-3">
      {/* Metric header */}
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="text-xs text-ink-muted">YTD: <span className="font-semibold text-ink">{actualFmt}</span></p>
      </div>

      {/* Layer bars */}
      <div className="flex flex-col gap-2">
        {layers.map(({ key, pctKey, gapKey, label: layerLabel, barClass }) => {
          const target    = row[key];
          const fillPct   = pcts[pctKey] ?? 0;
          const gapValue  = gaps[gapKey];
          const targetFmt = formatValue(target, isCurrency);

          return (
            <div key={key} className="flex items-center gap-3">
              <p className="text-[10px] font-semibold text-ink-muted w-36 shrink-0 truncate">{layerLabel}</p>
              <div className="flex-1 h-2 rounded-full bg-border/50 overflow-hidden">
                <div className={`h-2 rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${fillPct}%` }} />
              </div>
              <p className="text-[10px] text-ink-muted w-24 text-right shrink-0">{targetFmt}</p>
              <div className="w-24 flex justify-end shrink-0">
                <GapBadge gap={gapValue} target={target} isCurrency={isCurrency} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GapAnalysisPanel({ hierarchy, ytdTotals, loading, title = 'Goal Hierarchy' }) {
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
          <MetricSection row={row} />
        </div>
      ))}
    </div>
  );
}
