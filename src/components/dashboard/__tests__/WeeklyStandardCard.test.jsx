// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeeklyStandardCard from '../WeeklyStandardCard.jsx';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../utils/weeklyActivityFloors';

const MINIMUMS = { weeklyActivityFloors: DEFAULT_WEEKLY_ACTIVITY_FLOORS };

// Flat-schema submission: extractFields() derives totalTelAttempts and
// totalNewNames from the source fields, so the test provides those source
// fields rather than synthesising the derived keys directly.
const STRONG_SUBMISSION = {
  referralCalls: 30, coldCalls: 30, followUpCalls: 5, seminarTradeshowCalls: 0, // totalTelAttempts = 65
  qualifiedApproaches: 50,                                                       // telContacts falls back to 50
  appointmentsSet: 22,
  ffiConducted: 12, ciConducted: 11,                                             // interviewsKept = 23
  applicationsSold: 2, livesSold: 3, apiSold: 5200,
  referralsObtained: 50, namesFromColdCanvass: 30, namesFromOther: 30,           // totalNewNames = 110
};

const WEAK_SUBMISSION = {
  referralCalls: 10, coldCalls: 5, followUpCalls: 2, seminarTradeshowCalls: 0, // totalTelAttempts = 17
  qualifiedApproaches: 10,
  appointmentsSet: 4,
  ffiConducted: 2, ciConducted: 1,
  applicationsSold: 0, livesSold: 0, apiSold: 800,
  referralsObtained: 5, namesFromColdCanvass: 0, namesFromOther: 0,
};

describe('WeeklyStandardCard — loading', () => {
  it('renders 10 skeleton pulses when loading', () => {
    const { container } = render(<WeeklyStandardCard minimums={MINIMUMS} currentWeekSub={null} loading />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(10);
  });
});

describe('WeeklyStandardCard — error', () => {
  it('renders an error message when error is set', () => {
    render(<WeeklyStandardCard minimums={null} currentWeekSub={null} loading={false} error={new Error('boom')} />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});

describe('WeeklyStandardCard — empty (no submission)', () => {
  it('renders the 10 floors and shows the no-submission hint', () => {
    render(<WeeklyStandardCard minimums={MINIMUMS} currentWeekSub={null} loading={false} />);
    expect(screen.getByText(/no submission yet this week/i)).toBeInTheDocument();
    // 10 row labels
    expect(screen.getByText('Calls Made')).toBeInTheDocument();
    expect(screen.getByText('Contacts Made')).toBeInTheDocument();
    expect(screen.getByText('Appointments Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Interviews Kept')).toBeInTheDocument();
    expect(screen.getByText('Fact Finds Completed')).toBeInTheDocument();
    expect(screen.getByText('Closing Interviews Kept')).toBeInTheDocument();
    expect(screen.getByText('Applications Submitted')).toBeInTheDocument();
    expect(screen.getByText('Clients Sold')).toBeInTheDocument();
    expect(screen.getByText('API (TTD)')).toBeInTheDocument();
    expect(screen.getByText('Referrals / New Leads')).toBeInTheDocument();
  });

  it('renders 10 "Below" status badges when no submission exists', () => {
    render(<WeeklyStandardCard minimums={MINIMUMS} currentWeekSub={null} loading={false} />);
    expect(screen.getAllByText('Below')).toHaveLength(10);
  });
});

describe('WeeklyStandardCard — strong week (mostly met)', () => {
  it('renders Met badges for rows that exceed the floor', () => {
    render(<WeeklyStandardCard minimums={MINIMUMS} currentWeekSub={STRONG_SUBMISSION} loading={false} />);
    // STRONG: callsMade=65/60, contactsMade=50/40, appts=22/20, interviews=23/15,
    // factFinds=12/10, closingInt=11/10, apps=2/1, lives=3/1, api=5200/4800, newNames=110/100
    expect(screen.getAllByText('Met').length).toBe(10);
    expect(screen.queryByText('Below')).toBeNull();
  });
});

describe('WeeklyStandardCard — weak week', () => {
  it('renders red Below badges for weak rows', () => {
    render(<WeeklyStandardCard minimums={MINIMUMS} currentWeekSub={WEAK_SUBMISSION} loading={false} />);
    // Below count should be ≥ 5 (apps=0, lives=0 are clear below).
    expect(screen.getAllByText('Below').length).toBeGreaterThanOrEqual(5);
  });
});

describe('WeeklyStandardCard — contactsMade footnote', () => {
  it('toggles the footnote when the info button is clicked', () => {
    render(<WeeklyStandardCard minimums={MINIMUMS} currentWeekSub={STRONG_SUBMISSION} loading={false} />);
    const button = screen.getByRole('button', { name: /more info about contacts made/i });
    expect(screen.queryByText(/qualified approaches/i)).toBeNull();
    fireEvent.click(button);
    expect(screen.getByText(/qualified approaches/i)).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText(/qualified approaches/i)).toBeNull();
  });
});

describe('WeeklyStandardCard — defaults fallback', () => {
  it('uses Appendix A defaults when minimums.weeklyActivityFloors is absent', () => {
    render(<WeeklyStandardCard minimums={{}} currentWeekSub={null} loading={false} />);
    expect(screen.getByText('Calls Made')).toBeInTheDocument();
    // Expected value 60 visible for Calls Made
    expect(screen.getByText('60')).toBeInTheDocument();
  });
});
