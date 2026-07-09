// Kiosk v2 (3.6) — compact TTD formatter for the broadcast scale.
// Mirrors the screens-v2 kiosk `ttdK` helper (and TVRankedLeaderboard.fmtApi).

export function ttdK(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `TTD ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `TTD ${(v / 1_000).toFixed(1)}K`;
  return `TTD ${Math.round(v).toLocaleString()}`;
}
