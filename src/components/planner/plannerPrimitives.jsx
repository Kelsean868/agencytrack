import React from 'react';
import StatusPill from '../ui/StatusPill';
import { APPOINTMENT_TYPES, APPOINTMENT_STATUSES } from '../../services/plannerService';
import { TYPE_TONE } from './plannerTone';

/**
 * Planner primitives — ActivityChip (type code + tone) and ApptStatusPill
 * (status → shared StatusPill variant). Tokens only; no invented hex.
 *
 * The tone maps live in `plannerTone.js` (this file may only export components,
 * per react-refresh/only-export-components) — see that file for the §6 tone
 * rationale and the dense-card left-rail mapping.
 */

const TYPE_LABEL = Object.fromEntries(APPOINTMENT_TYPES.map((t) => [t.key, t.label]));
const TYPE_NAME  = Object.fromEntries(APPOINTMENT_TYPES.map((t) => [t.key, t.name]));

const CHIP_SIZE = {
  md: 'gap-1 px-2 py-0.5 rounded-md text-[11px]',
  // Dense/week-column chip — the mockup's `size="s"`.
  sm: 'gap-0.5 px-1 py-0 rounded text-[9.5px]',
};

/**
 * ActivityChip — the type code (P.C / F.F.I / Sale …) with its tone.
 * @param {string} type   one of the contract TYPE keys
 * @param {boolean} [dot] render a leading tone dot
 * @param {'md'|'sm'} [size] `sm` is the dense week-column chip
 */
export function ActivityChip({ type, dot = false, size = 'md', className = '' }) {
  const tone = TYPE_TONE[type] ?? TYPE_TONE.FREE;
  const label = TYPE_LABEL[type] ?? type;
  return (
    <span
      className={[
        'inline-flex items-center font-mono font-semibold whitespace-nowrap',
        CHIP_SIZE[size] ?? CHIP_SIZE.md,
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
