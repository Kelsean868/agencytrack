// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUser        = { uid: 'bm1' };
const mockUserProfile = { name: 'Branch Manager 1', email: 'bm@test.com' };
const mockRole        = 'branch_manager';
const mockTenantId    = 'test-tenant';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        mockUser,
    userProfile: mockUserProfile,
    role:        mockRole,
    tenantId:    mockTenantId,
  }),
}));

const mockGetJointCalls   = vi.fn();
const mockAddJointCall    = vi.fn();
const mockUpdateJointCall = vi.fn();

vi.mock('../../../services/jointCallsService', () => ({
  getJointCalls:   (...args) => mockGetJointCalls(...args),
  addJointCall:    (...args) => mockAddJointCall(...args),
  updateJointCall: (...args) => mockUpdateJointCall(...args),
  MEETING_TYPES: [
    { value: 'demonstration', label: 'Demonstration' },
    { value: 'observation',   label: 'Observation' },
    { value: 'collaboration', label: 'Collaboration' },
  ],
  NEEDS_COVERED: [
    { value: 'income_protection',        label: 'Income Protection' },
    { value: 'mortgage_or_debt',         label: 'Mortgage / Debt' },
    { value: 'education_funding',        label: 'Education Funding' },
    { value: 'retirement_planning',      label: 'Retirement Planning' },
    { value: 'final_expenses',           label: 'Final Expenses' },
    { value: 'wealth_accumulation',      label: 'Wealth Accumulation' },
    { value: 'critical_illness_or_health', label: 'Critical Illness / Health' },
    { value: 'business_protection',      label: 'Business Protection' },
    { value: 'other',                    label: 'Other' },
  ],
}));

// Prevent transitive prospectInfoService → firebase.js auth/invalid-api-key in CI (F2/F3 lesson)
const mockGetProspectInfo = vi.fn();
vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo: (...args) => mockGetProspectInfo(...args),
}));

import JointCallsTab from '../JointCallsTab';

const defaultProps = {
  agentId:    'agent1',
  agentUnitId: 'um1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProspectInfo.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JointCallsTab — loading state', () => {
  it('shows skeleton loaders while fetching', () => {
    mockGetJointCalls.mockReturnValue(new Promise(() => {}));
    render(<JointCallsTab {...defaultProps} />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('JointCallsTab — empty state', () => {
  it('shows empty prompt when no calls exist', async () => {
    mockGetJointCalls.mockResolvedValue([]);
    render(<JointCallsTab {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('No joint-call observations yet.')).toBeInTheDocument()
    );
  });
});

describe('JointCallsTab — call list', () => {
  const calls = [
    {
      id: 'c1',
      agentId: 'agent1',
      authorUid: 'bm1',
      authorName: 'Branch Manager 1',
      authorRole: 'branch_manager',
      authorRoleRank: 2,
      appointmentDate: '2026-05-20', appointmentTime: '10:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'income_protection',
      comments: 'Clean presentation, strong close.',
      saleMade: true, coachingMinutes: 15,
      trainingIdentified: 'Reinforce objection handling.',
      createdAt: { toDate: () => new Date('2026-05-20') },
      updatedAt: { toDate: () => new Date('2026-05-20') },
    },
    {
      id: 'c2',
      agentId: 'agent1',
      authorUid: 'um1',
      authorName: 'Unit Manager 1',
      authorRole: 'unit_manager',
      authorRoleRank: 1,
      appointmentDate: '2026-05-18', appointmentTime: '14:30',
      appointmentKept: false, nextMeetingDate: '2026-05-25',
      meetingType: 'collaboration', needCovered: 'mortgage_or_debt',
      comments: 'Client rescheduled.',
      saleMade: false, coachingMinutes: 5,
      trainingIdentified: '',
      createdAt: { toDate: () => new Date('2026-05-18') },
      updatedAt: { toDate: () => new Date('2026-05-18') },
    },
  ];

  it('renders comments and author names', async () => {
    mockGetJointCalls.mockResolvedValue(calls);
    render(<JointCallsTab {...defaultProps} />);
    await screen.findByText('Clean presentation, strong close.');
    expect(screen.getByText('Client rescheduled.')).toBeInTheDocument();
    expect(screen.getByText(/Branch Manager 1/)).toBeInTheDocument();
    expect(screen.getByText(/Unit Manager 1/)).toBeInTheDocument();
  });

  it('shows edit button only on calls the current user authored', async () => {
    mockGetJointCalls.mockResolvedValue(calls);
    render(<JointCallsTab {...defaultProps} />);
    await screen.findByText('Clean presentation, strong close.');
    const editBtns = screen.getAllByLabelText('Edit joint call');
    expect(editBtns).toHaveLength(1);
  });
});

describe('JointCallsTab — add call', () => {
  it('calls addJointCall with required fields and reloads on submit', async () => {
    mockGetJointCalls.mockResolvedValue([]);
    mockAddJointCall.mockResolvedValue({});

    render(<JointCallsTab {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('No joint-call observations yet.')).toBeInTheDocument());

    // Fill required appointmentDate
    fireEvent.change(screen.getByLabelText('Appointment date'), {
      target: { value: '2026-05-21' },
    });

    // Reload returns the newly added call
    const newCall = {
      id: 'c3',
      agentId: 'agent1',
      authorUid: 'bm1',
      authorName: 'Branch Manager 1',
      authorRole: 'branch_manager',
      authorRoleRank: 2,
      appointmentDate: '2026-05-21', appointmentTime: '',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'income_protection',
      comments: '', saleMade: false, coachingMinutes: 0,
      trainingIdentified: '',
      createdAt: { toDate: () => new Date() },
      updatedAt: { toDate: () => new Date() },
    };
    mockGetJointCalls.mockResolvedValueOnce([newCall]);

    fireEvent.click(screen.getByRole('button', { name: /log joint call/i }));

    await waitFor(() =>
      expect(mockAddJointCall).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId:   mockTenantId,
          agentId:    defaultProps.agentId,
          agentUnitId: defaultProps.agentUnitId,
          authorUid:  mockUser.uid,
          authorName: mockUserProfile.name,
          authorRole: mockRole,
          appointmentDate: '2026-05-21',
          meetingType: 'observation',
          needCovered: 'income_protection',
        })
      )
    );
  });

  it('reveals nextMeetingDate input when appointment NOT kept', async () => {
    mockGetJointCalls.mockResolvedValue([]);
    render(<JointCallsTab {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('No joint-call observations yet.')).toBeInTheDocument());

    // Initially appointmentKept is true → no next-meeting input
    expect(screen.queryByLabelText('Next meeting date')).toBeNull();

    // Uncheck appointment kept
    fireEvent.click(screen.getByLabelText(/Appointment kept/i));
    expect(screen.getByLabelText('Next meeting date')).toBeInTheDocument();
  });
});

describe('JointCallsTab — tabbed modal integration (smoke)', () => {
  it('renders without crash for default agent context', () => {
    mockGetJointCalls.mockResolvedValue([]);
    const { container } = render(<JointCallsTab {...defaultProps} />);
    expect(container).toBeTruthy();
  });
});

describe('JointCallsTab — prospect-info link (F3.1)', () => {
  const preps = [
    {
      id: 'prep1',
      agentId: 'agent1',
      clientName: 'Alice Smith',
      intendedAppointmentDate: '2026-05-28',
    },
    {
      id: 'prep2',
      agentId: 'agent1',
      clientName: 'Bob Jones',
      intendedAppointmentDate: '2026-06-03',
    },
  ];

  it('shows prospect-prep selector in add form when preps are available', async () => {
    mockGetJointCalls.mockResolvedValue([]);
    mockGetProspectInfo.mockResolvedValue(preps);

    render(<JointCallsTab {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByLabelText('Link to prospect prep')).toBeInTheDocument()
    );
    expect(screen.getByText('Alice Smith · 2026-05-28')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones · 2026-06-03')).toBeInTheDocument();
  });

  it('does not show selector when no preps exist', async () => {
    mockGetJointCalls.mockResolvedValue([]);
    mockGetProspectInfo.mockResolvedValue([]);

    render(<JointCallsTab {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('No joint-call observations yet.')).toBeInTheDocument());
    expect(screen.queryByLabelText('Link to prospect prep')).toBeNull();
  });

  it('passes prospectInfoId to addJointCall when a prep is selected', async () => {
    mockGetJointCalls.mockResolvedValue([]);
    mockGetProspectInfo.mockResolvedValue(preps);
    mockAddJointCall.mockResolvedValue({});

    render(<JointCallsTab {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByLabelText('Link to prospect prep')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText('Appointment date'), {
      target: { value: '2026-05-28' },
    });
    fireEvent.change(screen.getByLabelText('Link to prospect prep'), {
      target: { value: 'prep1' },
    });

    mockGetJointCalls.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: /log joint call/i }));

    await waitFor(() =>
      expect(mockAddJointCall).toHaveBeenCalledWith(
        expect.objectContaining({ prospectInfoId: 'prep1' })
      )
    );
  });

  it('shows linked-prep summary on observation card (manager view)', async () => {
    const callWithLink = {
      id: 'c1',
      agentId: 'agent1',
      authorUid: 'bm1',
      authorName: 'Branch Manager 1',
      authorRole: 'branch_manager',
      authorRoleRank: 2,
      appointmentDate: '2026-05-30', appointmentTime: '10:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'income_protection',
      comments: 'Good call.',
      saleMade: false, coachingMinutes: 10,
      trainingIdentified: '',
      prospectInfoId: 'prep1',
      createdAt: { toDate: () => new Date('2026-05-30') },
      updatedAt: { toDate: () => new Date('2026-05-30') },
    };
    mockGetJointCalls.mockResolvedValue([callWithLink]);
    mockGetProspectInfo.mockResolvedValue(preps);

    render(<JointCallsTab {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Good call.')).toBeInTheDocument());
    // 'Prep:' label is unique to the observation card linked-prep summary
    expect(screen.getByText('Prep:')).toBeInTheDocument();
    // The prep name appears in both the card summary and the selector option
    expect(screen.getAllByText(/Alice Smith/).length).toBeGreaterThan(0);
  });
});
