import React from 'react';

const PERIODS = [
  { id: 'week',    label: 'Week'    },
  { id: 'mtd',     label: 'MTD'     },
  { id: 'quarter', label: 'Quarter' },
  { id: 'ytd',     label: 'YTD'     },
];

export default function TimePeriodToggle({ selected, onChange }) {
  return (
    <div
      className="flex gap-1 p-1 rounded-xl bg-surface border border-border"
      role="radiogroup"
      aria-label="Time period"
    >
      {PERIODS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={selected === id}
          onClick={() => onChange(id)}
          className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-2 min-h-[44px] sm:min-h-[36px] ${
            selected === id
              ? 'bg-card text-primary shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
