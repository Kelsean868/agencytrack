// Track K · K2 — FinancingBasisBadge (the basisBadge primitive, deferred from K1).
//
// Renders the three basis-source states (CD#3), extending the awards-engine
// Confirmed/Estimated tone pattern: settled-confirmed reads "confirmed" (success),
// submitted-final reads as a definite submitted value (primary), and the
// K5-reserved submitted-provisional reads "estimated" (gold). Nexus tokens only —
// no hex, both themes. Basis is DERIVED at render (never stored) — see
// deriveBasisSource in financingService. Labels live in the service (data layer)
// so this file exports a component only (react-refresh).
import React from 'react';
import { BASIS_SOURCE_LABELS } from '../../services/financingService';

const BASIS_STYLES = {
  'submitted-final': {
    cls: 'bg-primary/10 text-primary border border-primary/30',
    dot: 'bg-primary',
  },
  'submitted-provisional': {
    cls: 'bg-gold-tint text-gold border border-gold/30',
    dot: 'bg-gold',
  },
  'settled-confirmed': {
    cls: 'bg-success/15 text-success-ink border border-success/30',
    dot: 'bg-success',
  },
};

export default function FinancingBasisBadge({ basis, className = '' }) {
  const key = BASIS_STYLES[basis] ? basis : 'submitted-final';
  const meta = BASIS_STYLES[key];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap',
        meta.cls,
        className,
      ].filter(Boolean).join(' ')}
      data-testid="financing-basis-badge"
      data-basis={key}
    >
      <span className={['h-1.5 w-1.5 rounded-full shrink-0', meta.dot].join(' ')} aria-hidden="true" />
      {BASIS_SOURCE_LABELS[key]}
    </span>
  );
}
