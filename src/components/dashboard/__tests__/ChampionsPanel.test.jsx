// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChampionsPanel from '../ChampionsPanel.jsx';

// §2 count-up is inert-under-test elsewhere in the codebase via this exact
// identity mock (see MovementChipIntegration.test.jsx) — avoids depending on
// jsdom's requestAnimationFrame timing to observe the final formatted value.
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

const CHAMPIONS = [
  { rank: 1, agentId: 'a2', agentName: 'Zubin Baksh', api: 9000, apps: 5 },
  { rank: 2, agentId: 'a3', agentName: 'Mira Singh',  api: 7000, apps: 3 },
  { rank: 3, agentId: 'a1', agentName: 'Aaliyah Ali', api: 5000, apps: 2 },
];

describe('ChampionsPanel — four states', () => {
  it('loading → skeleton, no list', () => {
    render(<ChampionsPanel champions={[]} loading />);
    expect(screen.getByTestId('champions-panel-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('champions-panel-list')).toBeNull();
  });

  it('empty → honest "no champions yet" state', () => {
    render(<ChampionsPanel champions={[]} loading={false} />);
    expect(screen.getByTestId('champions-panel-empty')).toBeInTheDocument();
    expect(screen.getByText(/no champions yet this week/i)).toBeInTheDocument();
  });

  it('list → renders a row per champion, ranked, with name + value', () => {
    render(<ChampionsPanel champions={CHAMPIONS} loading={false} />);
    expect(screen.getByTestId('champions-panel-list')).toBeInTheDocument();
    expect(screen.getByTestId('champion-row-a2')).toBeInTheDocument();
    expect(screen.getByTestId('champion-row-a3')).toBeInTheDocument();
    expect(screen.getByTestId('champion-row-a1')).toBeInTheDocument();
    expect(screen.getByText('Zubin Baksh')).toBeInTheDocument();
    expect(screen.getByText('Mira Singh')).toBeInTheDocument();
    expect(screen.getByText('Aaliyah Ali')).toBeInTheDocument();
    expect(screen.getByText('TTD 9,000')).toBeInTheDocument();
    expect(screen.getByText('5 apps')).toBeInTheDocument();
  });

  it('renders rows in the order given (already ranked by the caller)', () => {
    render(<ChampionsPanel champions={CHAMPIONS} loading={false} />);
    const rows = screen.getAllByText(/Baksh|Singh|Ali/);
    expect(rows[0]).toHaveTextContent('Zubin Baksh');
    expect(rows[1]).toHaveTextContent('Mira Singh');
    expect(rows[2]).toHaveTextContent('Aaliyah Ali');
  });

  it('shows the heading', () => {
    render(<ChampionsPanel champions={CHAMPIONS} loading={false} />);
    expect(screen.getByText(/this week's champions/i)).toBeInTheDocument();
  });
});
