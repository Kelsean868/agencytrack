import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { floorStatus } from '../../../utils/weeklyActivityFloors';

/**
 * StandardRow — single Expected-vs-Actual row.
 *
 * Shared between WeeklyStandardCard (always-visible card on legacy home,
 * still rendered elsewhere if reused) and the v2 StandardDetail drawer.
 * Pure presentation; consumers compute `expected` + `actual` from the same
 * weeklyActivityFloors helpers.
 */

const STATUS_CLASSES = {
  green: 'bg-success/10 text-success-ink border-success/30',
  amber: 'bg-warning/10 text-warning-ink border-warning/30',
  red:   'bg-danger/10 text-danger-ink border-danger/30',
};
const STATUS_LABELS = { green: 'Met', amber: 'Close', red: 'Below' };

function formatValue(value, isCurrency) {
  if (isCurrency) return formatCurrency(value);
  return String(Math.round(parseFloat(value) || 0));
}

export default function StandardRow({ row, expected, actual }) {
  const status = floorStatus(expected, actual);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 py-2 min-h-[44px] border-b border-border/40 last:border-b-0">
      <div className="min-w-0">
        <span className="text-sm text-ink truncate">{row.label}</span>
      </div>
      <div className="text-xs text-ink-muted text-right tabular-nums whitespace-nowrap">
        <span className="text-[10px] uppercase tracking-wide mr-1">Expected</span>
        <span className="text-sm font-semibold text-ink">{formatValue(expected, row.isCurrency)}</span>
      </div>
      <div className="text-xs text-ink-muted text-right tabular-nums whitespace-nowrap">
        <span className="text-[10px] uppercase tracking-wide mr-1">Actual</span>
        <span className="text-sm font-semibold text-ink">{formatValue(actual, row.isCurrency)}</span>
      </div>
      <span
        className={`inline-flex items-center justify-center px-2 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
        aria-label={`${row.label}: ${STATUS_LABELS[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>
    </li>
  );
}
