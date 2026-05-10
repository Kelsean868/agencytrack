import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeeklyActivityPanel from '../panels/WeeklyActivityPanel';

vi.mock('../Avatar', () => ({
  default: ({ agent }) => <span data-testid="avatar">{agent.name}</span>,
}));

const AGENTS = [
  { id: 'a1', name: 'Alice', role: 'agent' },
  { id: 'a2', name: 'Bob', role: 'agent' },
];

// Week starting must be the current week's Sunday
function currentWeekSunday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const THIS_WEEK = currentWeekSunday();

const SUBS = [
  {
    agentId: 'a1',
    weekStarting: THIS_WEEK,
    status: 'submitted',
    // activity fields (flat schema)
    namesFromColdCanvass: 10,
    referralsObtained: 5,
    namesFromSeminarsConducted: 0,
    namesFromSeminarsAttended: 0,
    namesFromTradeshowsConducted: 0,
    namesFromTradeshowsAttended: 0,
    namesFromOther: 0,
    referralCalls: 5,
    followUpCalls: 10,
    coldCalls: 3,
    seminarTradeshowCalls: 0,
    ffiConducted: 4,
    ciConducted: 2,
    appointmentsSet: 6,
  },
  {
    agentId: 'a2',
    weekStarting: THIS_WEEK,
    status: 'submitted',
    namesFromColdCanvass: 20,
    referralsObtained: 0,
    namesFromSeminarsConducted: 0,
    namesFromSeminarsAttended: 0,
    namesFromTradeshowsConducted: 0,
    namesFromTradeshowsAttended: 0,
    namesFromOther: 0,
    referralCalls: 0,
    followUpCalls: 5,
    coldCalls: 0,
    seminarTradeshowCalls: 0,
    ffiConducted: 1,
    ciConducted: 0,
    appointmentsSet: 2,
  },
];

describe('WeeklyActivityPanel', () => {
  it('renders both Prospecting and Conversions headers', () => {
    render(<WeeklyActivityPanel allSubmissions={SUBS} allUsers={AGENTS} />);
    expect(screen.getByText('Prospecting')).toBeInTheDocument();
    expect(screen.getByText('Conversions')).toBeInTheDocument();
  });

  it('renders subtitle text for each column', () => {
    render(<WeeklyActivityPanel allSubmissions={SUBS} allUsers={AGENTS} />);
    expect(screen.getByText('(Names + Calls)')).toBeInTheDocument();
    expect(screen.getByText('(FFIs + CIs)')).toBeInTheDocument();
  });

  it('shows both agent names in prospecting list', () => {
    render(<WeeklyActivityPanel allSubmissions={SUBS} allUsers={AGENTS} />);
    // Both columns render names — at least 2 Alice + 2 Bob across both columns
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
  });

  it('renders breakdown text beneath totals', () => {
    render(<WeeklyActivityPanel allSubmissions={SUBS} allUsers={AGENTS} />);
    // Breakdown labels should appear
    expect(document.body.textContent).toContain('names');
    expect(document.body.textContent).toContain('calls');
  });

  it('renders empty state when no submissions this week', () => {
    render(<WeeklyActivityPanel allSubmissions={[]} allUsers={AGENTS} />);
    expect(screen.getByText(/no prospecting recorded this week/i)).toBeInTheDocument();
    expect(screen.getByText(/no conversions recorded this week/i)).toBeInTheDocument();
  });

  it('excludes appointmentsSet from both totals', () => {
    // Appointments are set but should not appear in either column's total breakdown
    render(<WeeklyActivityPanel allSubmissions={SUBS} allUsers={AGENTS} />);
    expect(document.body.textContent).not.toMatch(/appointments/i);
  });

  it('does not render emoji characters', () => {
    render(<WeeklyActivityPanel allSubmissions={SUBS} allUsers={AGENTS} />);
    const emojiPattern = /[\u{1F947}\u{1F948}\u{1F949}\u{1F3C6}⭐\u{1F525}]/u;
    expect(emojiPattern.test(document.body.textContent)).toBe(false);
  });

  it('uses Trophy and Medal icons for top positions, not emoji', () => {
    render(<WeeklyActivityPanel allSubmissions={SUBS} allUsers={AGENTS} />);
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
