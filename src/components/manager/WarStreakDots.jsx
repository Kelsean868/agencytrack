import React from 'react';

/**
 * WarStreakDots — 8-week filing-consistency dots (item 2.1 "StreakDots").
 * One dot per recent week: filled (teal) when a SUBMITTED WAR exists for that
 * week, hollow (danger outline) when it was missed.
 *
 * `history` is an array of booleans ordered OLDEST → NEWEST (left to right),
 * matching the war-v2 mockup. The caller is responsible for ordering
 * (getRecentSundays returns newest-first, so reverse before passing).
 *
 * Decorative dots are aria-hidden; the wrapper carries a summary aria-label.
 *
 * @param {boolean[]} history      filed flags, oldest → newest
 * @param {boolean} [showLabel=true]  append the "N wks" caption
 */
export default function WarStreakDots({ history, showLabel = true, className = '' }) {
  const weeks = Array.isArray(history) ? history : [];
  const filedCount = weeks.filter(Boolean).length;

  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      role="img"
      aria-label={`Filed ${filedCount} of ${weeks.length} recent weeks`}
      data-testid="war-streak-dots"
    >
      <div className="flex gap-0.5" aria-hidden="true">
        {weeks.map((filed, i) => {
          const weeksAgo = weeks.length - i;
          return (
            <span
              key={i}
              title={`${weeksAgo} week${weeksAgo === 1 ? '' : 's'} ago — ${filed ? 'filed' : 'not filed'}`}
              className={`h-2 w-2 rounded-[3px] ${
                filed ? 'bg-success' : 'bg-danger/20 border border-danger/40'
              }`}
            />
          );
        })}
      </div>
      {showLabel && weeks.length > 0 && (
        <span className="text-[10px] text-text-muted tabular-nums">{weeks.length} wks</span>
      )}
    </div>
  );
}
