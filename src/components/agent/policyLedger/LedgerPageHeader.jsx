/**
 * LedgerPageHeader — block 1 of the Policy Ledger page (LX,
 * docs/briefs/ledger-layout-and-l3.md § LX; mockups D1 at 390, D3 at 1440 in
 * docs/design-system/proposals/ledger-2026-09/).
 *
 *   D1 (mobile):  "Policy ledger" over the mono "HEAD OFFICE LIST AS OF 15 SEP"
 *                 line; Export as a 44 px icon button on the right.
 *   D3 (desktop): the mono line ABOVE a display-size "Policy ledger", the
 *                 search box and the "Export n" button on the right.
 *
 * The header renders in every list state (loading / error / empty / list). It
 * owns no state: search, export and the page actions arrive from the
 * container, so the header search and the mobile search row drive the SAME
 * filter as the list below them.
 */
import React from 'react';
import { Search } from 'lucide-react';
import { dayMonth } from '../../../lib/awardLensView';

/** The one search box — used in the D3 header and the D1 search row. */
export function LedgerSearchInput({ value, onChange, className = '', testId = 'ledger-search' }) {
  return (
    <div className={`flex h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 ${className}`}>
      <Search size={15} className="shrink-0 text-ink-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name or policy no."
        className="w-full min-w-0 bg-transparent text-sm text-ink focus:outline-none"
        aria-label="Search policies"
        data-testid={testId}
      />
    </div>
  );
}

export default function LedgerPageHeader({ exportDate, search, onSearchChange, showSearch = false, exportMenu = null, actions = null }) {
  const year = exportDate ? String(exportDate).slice(0, 4) : '';
  return (
    // fr-fit-any-width: the row WRAPS. On the desktop layout the title column
    // keeps at least 15rem, so beside the sidebar on a narrow window the search
    // and buttons move under the title instead of crushing it to one word per
    // line. Phones never wrap (no minimum there), wide windows stay one row.
    <header className="flex flex-wrap items-center gap-2 lg:items-end lg:gap-3" data-testid="ledger-page-header">
      <div className="flex min-w-0 flex-1 flex-col lg:min-w-[15rem] lg:flex-col-reverse">
        <h2 className="text-[17px] font-bold leading-tight text-ink lg:font-display lg:text-[30px] lg:tracking-tight">
          Policy ledger
        </h2>
        {exportDate && (
          <span className="font-mono text-[11px] uppercase text-ink-muted" data-testid="ledger-ho-as-of">
            Head office list as of {dayMonth(exportDate)}
            <span className="hidden lg:inline"> {year}</span>
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
        {showSearch && (
          <LedgerSearchInput
            value={search}
            onChange={onSearchChange}
            className="hidden w-[280px] lg:flex"
            testId="ledger-search-desktop"
          />
        )}
        {actions}
        {exportMenu}
      </div>
    </header>
  );
}
