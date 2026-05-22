// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ManagerWarDetail from '../ManagerWarDetail';

const BASE_WAR = {
  managerName:          'Branch Mgr 1',
  managerRole:          'branch_manager',
  weekStart:            '2026-05-18',
  status:               'submitted',
  oneOnOnesConducted:   3,
  namesSourced:         5,
  interviewsConducted:  2,
  recruitsInFirstWeeks: 1,
  trainingSessions:     1,
  trainingTopic:        '',
  unitMeetingHeld:      true,
  attendanceCount:      12,
  dashboardReviewDone:  true,
  jfwCount:             2,
};

function renderDetail(overrides = {}, onBack = vi.fn()) {
  return render(<ManagerWarDetail warData={{ ...BASE_WAR, ...overrides }} onBack={onBack} />);
}

describe('ManagerWarDetail — rendering', () => {
  it('shows manager name and role', () => {
    renderDetail();
    expect(screen.getByText('Branch Mgr 1')).toBeInTheDocument();
    expect(screen.getByText(/branch manager/i)).toBeInTheDocument();
  });

  it('shows weekStart and status', () => {
    renderDetail();
    expect(screen.getByText(/2026-05-18/)).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('shows "Draft" for non-submitted status', () => {
    renderDetail({ status: 'draft' });
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders all numeric activity fields', () => {
    renderDetail();
    expect(screen.getByText('One-on-One Pipeline Reviews')).toBeInTheDocument();
    expect(screen.getByText('Names Sourced')).toBeInTheDocument();
    expect(screen.getByText('Initial Interviews Conducted')).toBeInTheDocument();
    expect(screen.getByText('New Recruits in First Weeks')).toBeInTheDocument();
    expect(screen.getByText('Training Sessions Delivered')).toBeInTheDocument();
  });

  it('renders training topic when present', () => {
    renderDetail({ trainingTopic: 'Objection handling' });
    expect(screen.getByText('Training Topic')).toBeInTheDocument();
    expect(screen.getByText('Objection handling')).toBeInTheDocument();
  });

  it('does NOT render training topic when empty', () => {
    renderDetail({ trainingTopic: '' });
    expect(screen.queryByText('Training Topic')).not.toBeInTheDocument();
  });

  it('renders attendance count when unitMeetingHeld is true', () => {
    renderDetail({ unitMeetingHeld: true, attendanceCount: 12 });
    expect(screen.getByText('Attendance Count')).toBeInTheDocument();
  });

  it('does NOT render attendance count when unitMeetingHeld is false', () => {
    renderDetail({ unitMeetingHeld: false, attendanceCount: null });
    expect(screen.queryByText('Attendance Count')).not.toBeInTheDocument();
  });

  it('renders JFW count from warData.jfwCount (I1.3a stored value)', () => {
    renderDetail({ jfwCount: 4 });
    expect(screen.getByLabelText(/joint field work count: 4/i)).toBeInTheDocument();
  });

  it('renders JFW count as 0 when jfwCount is null', () => {
    renderDetail({ jfwCount: null });
    expect(screen.getByLabelText(/joint field work count: 0/i)).toBeInTheDocument();
  });

  it('shows personal production section when personalApi + personalApps are present', () => {
    renderDetail({ personalApi: 1500.5, personalApps: 2 });
    expect(screen.getByText(/personal production/i)).toBeInTheDocument();
    expect(screen.getByText('Personal API (TTD)')).toBeInTheDocument();
    expect(screen.getByText('Personal Applications')).toBeInTheDocument();
  });

  it('does NOT show personal production when fields are absent', () => {
    renderDetail({ personalApi: undefined, personalApps: undefined });
    expect(screen.queryByText(/personal production/i)).not.toBeInTheDocument();
  });
});

describe('ManagerWarDetail — navigation', () => {
  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    renderDetail({}, onBack);
    fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
