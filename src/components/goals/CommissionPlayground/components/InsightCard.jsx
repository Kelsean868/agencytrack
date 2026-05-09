import { Lightbulb } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import { reverseCalc } from '../utils/commissionMath';

const MODE_LABELS = { annual: 'Annual', semiAnnual: 'Semi-Annual', quarterly: 'Quarterly', monthly: 'Monthly' };

function buildInsights({ totalApi, modeMix, commissionRate, targetCommission }) {
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

export default function InsightCard({ totalApi, modeMix, commissionRate, targetCommission }) {
  if (totalApi <= 0) return null;
  const insights = buildInsights({ totalApi, modeMix, commissionRate, targetCommission });
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
      <div className="flex items-center gap-2">
        <Lightbulb size={14} className="text-primary shrink-0" />
        <p className="text-xs font-semibold text-primary">Insights</p>
      </div>
      <ul className="flex flex-col gap-1.5 list-none">
        {insights.map((text, i) => (
          <li key={i} className="text-xs text-ink leading-snug">{text}</li>
        ))}
      </ul>
    </div>
  );
}
