import { formatCurrency } from '../../../../utils/formatters';
import { reverseCalc } from './commissionMath';

/**
 * buildInsights — the Modal Targeting tab's insight sentences (moved verbatim
 * out of InsightCard in R2-7 so the FR layout prints the same sentences).
 */
const MODE_LABELS = { annual: 'Annual', semiAnnual: 'Semi-Annual', quarterly: 'Quarterly', monthly: 'Monthly' };

export function buildInsights({ totalApi, modeMix, commissionRate, targetCommission }) {
  const insights = [];
  const modes = ['annual', 'semiAnnual', 'quarterly', 'monthly'];

  // Suggest shifting 10% of the most expensive non-annual mode to annual.
  let bestShift = null;
  for (const mode of modes) {
    if (mode === 'annual') continue;
    const weight = modeMix[mode] ?? 0;
    if (weight < 0.05) continue;
    const shift = Math.min(0.1, weight);
    const shifted = {
      ...modeMix,
      [mode]: weight - shift,
      annual: (modeMix.annual ?? 0) + shift,
    };
    const newApi = reverseCalc({ targetCommission, modeMix: shifted, commissionRate });
    const saving = totalApi - newApi;
    if (!bestShift || saving > bestShift.saving) {
      bestShift = { mode, saving };
    }
  }
  if (bestShift && bestShift.saving > 500) {
    insights.push(
      `Shift 10% ${MODE_LABELS[bestShift.mode]} → Annual to reduce required API by ${formatCurrency(Math.round(bestShift.saving / 10) * 10)}.`
    );
  }

  const monthlyPct = Math.round((modeMix.monthly ?? 0) * 100);
  if (monthlyPct > 30) {
    insights.push(
      `High monthly mix (${monthlyPct}%) increases required API significantly. Offering annual or semi-annual where possible will lower the target.`
    );
  }

  return insights;
}
