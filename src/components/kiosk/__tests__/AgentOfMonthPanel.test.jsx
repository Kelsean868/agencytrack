import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentOfMonthPanel from '../panels/AgentOfMonthPanel';

vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (v) => `TTD ${v}`,
}));

const FULL_DATA = {
  monthKey: '2026-05',
  tenantId: 't1',
  branchId: 'b1',
  api:      { agentUid: 'u1', agentName: 'Alice Smith', photoURL: null, achievementValue: 50000 },
  apps:     { agentUid: 'u2', agentName: 'Bob Jones',   photoURL: null, achievementValue: 8 },
  activity: { agentUid: 'u3', agentName: 'Carol Lee',   photoURL: null, achievementValue: 150 },
};

describe('AgentOfMonthPanel', () => {
  it('renders empty state when agentOfMonthData is null', () => {
    render(<AgentOfMonthPanel agentOfMonthData={null} />);
    expect(screen.getByText(/awards pending/i)).toBeInTheDocument();
  });

  it('renders empty state when no category winners are set', () => {
    render(<AgentOfMonthPanel agentOfMonthData={{ monthKey: '2026-05' }} />);
    expect(screen.getByText(/awards pending/i)).toBeInTheDocument();
  });

  it('renders three category column headers with full data', () => {
    render(<AgentOfMonthPanel agentOfMonthData={FULL_DATA} />);
    expect(screen.getByText('API Champion')).toBeInTheDocument();
    expect(screen.getByText('Apps Leader')).toBeInTheDocument();
    expect(screen.getByText('Activity Winner')).toBeInTheDocument();
  });

  it('renders all three winner names', () => {
    render(<AgentOfMonthPanel agentOfMonthData={FULL_DATA} />);
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bob Jones').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Carol Lee').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the panel title', () => {
    render(<AgentOfMonthPanel agentOfMonthData={FULL_DATA} />);
    expect(screen.getByText('Agent of the Month')).toBeInTheDocument();
  });

  it('shows "Pending" for categories without a winner', () => {
    const partial = { ...FULL_DATA, apps: null, activity: null };
    render(<AgentOfMonthPanel agentOfMonthData={partial} />);
    const pending = screen.getAllByText('Pending');
    expect(pending.length).toBe(2);
  });

  it('does not render emoji characters', () => {
    render(<AgentOfMonthPanel agentOfMonthData={FULL_DATA} />);
    const emojiPattern = /[\u{1F947}\u{1F948}\u{1F949}\u{1F3C6}⭐\u{1F525}]/u;
    expect(emojiPattern.test(document.body.textContent)).toBe(false);
  });

  it('uses Lucide SVG icons, not emoji, for category labels', () => {
    render(<AgentOfMonthPanel agentOfMonthData={FULL_DATA} />);
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
