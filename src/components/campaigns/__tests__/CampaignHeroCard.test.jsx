// @vitest-environment jsdom
//
// Hero-ledger H3 — CampaignHeroCard is the one presentational hero reused on
// the agent Awards tab and on HomeV2. It reads the SAME `derivePolicyLens`
// call CampaignLensPanel makes (C-D10), never weekly submissions — the exact
// gap H1/H2 left behind ("the campaign card's own lower progress bars still
// read weekly reports").

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampaignHeroCard from '../CampaignHeroCard';

const CAMPAIGN = {
  id: 'xmas26',
  name: 'Christmas Campaign and Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  persistencyGate: { mode: 'binary', basis: 'periodAggregate', threshold: 90 },
  tiers: [
    { level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000, accommodation: 'shared' },
    { level: 5, name: 'Pioneer', api: 825_000, apps: 35, cash: 70_000, accommodation: 'double' },
  ],
};

const NON_TIERED_CAMPAIGN = { id: 'x', name: 'Placement thing', structure: 'placement' };

// The real Christmas Campaign's gate is judged at a single final month
// (December 2026 — CONTEXT.md's C5 authoring note), not a period aggregate.
// Used for the preview-vs-known-figure precedence tests, since a
// periodAggregate basis (CAMPAIGN above) folds a single month straight into
// the known figure and never exercises the preview path at all.
const FINAL_MONTH_CAMPAIGN = {
  ...CAMPAIGN,
  persistencyGate: { mode: 'binary', basis: 'finalMonth', threshold: 90 },
};

const policy = (over = {}) => ({
  id: 'p1',
  productLine: 'life',
  status: 'settled',
  isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary',
  proposedAPI: 25_000,
  dateIssued: '2026-08-15',
  dateWritten: '2026-08-01',
  importSource: 'oipa_import',
  exportDate: '2026-09-15',
  ...over,
});

const POLICIES = [
  policy({ id: 'p1' }),
  policy({ id: 'p2' }),
  policy({ id: 'p3' }),
];

describe('CampaignHeroCard', () => {
  it('returns null when campaign is absent', () => {
    const { container } = render(<CampaignHeroCard campaign={null} policies={POLICIES} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for a non-tiered campaign', () => {
    const { container } = render(<CampaignHeroCard campaign={NON_TIERED_CAMPAIGN} policies={POLICIES} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a loading skeleton', () => {
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={POLICIES} loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-hero-card')).not.toBeInTheDocument();
  });

  it('renders an error state', () => {
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={POLICIES} error />);
    expect(screen.getByTestId('campaign-hero-card-error')).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-hero-card')).not.toBeInTheDocument();
  });

  it('reads the ledger, not weekly submissions: 3 imported settled policies count 3 apps / TTD 75,000 against the level in reach', () => {
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={POLICIES} />);
    expect(screen.getByTestId('campaign-hero-card')).toBeInTheDocument();

    const apiRow = screen.getByTestId('campaign-hero-row-api');
    expect(apiRow.textContent).toContain('TTD 75,000');
    expect(apiRow.textContent).toContain('TTD 275,000'); // Champion — the level in reach, not Pioneer's ceiling

    const appsRow = screen.getByTestId('campaign-hero-row-apps');
    expect(appsRow.textContent).toContain('3');
    expect(appsRow.textContent).toContain('35');

    expect(screen.getByText(/Toward Champion/)).toBeInTheDocument();
  });

  it('shows "—" (never a fabricated 0%) when no persistency record covers the campaign period', () => {
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={POLICIES} persistencyRecords={[]} />);
    const persistencyRow = screen.getByTestId('campaign-hero-row-persistency');
    expect(persistencyRow.textContent).toContain('—');
    expect(persistencyRow.textContent).not.toMatch(/\b0%/);
    expect(persistencyRow.textContent).toContain('90%');
    expect(screen.queryByTestId('campaign-hero-persistency-bar-fill')).not.toBeInTheDocument();
    expect(screen.getByTestId('campaign-hero-persistency-unknown')).toBeInTheDocument();
  });

  it('previews the latest 24-month-model reading below 90% as a warning, never as the gate figure itself', () => {
    // Not December (the campaign's finalMonth), so the actual gate figure is
    // still unknown — this record is on the 24-month model (>= 2026-09) and
    // becomes the preview.
    const records = [{ monthKey: '2026-09', grossSettled: 100_000, netSettled: 80_000 }];
    render(<CampaignHeroCard campaign={FINAL_MONTH_CAMPAIGN} policies={POLICIES} persistencyRecords={records} />);
    const persistencyRow = screen.getByTestId('campaign-hero-row-persistency');
    // Two decimals on the preview (ruling R-a), labelled with what it is.
    expect(persistencyRow.textContent).toContain('80.00% confirmed, Sep 2026');
    expect(persistencyRow.textContent).toContain('90%');

    const note = screen.getByTestId('campaign-hero-persistency-preview-note');
    expect(note.textContent).toBe('Gate judged on December 2026 · 90% needed');
    expect(note.className).toContain('text-warning-ink');

    const fill = screen.getByTestId('campaign-hero-persistency-bar-fill');
    expect(fill.className).toContain('bg-warning');
  });

  it('a December (finalMonth) reading wins over an earlier 24-month preview', () => {
    const records = [
      { monthKey: '2026-09', grossSettled: 100_000, netSettled: 60_000 }, // preview-eligible, would read 60%
      // persistencyPctAtFinalMonth reads the record's own `persistency`
      // fraction directly (campaignEngine.js), not grossSettled/netSettled —
      // a real saved record carries both (calculations.js `deriveAll`).
      { monthKey: '2026-12', grossSettled: 100_000, netSettled: 92_000, persistency: 0.92 },
    ];
    render(<CampaignHeroCard campaign={FINAL_MONTH_CAMPAIGN} policies={POLICIES} persistencyRecords={records} />);
    const persistencyRow = screen.getByTestId('campaign-hero-row-persistency');
    expect(persistencyRow.textContent).toContain('92.00%');
    expect(persistencyRow.textContent).not.toContain('60%');
    expect(persistencyRow.textContent).not.toContain('Sep 2026');
    expect(screen.queryByTestId('campaign-hero-persistency-preview-note')).not.toBeInTheDocument();

    const fill = screen.getByTestId('campaign-hero-persistency-bar-fill');
    expect(fill.className).toContain('bg-success');
  });

  it('reads a real persistency record against the 90% gate and clears it', () => {
    const records = [{ monthKey: '2026-08', grossSettled: 100_000, netSettled: 95_000 }];
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={POLICIES} persistencyRecords={records} />);
    const persistencyRow = screen.getByTestId('campaign-hero-row-persistency');
    expect(persistencyRow.textContent).toContain('95.00%');
    expect(persistencyRow.textContent).toContain('90%');
    expect(screen.queryByTestId('campaign-hero-persistency-unknown')).not.toBeInTheDocument();
  });

  it('says the campaign does not gate on persistency when the gate is disabled', () => {
    const ungated = { ...CAMPAIGN, persistencyGateEnabled: false };
    render(<CampaignHeroCard campaign={ungated} policies={POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-hero-persistency-ungated')).toBeInTheDocument();
  });

  it('shows the as-at export date from the portfolio import', () => {
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={POLICIES} />);
    const note = screen.getByTestId('campaign-hero-as-at');
    expect(note.textContent).toContain('As at');
    expect(note.textContent).toContain('2026-09-15'); // ledgerExportDate — latest exportDate among the fixture policies
  });
});
