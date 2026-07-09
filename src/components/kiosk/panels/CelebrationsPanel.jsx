import React, { useMemo } from 'react';
import { deriveKioskCelebrations } from '../../../lib/kiosk/kioskCelebrations';
import Avatar from '../Avatar';

/**
 * CelebrationsPanel — work anniversaries for the current week (3.6).
 *
 * Derives from `contractStartDate` (3.3 precedent). BIRTHDAYS are skip-logged:
 * there is NO DOB field on user docs, so only anniversaries are shown. Empty →
 * the shell drops this panel from the rotation (see buildKioskRotation).
 *
 * Props:
 *   allUsers — branch users (may be [] under SEC-012)
 *   now      — injectable clock for tests (defaults to new Date())
 */

// Full static class strings (Tailwind JIT can't see interpolated names).
const CARD_ACCENTS = [
  { pill: 'bg-presentation-gold/15 text-presentation-gold', halo: 'kiosk-halo-gold', value: 'text-presentation-gold', block: 'bg-presentation-gold/10' },
  { pill: 'bg-presentation-accent/15 text-presentation-accent', halo: 'kiosk-halo-teal', value: 'text-presentation-accent', block: 'bg-presentation-accent/10' },
  { pill: 'bg-presentation-hot/15 text-presentation-hot', halo: 'kiosk-halo-hot', value: 'text-presentation-hot', block: 'bg-presentation-hot/10' },
];

function AnniversaryCard({ celebration, accent }) {
  return (
    <div
      className="kiosk-glass-raised rounded-3xl relative overflow-hidden flex flex-col items-center text-center px-6 pt-7 pb-6"
      data-testid="celebration-card"
    >
      <span className={`inline-block px-3 py-1.5 rounded-full text-[0.62rem] font-mono font-bold uppercase tracking-[0.18em] ${accent.pill}`}>
        Work Anniversary
      </span>

      <div className="relative mt-6 flex items-center justify-center h-40 w-40">
        <div className={`kiosk-halo kiosk-halo-breathe ${accent.halo} inset-[-12%]`} />
        <span className="absolute top-2 left-4 text-presentation-gold text-lg motion-reduce:animate-none animate-kiosk-sparkle" aria-hidden="true">✦</span>
        <span className="absolute bottom-3 right-5 text-presentation-accent text-sm motion-reduce:animate-none animate-kiosk-sparkle" aria-hidden="true">✦</span>
        <div className="relative">
          <Avatar agent={{ uid: celebration.id, name: celebration.name }} size="hero" />
        </div>
      </div>

      <p className="mt-6 text-2xl font-display font-bold text-presentation-text tracking-tight leading-tight">
        {celebration.name}
      </p>
      {celebration.unit && (
        <p className="mt-1 text-[0.66rem] font-mono uppercase tracking-[0.1em] text-presentation-muted">{celebration.unit}</p>
      )}

      <div className="mt-auto pt-5 w-full">
        <div className={`rounded-xl px-4 py-3 border border-presentation-border ${accent.block}`}>
          <div className={`text-3xl font-display font-bold tracking-tight leading-none ${accent.value}`}>
            {celebration.years} {celebration.years === 1 ? 'year' : 'years'}
          </div>
          <div className="mt-1.5 text-[0.62rem] font-mono uppercase tracking-[0.14em] text-presentation-muted">
            {celebration.dateLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CelebrationsPanel({ allUsers = [], now }) {
  const celebrations = useMemo(
    () => deriveKioskCelebrations(allUsers, now ?? new Date()).slice(0, 3),
    [allUsers, now]
  );

  return (
    <div className="w-full h-full flex flex-col px-14 pt-12 pb-10">
      <div className="mb-8">
        <p className="text-xs font-mono font-bold uppercase tracking-[0.22em] text-presentation-gold">
          ★ Celebrating this week
        </p>
        <h1 className="mt-2 text-5xl font-display font-bold text-presentation-text tracking-tight">
          Work Anniversaries.
        </h1>
      </div>

      {celebrations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-3xl text-presentation-muted">No celebrations this week</p>
        </div>
      ) : (
        <div
          className="flex-1 grid gap-6 min-h-0"
          style={{ gridTemplateColumns: `repeat(${celebrations.length}, minmax(0, 1fr))` }}
        >
          {celebrations.map((c, i) => (
            <AnniversaryCard key={c.id} celebration={c} accent={CARD_ACCENTS[i % CARD_ACCENTS.length]} />
          ))}
        </div>
      )}
    </div>
  );
}
