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
 * @param {'default'|'hero'} [variant='default']  'hero' swaps the dot fills +
 *   caption to certified glass-hero viz tokens so the dots stay legible on the
 *   dark-teal `.glass.hero.teal` surface (light-card `bg-success` + muted-ink
 *   caption would wash out there).
 */
export default function WarStreakDots({ history, showLabel = true, className = '', variant = 'default' }) {
  const weeks = Array.isArray(history) ? history : [];
  const filedCount = weeks.filter(Boolean).length;
  const isHero = variant === 'hero';
  const filedClass = isHero ? 'bg-[--hero-dot-success]' : 'bg-success';
  const missedClass = isHero
    ? 'bg-white/10 border border-[--hero-chip-border]'
    : 'bg-danger/20 border border-danger/40';
  const labelClass = isHero ? 'text-[--hero-ink-muted-teal]' : 'text-text-muted';

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
              className={`h-2 w-2 rounded-[3px] ${filed ? filedClass : missedClass}`}
            />
          );
        })}
      </div>
      {showLabel && weeks.length > 0 && (
        <span className={`text-[10px] tabular-nums ${labelClass}`}>{weeks.length} wks</span>
      )}
    </div>
  );
}
