import React from 'react';

const VARIANT_CLASS = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  muted:   'bg-border/60 text-ink-muted',
  danger:  'bg-danger/15 text-danger',
  primary: 'bg-primary/10 text-primary',
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
