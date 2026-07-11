import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Dashed future-phase banner shown atop any section not yet in Phase 1
 * (design handoff README §Left rail / §Screens-Sections — "Future phase"
 * sections are fully designed and ship data-driven once their registry
 * entries unlock).
 *
 * Copy reworded from the prototype's "Future phase." to be explicit that the
 * values shown below the banner are real, currently-enforced values — not
 * placeholders — since Phase 1 hasn't shipped editing for this section yet.
 */
export default function SoonBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-[1.5px] border-dashed border-border bg-surface-muted">
      <Clock size={17} className="text-ink-muted shrink-0" aria-hidden="true" />
      <p className="text-[12px] text-ink-muted leading-snug">
        Designed ahead — ships after Phase 1. Values shown are the real ones in force today.
      </p>
    </div>
  );
}
