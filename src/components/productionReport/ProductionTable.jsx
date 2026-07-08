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

  // §5 dense-table contract: identity columns (rank + agent) are sticky-left
  // as a matched pair — the rank column is given an explicit fixed width on
  // every row (header + body) so the agent column's left offset is stable.
  const rankColClass = 'w-8 sticky left-0 bg-surface';
  const agentLeftClass = showRankColumn ? 'left-8' : 'left-0';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Card-scoped vertical + horizontal scroll (§5) — scroll lives inside
          this card, never the page. */}
      <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[560px] border-separate border-spacing-0">
          <thead>
            <tr>
              {showRankColumn && (
                <th className={`px-3 py-2 h-8 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-40 ${rankColClass}`}>
                  #
                </th>
              )}
              <th className={`px-3 py-2 h-8 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-40 ${agentLeftClass} bg-surface`}>
                Agent {periodLabel && <span className="normal-case">— {periodLabel}</span>}
              </th>
              <th className="px-3 py-2 h-8 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-30 bg-surface" colSpan={2}>
                New Business
              </th>
              <th className="px-3 py-2 h-8 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-30 bg-surface" colSpan={2}>
                API Adjustments
              </th>
              <th className="px-3 py-2 h-8 text-right text-[10px] font-semibold uppercase tracking-wide text-primary border-b border-border sticky top-0 z-30 bg-surface">
                Total API
              </th>
            </tr>
            <tr>
              {showRankColumn && (
                <th className={`px-3 py-1 border-b border-border sticky top-8 z-30 ${rankColClass}`} />
              )}
              <th className={`px-3 py-1 border-b border-border sticky top-8 z-30 ${agentLeftClass} bg-surface`} />
              <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium border-b border-border sticky top-8 z-20 bg-surface">Apps</th>
              <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium border-b border-border sticky top-8 z-20 bg-surface">NB API</th>
              <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium border-b border-border sticky top-8 z-20 bg-surface">PPP</th>
              <th className="px-3 py-1 text-right text-[10px] text-ink-muted font-medium border-b border-border sticky top-8 z-20 bg-surface">LMPS</th>
              <th className="px-3 py-1 border-b border-border sticky top-8 z-20 bg-surface" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rowBg = row.highlight ? 'bg-primary/5' : 'bg-card group-hover:bg-surface';
              return (
                <tr
                  key={row.label + i}
                  className={`group border-b border-border last:border-0 transition-colors ${
                    row.highlight
                      ? 'bg-primary/5 font-semibold'
                      : 'hover:bg-surface'
                  }`}
                >
                  {showRankColumn && (
                    <td className={`px-3 py-2.5 text-ink-muted text-xs text-right tabular-nums sticky z-10 ${rowBg} left-0 w-8`}>
                      {row.rank ?? i + 1}
                    </td>
                  )}
                  <td
                    className={`px-3 py-2.5 text-ink font-medium max-w-[140px] truncate sticky z-10 ${rowBg} ${agentLeftClass}`}
                    title={row.label}
                  >
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Live footer count (§5) */}
      <div className="px-3 py-2 border-t border-border bg-surface text-xs text-ink-muted">
        {rows.length} agent{rows.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
