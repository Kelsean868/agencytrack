import React from 'react';

// Kiosk v2 (3.6) — gradient medal coin (recognition theming, token-driven).
// Gold/silver/bronze gradients + glow live in index.css (.kiosk-medal-*);
// only the dynamic geometry (size / font-size) is inline, per the SVG/dynamic
// geometry carve-out on the no-inline-styles rule.
//
// Props:
//   rank — 1 | 2 | 3 (anything else → gold styling, but callers gate on ≤3)
//   size — coin diameter in px (default 56)
//   glow — outer glow ring (default true)

const RANK_CLASS = {
  1: 'kiosk-medal-gold',
  2: 'kiosk-medal-silver',
  3: 'kiosk-medal-bronze',
};

export default function KioskMedal({ rank = 1, size = 56, glow = true }) {
  const rankClass = RANK_CLASS[rank] ?? RANK_CLASS[1];
  return (
    <div
      className={`kiosk-medal ${rankClass}${glow ? ' kiosk-medal-glow' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {rank}
    </div>
  );
}
