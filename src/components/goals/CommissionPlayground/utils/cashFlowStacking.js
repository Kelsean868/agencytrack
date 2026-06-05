// Per-mode 12-month payment distribution for a block of policies incepted in month 1.
// Same arithmetic model as cashFlowForecast() in commissionMath.js — each mode's
// contribution is rounded independently to TTD whole cents before accumulation,
// whereas cashFlowForecast accumulates exact floats. Max divergence per month = 2 TTD
// (4 components × max rounding error of 0.5 each). See cashFlowStacking.test.js parity suite.

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function buildStackedData(totalApi, modeMix, commissionRate) {
  const C = commissionRate / 100;
  const a = totalApi * (modeMix.annual     ?? 0) * C;
  const s = totalApi * (modeMix.semiAnnual ?? 0) * C;
  const q = totalApi * (modeMix.quarterly  ?? 0) * C;
  const m = totalApi * (modeMix.monthly    ?? 0) * C;

  let cumulative = 0;
  return MONTH_LABELS.map((name, i) => {
    const annual     = i === 0               ? Math.round(a)        : 0;
    const semiAnnual = i === 0 || i === 6    ? Math.round(s * 0.5)  : 0;
    const quarterly  = [0,3,6,9].includes(i) ? Math.round(q * 0.25) : 0;
    const monthly    = Math.round(m / 12);
    cumulative += annual + semiAnnual + quarterly + monthly;
    return { name, annual, semiAnnual, quarterly, monthly, cumulative };
  });
}
