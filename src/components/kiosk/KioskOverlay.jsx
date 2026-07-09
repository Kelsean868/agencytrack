import React from 'react';

/**
 * KioskOverlay — position/chapter chrome for the rotation (3.6).
 *
 * Top-right LIVE chapter badge (NN / NN · label) and a bottom-center progress
 * dot rail with the active dot elongated. Pointer-inert, presentation-scoped.
 *
 * Props:
 *   index — 0-based position of the active panel
 *   total — number of panels in the effective rotation
 *   label — human label for the active panel
 */
export default function KioskOverlay({ index = 0, total = 1, label = '' }) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <>
      <div
        className="absolute top-5 right-6 z-10 flex items-center gap-2.5 px-3.5 py-2 rounded-full kiosk-glass"
        data-testid="kiosk-chapter-overlay"
      >
        <span className="w-2 h-2 rounded-full bg-presentation-hot motion-reduce:animate-none animate-kiosk-pulse-dot" aria-hidden="true" />
        <span className="text-[0.62rem] font-mono font-bold uppercase tracking-[0.18em] text-presentation-accent">Live</span>
        <span className="w-px h-3 bg-presentation-border" aria-hidden="true" />
        <span className="text-[0.62rem] font-mono font-bold uppercase tracking-[0.14em] text-presentation-muted">
          <span className="text-presentation-text">{pad(index + 1)}</span>
          <span className="px-1.5 text-presentation-muted">/</span>
          <span>{pad(total)}</span>
          {label && (
            <>
              <span className="px-2 text-presentation-muted">·</span>
              <span className="text-presentation-text">{label}</span>
            </>
          )}
        </span>
      </div>

      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full kiosk-glass"
        data-testid="kiosk-progress-dots"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-5 bg-presentation-accent' : 'w-1.5 bg-presentation-border'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </>
  );
}
