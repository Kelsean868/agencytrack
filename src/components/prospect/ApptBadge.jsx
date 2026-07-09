// ApptBadge — countdown chip for a prospect prep's intendedAppointmentDate.
// TODAY / TOMORROW / IN N DAYS / overdue framing, derived from computeCountdown.
// Amber (warning) when imminent AND not yet prepped (per the v2 mockup ApptBadge);
// teal when imminent + prepped; danger when overdue; muted otherwise.

import React from 'react';
import { computeCountdown } from '../../utils/prospectPrep';

export default function ApptBadge({ intendedDate, today, prepped = false, className = '' }) {
  const { label, tone } = computeCountdown(intendedDate, today);
  if (!label) return null;

  const imminent = tone === 'imminent';
  const urgent = imminent && !prepped;

  let cls;
  if (tone === 'overdue') cls = 'bg-danger/10 text-danger-ink';
  else if (urgent) cls = 'bg-warning/10 text-warning-ink';
  else if (imminent) cls = 'bg-primary/10 text-primary';
  else cls = 'bg-border/40 text-ink-muted';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${cls} ${className}`}
      data-testid="appt-badge"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
