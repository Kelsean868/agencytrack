import React from 'react';
import { formatCurrency } from '../../../../utils/formatters';

const MODE_LABELS = {
  annual:     'Annual',
  semiAnnual: 'Semi-Annual',
  quarterly:  'Quarterly',
  monthly:    'Monthly',
};

export default function CommissionBreakdownTable({ breakdown }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-2 py-2 text-ink-muted font-semibold">Mode</th>
            <th className="text-right px-2 py-2 text-ink-muted font-semibold">Mix</th>
            <th className="text-right px-2 py-2 text-ink-muted font-semibold">API Required</th>
            <th className="text-right px-2 py-2 text-ink-muted font-semibold">Commission</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((row, i) => (
            <tr
              key={row.mode}
              className={i % 2 === 0 ? 'bg-card-raised' : 'bg-card'}
            >
              <td className="px-2 py-2 font-medium text-ink">{MODE_LABELS[row.mode]}</td>
              <td className="px-2 py-2 text-right text-ink tabular-nums">
                {Math.round(row.weight * 100)}%
              </td>
              <td className="px-2 py-2 text-right text-ink tabular-nums">
                {formatCurrency(Math.round(row.modeApi / 10) * 10)}
              </td>
              <td className="px-2 py-2 text-right text-ink tabular-nums">
                {formatCurrency(Math.round(row.commission))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
