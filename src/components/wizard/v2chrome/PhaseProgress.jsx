/**
 * Track J Wizard v2 PR1 — PhaseProgress.
 *
 * 4-phase rail + 12-dot bar across the top of the wizard. The mockup
 * (wizard-v2-shared.jsx) shows: phase-label row (active = teal +
 * "·pos/len", past = success/green, future = ink-faint) above a
 * segmented dot bar (one dot per step, grouped by phase, current = an
 * elongated teal pill, past = solid teal, future = surface-muted).
 *
 * Mockup "11" comment is stale — we render all 12 dots per the brief.
 *
 * `currentStep` is 1-indexed (1..12). Steps before currentStep are past;
 * steps within the same phase as currentStep but > currentStep render
 * future-state. Phase labels reflect aggregate state across the phase's
 * step range.
 *
 * `onDotClick(stepN)` is called when a VISITED dot (n < currentStep) is
 * tapped. The current dot and all future dots are gated — onDotClick is
 * never called for them.
 *
 * No computation, no live data — pure presentational chrome. Animations
 * carry `motion-reduce:` safe class names where relevant.
 */

import React from 'react';

const PHASES = [
  { key: 'activity',   label: 'Activity',   range: [1, 5]  },
  { key: 'sales',      label: 'Sales',      range: [6, 8]  },
  { key: 'reflection', label: 'Reflection', range: [9, 10] },
  { key: 'goals',      label: 'Goals',      range: [11, 12] },
];

// `totalSteps` is accepted for API symmetry (mockup uses 12) but the dot
// count is currently derived from PHASES; ignored if passed.
// eslint-disable-next-line no-unused-vars
export default function PhaseProgress({ currentStep, totalSteps = 12, onDotClick }) {
  return (
    <div className="flex flex-col gap-1.5" data-testid="wizard-v2-phase-progress">
      {/* Phase labels row */}
      <div className="flex gap-1.5">
        {PHASES.map((ph) => {
          const [a, b] = ph.range;
          const width = b - a + 1;
          const isActive = currentStep >= a && currentStep <= b;
          const isPast = currentStep > b;
          const labelClass = isActive
            ? 'text-primary'
            : isPast
            ? 'text-success-ink'
            : 'text-ink-muted';
          return (
            <div
              key={ph.key}
              className="flex items-baseline gap-1.5"
              style={{ flex: width }}
              data-testid={`wizard-v2-phase-label-${ph.key}`}
              data-state={isActive ? 'active' : isPast ? 'past' : 'future'}
            >
              <span
                className={`text-[10px] font-bold font-mono uppercase tracking-widest ${labelClass}`}
              >
                {ph.label}
              </span>
              {isActive && (
                <span className="text-[10px] font-mono text-ink-muted tracking-wide">
                  · {currentStep - a + 1}/{width}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Step dots — segmented by phase, one dot per step */}
      <div className="flex gap-1.5">
        {PHASES.map((ph) => {
          const [a, b] = ph.range;
          const width = b - a + 1;
          return (
            <div
              key={ph.key}
              className="flex gap-1"
              style={{ flex: width }}
              data-testid={`wizard-v2-phase-dots-${ph.key}`}
            >
              {Array.from({ length: width }).map((_, i) => {
                const n = a + i;
                const isCurrent = n === currentStep;
                const isPast = n < currentStep;
                const isVisited = isPast; // tappable only when fully visited
                const stateBg = isCurrent
                  ? 'bg-primary dark:bg-primary-dark'
                  : isPast
                  ? 'bg-primary/70'
                  : 'bg-surface-muted';
                const cursor = isVisited ? 'cursor-pointer' : 'cursor-default';
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Go to step ${n}`}
                    onClick={isVisited && onDotClick ? () => onDotClick(n) : undefined}
                    disabled={!isVisited}
                    className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${stateBg} ${cursor}`}
                    style={{ flex: isCurrent ? 1.8 : 1 }}
                    data-testid={`wizard-v2-step-dot-${n}`}
                    data-state={isCurrent ? 'current' : isPast ? 'past' : 'future'}
                    data-visited={isVisited ? 'true' : 'false'}
                    data-step={n}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
