export const getUnitDisplayName = (unitManagerDoc) => {
  if (!unitManagerDoc) return 'Unknown Unit';
  if (unitManagerDoc.unitName?.trim()) return unitManagerDoc.unitName.trim();
  const name = unitManagerDoc.name || unitManagerDoc.displayName || 'Unit Manager';
  return `${name}'s Unit`;
};

export const ROLE_LABELS = {
  tenant_admin: 'Tenant Admin',
  platform_admin: 'Platform Admin',
  branch_manager: 'Branch Manager',
  unit_manager: 'Unit Manager',
  sales_manager: 'Sales Manager',
  agent: 'Agent',
};

export const getRoleLabel = (role) => ROLE_LABELS[role] ?? 'Unknown';

export const formatCurrency = (amount) => {
  const num = parseFloat(amount ?? 0);
  return 'TTD ' + num.toLocaleString('en-TT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const formatPercent = (value, total) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

// Round an already-computed award progress percentage for DISPLAY only.
// The awards engine clamps progressPercent to 0–100 as a raw float; this
// whole-numbers it at the render layer so cards/donuts never show
// `13.333…%`. Bar-fill widths + threshold/criterion logic keep the raw value.
export const formatAwardPct = (pct) => Math.round(Number(pct) || 0);

// Compact TTD for dense summaries (pipeline tiles, flow bar, hero):
// 1_240 → "TTD 1.2K", 161_400 → "TTD 161.4K", 2_400_000 → "TTD 2.4M".
export const formatCompactTTD = (amount) => {
  const num = parseFloat(amount ?? 0) || 0;
  const abs = Math.abs(num);
  if (abs >= 1_000_000) return `TTD ${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `TTD ${(num / 1_000).toFixed(1)}K`;
  return `TTD ${num.toLocaleString('en-TT', { maximumFractionDigits: 0 })}`;
};

export const formatDateDisplay = (isoString) => {
  if (!isoString) return '';
  const [yyyy, mm, dd] = isoString.split('-');
  return `${dd}-${mm}-${yyyy}`;
};

export const formatDateFriendly = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString + 'T12:00:00Z').toLocaleDateString('en-TT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
};

// Awards pace narrative (§2.7) — weeks-to-qualify display, capped at a sane
// ceiling so a technically-correct-but-absurd "47 wks" never renders; an
// operator reads "20+ wks" as "not close," which is the honest takeaway.
// Returns null for null/zero/negative/non-finite input — callers fall back
// to an honest "no pace yet" copy rather than ever showing NaN/Infinity.
export const PACE_WEEKS_CAP = 20;
export const formatPaceWeeks = (weeks) => {
  if (weeks == null || !Number.isFinite(weeks) || weeks <= 0) return null;
  if (weeks > PACE_WEEKS_CAP) return `${PACE_WEEKS_CAP}+ wks`;
  return weeks === 1 ? '~1 wk' : `~${weeks} wks`;
};

// Awards pace narrative (§2.7) — "avg X/wk" rate display. TTD-denominated
// criteria use formatCurrency (full value, not compact-K); other cumulative
// units (e.g. apps) render a rounded count. Returns null for a non-finite or
// non-positive rate — callers gate on this before rendering the pace line.
export const formatPaceRate = (avgPerWeek, unit) => {
  const num = parseFloat(avgPerWeek);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (unit === 'TTD') return `${formatCurrency(num)}/wk`;
  const rounded = Math.round(num);
  return unit ? `${rounded.toLocaleString('en-TT')} ${unit}/wk` : `${rounded.toLocaleString('en-TT')}/wk`;
};

// Signed financing-adjustment label. adjustmentPct > 0 is a cut BELOW the amount
// in effect (shown −X%); < 0 is above (+X%); 0 is "0%". Sign is derived from the
// magnitude so a value never double-signs (e.g. "−-13%"). A magnitude that ROUNDS
// to zero renders the unsigned "0%" — never "−0%" / "+0%" (PR #769 Rule-21
// backstop). Shared by the Track K unit-financing roster + read-only drawer.
export const formatAdjustmentPct = (frac) => {
  // parseFloat coercion (codebase idiom): Number.isNaN alone doesn't coerce, so a
  // non-numeric string would otherwise slip past the guard and render "+NaN%".
  const num = parseFloat(frac);
  if (frac == null || Number.isNaN(num)) return '—';
  const pct = Math.round(Math.abs(num) * 100);
  if (pct === 0) return '0%';
  return num > 0 ? `−${pct}%` : `+${pct}%`;
};

// Up-to-two-letter uppercase initials for an avatar chip; '—' when empty.
export const initials = (name) =>
  String(name ?? '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('') || '—';