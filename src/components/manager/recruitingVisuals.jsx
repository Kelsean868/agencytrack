// recruitingVisuals.jsx — shared presentational COMPONENTS for the Monthly
// Recruiting kanban (item 2.2). Ported from recruiting-v2-shared.jsx into repo
// Tailwind/token idiom. Pure token/label helpers live in recruitingStageTone.js
// (re-exported here for convenience) so this file stays a components-only
// fast-refresh boundary.
import React from 'react';
import { RECRUITING_STAGES, stageIndex } from '../../services/recruitingService';
import { initials as toInitials } from '../../utils/formatters';
import { stageTone, stageShort } from './recruitingStageTone';

/** Initials avatar chip, tinted by stage. */
export function CandidateAvatar({ name, stage, size = 'md' }) {
  const tone = stageTone(stage);
  const dim = size === 'lg' ? 'h-12 w-12 text-lg' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-xs';
  return (
    <div
      className={`${dim} shrink-0 rounded-full flex items-center justify-center font-display font-bold ${tone.avaBg} ${tone.avaFg}`}
      aria-hidden="true"
    >
      {toInitials(name)}
    </div>
  );
}

/** Small stage pill (used in card headers / drawer header). */
export function StagePill({ stage }) {
  const tone = stageTone(stage);
  const hire = stage === 'licensed';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide ${tone.text} ${tone.pillBg}`}
      data-testid="rec-stage-pill"
    >
      {hire ? '★ ' : ''}{stageShort(stage)}
    </span>
  );
}

/**
 * Vertical stage timeline — 8 nodes, current highlighted, prior nodes filled.
 * Decorative connectors are aria-hidden; the current stage carries an aria-
 * current="step" cue plus a visible " · here" label.
 */
export function StageTimeline({ stage }) {
  const cur = stageIndex(stage);
  return (
    <ol className="flex flex-col" data-testid="rec-stage-timeline">
      {RECRUITING_STAGES.map((s, i) => {
        const here = i === cur;
        const done = i < cur;
        const tone = stageTone(s.key);
        const nodeClass = here
          ? `${tone.dot} ring-2 ring-offset-1 ring-offset-card`
          : done
          ? 'bg-primary'
          : 'bg-transparent border-2 border-ink-dim';
        return (
          <li key={s.key} className="flex items-center gap-3" aria-current={here ? 'step' : undefined}>
            <div className="flex flex-col items-center w-4 shrink-0">
              <span className={`h-3 w-3 rounded-full ${nodeClass}`} aria-hidden="true" />
              {i < RECRUITING_STAGES.length - 1 && (
                <span className={`w-0.5 h-4 ${done ? 'bg-primary' : 'bg-border'}`} aria-hidden="true" />
              )}
            </div>
            <span
              className={`text-sm ${here ? 'font-bold text-ink' : done ? 'font-semibold text-ink-muted' : 'text-ink-muted'} ${i < RECRUITING_STAGES.length - 1 ? 'pb-1.5' : ''}`}
            >
              {s.label}{here ? ' · here' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
