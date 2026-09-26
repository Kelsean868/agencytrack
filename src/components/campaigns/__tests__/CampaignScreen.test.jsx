// @vitest-environment jsdom
//
// R2 — the Campaign screen (CampaignHeroCard variant="screen").
// Fixture shared with R1 (CampaignHeroCompact.test.jsx): one settled policy
// worth TTD 73,946 of API against a Champion tier of 275,000 / 35 apps, 96
// days left to 31 Dec 2026 ("today" = 26 Sep 2026). A second, lapsed policy is
// added for the "below the gate" scenarios — the campaign lens (progress,
// tiers, pace) never counts it, so API/apps stay 73,946 / 1 in both fixtures;
// only the LEDGER-derived persistency projection (gateMonth) differs.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CampaignHeroCard from '../CampaignHeroCard';

const CAMPAIGN = {
  id: 'xmas26',
  name: 'Christmas Campaign & Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  persistencyGate: { mode: 'binary', basis: 'finalMonth', threshold: 90 },
  tiers: [
    { level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000, accommodation: 'shared' },
    { level: 2, name: 'VIP', api: 375_000, apps: 35, cash: 20_000, accommodation: 'shared' },
    { level: 5, name: 'Pioneer', api: 825_000, apps: 35, cash: 70_000, accommodation: 'double' },
  ],
};

const SETTLED = {
  id: 'p1', productLine: 'life', status: 'settled', isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary', proposedAPI: 73_946, dateIssued: '2026-08-15',
  dateWritten: '2026-08-01', importSource: 'oipa_import', exportDate: '2026-09-15',
  isWritingAgent: true,
};
const LAPSED = {
  id: 'p2', productLine: 'life', status: 'lapsed', isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary', proposedAPI: 12_000, dateIssued: '2026-08-20',
  dateWritten: '2026-08-05', importSource: 'oipa_import', exportDate: '2026-09-15',
  isWritingAgent: true, totalPremiumPaid: null,
};

// Projected Dec persistency ≈ 86.0% (below the 90% gate) — a lapse drags it down.
const BELOW_GATE_POLICIES = [SETTLED, LAPSED];
// No lapse → nothing to net off → projected persistency 100% (at/above gate).
const AT_GATE_POLICIES = [SETTLED];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-26T15:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CampaignHeroCard variant="screen"', () => {
  it('block 1 — progress: API, applications and persistency with "to go" copy', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-progress-api')).toHaveTextContent('73.9K');
    expect(screen.getByTestId('campaign-screen-progress-api')).toHaveTextContent('275K');
    expect(screen.getByTestId('campaign-screen-progress-api')).toHaveTextContent('201.1K to go');
    expect(screen.getByTestId('campaign-screen-progress-apps')).toHaveTextContent('34 to go');
    expect(screen.getByTestId('campaign-screen-progress-persistency')).toHaveTextContent('Below the gate');
    expect(screen.getByTestId('campaign-screen-progress-persistency')).toHaveTextContent(/need 90% in Dec/);
  });

  it('block 2 — what it takes: pace lines, reinstate line hidden at/above the gate', () => {
    const below = render(
      <CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />,
    );
    expect(screen.getByTestId('campaign-screen-takes-api')).toHaveTextContent('14.7K');
    expect(screen.getByTestId('campaign-screen-takes-apps')).toHaveTextContent('2–3');
    expect(screen.getByTestId('campaign-screen-takes-reinstate')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-takes-reinstate')).toHaveTextContent(/lifts persistency to 90%/);
    below.unmount();

    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.queryByTestId('campaign-screen-takes-reinstate')).toBeNull();
  });

  it('block 3 — persistency gate bar: tick at the gate threshold, projected value shown', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    const bar = screen.getByTestId('campaign-screen-gate-bar');
    const tick = bar.querySelector('[data-testid="campaign-screen-gate-bar-tick"]');
    // Gate 90 on an 80–95 scale → (90-80)/15 = 66.7% of the 300-wide viewBox.
    expect(Number(tick.getAttribute('x1'))).toBeCloseTo((66.667 / 100) * 300, 0);
    expect(screen.getByTestId('campaign-screen-gate-bar-value')).toHaveTextContent('86.0');
    expect(screen.getByText(/Judged on December/)).toBeInTheDocument();
  });

  it('block 3 — no fill/value drawn once persistency is unknown (no ledger data)', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={[]} persistencyRecords={[]} />);
    expect(screen.queryByTestId('campaign-screen-gate-bar-value')).toBeNull();
  });

  it('block 4 — tier ladder: every tier, next tier highlighted, "You" row with progress', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-tier-row-Champion')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-tier-row-VIP')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-tier-row-Pioneer')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-tier-next-badge').closest('[data-testid^="campaign-screen-tier-row-"]'))
      .toHaveAttribute('data-testid', 'campaign-screen-tier-row-Champion');
    expect(screen.getByTestId('campaign-screen-you-row')).toHaveTextContent('27% of the way to Champion');
  });

  it('block 5 — what if: slider has a label, and the default pace projects Champion', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    const slider = screen.getByTestId('campaign-screen-whatif-slider');
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '5000');
    expect(slider).toHaveAttribute('max', '40000');
    expect(slider).toHaveAttribute('step', '1000');
    expect(screen.getByLabelText(/What if I write TTD/)).toBe(slider);

    fireEvent.change(slider, { target: { value: '20000' } });
    expect(screen.getByTestId('campaign-screen-whatif-result')).toHaveTextContent('Champion around 6 Dec 2026');
    expect(screen.getByTestId('campaign-screen-whatif-result')).toHaveTextContent(/VIP not reached by 31 Dec 2026 at this pace/);
  });

  it('block 6 — footer', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-footer')).toHaveTextContent('An indication only. Executive Business Development decides.');
  });

  it('loading → skeleton; error → alert; no campaign → nothing', () => {
    const { unmount } = render(<CampaignHeroCard variant="screen" campaign={null} loading />);
    expect(screen.getByRole('status', { name: /Loading campaign progress/i })).toBeInTheDocument();
    unmount();
    const r2 = render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} error />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t load your campaign progress/i);
    r2.unmount();
    const { container } = render(<CampaignHeroCard variant="screen" campaign={null} policies={AT_GATE_POLICIES} />);
    expect(container.firstChild).toBeNull();
  });
});
