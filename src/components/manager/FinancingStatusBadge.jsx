// Track K · K1 — FinancingStatusBadge.
//
// Shared primitive rendering all five financingStatus states (Addendum B.9),
// reused across every later Track-K surface (K2+). Nexus tokens only — no hex,
// both themes via the semantic color tokens. The gold/tint and
// warning/success-ink pairs are the established AA-safe combinations.
import React from 'react';
import { FINANCING_STATUS_LABELS } from '../../services/financingService';

// Per-state presentation (cls/dot). Labels live in the service (data layer) so
// this file exports a component only (react-refresh).
const STATUS_STYLES = {
  not_on_financing: {
    cls: 'bg-surface-muted text-ink-muted border border-border',
    dot: 'bg-ink-faint',
  },
  on_financing: {
    cls: 'bg-primary dark:bg-primary-dark text-white',
    dot: 'bg-white/80',
  },
  reconciling: {
    cls: 'bg-gold-tint text-gold border border-gold/30',
    dot: 'bg-gold',
  },
  post_financing_repayment: {
    cls: 'bg-warning/15 text-warning-ink border border-warning/30',
    dot: 'bg-warning',
  },
  cleared: {
    cls: 'bg-success/15 text-success-ink border border-success/30',
    dot: 'bg-success',
  },
};

export default function FinancingStatusBadge({ status, className = '' }) {
  const key = STATUS_STYLES[status] ? status : 'not_on_financing';
  const meta = STATUS_STYLES[key];
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap',
        meta.cls,
        className,
      ].filter(Boolean).join(' ')}
      data-testid="financing-status-badge"
      data-status={key}
    >
      <span className={['h-2 w-2 rounded-full shrink-0', meta.dot].join(' ')} aria-hidden="true" />
      {FINANCING_STATUS_LABELS[key]}
    </span>
  );
}
