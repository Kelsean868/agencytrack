// @vitest-environment jsdom
//
// AgentDashboardHomeV2 — §2 "staggered assemble" structural coverage
// (design-conformance-2026-07-12 row 85 residual: "Hero count-up + staggered
// assemble — residual: per-block stagger absent").
//
// Verifies the shipped `.stagger` class (index.css; transform-only,
// nth-child delay, degrades under reduced-motion) wraps the screen's
// top-level synchronous blocks (error banner / needs-action banner / Hero /
// PulseStrip / MyPointsCard / Recent+Delivery grid), and that the two
// position:fixed overlays — StandardDetail (drawer) and
// FilingStreakCelebration (full-screen takeover) — render OUTSIDE that
// wrapper, per the same "keep fixed overlays out of transform-animated
// ancestors" rule already documented at AgentDashboard.jsx's screen-enter
// wrapper. All children are mocked to isolate the structural assembly from
// their own internals (data fetching, Firestore reads, etc).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import AgentDashboardHomeV2 from '../index';

vi.mock('../HeroCard', () => ({ default: () => <div data-testid="mock-hero" /> }));
vi.mock('../PulseStrip', () => ({
  default: ({ onChipClick }) => (
    <div data-testid="mock-pulse">
      <button data-testid="mock-pulse-standard-btn" onClick={() => onChipClick('standard')}>
        open standard
      </button>
    </div>
  ),
}));
vi.mock('../NeedsActionBanner', () => ({ default: () => <div data-testid="mock-nudge" /> }));
vi.mock('../RecentCompact', () => ({ default: () => <div data-testid="mock-recent" /> }));
vi.mock('../DeliveryStripCard', () => ({ default: () => <div data-testid="mock-delivery" /> }));
vi.mock('../StandardDetail', () => ({ default: () => <div data-testid="mock-standard-detail" /> }));
vi.mock('../FilingStreakCelebration', () => ({ default: () => <div data-testid="mock-celebration" /> }));
vi.mock('../../../campaigns/CampaignCard', () => ({ default: () => <div data-testid="mock-campaign" /> }));
vi.mock('../../../gamification/MyPointsCard', () => ({ default: () => <div data-testid="mock-points" /> }));

function renderHome(props = {}) {
  return render(
    <AgentDashboardHomeV2
      ytdTotals={{ api: 1000 }}
      personalAnnualAPI={5000}
      kpiData={[]}
      allSubmissions={[]}
      resolvedMinimums={{}}
      currentWeekSub={null}
      persistency={[]}
      settlements={[]}
      awardsRuleset={{}}
      agentProfile={{}}
      activityEvents={[]}
      activeCampaigns={[]}
      campaignsLoading={false}
      campaignSubs={{}}
      agentUid="agent-1"
      policies={[]}
      committedPlan={null}
      weekDailyDocs={[]}
      weekStart={null}
      showDailyCTA={false}
      todayDailyChecked={false}
      todayDailyEntry={null}
      submissionsError={null}
      onSubmit={() => {}}
      onLogToday={() => {}}
      onOpenTab={() => {}}
      {...props}
    />
  );
}

describe('AgentDashboardHomeV2 — §2 stagger wrapper', () => {
  it('wraps Hero/PulseStrip/MyPointsCard/Recent grid in a single .stagger container', () => {
    const { container } = renderHome();
    const staggerEls = container.querySelectorAll('.stagger');
    expect(staggerEls.length).toBeGreaterThanOrEqual(1);
    const wrapper = staggerEls[0];
    expect(wrapper.contains(screen.getByTestId('mock-hero'))).toBe(true);
    expect(wrapper.contains(screen.getByTestId('mock-pulse'))).toBe(true);
    expect(wrapper.contains(screen.getByTestId('mock-points'))).toBe(true);
    expect(wrapper.contains(screen.getByTestId('mock-recent'))).toBe(true);
    expect(wrapper.contains(screen.getByTestId('mock-delivery'))).toBe(true);
  });

  it('keeps FilingStreakCelebration (fixed-position overlay) OUTSIDE the .stagger wrapper', () => {
    const { container } = renderHome();
    const wrapper = container.querySelector('.stagger');
    const celebration = screen.getByTestId('mock-celebration');
    expect(wrapper.contains(celebration)).toBe(false);
  });

  it('keeps the StandardDetail drawer (fixed-position overlay) OUTSIDE the .stagger wrapper when open', () => {
    const { container } = renderHome();
    fireEvent.click(screen.getByTestId('mock-pulse-standard-btn'));
    const wrapper = container.querySelector('.stagger');
    const drawer = screen.getByTestId('mock-standard-detail');
    expect(wrapper.contains(drawer)).toBe(false);
  });
});
