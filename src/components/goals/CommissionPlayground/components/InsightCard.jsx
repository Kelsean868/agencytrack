import React from 'react';
import { Lightbulb } from 'lucide-react';
import { buildInsights } from '../utils/insights';

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
