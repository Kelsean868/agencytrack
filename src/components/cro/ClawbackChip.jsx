import React from 'react';
import { deriveClawback } from '../../utils/clawbackClock';

/**
 * ClawbackChip — the 30-day delivery clawback countdown, as a compact status
 * chip (Tier-3 3.1). DISPLAY-ONLY: derives from the policy's `dateIssued` and
 * whether `policyDeliveryDate` is set; stores nothing.
 *
 * Tones map to the app's semantic -ink tokens (AA both themes, per StatusPill):
 *   delivered → success · overdue → danger · at-risk → warning · within → primary
 *
 * Reused by the CRO Delivery Register rows and the agent DeliveryStripCard.
 */
const TONE_CLASS = {
  delivered: 'bg-success/15 text-success-ink',
  overdue:   'bg-danger/15 text-danger-ink',
  'at-risk': 'bg-warning/15 text-warning-ink',
  within:    'bg-primary/10 text-primary',
  unknown:   'bg-border/60 text-ink-muted',
};

export default function ClawbackChip({ dateIssued, delivered = false, today, className = '' }) {
  const clock = deriveClawback(dateIssued, { delivered, today });
  const toneClass = TONE_CLASS[clock.tone] ?? TONE_CLASS.unknown;

  let label;
  if (clock.delivered) {
    label = 'Delivered';
  } else if (!clock.valid) {
    label = 'No issue date';
  } else if (clock.overdue) {
    label = `${Math.abs(clock.daysLeft)}d over`;
  } else {
    label = `${clock.daysLeft}d left`;
  }

  const ariaLabel = clock.delivered
    ? 'Delivered — clawback clock closed'
    : !clock.valid
      ? 'Clawback clock unavailable — no issue date'
      : clock.overdue
        ? `Overdue by ${Math.abs(clock.daysLeft)} days past the 30-day delivery deadline`
        : `${clock.daysLeft} days left before the 30-day clawback deadline`;

  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums whitespace-nowrap',
        toneClass,
        className,
      ].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
      data-testid="clawback-chip"
      data-tone={clock.tone}
    >
      {clock.delivered ? '✓ ' : ''}{label}
    </span>
  );
}
