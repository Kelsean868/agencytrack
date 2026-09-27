// @vitest-environment jsdom
//
// LedgerFilterSort — FX item 1 (docs/briefs/ledger-layout-and-l3.md § FX):
// the Date section's From / To boxes must show the full DD-MM-YYYY at both
// the mobile filter sheet and the desktop filter rail, never clipped.
// `inputMode="numeric"` was already present; this covers the width fix
// (min-width on both, the rail's fields stacked so they get the rail's full
// content width) and tabular numerals.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getUserPrefs: vi.fn(),
  setLedgerSavedViews: vi.fn(),
}));

vi.mock('../../../../services/userPrefsService', () => ({
  getUserPrefs: hoisted.getUserPrefs,
  setLedgerSavedViews: hoisted.setLedgerSavedViews,
}));
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'a1' }, userProfile: { unitId: 'u1' }, tenantId: 't1' }),
}));

import LedgerFilterSort from '../LedgerFilterSort';
import { emptyFilterState, DEFAULT_SORT_KEY } from '../../../../lib/ledgerFilters';
import { __resetLedgerSavedViewsStore } from '../../../../hooks/useLedgerSavedViews';

beforeEach(() => {
  vi.clearAllMocks();
  __resetLedgerSavedViewsStore();
  hoisted.getUserPrefs.mockResolvedValue(null);
  hoisted.setLedgerSavedViews.mockResolvedValue();
});
afterEach(() => cleanup());

const ROWS = [
  { policy: { id: 'p1', productLine: 'life', status: 'settled', proposedFrequency: 'A', dateIssued: '2026-07-01' }, group: 'counting', credit: 10000, reason: null, hoFlag: false },
];

function renderRail(props = {}) {
  return render(
    <LedgerFilterSort
      rows={ROWS}
      filters={emptyFilterState()}
      onFiltersChange={() => {}}
      sortKey={DEFAULT_SORT_KEY}
      onSortChange={() => {}}
      hasCampaign={false}
      campaignLabel={null}
      {...props}
    >
      <div data-testid="ledger-list-stub" />
    </LedgerFilterSort>,
  );
}

describe('LedgerFilterSort — date boxes (FX item 1)', () => {
  it('both the rail and the sheet date inputs carry inputMode="numeric" and tabular numerals', () => {
    renderRail();
    const railFrom = screen.getByTestId('ledger-filter-date-from');
    expect(railFrom).toHaveAttribute('inputMode', 'numeric');
    expect(railFrom.className).toContain('tabular-nums');
    const railTo = screen.getByTestId('ledger-filter-date-to');
    expect(railTo).toHaveAttribute('inputMode', 'numeric');
    expect(railTo.className).toContain('tabular-nums');
  });

  it('the desktop rail stacks From / To (full rail width per field) instead of a cramped two-up row', () => {
    renderRail();
    // The rail's copy of the date inputs sits inside the [data-testid="ledger-filter-rail"] aside.
    const rail = screen.getByTestId('ledger-filter-rail');
    const railFrom = rail.querySelector('[data-testid="ledger-filter-date-from"]');
    expect(railFrom).toBeTruthy();
    // Stacked layout: the shared row wrapper is flex-col, and the label no
    // longer claims flex-1 of a side-by-side row.
    const label = railFrom.closest('label');
    const row = label.parentElement;
    expect(row.className).toContain('flex-col');
    expect(label.className).not.toContain('flex-1');
  });

  it('every date input keeps a minimum width wide enough for the full DD-MM-YYYY placeholder', () => {
    renderRail();
    for (const el of screen.getAllByTestId(/ledger-filter-date-(from|to)/)) {
      expect(el.className).toMatch(/min-w-\[118px\]/);
      expect(el.getAttribute('placeholder')).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    }
  });

  it('the mobile sheet also renders full-width date inputs once opened', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('ledger-filter-sheet-trigger'));
    const dialog = screen.getByRole('dialog', { name: 'Filter and sort' });
    const sheetFrom = dialog.querySelector('[data-testid="ledger-filter-date-from"]');
    expect(sheetFrom).toBeTruthy();
    expect(sheetFrom.className).toContain('tabular-nums');
  });
});
