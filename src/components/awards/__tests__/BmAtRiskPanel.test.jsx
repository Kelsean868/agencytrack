// @vitest-environment jsdom
//
// Track J — BmAtRiskPanel v2 visual port.
//
// Asserts the new card grammar AND that the awards-engine call signature
// (computeAgentAwards + computeAtRiskStatus + getPeriodCtx) is preserved:
// the mock receives the same per-agent slice of settlements + ytdSubs +
// profile + currentDate + ruleset as before.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../utils/awardsEngine', () => ({
  computeAgentAwards:    vi.fn(),
  computeAtRiskStatus:   vi.fn(),
  getPeriodCtx:          vi.fn((category) => ({ category })),
}));

import BmAtRiskPanel from '../BmAtRiskPanel';
import {
  computeAgentAwards, computeAtRiskStatus,
} from '../../../utils/awardsEngine';

const AWARD_A = { id: 'a', name: 'Production Award',          category: 'annual' };
const AWARD_B = { id: 'b', name: 'Persistency Silver',        category: 'annual' };
const AWARD_C = { id: 'c', name: 'Activity Gold',             category: 'annual' };

const PROFILES = [
  { id: 'agent-1', name: 'Marsha Singh' },
  { id: 'agent-2', name: 'Anand Persad' },
  { id: 'agent-3', name: 'Priya Naidu' },
];

const SETTLEMENTS = [
  { agentId: 'agent-1', api: 12000 },
  { agentId: 'agent-2', api: 8000 },
];

const YTD_SUBS = [
  { agentId: 'agent-1', apps: 4 },
  { userId: 'agent-2',  apps: 3 },
];

function setStatus(byAgent) {
  computeAgentAwards.mockImplementation((_setts, _subs, profile) => {
    const rec = byAgent[profile.id ?? 'unknown'] ?? {};
    return rec;
  });
  computeAtRiskStatus.mockImplementation((award) => {
    for (const byAgentVal of Object.values(byAgent)) {
      for (const [, entry] of Object.entries(byAgentVal)) {
        if (entry === award) return entry.__status ?? 'on_track';
      }
    }
    return 'on_track';
  });
}

function withStatus(award, status) {
  return { ...award, __status: status };
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

function renderPanel(props = {}) {
  return render(
    <BmAtRiskPanel
      agentProfiles={PROFILES}
      settlements={SETTLEMENTS}
      ytdSubs={YTD_SUBS}
      agentIds={['agent-1', 'agent-2', 'agent-3']}
      currentDate={new Date('2026-05-11')}
      ruleset={{}}
      {...props}
    />,
  );
}

describe('BmAtRiskPanel — render gating', () => {
  it('returns null when agentIds is empty', () => {
    const { container } = renderPanel({ agentIds: [] });
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel header with total agent count', () => {
    computeAgentAwards.mockReturnValue({});
    renderPanel();
    expect(screen.getByText('Agent Award Risk View')).toBeInTheDocument();
    expect(screen.getByTestId('bm-at-risk-total').textContent).toMatch(/3 agents/);
  });
});

describe('BmAtRiskPanel — at-risk + achieved card classification', () => {
  it('marks an agent card with data-at-risk="true" when ≥1 award is at_risk', () => {
    const atRiskA = withStatus(AWARD_A, 'at_risk');
    const onTrack = withStatus(AWARD_B, 'on_track');
    setStatus({
      'agent-1': { a: atRiskA, b: onTrack },
      'agent-2': { a: withStatus(AWARD_A, 'on_track') },
      'agent-3': { a: withStatus(AWARD_A, 'achieved') },
    });
    renderPanel();

    const cards = screen.getAllByTestId('bm-at-risk-agent-card');
    const atRiskCards = cards.filter((c) => c.getAttribute('data-at-risk') === 'true');
    expect(atRiskCards.length).toBe(1);
    expect(atRiskCards[0].textContent).toContain('Marsha Singh');
  });

  it('renders the at-risk reality strip with the at-risk count + achieved count', () => {
    setStatus({
      'agent-1': { a: withStatus(AWARD_A, 'at_risk'),  b: withStatus(AWARD_B, 'on_track') },
      'agent-2': { a: withStatus(AWARD_A, 'achieved') },
      'agent-3': { a: withStatus(AWARD_A, 'on_track') },
    });
    renderPanel();

    const reality = screen.getByTestId('bm-at-risk-reality');
    expect(reality.textContent).toContain('1 at risk');
    expect(reality.textContent).toContain('1 qualified');
  });

  it('sorts agent cards: at-risk first, then achieved, then on-track', () => {
    setStatus({
      'agent-1': { a: withStatus(AWARD_A, 'on_track') },
      'agent-2': { a: withStatus(AWARD_A, 'achieved') },
      'agent-3': { a: withStatus(AWARD_A, 'at_risk') },
    });
    renderPanel();

    const cards = screen.getAllByTestId('bm-at-risk-agent-card');
    expect(cards[0].textContent).toContain('Priya Naidu');   // at-risk
    expect(cards[1].textContent).toContain('Anand Persad');  // achieved
    expect(cards[2].textContent).toContain('Marsha Singh');  // on-track
  });
});

describe('BmAtRiskPanel — filter pills', () => {
  it('filters to at-risk agents only when the "At risk only" pill is clicked', () => {
    setStatus({
      'agent-1': { a: withStatus(AWARD_A, 'at_risk') },
      'agent-2': { a: withStatus(AWARD_A, 'on_track') },
      'agent-3': { a: withStatus(AWARD_A, 'on_track') },
    });
    renderPanel();

    expect(screen.getAllByTestId('bm-at-risk-agent-card').length).toBe(3);

    fireEvent.click(screen.getByRole('tab', { name: /at risk only/i }));

    const filteredCards = screen.getAllByTestId('bm-at-risk-agent-card');
    expect(filteredCards.length).toBe(1);
    expect(filteredCards[0].textContent).toContain('Marsha Singh');
  });

  it('renders the at-risk empty card when no agents are at risk and filter is at_risk', () => {
    setStatus({
      'agent-1': { a: withStatus(AWARD_A, 'on_track') },
      'agent-2': { a: withStatus(AWARD_A, 'on_track') },
      'agent-3': { a: withStatus(AWARD_A, 'on_track') },
    });
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /at risk only/i }));
    expect(
      screen.getByText('No agents are currently at risk on any award.')
    ).toBeInTheDocument();
  });
});

describe('BmAtRiskPanel — at-risk award chips', () => {
  it('renders one chip per at-risk award name on the agent card', () => {
    const longName = 'A really really really long award name past thirty chars';
    setStatus({
      'agent-1': {
        a: withStatus(AWARD_A, 'at_risk'),
        b: withStatus({ ...AWARD_B, name: longName }, 'at_risk'),
        c: withStatus(AWARD_C, 'on_track'),
      },
      'agent-2': { a: withStatus(AWARD_A, 'on_track') },
      'agent-3': { a: withStatus(AWARD_A, 'on_track') },
    });
    renderPanel();

    const cards = screen.getAllByTestId('bm-at-risk-agent-card');
    const marshaCard = cards.find((c) => c.textContent.includes('Marsha Singh'));
    expect(marshaCard).toBeTruthy();
    expect(marshaCard.textContent).toContain('Production Award');
    // slice(0, 30) of longName + '…' — exact truncated prefix.
    expect(marshaCard.textContent).toContain(`${longName.slice(0, 30)}…`);
  });
});

describe('BmAtRiskPanel — preserved awards-engine call', () => {
  it('calls computeAgentAwards with per-agent slice of settlements + subs + profile + date + ruleset', () => {
    setStatus({
      'agent-1': { a: withStatus(AWARD_A, 'on_track') },
      'agent-2': { a: withStatus(AWARD_A, 'on_track') },
      'agent-3': { a: withStatus(AWARD_A, 'on_track') },
    });
    renderPanel();

    const calls = computeAgentAwards.mock.calls;
    expect(calls.length).toBe(3);
    // First call is for agent-1: should receive only agent-1's settlement.
    const [setts1, subs1, profile1, date1, ruleset1] = calls[0];
    expect(setts1.every((s) => s.agentId === 'agent-1')).toBe(true);
    expect(subs1.every((s) => (s.agentId ?? s.userId) === 'agent-1')).toBe(true);
    expect(profile1.id).toBe('agent-1');
    expect(date1.toISOString().startsWith('2026-05-11')).toBe(true);
    expect(ruleset1).toEqual({});
  });
});
