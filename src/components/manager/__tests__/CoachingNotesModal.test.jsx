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

const mockGetCoachingNotes  = vi.fn();
const mockAddCoachingNote   = vi.fn();
const mockUpdateCoachingNote = vi.fn();

vi.mock('../../../services/coachingNotesService', () => ({
  getCoachingNotes:   (...args) => mockGetCoachingNotes(...args),
  addCoachingNote:    (...args) => mockAddCoachingNote(...args),
  updateCoachingNote: (...args) => mockUpdateCoachingNote(...args),
  COACHING_CATEGORIES: [
    { value: 'observation', label: 'Observation' },
    { value: 'goal',        label: 'Goal' },
    { value: 'concern',     label: 'Concern' },
    { value: 'win',         label: 'Win' },
    { value: 'action_item', label: 'Action Item' },
  ],
}));

// F2: CoachingNotesModal now imports JointCallsTab → jointCallsService → src/firebase.js.
// Mock the service to prevent real firebase.js from loading getAuth() and throwing
// auth/invalid-api-key in CI (where firebase env vars are unset). Notes is the default
// tab, so JointCallsTab is rendered lazily on tab click — but its module is still
// evaluated at import time and that pulls in src/firebase.js. Mock = surgical fix.
vi.mock('../../../services/jointCallsService', () => ({
  getJointCalls:   vi.fn().mockResolvedValue([]),
  addJointCall:    vi.fn().mockResolvedValue({}),
  updateJointCall: vi.fn().mockResolvedValue({}),
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

// F3: CoachingNotesModal now also imports ProspectInfoTab → prospectInfoService
// → src/firebase.js. Same surgical mock pattern as jointCallsService (F2 CI lesson).
vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo:    vi.fn().mockResolvedValue([]),
  addProspectInfo:    vi.fn().mockResolvedValue({}),
  updateProspectInfo: vi.fn().mockResolvedValue({}),
  PROSPECTING_SOURCES: [
    { value: 'referral',      label: 'Referral' },
    { value: 'cold-call',     label: 'Cold Call' },
    { value: 'bank-referral', label: 'Bank Referral (BOA)' },
  ],
  PROSPECTING_SOURCE_LABELS: {
    referral:        'Referral',
    'cold-call':     'Cold Call',
    'bank-referral': 'Bank Referral (BOA)',
    BOA:             'Bank Referral (BOA)',
  },
  APPOINTMENT_TYPES: [
    { value: '2nd-interview',     label: '2nd Interview' },
    { value: 'closing-interview', label: 'Closing Interview' },
  ],
  OBJECTIONS: [
    { value: 'no-money',      label: 'No Money' },
    { value: 'no-need',       label: 'No Need' },
    { value: 'no-hurry',      label: 'No Hurry' },
    { value: 'no-confidence', label: 'No Confidence' },
  ],
  POLICY_TYPES: [
    { value: 'whole-life', label: 'Whole Life / Permanent' },
    { value: 'term-life',  label: 'Term Life' },
  ],
}));

import CoachingNotesModal from '../CoachingNotesModal';

const defaultProps = {
  agentId:    'agent1',
  agentName:  'Test Agent',
  agentUnitId: 'um1',
  onClose:    vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  defaultProps.onClose = vi.fn();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CoachingNotesModal — loading state', () => {
  it('shows skeleton loaders while fetching', () => {
    mockGetCoachingNotes.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CoachingNotesModal {...defaultProps} />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('CoachingNotesModal — empty state', () => {
  it('shows empty prompt when no notes exist', async () => {
    mockGetCoachingNotes.mockResolvedValue([]);
    render(<CoachingNotesModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('No coaching notes yet.')).toBeInTheDocument()
    );
  });
});

describe('CoachingNotesModal — note list', () => {
  const notes = [
    {
      id: 'n1',
      agentId: 'agent1',
      authorUid: 'bm1',         // same as mockUser.uid → isAuthor = true
      authorName: 'Branch Manager 1',
      authorRole: 'branch_manager',
      authorRoleRank: 2,
      category: 'goal',
      body: 'Close 20 apps this quarter.',
      createdAt: { toDate: () => new Date('2026-05-01') },
      updatedAt: { toDate: () => new Date('2026-05-01') },
    },
    {
      id: 'n2',
      agentId: 'agent1',
      authorUid: 'um1',         // different author
      authorName: 'Unit Manager 1',
      authorRole: 'unit_manager',
      authorRoleRank: 1,
      category: 'observation',
      body: 'Good prospect pipeline.',
      createdAt: { toDate: () => new Date('2026-04-28') },
      updatedAt: { toDate: () => new Date('2026-04-28') },
    },
  ];

  it('renders note bodies and author names', async () => {
    mockGetCoachingNotes.mockResolvedValue(notes);
    render(<CoachingNotesModal {...defaultProps} />);
    await screen.findByText('Close 20 apps this quarter.');
    expect(screen.getByText('Good prospect pipeline.')).toBeInTheDocument();
    expect(screen.getByText(/Branch Manager 1/)).toBeInTheDocument();
    expect(screen.getByText(/Unit Manager 1/)).toBeInTheDocument();
  });

  it('shows edit button only on notes the current user authored', async () => {
    mockGetCoachingNotes.mockResolvedValue(notes);
    render(<CoachingNotesModal {...defaultProps} />);
    await screen.findByText('Close 20 apps this quarter.');
    const editBtns = screen.getAllByLabelText('Edit note');
    expect(editBtns).toHaveLength(1); // only n1 belongs to bm1
  });
});

describe('CoachingNotesModal — add note', () => {
  it('calls addCoachingNote with correct data and reloads on submit', async () => {
    mockGetCoachingNotes.mockResolvedValue([]);
    mockAddCoachingNote.mockResolvedValue({});

    render(<CoachingNotesModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('No coaching notes yet.')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Coaching note body'), {
      target: { value: 'New coaching note.' },
    });

    // After first render reload returns the newly added note
    const newNote = {
      id: 'n3', agentId: 'agent1', authorUid: 'bm1', authorName: 'Branch Manager 1',
      authorRole: 'branch_manager', authorRoleRank: 2, category: 'observation',
      body: 'New coaching note.',
      createdAt: { toDate: () => new Date() }, updatedAt: { toDate: () => new Date() },
    };
    mockGetCoachingNotes.mockResolvedValueOnce([newNote]);

    fireEvent.click(screen.getByRole('button', { name: /add note/i }));

    await waitFor(() =>
      expect(mockAddCoachingNote).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId:   mockTenantId,
          agentId:    defaultProps.agentId,
          agentUnitId: defaultProps.agentUnitId,
          authorUid:  mockUser.uid,
          authorName: mockUserProfile.name,
          authorRole: mockRole,
          body:       'New coaching note.',
        })
      )
    );

    await waitFor(() => expect(screen.getByText('New coaching note.')).toBeInTheDocument());
  });
});

describe('CoachingNotesModal — close', () => {
  it('calls onClose when X button is clicked', async () => {
    mockGetCoachingNotes.mockResolvedValue([]);
    render(<CoachingNotesModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close coaching notes'));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    mockGetCoachingNotes.mockResolvedValue([]);
    render(<CoachingNotesModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });
});
