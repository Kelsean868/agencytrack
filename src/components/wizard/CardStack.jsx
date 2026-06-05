import React from 'react';

export function Card({ badge, desc, children, variant = 'default' }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        variant === 'teal'
          ? 'bg-primary/5 border border-primary/20'
          : 'bg-card border border-border/60'
      }`}
    >
      {badge && (
        <div className="mb-2">
          <span className="inline-flex text-xs font-semibold text-white bg-primary dark:bg-primary-dark px-2 py-0.5 rounded-full">
            {badge}
          </span>
        </div>
      )}
      {desc && <p className="text-xs text-ink-muted mb-3 leading-relaxed">{desc}</p>}
      {children}
    </div>
  );
}

export function NumericField({ label, name, inputId, value, onChange, desc, lastWeek }) {
  const fieldId = inputId ?? name;
  const showLastWeek = lastWeek != null && Number(lastWeek) > 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-ink">{label}</label>
        {showLastWeek && (
          <span
            data-testid={`${name}-last-week`}
            className="text-[9.5px] font-mono uppercase tracking-widest text-ink-muted shrink-0"
          >
            LAST WK · {lastWeek}
          </span>
        )}
      </div>
      {desc && <p className="text-xs text-ink-muted">{desc}</p>}
      <input
        id={fieldId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '');
          onChange(name, v === '' ? 0 : parseInt(v, 10));
        }}
        className="w-full h-11 px-3 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

export function CurrencyField({ label, name, inputId, value, onChange, desc, lastWeek }) {
  const fieldId = inputId ?? name;
  const showLastWeek = lastWeek != null && Number(lastWeek) > 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-ink">{label}</label>
        {showLastWeek && (
          <span
            data-testid={`${name}-last-week`}
            className="text-[9.5px] font-mono uppercase tracking-widest text-ink-muted shrink-0"
          >
            LAST WK · TTD {lastWeek}
          </span>
        )}
      </div>
      {desc && <p className="text-xs text-ink-muted">{desc}</p>}
      <div className="flex h-11 rounded-lg border border-border/60 overflow-hidden bg-surface">
        <span className="flex items-center px-3 text-xs font-semibold text-ink-muted bg-surface border-r border-border/60 shrink-0">
          TTD
        </span>
        <input
          id={fieldId}
          type="text"
          inputMode="decimal"
          value={value === 0 ? '' : value}
          placeholder="0.00"
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, '');
            onChange(name, v === '' ? 0 : parseFloat(v) || 0);
          }}
          className="flex-1 px-3 bg-transparent text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-r-lg"
        />
      </div>
    </div>
  );
}

export function ReadOnlyField({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      <div className="h-11 px-3 flex items-center rounded-lg bg-primary/5 border border-primary/20">
        <span className="text-sm font-semibold text-primary">{value}</span>
      </div>
      <p className="text-xs text-ink-muted">auto-pulled from Step 1</p>
    </div>
  );
}

export function SuggestedField({ label, name, value, onChange, suggestion, note, desc }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-ink">{label}</label>
      {desc && <p className="text-xs text-ink-muted">{desc}</p>}
      <input
        id={name}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '');
          onChange(name, v === '' ? 0 : parseInt(v, 10));
        }}
        className="w-full h-11 px-3 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {suggestion != null && suggestion > 0 && (
        <p className="text-xs text-primary font-medium">
          Suggested: {suggestion}{note ? ` — ${note}` : ''}
        </p>
      )}
    </div>
  );
}
