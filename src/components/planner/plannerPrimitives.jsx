import React from 'react';
import StatusPill from '../ui/StatusPill';
import { APPOINTMENT_TYPES, APPOINTMENT_STATUSES } from '../../services/plannerService';

/**
 * Planner primitives — ActivityChip (type code + tone) and ApptStatusPill
 * (status → shared StatusPill variant). Tokens only; no invented hex.
 *
 * Tone mapping (handoff §6): calls (P.C/S.C) read low-emphasis neutral; the
 * interview ladder (A.I/F.F.I) reads teal; C.I is solid teal (the money type,
 * white text paired with dark:bg-primary-dark per UI rule D6); Sale reads gold
 * (strong gold tint + gold-ink text, AA-safe — a full gold fill would fail
 * AA-large for the label, so "solid gold" is expressed as a strong tint + dot);
 * Free is a dashed neutral block. The repo ships no violet token, so the
 * handoff's violet "call" hue maps to the neutral family (documented divergence).
 */

const TYPE_LABEL = Object.fromEntries(APPOINTMENT_TYPES.map((t) => [t.key, t.label]));
const TYPE_NAME  = Object.fromEntries(APPOINTMENT_TYPES.map((t) => [t.key, t.name]));

const TYPE_TONE = {
  PC:   { chip: 'bg-card-raised text-ink-muted border border-border',       dot: 'bg-ink-dim' },
  SC:   { chip: 'bg-card-raised text-ink-muted border border-border',       dot: 'bg-ink-dim' },
  AI:   { chip: 'bg-primary/10 text-primary border border-primary/20',      dot: 'bg-primary' },
  FFI:  { chip: 'bg-primary/10 text-primary border border-primary/20',      dot: 'bg-primary' },
  CI:   { chip: 'bg-primary text-white dark:bg-primary-dark border border-primary dark:border-primary-dark', dot: 'bg-white' },
  SALE: { chip: 'bg-gold/20 text-gold-ink border border-gold/50',           dot: 'bg-gold' },
  FREE: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim' },
};

/**
 * ActivityChip — the type code (P.C / F.F.I / Sale …) with its tone.
 * @param {string} type   one of the contract TYPE keys
 * @param {boolean} [dot] render a leading tone dot
 */
export function ActivityChip({ type, dot = false, className = '' }) {
  const tone = TYPE_TONE[type] ?? TYPE_TONE.FREE;
  const label = TYPE_LABEL[type] ?? type;
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold whitespace-nowrap',
        tone.chip,
        className,
      ].filter(Boolean).join(' ')}
      title={TYPE_NAME[type] ?? undefined}
      data-type={type}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />}
      {label}
    </span>
  );
}

const STATUS_VARIANT = {
  scheduled: 'muted',
  confirmed: 'primary',
  kept:      'success',
  done:      'success',
  postponed: 'warning',
  cancelled: 'danger',
};
const STATUS_LABEL = Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s.key, s.label]));

/** ApptStatusPill — status → shared StatusPill variant. */
export function ApptStatusPill({ status, className = '' }) {
  return (
    <StatusPill
      variant={STATUS_VARIANT[status] ?? 'muted'}
      label={STATUS_LABEL[status] ?? status}
      className={className}
    />
  );
}
