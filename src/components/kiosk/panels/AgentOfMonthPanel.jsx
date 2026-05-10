import React from 'react';
import { Trophy, Award, TrendingUp } from 'lucide-react';
import AOMCategoryColumn from './AOMCategoryColumn';

const CATEGORIES = [
  { key: 'api',      label: 'API Champion',    Icon: Trophy },
  { key: 'apps',     label: 'Apps Leader',     Icon: Award },
  { key: 'activity', label: 'Activity Winner', Icon: TrendingUp },
];

export default function AgentOfMonthPanel({ agentOfMonthData }) {
  const hasAnyWinner =
    agentOfMonthData &&
    CATEGORIES.some((c) => agentOfMonthData[c.key]);

  if (!agentOfMonthData || !hasAnyWinner) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-10">
        <Trophy size={80} className="text-primary opacity-30" aria-hidden="true" />
        <p className="text-4xl font-display font-bold text-ink-muted text-center">
          Awards pending for this month
        </p>
      </div>
    );
  }

  const monthLabel = agentOfMonthData.monthKey
    ? new Date(agentOfMonthData.monthKey + '-01').toLocaleDateString('en-TT', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="w-full h-full flex flex-col p-10">
      <div className="flex items-baseline gap-4 mb-8">
        <h1 className="text-5xl font-display font-bold text-ink tracking-tight">
          Agent of the Month
        </h1>
        {monthLabel && (
          <span className="text-2xl text-ink-muted font-semibold">{monthLabel}</span>
        )}
      </div>

      <div className="flex-1 grid grid-cols-3 gap-12 min-h-0 items-center">
        {CATEGORIES.map(({ key, label, Icon }, i) => (
          <AOMCategoryColumn
            key={key}
            category={key}
            label={label}
            Icon={Icon}
            winner={agentOfMonthData[key] ?? null}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
