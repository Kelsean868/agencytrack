// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LedgerSourceChip, ContributionBar, AwardProvenancePanel } from '../awardProvenance';
import { deriveAwardProvenance } from '../../../lib/awardProvenance';

afterEach(() => cleanup());

const PROV = deriveAwardProvenance({
  id: 'mdrt', name: 'MDRT 2026',
  criteria: [{ label: 'Settled API', current: 487000, target: 500000, unit: 'TTD', met: false }],
});

describe('LedgerSourceChip', () => {
  it('states the honest source — settlements by default, ledger when live', () => {
    const { rerender } = render(<LedgerSourceChip sourceLive={false} source="CONFIRMED SETTLEMENTS" />);
    expect(screen.getByTestId('ledger-source-chip').textContent).toMatch(/FROM CONFIRMED SETTLEMENTS/);
    rerender(<LedgerSourceChip sourceLive source="POLICY LEDGER" />);
    expect(screen.getByTestId('ledger-source-chip').textContent).toMatch(/LIVE FROM POLICY LEDGER/);
  });
});

describe('ContributionBar', () => {
  it('renders the (real) base segment; returns null without provenance', () => {
    const { container, rerender } = render(<ContributionBar provenance={PROV} />);
    expect(screen.getByTestId('award-contribution-bar')).toBeInTheDocument();
    rerender(<ContributionBar provenance={null} />);
    expect(container.querySelector('[data-testid="award-contribution-bar"]')).toBeNull();
  });
});

describe('AwardProvenancePanel', () => {
  it('renders the how-calculated block, chip, bar, and the pending campaign row', () => {
    render(<AwardProvenancePanel provenance={PROV} />);
    expect(screen.getByTestId('award-provenance-panel')).toBeInTheDocument();
    expect(screen.getByText(/How this is calculated/i)).toBeInTheDocument();
    expect(screen.getByTestId('ledger-source-chip')).toBeInTheDocument();
    expect(screen.getByTestId('award-contribution-bar')).toBeInTheDocument();
    // Campaign attribution is honestly surfaced as pending (not fabricated)
    expect(screen.getByTestId('award-provenance-campaign-pending')).toBeInTheDocument();
  });

  it('returns null without provenance', () => {
    const { container } = render(<AwardProvenancePanel provenance={null} />);
    expect(container.firstChild).toBeNull();
  });
});
