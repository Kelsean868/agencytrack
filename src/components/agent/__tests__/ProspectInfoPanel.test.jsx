// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUser     = { uid: 'agent1' };
const mockProfile  = { name: 'Test Agent', email: 'agent@test.com', unitId: 'um1' };
const mockRole     = 'agent';
const mockTenantId = 'test-tenant';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        mockUser,
    userProfile: mockProfile,
    role:        mockRole,
    tenantId:    mockTenantId,
  }),
}));

const mockGetProspectInfo    = vi.fn();
const mockAddProspectInfo    = vi.fn();
const mockUpdateProspectInfo = vi.fn();

vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo:    (...args) => mockGetProspectInfo(...args),
  addProspectInfo:    (...args) => mockAddProspectInfo(...args),
  updateProspectInfo: (...args) => mockUpdateProspectInfo(...args),
  PROSPECTING_SOURCES: [
    { value: 'referral', label: 'Referral' },
    { value: 'cold-call', label: 'Cold Call' },
  ],
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
}));

import ProspectInfoPanel from '../ProspectInfoPanel';

beforeEach(() => { vi.clearAllMocks(); });

describe('ProspectInfoPanel — empty state', () => {
  it('shows empty prompt + New Prep button when no preps exist', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await waitFor(() => screen.getByTestId('prospect-info-empty'));
    expect(screen.getByText(/No joint-call prep yet/i)).toBeInTheDocument();
    expect(screen.getByTestId('prospect-info-add-btn')).toBeInTheDocument();
  });
});

describe('ProspectInfoPanel — list of own preps (inclusion)', () => {
  const preps = [
    {
      id: 'p1',
      agentId: 'agent1',
      clientName: 'Jane Smith',
      clientAge: 42,
      clientOccupation: 'Engineer',
      prospectingSource: 'referral',
      appointmentType: '2nd-interview',
      objections: ['no-money'],
      policyType: 'Whole Life',
      intendedAppointmentDate: '2026-06-01',
      createdBy: 'agent1',
    },
  ];

  it('agent SEES their OWN prep records (inclusion semantics)', async () => {
    mockGetProspectInfo.mockResolvedValue(preps);
    render(<ProspectInfoPanel />);
    await waitFor(() => screen.getByTestId('prospect-info-list'));
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Whole Life', { exact: false })).toBeInTheDocument();
  });

  it('shows an Edit affordance for the agent on their own prep (createdBy match)', async () => {
    mockGetProspectInfo.mockResolvedValue(preps);
    render(<ProspectInfoPanel />);
    await waitFor(() => screen.getByText('Jane Smith'));
    expect(screen.getByLabelText('Edit prep')).toBeInTheDocument();
  });

  it('queries service with callerRole=agent + callerUid=own uid', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await waitFor(() =>
      expect(mockGetProspectInfo).toHaveBeenCalledWith({
        tenantId:   mockTenantId,
        agentId:    mockUser.uid,
        callerRole: 'agent',
        callerUid:  mockUser.uid,
      }),
    );
  });
});

describe('ProspectInfoPanel — add prep flow', () => {
  it('opens form on New Prep click; saves with required fields and agent identity', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    mockAddProspectInfo.mockResolvedValue({});
    render(<ProspectInfoPanel />);
    await waitFor(() => screen.getByTestId('prospect-info-add-btn'));

    fireEvent.click(screen.getByTestId('prospect-info-add-btn'));
    expect(screen.getByTestId('prospect-info-add-form')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'New Prospect' } });
    fireEvent.change(screen.getByLabelText(/Intended appointment date/i), {
      target: { value: '2026-06-15' },
    });

    // After save, the reload returns the new prep
    const newPrep = {
      id: 'p2', agentId: 'agent1', clientName: 'New Prospect', clientAge: 0,
      clientOccupation: '', prospectingSource: 'referral', appointmentType: '2nd-interview',
      objections: [], policyType: '', intendedAppointmentDate: '2026-06-15',
      createdBy: 'agent1',
    };
    mockGetProspectInfo.mockResolvedValueOnce([newPrep]);

    fireEvent.click(screen.getByTestId('prospect-info-save-btn'));

    await waitFor(() =>
      expect(mockAddProspectInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId:                mockTenantId,
          agentId:                 mockUser.uid,
          agentUnitId:             mockProfile.unitId,
          clientName:              'New Prospect',
          intendedAppointmentDate: '2026-06-15',
        }),
      ),
    );

    await waitFor(() => screen.getByText('New Prospect'));
  });

  it('appointment date input is marked required (appointment-bound guardrail)', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await waitFor(() => screen.getByTestId('prospect-info-add-btn'));
    fireEvent.click(screen.getByTestId('prospect-info-add-btn'));
    const dateInput = screen.getByLabelText(/Intended appointment date/i);
    expect(dateInput).toBeRequired();
  });
});
