/**
 * LedgerTable — L2 desktop table (D3 mockup: docs/design-system/proposals/
 * ledger-2026-09/D3-Ledger-Desktop.dc.html). Flat, sortable, one row per
 * filtered `deriveAwardLens` row, replacing the grouped 2-column card grid at
 * `lg` and above. `AwardLensGroups` (mobile/tablet) stays unchanged.
 *
 * v3 non-negotiable #10: the sticky header lives INSIDE the grid it heads (the
 * `<thead>`'s own `position: sticky; top: 0`), never as a sibling element.
 * Tabular numerals on every numeric column (v2 non-negotiable pairing).
 */
import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { POLICY_STATUS_LABELS } from '../../../constants/policyLifecycle';
import { policyValue } from '../../../lib/policyLedgerDerivation';
import { toDisplayDate, humanizeToken } from '../../../lib/ledgerFilters';
import { toDateStr } from '../../../lib/policyCampaignLens';
import { STATUS_SOURCE_IMPORT } from '../../../lib/portfolioImport/oipaImportConfig';

const STATUS_PILL = {
  settled: 'text-success-ink bg-success-tint',
  submitted: 'text-warning-ink bg-warning-tint',
  ntu: 'text-danger-ink bg-danger-tint',
  denied: 'text-danger-ink bg-danger-tint',
  lapsed: 'text-ink-muted bg-surface-muted',
  rated: 'text-primary bg-primary-tint',
  postponed: 'text-warning-ink bg-warning-tint',
  written: 'text-primary bg-primary-tint',
};

const HEADERS = [
  { key: 'client', label: 'Client' },
  { key: 'policy', label: 'Policy' },
  { key: 'product', label: 'Product' },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'issued', label: 'Issued', sortKey: 'issuedDesc' },
  { key: 'api', label: 'API', align: 'right', sortKey: 'apiDesc' },
  { key: 'credit', label: 'Counts toward', align: 'right' },
  { key: 'flag', label: 'Flag' },
];

function Th({ header, sortKey, onSort }) {
  const isSorted = header.sortKey === sortKey;
  const content = header.sortKey ? (
    <button
      type="button"
      onClick={() => onSort(header.sortKey)}
      className="flex items-center gap-1 font-inherit"
      data-testid={`ledger-table-sort-${header.key}`}
    >
      {header.label.toUpperCase()}{isSorted ? ' ↓' : ''}
    </button>
  ) : header.label.toUpperCase();
  return (
    <th
      scope="col"
      className={`sticky top-0 z-[1] h-10 whitespace-nowrap border-b border-border bg-surface px-3 font-mono text-[10px] font-semibold tracking-wide text-ink-muted ${header.align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {content}
    </th>
  );
}

export default function LedgerTable({ rows, sortKey, onSort, onOpen }) {
  return (
    <div className="hidden overflow-x-auto rounded-[18px] border border-border bg-card lg:block" data-testid="ledger-table">
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {HEADERS.map((h) => <Th key={h.key} header={h} sortKey={sortKey} onSort={onSort} />)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={HEADERS.length} className="px-3 py-10 text-center text-sm text-ink-muted" data-testid="ledger-table-empty">
                  No policies match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const p = r.policy;
              const fromHo = p?.statusSource === STATUS_SOURCE_IMPORT;
              return (
                <tr
                  key={p.id}
                  className="cursor-pointer hover:bg-surface/60"
                  onClick={() => onOpen?.(p)}
                  data-testid={`ledger-table-row-${p.id}`}
                >
                  <td className="sticky left-0 z-[1] h-[52px] whitespace-nowrap border-b border-border/60 bg-card px-3 text-[13px] font-bold text-ink">{p.ownerName || '—'}</td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 font-mono text-xs text-ink-muted">{p.policyNumber ? `···${String(p.policyNumber).slice(-4)}` : '—'}</td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-[13px] text-ink">{humanizeToken(p.policyClass)}</td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-[13px]">
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${STATUS_PILL[p.status] ?? 'bg-surface-muted text-ink-muted'}`}>
                      {POLICY_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-[13px] text-ink-muted">{fromHo ? 'Head office' : 'Self'}</td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-[13px] tabular-nums text-ink">{toDisplayDate(toDateStr(p.dateSubmitted) ?? toDateStr(p.dateWritten)) || '—'}</td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-[13px] tabular-nums text-ink">{toDisplayDate(toDateStr(p.dateIssued)) || '—'}</td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-right text-[13px] font-bold tabular-nums text-ink">{formatCurrency(policyValue(p))}</td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-right text-[13px] font-semibold tabular-nums text-primary">
                    {r.group === 'pending' ? 'When settled' : formatCurrency(r.credit?.api ?? 0)}
                  </td>
                  <td className="h-[52px] whitespace-nowrap border-b border-border/60 px-3 text-[12px] font-semibold text-warning-ink">{r.hoFlag ? 'Not on HO list' : <span className="text-ink-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
