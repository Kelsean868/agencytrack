import React from 'react';
import { formatCurrency } from '../../utils/formatters';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthTargetField({ monthIndex, target, actual, editable, onChange }) {
  const label = MONTH_NAMES[monthIndex];

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      {editable ? (
        <input
          type="number"
          inputMode="decimal"
          aria-label={`${label} target`}
          className="w-full min-h-[44px] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-mono text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary"
          value={target === 0 ? '' : target}
          placeholder="0"
          min={0}
          step={100}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(Number.isFinite(v) ? v : 0);
          }}
        />
      ) : (
        <div
          className="flex min-h-[44px] w-full cursor-not-allowed items-center rounded-lg border border-border bg-surface-muted px-2.5 py-1.5"
          aria-label={`${label} target (locked)`}
          aria-readonly="true"
        >
          <span className="text-sm font-mono text-ink-muted">{formatCurrency(target)}</span>
        </div>
      )}
      {!editable && (
        <span className="text-[10px] text-ink-muted">
          Act: {formatCurrency(actual ?? 0)}
        </span>
      )}
    </div>
  );
}
