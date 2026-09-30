/**
 * persistencyRounding.js — the one rounding rule for every agent- and
 * manager-facing persistency percent (Kyron ruling R-a, 28–29-09-2026).
 *
 * Head office reports persistency to 2 decimals, so a figure is rounded to
 * 2 decimals, half up (89.996 → 90.00; 89.994 → 89.99; 89.995 → 90.00). The
 * DISPLAY and the GATE VERDICT both use this same rounded value, so a screen
 * can never print "90.00%" beside "below the 90% gate".
 *
 * PURE: no SDK, no clock.
 */

/**
 * roundPersistencyPct(pct) — a percent (0–100) rounded to 2 decimals, half up.
 * `null` for anything that is not a finite number (unknown, never a confident 0).
 *
 * Float guard: a percent built from a fraction carries binary noise —
 * 0.89965 × 100 is 89.96499999999999, so a bare `Math.round(x * 100) / 100`
 * gives 89.96, not 89.97 (same for 0.89245 → 89.24 and 1.005 → 1.00).
 * Trimming the scaled value to 12 significant digits first removes that noise
 * (8996.499999… → 8996.5) before rounding half up.
 */
export function roundPersistencyPct(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  const scaled = Number((pct * 100).toPrecision(12));
  return Math.round(scaled) / 100;
}

/** `89.996` → `"90.00%"`; `null` / non-numeric → `"—"`. */
export function formatPersistencyPct(pct) {
  const r = roundPersistencyPct(pct);
  return r == null ? '—' : `${r.toFixed(2)}%`;
}
