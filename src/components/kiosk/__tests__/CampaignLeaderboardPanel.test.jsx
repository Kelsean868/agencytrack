import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CampaignLeaderboardPanel from '../panels/CampaignLeaderboardPanel';

vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

const CAMPAIGN = {
  id: 'c1',
  name: 'Christmas Campaign',
  structure: 'qualify',
  standingsMetric: 'apiSold',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  persistencyGateEnabled: true,
  scope: { type: 'branch' },
  tiers: [{ level: 1, api: 50000, apps: 1, cash: 10000, name: 'Gold' }],
};

const USERS = [
  { id: 'a1', name: 'Marsha', role: 'agent' },
  { id: 'a2', name: 'Anand', role: 'agent' },
];
const sub = (agentId, api, apps) => ({
  agentId, weekStarting: '2026-03-01', status: 'submitted', version: 2,
  newBusiness: { api, apps },
});
const SUBS = [sub('a1', 80000, 4), sub('a2', 40000, 2)];

describe('CampaignLeaderboardPanel (3.6)', () => {
  it('renders a podium with the leading advisor as champion', () => {
    render(<CampaignLeaderboardPanel campaign={CAMPAIGN} allSubmissions={SUBS} allUsers={USERS} />);
    const champ = document.querySelector('[data-testid="campaign-podium-rank-1"]');
    expect(champ).not.toBeNull();
    expect(champ.textContent).toContain('Marsha');
  });

  it('shows the campaign name and the qualify prize headline', () => {
    render(<CampaignLeaderboardPanel campaign={CAMPAIGN} allSubmissions={SUBS} allUsers={USERS} />);
    expect(screen.getByText('Christmas Campaign')).toBeInTheDocument();
    expect(screen.getByText(/Up to TTD 10\.0K/)).toBeInTheDocument();
  });

  it('renders the persistency gate legend when the gate is enabled', () => {
    render(<CampaignLeaderboardPanel campaign={CAMPAIGN} allSubmissions={SUBS} allUsers={USERS} />);
    expect(screen.getByText('★ Persistency gate')).toBeInTheDocument();
    expect(screen.getByText('≥90%')).toBeInTheDocument();
  });

  it('hides the gate legend when the gate is disabled', () => {
    render(
      <CampaignLeaderboardPanel
        campaign={{ ...CAMPAIGN, persistencyGateEnabled: false }}
        allSubmissions={SUBS}
        allUsers={USERS}
      />,
    );
    expect(screen.queryByText('★ Persistency gate')).not.toBeInTheDocument();
  });

  it('projects a tier prize onto a qualifying advisor', () => {
    // Marsha (80k API, 4 apps) clears the 50k/1 Gold tier → 10k projected.
    render(<CampaignLeaderboardPanel campaign={CAMPAIGN} allSubmissions={SUBS} allUsers={USERS} />);
    const champ = document.querySelector('[data-testid="campaign-podium-rank-1"]');
    expect(champ.textContent).toContain('Gold');
    expect(champ.textContent).toContain('TTD 10.0K');
  });

  it('shows an empty state when there are no participants', () => {
    render(<CampaignLeaderboardPanel campaign={CAMPAIGN} allSubmissions={[]} allUsers={[]} />);
    expect(screen.getByText(/no standings yet/i)).toBeInTheDocument();
  });
});
