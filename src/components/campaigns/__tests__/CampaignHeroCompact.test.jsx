// @vitest-environment jsdom
//
// Home redesign R1 block 3 — the compact campaign card (CampaignHeroCard
// variant="compact"). Pace maths, persistency warning tone, loading / error /
// empty, and the Details link.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CampaignHeroCard from '../CampaignHeroCard';
import { campaignPace, formatCompact, paceLine } from '../../../lib/campaignPace';

const CAMPAIGN = {
  id: 'xmas26',
  name: 'Christmas Campaign & Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  persistencyGate: { mode: 'binary', basis: 'finalMonth', threshold: 90 },
  tiers: [
    { level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000, accommodation: 'shared' },
    { level: 5, name: 'Pioneer', api: 825_000, apps: 35, cash: 70_000, accommodation: 'double' },
  ],
};

// One settled policy worth TTD 73,946 — the mockup's figure.
const POLICIES = [{
  id: 'p1',
  productLine: 'life',
  status: 'settled',
  isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary',
  proposedAPI: 73_946,
  dateIssued: '2026-08-15',
  dateWritten: '2026-08-01',
  importSource: 'oipa_import',
  exportDate: '2026-09-15',
}];

beforeEach(() => {
  // 26 Sep 2026 → 96 days to 31 Dec 2026.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-26T15:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('campaign pace maths', () => {
  it('73,946 of 275,000 with 96 days left → 14.7K a week', () => {
    const pace = campaignPace({ apiCurrent: 73_946, apiTarget: 275_000, appsCurrent: 3, appsTarget: 35, daysLeft: 96 });
    expect(pace.weeksLeft).toBeCloseTo(96 / 7, 10);
    expect(pace.apiRemaining).toBe(201_054);
    expect(pace.apiPerWeek).toBeCloseTo(14_660.19, 2); // 201,054 ÷ (96 ÷ 7)
    expect(formatCompact(pace.apiPerWeek)).toBe('14.7K');
    // 32 apps over 13.7 weeks = 2.33 a week → "2–3".
    expect(paceLine(pace)).toBe('Pace: TTD 14.7K + 2–3 apps / week');
  });

  it('no pace once the campaign has ended', () => {
    expect(campaignPace({ apiCurrent: 1, apiTarget: 2, appsCurrent: 0, appsTarget: 1, daysLeft: 0 })).toBeNull();
    expect(paceLine(null)).toBeNull();
  });

  it('drops the part already met', () => {
    const pace = campaignPace({ apiCurrent: 300_000, apiTarget: 275_000, appsCurrent: 30, appsTarget: 35, daysLeft: 35 });
    expect(paceLine(pace)).toBe('Pace: 1 apps / week');
  });

  it('formatCompact', () => {
    expect(formatCompact(73_946)).toBe('73.9K');
    expect(formatCompact(275_000)).toBe('275K');
    expect(formatCompact(950)).toBe('950');
  });
});

describe('CampaignHeroCard variant="compact"', () => {
  it('renders title, days-left chip, next tier with cash, three donuts and the pace line', () => {
    render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-compact-card')).toHaveTextContent('Christmas Campaign & Retreat 2026');
    expect(screen.getByTestId('campaign-compact-days')).toHaveTextContent('96 days left');
    expect(screen.getByTestId('campaign-compact-next')).toHaveTextContent('Next tier: Champion · TTD 7,000 cash');
    expect(screen.getByTestId('campaign-compact-api')).toHaveTextContent('27%');
    expect(screen.getByTestId('campaign-compact-api')).toHaveTextContent('73.9K / 275K');
    expect(screen.getByTestId('campaign-compact-apps')).toHaveTextContent('1/35');
    expect(screen.getByTestId('campaign-compact-apps')).toHaveTextContent('34 to go');
    // 34 apps / 13.71 weeks = 2.48 → "2–3".
    expect(screen.getByTestId('campaign-compact-pace')).toHaveTextContent('Pace: TTD 14.7K + 2–3 apps / week');
  });

  it('persistency below the gate → warning tone, gate tick at 90%', () => {
    const records = [{ monthKey: '2026-09', grossSettled: 100_000, netSettled: 86_600 }];
    render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={POLICIES} persistencyRecords={records} />);
    const cell = screen.getByTestId('campaign-compact-persistency');
    expect(cell).toHaveTextContent('86.60%');
    expect(cell).toHaveTextContent('Gate 90% · Dec');
    const donut = screen.getByTestId('campaign-compact-persistency-donut');
    expect(donut.querySelector('[data-testid="donut-arc"]').getAttribute('class')).toContain('stroke-warning');
    expect(donut.querySelector('[data-testid="donut-tick"]').getAttribute('transform')).toBe('rotate(324 50 50)');
  });

  it('persistency at or above the gate → teal tone', () => {
    const records = [{ monthKey: '2026-09', grossSettled: 100_000, netSettled: 93_000 }];
    render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={POLICIES} persistencyRecords={records} />);
    const arc = screen.getByTestId('campaign-compact-persistency-donut').querySelector('[data-testid="donut-arc"]');
    expect(arc.getAttribute('class')).toContain('stroke-primary');
    expect(arc.getAttribute('class')).not.toContain('stroke-warning');
  });

  it('unknown persistency shows "—", never a confident 0%', () => {
    render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={POLICIES} persistencyRecords={[]} />);
    const cell = screen.getByTestId('campaign-compact-persistency');
    expect(cell).toHaveTextContent('—');
    expect(cell).toHaveTextContent('Not yet known');
    expect(cell.textContent).not.toMatch(/\b0%/);
  });

  it('Details opens the campaign screen', () => {
    const onOpenDetails = vi.fn();
    render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={POLICIES} onOpenDetails={onOpenDetails} />);
    fireEvent.click(screen.getByRole('button', { name: /details for/i }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('pending (L0): faint arcs on API + Applications, "+x submitted" sub-lines, and the legend', () => {
    // policyCampaignLensCredit-style: a settled + a submitted policy so the
    // lens itself derives a non-zero `pending`.
    const policies = [
      ...POLICIES,
      {
        id: 'p2', productLine: 'life', status: 'submitted', isSelfOrFamily: false,
        newBusinessType: 'nb_ordinary', proposedAPI: 36_000, dateSubmitted: '2026-09-01',
      },
    ];
    render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={policies} persistencyRecords={[]} />);
    const apiCell = screen.getByTestId('campaign-compact-api');
    expect(apiCell.querySelector('[data-testid="donut-arc-pending"]')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-compact-api-pending')).toHaveTextContent('+36K submitted');
    const appsCell = screen.getByTestId('campaign-compact-apps');
    expect(appsCell.querySelector('[data-testid="donut-arc-pending"]')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-compact-apps-pending')).toHaveTextContent('+1 submitted');
    expect(screen.getByTestId('ring-legend')).toHaveTextContent('Settled — counts');
    expect(screen.getByTestId('ring-legend')).toHaveTextContent('Submitted — waiting to settle');
  });

  it('no pending: no faint arcs, no sub-lines, no legend', () => {
    render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={POLICIES} persistencyRecords={[]} />);
    expect(screen.queryByTestId('donut-arc-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('campaign-compact-api-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('campaign-compact-apps-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ring-legend')).not.toBeInTheDocument();
  });

  it('loading → skeleton; error → inline alert; no campaign → nothing', () => {
    const { unmount } = render(<CampaignHeroCard variant="compact" campaign={null} loading />);
    expect(screen.getByTestId('campaign-compact-loading')).toBeInTheDocument();
    unmount();
    const r2 = render(<CampaignHeroCard variant="compact" campaign={CAMPAIGN} policies={POLICIES} error />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t load your campaign progress/i);
    r2.unmount();
    const { container } = render(<CampaignHeroCard variant="compact" campaign={null} policies={POLICIES} />);
    expect(container.firstChild).toBeNull();
  });
});
