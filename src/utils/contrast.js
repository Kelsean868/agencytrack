// contrast.js — WCAG 2.1 relative-luminance + contrast-ratio math.
//
// The deterministic basis for the status-ink tokens (contrast-debt retirement):
// every on-tint text token is proven ≥ 4.5:1 against its backgrounds by the unit
// tests in __tests__/contrast.test.js — executed proof, not eyeballs. Extends the
// hand-computed #465 gold approach (which baked ratios into an index.css comment)
// into a reusable, tested module.
//
// Pure, framework-free. RGB is always an [r, g, b] triple of 0–255 integers.

// sRGB channel → linear-light, per WCAG 2.1.
function channelToLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an [r,g,b] colour (0–1). */
export function relativeLuminance([r, g, b]) {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG contrast ratio between two [r,g,b] colours (1–21). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Alpha-composite `fg` at `alpha` (0–1) over opaque `bg` → solid [r,g,b].
 * Models a Tailwind `/15` tint (status colour at 15% over the card) so the
 * text token can be proven against the pill's *effective* background.
 */
export function composite(fg, alpha, bg) {
  return fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]));
}

/** Parse "#rrggbb" or "r g b" / "r,g,b" channel strings → [r,g,b]. */
export function toRgb(value) {
  if (Array.isArray(value)) return value.map(Number);
  const v = String(value).trim();
  if (v.startsWith('#')) {
    const h = v.slice(1);
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  }
  return v.split(/[\s,]+/).map(Number);
}

/** True iff `fg` clears AA (≥ 4.5:1) against `bg`. */
export function passesAA(fg, bg) {
  return contrastRatio(fg, bg) >= 4.5;
}

/**
 * Compute the effective glass background as an opaque [r,g,b] triple.
 *
 * The recipe models effective bg as: tint (at its alpha) composited over
 * base (at its floor alpha) composited over the darkest named app surface.
 * All channel values mirror the index.css glass token definitions — if a
 * token changes, update both here and there to keep the test suite green.
 *
 * Light floor: base ≥ 0.62 over --color-bg [247,246,242].
 * Dark  floor: base ≥ 0.55 over --color-surface dark [37,32,25].
 *
 * @param {'teal'|'gold'} tintToken
 * @param {'light'|'dark'} theme
 * @returns {[number, number, number]} opaque effective background
 */
export function glassPair(tintToken, theme) {
  const PARAMS = {
    light: {
      base:    { rgb: [255, 255, 255], alpha: 0.62 },
      surface: [247, 246, 242],                        // --color-bg (light)
      tints: {
        teal: { rgb: [1,   138, 145], alpha: 0.10 },   // --glass-l-tint-teal
        gold: { rgb: [176, 125, 26],  alpha: 0.10 },   // --glass-l-tint-gold
      },
    },
    dark: {
      base:    { rgb: [28, 25, 20], alpha: 0.55 },
      surface: [37, 32, 25],                           // --color-surface (dark)
      tints: {
        teal: { rgb: [74,  181, 184], alpha: 0.14 },   // --glass-d-tint-teal
        gold: { rgb: [232, 183, 62],  alpha: 0.12 },   // --glass-d-tint-gold
      },
    },
  };
  const { base, surface, tints } = PARAMS[theme];
  const tint = tints[tintToken];
  const baseOverSurface = composite(base.rgb, base.alpha, surface);
  return composite(tint.rgb, tint.alpha, baseOverSurface);
}
