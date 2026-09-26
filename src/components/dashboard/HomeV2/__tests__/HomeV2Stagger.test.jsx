// @vitest-environment jsdom
//
// AgentDashboardHomeV2 — composition after the Home redesign (R1).
//
// §2 "staggered assemble": the shipped `.stagger` class wraps the screen's
// top-level synchronous blocks (Hero / Campaign / Do next / This week / My
// Points / Recent+Delivery), and the two position:fixed overlays —
// StandardDetail and FilingStreakCelebration — render OUTSIDE that wrapper.
// R1: PulseStrip is gone from Home; the campaign card is hidden when there is
// no active campaign; the Standard drawer opens from This week's Details.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import AgentDashboardHomeV2 from '../index';

vi.mock('../HeroCard', () => ({ default: () => <div data-testid="mock-hero" /> }));
vi.mock('../NeedsActionBanner', () => ({ default: () => <div data-testid="mock-nudge" /> }));
vi.mock('../RecentCompact', () => ({ default: () => <div data-testid="mock-recent" /> }));
vi.mock('../DeliveryStripCard', () => ({ default: () => <div data-testid="mock-delivery" /> }));
vi.mock('../StandardDetail', () => ({ default: () => <div data-testid="mock-standard-detail" /> }));
vi.mock('../FilingStreakCelebration', () => ({ default: () => <div data-testid="mock-celebration" /> }));
vi.mock('../../../campaigns/CampaignHeroCard', () => ({
  default: ({ loading, campaign }) => (
    <div data-testid={loading ? 'mock-campaign-loading' : `mock-campaign-${campaign?.id}`} />
  ),
}));
vi.mock('../../../gamification/MyPointsCard', () => ({ default: () => <div data-testid="mock-points" /> }));

const TIERED = {
  id: 'xmas26',
  name: 'Christmas',
  structure: 'qualify',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  tiers: [{ level: 1, name: 'Champion', api: 275000, apps: 35, cash: 7000 }],
};

function renderHome(props = {}) {
  return render(
    <AgentDashboardHomeV2
      ledgerProduction={null}
      ledgerPending={false}
      ledgerError={false}
      personalGoalAPI={null}
      allSubmissions={[]}
      resolvedMinimums={{}}
      currentWeekSub={null}
      persistency={[]}
      activityEvents={[]}
      activeCampaigns={[]}
      campaignsLoading={false}
      campaignPolicies={[]}
      agentUid="agent-1"
      policies={[]}
      committedPlan={null}
      weekDailyDocs={[]}
      weekStart="2026-09-20"
      showDailyCTA={false}
      todayDailyChecked={false}
      todayDailyEntry={null}
      submissionsError={null}
      onSubmit={() => {}}
      onLogToday={() => {}}
      onOpenTab={() => {}}
      {...props}
    />,
  );
}

describe('AgentDashboardHomeV2 — §2 stagger wrapper', () => {
  it('wraps Hero / Do next / This week / My Points / Recent grid in a single .stagger container', () => {
    const { container } = renderHome({ activeCampaigns: [TIERED] });
    const wrapper = container.querySelector('.stagger');
    expect(wrapper).not.toBeNull();
    for (const id of ['mock-hero', 'mock-campaign-xmas26', 'do-next', 'this-week', 'mock-points', 'mock-recent', 'mock-delivery']) {
      expect(wrapper.contains(screen.getByTestId(id)), id).toBe(true);
    }
  });

  it('keeps FilingStreakCelebration (fixed-position overlay) OUTSIDE the .stagger wrapper', () => {
    const { container } = renderHome();
    expect(container.querySelector('.stagger').contains(screen.getByTestId('mock-celebration'))).toBe(false);
  });

  it('opens the StandardDetail drawer from This week → Details, OUTSIDE the .stagger wrapper', () => {
    const { container } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    const drawer = screen.getByTestId('mock-standard-detail');
    expect(container.querySelector('.stagger').contains(drawer)).toBe(false);
  });
});

describe('AgentDashboardHomeV2 — R1 blocks', () => {
  it('no longer renders the PulseStrip', () => {
    renderHome();
    expect(screen.queryByRole('list', { name: /pulse/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Standard')).not.toBeInTheDocument();
  });

  it('hides the campaign card when there is no active campaign (no empty shell)', () => {
    renderHome({ activeCampaigns: [] });
    expect(screen.queryByTestId('home-campaign-slot')).not.toBeInTheDocument();
  });

  it('hides a non-tiered campaign too', () => {
    renderHome({ activeCampaigns: [{ id: 'p', structure: 'placement' }] });
    expect(screen.queryByTestId('home-campaign-slot')).not.toBeInTheDocument();
  });

  it('shows a campaign skeleton while campaigns load', () => {
    renderHome({ campaignsLoading: true });
    expect(screen.getByTestId('mock-campaign-loading')).toBeInTheDocument();
  });

  it('Do next says "You\'re on track this week." when nothing applies', () => {
    renderHome({ weekStart: null });
    expect(screen.getByTestId('do-next-on-track')).toHaveTextContent("You're on track this week.");
  });

  it('Do next links "Confirm settled policies" to the ledger\'s action filter', () => {
    const onOpenLedgerFilter = vi.fn();
    renderHome({
      weekStart: null,
      onOpenLedgerFilter,
      campaignPolicies: [
        { id: 'a', status: 'settled', statusSource: 'agent' },
        { id: 'b', status: 'settled', statusSource: 'oipa_import' },
        { id: 'c', status: 'settled', statusSource: 'agent', confirmedAt: '2026-09-01' },
      ],
    });
    const item = screen.getByTestId('do-next-confirm');
    expect(item).toHaveTextContent('Confirm settled policies');
    expect(item).toHaveTextContent('1 waiting');
    fireEvent.click(item);
    expect(onOpenLedgerFilter).toHaveBeenCalledWith('action');
  });

  it('Do next and This week show skeletons while their data loads', () => {
    renderHome({ ledgerPending: true, committedPlan: undefined });
    expect(screen.getByTestId('do-next-loading')).toBeInTheDocument();
    expect(screen.getByTestId('this-week-loading')).toBeInTheDocument();
  });
});
