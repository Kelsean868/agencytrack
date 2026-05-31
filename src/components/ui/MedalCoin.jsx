/**
 * MedalCoin — gold/silver/bronze medallion primitive for podium/recognition surfaces.
 *
 * Visually identical to the kiosk's `.medal-N` CSS class but parameterized
 * by size + rank so the app and kiosk can share one gradient source of truth
 * (the `--color-medal-{1,2,3}-{light,mid,deep,glow}` tokens in `src/index.css`).
 *
 * NO raw hex anywhere in this file — every color references a CSS var.
 * Themed via the existing tokens (which have `:root` + `.dark` variants so the
 * coin looks right in both themes without component-side branching).
 *
 * Props:
 *   rank   — 1 | 2 | 3 (gold | silver | bronze). Other ranks render the
 *            "tail" neutral coin (surface-muted bg + ink-muted text) so the
 *            component is safe to use beyond the podium without ad-hoc guards.
 *   size   — number, the coin diameter in px (default 36, matches mockup).
 *   glow   — boolean, whether to render the colored outer glow (default true
 *            for podium ranks; downstream callers can disable on dense tail
 *            surfaces if needed).
 *   className — opt-in passthrough.
 */
import React from 'react';

function MedalCoin({ rank, size = 36, glow = true, className = '' }) {
  const isPodium = rank === 1 || rank === 2 || rank === 3;

  // Token mapping per rank — kept inline (rather than a Map) so it greps cleanly.
  // For non-podium ranks (>= 4) we fall through to a neutral coin using the
  // generic surface-muted tokens; the gradient is intentionally absent so the
  // visual hierarchy stays podium-anchored.
  const medalClass =
    rank === 1 ? 'medal-1' :
    rank === 2 ? 'medal-2' :
    rank === 3 ? 'medal-3' :
    null;

  if (!isPodium) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-surface-muted text-ink-muted font-bold font-display select-none ${className}`}
        style={{
          width:    size,
          height:   size,
          fontSize: Math.round(size * 0.4),
        }}
        aria-label={`Rank ${rank}`}
        role="img"
      >
        {rank}
      </div>
    );
  }

  // Podium coin — gradient + inner shadow (from `.medal-N`) + optional outer glow
  // (from `.medal-N.glow`). Numeric label inside; a soft highlight overlay on
  // top-left for the polished-metal look.
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full font-bold font-display text-white select-none ${medalClass}${glow ? ' glow' : ''} ${className}`}
      style={{
        width:      size,
        height:     size,
        fontSize:   Math.round(size * 0.4),
        letterSpacing: '-0.04em',
        textShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }}
      aria-label={`Rank ${rank} medal`}
      role="img"
    >
      <span className="relative z-[1]">{rank}</span>
      {/* Top-left specular highlight — soft white blur for the polished-metal effect */}
      <span
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          top:      '6%',
          left:     '18%',
          width:    '38%',
          height:   '24%',
          background: 'rgba(255,255,255,0.42)',
          filter:    'blur(2px)',
        }}
      />
    </div>
  );
}

export default MedalCoin;
