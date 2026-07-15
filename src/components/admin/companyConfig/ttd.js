/**
 * TTD currency abbreviation rule for the Company Config surface (design
 * handoff README §Design Tokens): `TTD 9.60M` / `TTD 24.5K` / `TTD 950`.
 *
 * This is intentionally NOT `formatCurrency` from `src/utils/formatters.js` —
 * that helper renders the full comma-grouped amount (`TTD 1,200,000`), which
 * is correct for report/ledger surfaces but too wide for the dense
 * Company Config row grammar. `formatTTD` is the abbreviated form the
 * prototype (`cc-proto-data.jsx` → `ccpTTD`) specifies for this surface only.
 *
 * @param {number} n
 * @returns {string}
 */
export function formatTTD(n) {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  const abs = Math.abs(safe);
  if (abs >= 1e6) return 'TTD ' + (safe / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return 'TTD ' + (safe / 1e3).toFixed(1) + 'K';
  return 'TTD ' + Math.round(safe);
}
