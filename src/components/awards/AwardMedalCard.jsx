import React from 'react';
import { Info } from 'lucide-react';
import AwardMedal from './AwardMedal';
import { getAwardIcon } from './awardIconMap';
import DataSourceBadge from '../productionReport/DataSourceBadge';
import { formatCurrency } from '../../utils/formatters';

function formatCriterionValue(c) {
  if (c.unit === 'TTD') return formatCurrency(c.current);
  if (c.unit === '%')   return `${Number(c.current).toFixed(0)}%`;
  return String(c.current);
}

function formatCriterionTarget(c) {
  if (c.unit === 'TTD') return formatCurrency(c.target);
  if (c.unit === '%')   return `${c.target}%`;
  return String(c.target);
}

function deriveState(award) {
  if (award.eligible)     return 'qualified';
  if (award.inContention) return 'contention';
  return 'locked';
}

const STATE_BLOCK_CLASS = {
  qualified:  'bg-success-tint',
  contention: 'bg-warning-tint',
  locked:     'bg-surface-muted',
};

const STATE_LABEL_CLASS = {
  qualified:  'text-success',
  contention: 'text-warning',
  locked:     'text-ink-muted',
};

const STATE_LABEL_TEXT = {
  qualified:  'Qualified',
  contention: 'In Contention',
  locked:     'Not Eligible',
};

// Primary criterion summary — pulls the first criterion's "current / target" line.
function primaryCriterionLine(award) {
  const primary = award.criteria?.[0];
  if (!primary) return award.prize;
  return `${formatCriterionValue(primary)} / ${formatCriterionTarget(primary)}`;
}

export default function AwardMedalCard({ award }) {
  const state = deriveState(award);
  const Icon  = getAwardIcon(award.id);
  const blockClass = STATE_BLOCK_CLASS[state];
  const labelClass = STATE_LABEL_CLASS[state];
  const labelText  = STATE_LABEL_TEXT[state];

  return (
    <div className={`badge-item ${state === 'qualified' || state === 'contention' ? 'earned' : 'locked'} relative`}>
      {award.dataSource && (
        <div className="absolute top-2 right-2">
          <DataSourceBadge source={award.dataSource} />
        </div>
      )}

      <AwardMedal state={state} icon={Icon} name={award.name} />

      <div className="badge-name">{award.name}</div>
      <div className="badge-sub">{award.prize}</div>

      <div className={`mt-2 px-2 py-1.5 rounded-lg ${blockClass}`}>
        <div className={`text-[10px] font-bold uppercase tracking-wider ${labelClass}`}>
          {labelText}
        </div>
        <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
          {primaryCriterionLine(award)}
        </div>
      </div>

      {award.note && (
        <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-warning/10 border border-warning/20 text-left">
          <Info size={11} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-[10px] text-warning leading-snug">{award.note}</p>
        </div>
      )}
    </div>
  );
}
