import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  periodLabel,
  defaultPeriodForGrain,
  canStepPrev,
  canStepNext,
  stepPrev,
  stepNext,
} from './periodUtils';

const GRAINS = [
  { id: 'year',  label: 'Year' },
  { id: 'month', label: 'Month' },
  { id: 'week',  label: 'Week' },
];

export default function PeriodFilter({ period, onChangePeriod }) {
  function handleGrain(grain) {
    if (grain === period.grain) return;
    onChangePeriod(defaultPeriodForGrain(grain));
  }

  const prevOk = canStepPrev(period);
  const nextOk = canStepNext(period);

  return (
    <div
      className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
      data-testid="period-filter"
    >
      <span className="font-mono text-[9px] font-bold tracking-widest uppercase text-ink-muted">
        Period
      </span>

      {/* Grain pills */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-lg" data-testid="grain-selector">
        {GRAINS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => handleGrain(g.id)}
            aria-pressed={period.grain === g.id}
            className={`px-3.5 py-1.5 rounded-md font-mono text-[10.5px] font-bold min-h-[34px] transition-colors ${
              period.grain === g.id
                ? 'bg-primary text-white dark:bg-primary-dark'
                : 'text-ink-muted hover:text-ink'
            }`}
            data-testid={`grain-${g.id}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Period picker */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg min-h-[38px]" data-testid="period-picker">
        <button
          type="button"
          onClick={() => prevOk && onChangePeriod(stepPrev(period))}
          disabled={!prevOk}
          aria-label="Previous period"
          className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="period-prev"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="font-bold text-sm min-w-[120px] text-center" data-testid="period-value">
          {periodLabel(period)}
        </span>
        <button
          type="button"
          onClick={() => nextOk && onChangePeriod(stepNext(period))}
          disabled={!nextOk}
          aria-label="Next period"
          className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="period-next"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <span className="ml-auto font-mono text-[10px] text-ink-muted hidden sm:flex items-center gap-1">
        <strong className="text-ink">Scopes production columns only.</strong>
        {' '}Persistency = month of period · % goal = annual
      </span>
    </div>
  );
}
