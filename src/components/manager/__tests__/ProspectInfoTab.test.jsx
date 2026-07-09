// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUser     = { uid: 'bm1' };
const mockRole     = 'branch_manager';
const mockTenantId = 'test-tenant';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        mockUser,
    userProfile: { name: 'Branch Manager 1', email: 'bm@test.com' },
    role:        mockRole,
    tenantId:    mockTenantId,
  }),
}));

const mockGetProspectInfo = vi.fn();

vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo: (...args) => mockGetProspectInfo(...args),
  addProspectInfo: vi.fn(),
  updateProspectInfo: vi.fn(),
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
    { value: 'whole-life',           label: 'Whole Life / Permanent' },
    { value: 'term-life',            label: 'Term Life' },
    { value: 'mortgage-credit-life', label: 'Mortgage / Credit Life' },
  ],
}));

import ProspectInfoTab from '../ProspectInfoTab';

const defaultProps = { agentId: 'agent1' };

beforeEach(() => { vi.clearAllMocks(); });

describe('ProspectInfoTab — loading state', () => {
  it('shows skeleton loaders while fetching', () => {
    mockGetProspectInfo.mockReturnValue(new Promise(() => {}));
    render(<ProspectInfoTab {...defaultProps} />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('ProspectInfoTab — empty state', () => {
  it('shows empty prompt when no preps exist', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoTab {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('No joint-call prep submitted yet.')).toBeInTheDocument(),
    );
  });
});

describe('ProspectInfoTab — read-only render', () => {
  const preps = [
    {
      id: 'p1',
      agentId: 'agent1',
      clientName: 'Jane Smith',
      clientAge: 42,
      clientOccupation: 'Engineer',
      prospectingSource: 'referral',
      appointmentType: '2nd-interview',
      objections: ['no-money', 'no-hurry'],
      policyType: 'Whole Life',
      intendedAppointmentDate: '2026-06-01',
      createdBy: 'agent1',
    },
  ];

  it('renders prep card fields', async () => {
    mockGetProspectInfo.mockResolvedValue(preps);
    render(<ProspectInfoTab {...defaultProps} />);
    await waitFor(() => screen.getByText('Jane Smith'));
    expect(screen.getByText('42 yrs · Engineer')).toBeInTheDocument();
    expect(screen.getByText('2nd Interview')).toBeInTheDocument();
    expect(screen.getByText('Referral')).toBeInTheDocument();
    expect(screen.getByText('01-06-2026')).toBeInTheDocument();
    expect(screen.getByText('No Money')).toBeInTheDocument();
    expect(screen.getByText('No Hurry')).toBeInTheDocument();
  });

  it('does NOT show any edit / add controls (manager read-only)', async () => {
    mockGetProspectInfo.mockResolvedValue(preps);
    render(<ProspectInfoTab {...defaultProps} />);
    await waitFor(() => screen.getByText('Jane Smith'));
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('passes callerRole/callerUid to service for scope-aware query', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoTab {...defaultProps} />);
    await waitFor(() =>
      expect(mockGetProspectInfo).toHaveBeenCalledWith({
        tenantId:   mockTenantId,
        agentId:    'agent1',
        callerRole: mockRole,
        callerUid:  mockUser.uid,
      }),
    );
  });
});

describe('ProspectInfoTab — taxonomy labels', () => {
  it('renders legacy BOA source as "Bank Referral (BOA)" label', async () => {
    mockGetProspectInfo.mockResolvedValue([{
      id: 'legacy-boa',
      agentId: 'agent1',
      clientName: 'Legacy Prospect',
      clientAge: 30,
      clientOccupation: 'Mortgage Client',
      prospectingSource: 'BOA',
      appointmentType: '2nd-interview',
      objections: [],
      policyType: 'mortgage-credit-life',
      intendedAppointmentDate: '2026-06-10',
      createdBy: 'agent1',
    }]);
    render(<ProspectInfoTab {...defaultProps} />);
    await waitFor(() => screen.getByText('Legacy Prospect'));
    expect(screen.getByText('Bank Referral (BOA)')).toBeInTheDocument();
    expect(screen.getByText('Mortgage / Credit Life', { exact: false })).toBeInTheDocument();
  });

  it('renders bank-referral + enum policyType using enum labels', async () => {
    mockGetProspectInfo.mockResolvedValue([{
      id: 'enum-pt', agentId: 'agent1', clientName: 'Enum Client',
      clientAge: 0, clientOccupation: '',
      prospectingSource: 'bank-referral', appointmentType: '2nd-interview',
      objections: [], policyType: 'whole-life',
      intendedAppointmentDate: '2026-06-12', createdBy: 'agent1',
    }]);
    render(<ProspectInfoTab {...defaultProps} />);
    await waitFor(() => screen.getByText('Enum Client'));
    expect(screen.getByText('Bank Referral (BOA)')).toBeInTheDocument();
    expect(screen.getByText('Whole Life / Permanent', { exact: false })).toBeInTheDocument();
  });
});

describe('ProspectInfoTab — error state', () => {
  it('shows error message when service rejects', async () => {
    mockGetProspectInfo.mockRejectedValue(new Error('boom'));
    render(<ProspectInfoTab {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load prospect info/i)).toBeInTheDocument(),
    );
  });
});
