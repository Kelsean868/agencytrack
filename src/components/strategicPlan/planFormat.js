// Track K — Strategic Plan · shared display formatters. Presentation only;
// never derives numbers (single math path lives in lib/strategicPlan).
import { formatCurrency } from '../../utils/formatters';

export const fmtTTD = (v) => (v == null ? '—' : formatCurrency(v));
export const fmtNum = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-TT'));
export const fmtPct = (v) => (v == null ? '—' : `${Math.round(v)}%`);
export const fmtSignedTTD = (v) => (v == null ? '—' : `${v < 0 ? '−' : '+'}${formatCurrency(Math.abs(v))}`);
export const fmtYears = (v) => (v == null ? '—' : `${v} yr${v === 1 ? '' : 's'}`);

// Conditional band for % objective achieved → StatusPill variant.
// red < 50% · amber 50–80% · green ≥ 80% (mirrors Master Sheet banding).
export function pctVariant(pct) {
  if (pct == null) return 'muted';
  if (pct < 50) return 'danger';
  if (pct < 80) return 'warning';
  return 'success';
}
