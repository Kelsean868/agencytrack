import React from 'react';

/**
 * WorkspaceToggle — My Work ⇄ My Team segmented control (Nav redesign PR-4).
 *
 * Session-state control at the top of the sidebar (and mobile drawer) for the
 * `workspace` / `both` layouts. Two segmented buttons using `aria-pressed` to
 * expose selection state; keyboard-operable (native buttons), focus-visible
 * ring, 44px touch targets, motion-safe transitions. Token-based colors only
 * (no new hex). The active workspace is owned by the dashboard (defaults to
 * `work`, not persisted — decision #4).
 *
 * @param {{ workspace: 'work'|'team', onChange: (ws:'work'|'team')=>void, idPrefix?: string }} props
 */
const OPTIONS = [
  { key: 'work', label: 'My Work' },
  { key: 'team', label: 'My Team' },
];

export default function WorkspaceToggle({ workspace, onChange, idPrefix = 'ws' }) {
  return (
    <div
      className="flex gap-1 p-1 mx-3 mb-2 rounded-xl bg-card-raised"
      role="group"
      aria-label="Workspace"
    >
      {OPTIONS.map((opt) => {
        const active = workspace === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            data-testid={`${idPrefix}-toggle-${opt.key}`}
            className={`flex-1 min-h-[44px] px-3 rounded-lg text-sm font-semibold motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? 'bg-card text-primary shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
