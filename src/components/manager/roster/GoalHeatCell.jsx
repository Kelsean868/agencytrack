import React from 'react';

// Straight-line time-elapsed pace: elapsed months / 12 at render time.
function paceRatio(now = new Date()) {
  return Math.min((now.getMonth() + now.getDate() / 30) / 12, 1);
}

// Input: pctOfAnnualGoal 0–100+ (100 = at goal, can exceed 100).
// null → no committed target → "—".
export default function GoalHeatCell({ pctOfAnnualGoal }) {
  if (pctOfAnnualGoal === null || pctOfAnnualGoal === undefined) {
    return (
      <div className="flex flex-col items-end" data-testid="goal-heat-cell-empty">
        <span className="font-display font-extrabold text-sm text-ink-muted">—</span>
      </div>
    );
  }
  const pace = paceRatio();
  const ahead = pctOfAnnualGoal >= pace * 100;
  const fillWidth = Math.min(pctOfAnnualGoal, 100);
  const paceLeft = Math.round(pace * 100);

  return (
    <div className="flex flex-col items-end gap-1" data-testid="goal-heat-cell">
      <span
        className={`font-display font-extrabold text-sm leading-none ${ahead ? 'text-success-ink' : 'text-warning-ink'}`}
      >
        {Math.round(pctOfAnnualGoal)}%
      </span>
      <div
        className="relative h-1.5 rounded-full bg-border/40"
        style={{ width: 84, overflow: 'hidden' }}
        aria-hidden="true"
      >
        <div
          className={`absolute left-0 top-0 bottom-0 rounded-full ${ahead ? 'bg-success' : 'bg-warning'}`}
          style={{ width: `${fillWidth}%` }}
        />
        {/* Straight-line pace marker */}
        <div
          className="absolute w-0.5 top-0 bottom-0 bg-ink-muted/50"
          style={{ left: `${paceLeft}%` }}
        />
      </div>
    </div>
  );
}
