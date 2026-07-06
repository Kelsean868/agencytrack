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
    cls: 'bg-gold-tint text-gold-ink border border-gold/30',
    dot: 'bg-gold',
  },
  'settled-confirmed': {
    cls: 'bg-success/15 text-success-ink border border-success/30',
    dot: 'bg-success',
  },
};

export default function FinancingBasisBadge({ basis, className = '' }) {
  const isKnown = Boolean(BASIS_STYLES[basis]);
  // DEV-only surface for an unexpected basisSource key (GLM nit): warn so a typo
  // or a new unwired state is caught in development, then fall back to the
  // existing 'submitted-final' default. No production behavior change.
  // Only warn on a truthy-but-unrecognized key — a falsy/absent basis (initial
  // load, before data is fetched) legitimately falls back and should stay quiet.
  if (basis && !isKnown && import.meta.env.DEV) {
    console.warn(`[FinancingBasisBadge] unexpected basisSource "${basis}" — falling back to "submitted-final".`);
  }
  const key = isKnown ? basis : 'submitted-final';
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
