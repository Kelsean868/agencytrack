import React from 'react';
import { formatCurrency } from '../../utils/formatters';

/**
 * ProductionTable — whiteboard-format breakdown table.
 *
 * rows: [{ label, nb: {apps, api}, ppp: {apps, apiIncrease}, lmps: {apiCredit}, total, highlight? }]
 * showRankColumn: show a leading # rank column
 * period: 'week'|'mtd'|'quarter'|'ytd' — shown in header context
 */
export default function ProductionTable({ rows = [], showRankColumn = false, period }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-ink-muted text-sm">
        No production data for this period.
      </div>
    );
  }

  const periodLabel = {
    week: 'This Week', mtd: 'Month to Date', quarter: 'This Quarter', ytd: 'Year to Date',
  }[period] ?? '';

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-border">
            {showRankColumn && (
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-muted w-8">#</th>
            )}
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Agent {periodLabel && <span className="normal-case text-ink-muted/60">— {periodLabel}</span>}
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-muted" colSpan={2}>
              New Business
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-muted" colSpan={2}>
              API Adjustments
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-primary">
              Total API
            </th>
          </tr>
          <tr className="border-b border-border bg-surface">
            {showRankColumn && <th className="px-3 py-1" />}
            <th className="px-3 py-1" />
            <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium">Apps</th>
            <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium">NB API</th>
            <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium">PPP</th>
            <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium">LMPS</th>
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label + i}
              className={`border-b border-border last:border-0 transition-colors ${
                row.highlight
                  ? 'bg-primary/5 font-semibold'
                  : 'hover:bg-surface'
              }`}
            >
              {showRankColumn && (
                <td className="px-3 py-2.5 text-ink-muted text-xs tabular-nums">{row.rank ?? i + 1}</td>
              )}
              <td className="px-3 py-2.5 text-ink font-medium max-w-[140px] truncate">
                {row.label}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                {row.nb?.apps ?? 0}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                {formatCurrency(row.nb?.api ?? 0)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                {row.ppp?.apiIncrease ? formatCurrency(row.ppp.apiIncrease) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                {row.lmps?.apiCredit ? formatCurrency(row.lmps.apiCredit) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-primary">
                {formatCurrency(row.total ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
