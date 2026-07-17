import React from 'react';
import { initials as toInitials } from '../../utils/formatters';

// Track K — Strategic Plan · shared presentational primitives, translated from the
// CD mockup (stratplan-shared.jsx) into the app's Tailwind/CSS-var idiom (no inline
// styles, no hardcoded hex). GlassHero → `.glass.hero.teal`; hero ink stays inside
// hero panes via the arbitrary `text-[--hero-ink]` utilities.

/** Initials avatar — neutral teal tint (people = circle). */
export function PlanAvatar({ name, size = 'md' }) {
  const dim = size === 'lg' ? 'h-9 w-9 text-sm' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-xs';
  return (
    <div
      className={`${dim} shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold`}
      aria-hidden="true"
    >
      {toInitials(name)}
    </div>
  );
}

const TONE = {
  gold: 'text-gold-ink',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
  success: 'text-success-ink',
};

// Glass hero stat strip — one teal-glass card per section summary. `items` is a
// list of { k (label), v (value), sub?, tone? }. Values that don't fit scroll
// horizontally inside the card (page body never scrolls sideways).
export function StatHero({ items, testid }) {
  return (
    <div className="glass hero teal rounded-2xl px-1 py-4 shadow-sm" data-testid={testid}>
      <div className="flex min-w-0 items-stretch gap-0 overflow-x-auto">
        {items.map((it, i) => (
          <div
            key={it.k}
            className={`min-w-[9rem] flex-1 px-5 ${i ? 'border-l border-[--hero-ink]/15' : ''}`}
          >
            <div className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${it.tone ? TONE[it.tone] : 'text-[--hero-ink-muted-teal]'} whitespace-nowrap`}>
              {it.k}
            </div>
            <div className={`mt-1.5 font-display text-2xl font-extrabold tracking-tight ${it.tone ? TONE[it.tone] : 'text-[--hero-ink]'} whitespace-nowrap leading-none`}>
              {it.v}
            </div>
            {it.sub && <div className="mt-1.5 text-[11px] text-[--hero-ink-muted-teal] whitespace-nowrap">{it.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
