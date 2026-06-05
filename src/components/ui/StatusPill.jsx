import React from 'react';

const VARIANT_CLASS = {
  // On-tint status text uses the deep -ink tokens (AA ≥4.5 both themes; see
  // src/utils/__tests__/contrast.test.js). Tint backgrounds are unchanged.
  success: 'bg-success/15 text-success-ink',
  warning: 'bg-warning/15 text-warning-ink',
  muted:   'bg-border/60 text-ink-muted',
  danger:  'bg-danger/15 text-danger-ink',
  primary: 'bg-primary/10 text-primary', // text-primary on primary/10 clears AA (5.57/5.61)
};

export default function StatusPill({ variant = 'muted', label, icon, className = '' }) {
  const colorClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.muted;
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap',
        colorClass,
        className,
      ].filter(Boolean).join(' ')}
    >
      {icon}
      {label}
    </span>
  );
}
