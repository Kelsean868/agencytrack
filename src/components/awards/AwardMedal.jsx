import React from 'react';

// Shared medal coin primitive for manager awards.
// Reuses .badge-medal / .medal-1 / .medal-6 / .medal-locked CSS from src/index.css —
// the same classes the agent BadgeGrid uses. Visual parity by construction.
const MEDAL_CLASS_BY_STATE = {
  qualified:  'medal-1 glow',
  contention: 'medal-6',
  locked:     'medal-locked',
};

const LABEL_BY_STATE = {
  qualified:  'qualified',
  contention: 'in contention',
  locked:     'not eligible',
};

export default function AwardMedal({ state, icon: Icon, name }) {
  const medalClass = MEDAL_CLASS_BY_STATE[state] ?? MEDAL_CLASS_BY_STATE.locked;
  const stateLabel = LABEL_BY_STATE[state] ?? LABEL_BY_STATE.locked;
  return (
    <div
      className={`badge-medal ${medalClass}`}
      role="img"
      aria-label={`${name} — ${stateLabel}`}
    >
      <Icon className="medal-ico" size={26} strokeWidth={2} aria-hidden="true" />
    </div>
  );
}
