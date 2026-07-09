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
    { value: 'referral',      label: 'Referral' },
    { value: 'cold-call',     label: 'Cold Call' },
    { value: 'bank-referral', label: 'Bank Referral (BOA)' },
    { value: 'social-media',  label: 'Social Media' },
  ],
  PROSPECTING_SOURCE_LABELS: {
    referral:        'Referral',
    'cold-call':     'Cold Call',
    'bank-referral': 'Bank Referral (BOA)',
    'social-media':  'Social Media',
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

import ProspectInfoPanel from '../ProspectInfoPanel';

beforeEach(() => { vi.clearAllMocks(); });

describe('ProspectInfoPanel — empty state', () => {
  it('shows empty prompt + New Prep button when no preps exist', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await screen.findByTestId('prospect-info-empty');
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
    await screen.findByText('Jane Smith');
    expect(screen.getByText('Whole Life', { exact: false })).toBeInTheDocument();
  });

  it('shows an Edit affordance for the agent on their own prep (createdBy match)', async () => {
    mockGetProspectInfo.mockResolvedValue(preps);
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());
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

describe('ProspectInfoPanel — taxonomy labels', () => {
  it('renders legacy BOA prep with "Bank Referral (BOA)" label (display-superset fallback)', async () => {
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
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByText('Legacy Prospect')).toBeInTheDocument());
    expect(screen.getByText('Bank Referral (BOA)')).toBeInTheDocument();
    expect(screen.getByText('Mortgage / Credit Life', { exact: false })).toBeInTheDocument();
  });

  it('renders enum policyType value with its label and legacy free-text verbatim', async () => {
    mockGetProspectInfo.mockResolvedValue([
      {
        id: 'enum-pt', agentId: 'agent1', clientName: 'Enum Client',
        clientAge: 0, clientOccupation: '',
        prospectingSource: 'bank-referral', appointmentType: '2nd-interview',
        objections: [], policyType: 'whole-life',
        intendedAppointmentDate: '2026-06-12', createdBy: 'agent1',
      },
      {
        id: 'legacy-pt', agentId: 'agent1', clientName: 'Legacy Client',
        clientAge: 0, clientOccupation: '',
        prospectingSource: 'referral', appointmentType: '2nd-interview',
        objections: [], policyType: 'Whole Life',
        intendedAppointmentDate: '2026-06-13', createdBy: 'agent1',
      },
    ]);
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByText('Enum Client')).toBeInTheDocument());
    expect(screen.getByText('Whole Life / Permanent', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Whole Life', { exact: true })).toBeInTheDocument();
  });
});

describe('ProspectInfoPanel — add prep flow', () => {
  it('opens form on New Prep click; saves with required fields and agent identity', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    mockAddProspectInfo.mockResolvedValue({});
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByTestId('prospect-info-add-btn')).toBeInTheDocument());

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

    await waitFor(() => expect(screen.getByText('New Prospect')).toBeInTheDocument());
  });

  it('appointment date input is marked required (appointment-bound guardrail)', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByTestId('prospect-info-add-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('prospect-info-add-btn'));
    const dateInput = screen.getByLabelText(/Intended appointment date/i);
    expect(dateInput).toBeRequired();
  });
});

// ── onCreatePolicyFromPrep callback tests (F3.1) ──────────────────────────────

describe('ProspectInfoPanel — Log Policy CTA (F3.1)', () => {
  const prep = {
    id: 'p-lp',
    agentId: 'agent1',
    clientName: 'Alice Test',
    clientAge: 35,
    clientOccupation: 'Nurse',
    prospectingSource: 'referral',
    appointmentType: '2nd-interview',
    objections: [],
    policyType: 'whole-life',
    intendedAppointmentDate: '2026-07-01',
    createdBy: 'agent1',
  };

  it('Log Policy button visible when onCreatePolicyFromPrep is provided', async () => {
    mockGetProspectInfo.mockResolvedValue([prep]);
    render(<ProspectInfoPanel onCreatePolicyFromPrep={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId(`log-policy-btn-${prep.id}`)).toBeInTheDocument());
    expect(screen.getByTestId(`log-policy-btn-${prep.id}`)).toBeInTheDocument();
  });

  it('Log Policy button fires onCreatePolicyFromPrep with ownerName + sourceOfProspect', async () => {
    mockGetProspectInfo.mockResolvedValue([prep]);
    const callback = vi.fn();
    render(<ProspectInfoPanel onCreatePolicyFromPrep={callback} />);
    await waitFor(() => expect(screen.getByTestId(`log-policy-btn-${prep.id}`)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId(`log-policy-btn-${prep.id}`));
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      clientName: 'Alice Test',
      prospectingSource: 'referral',
    }));
  });

  it('Log Policy button hidden when onCreatePolicyFromPrep is not provided', async () => {
    mockGetProspectInfo.mockResolvedValue([prep]);
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByText('Alice Test')).toBeInTheDocument());
    expect(screen.queryByTestId(`log-policy-btn-${prep.id}`)).not.toBeInTheDocument();
  });
});

describe('ProspectInfoPanel — NextCallHero + readiness (item 3.5)', () => {
  const futurePrep = {
    id: 'hero1',
    agentId: 'agent1',
    clientName: 'Future Client',
    clientAge: 40,
    clientOccupation: 'Teacher',
    prospectingSource: 'referral',
    appointmentType: 'closing-interview',
    objections: ['no-money'],
    policyType: 'whole-life',
    intendedAppointmentDate: '2099-01-15', // always upcoming → becomes the hero
    createdBy: 'agent1',
  };

  it('renders NextCallHero for the soonest upcoming prep with the rehearsal aid', async () => {
    mockGetProspectInfo.mockResolvedValue([futurePrep]);
    render(<ProspectInfoPanel />);
    await screen.findByTestId('next-call-hero');
    // Objection rehearsal counter surfaces inside the hero
    expect(screen.getByText(/smaller starter premium/i)).toBeInTheDocument();
    // policyType present + objections listed → prepped
    expect(screen.getByTestId('readiness-prepped')).toBeInTheDocument();
  });

  it('shows "Needs prep" when a prep lacks policyType/objections', async () => {
    mockGetProspectInfo.mockResolvedValue([{
      ...futurePrep, id: 'hero2', clientName: 'Bare Client', policyType: '', objections: [],
    }]);
    render(<ProspectInfoPanel />);
    await screen.findByTestId('next-call-hero');
    expect(screen.getByTestId('readiness-needs-prep')).toBeInTheDocument();
  });

  it('does NOT render a hero when every prep is overdue (all past-dated)', async () => {
    mockGetProspectInfo.mockResolvedValue([{
      ...futurePrep, id: 'past1', clientName: 'Past Client', intendedAppointmentDate: '2020-01-01',
    }]);
    render(<ProspectInfoPanel />);
    await screen.findByText('Past Client');
    expect(screen.queryByTestId('next-call-hero')).not.toBeInTheDocument();
  });
});

describe('ProspectInfoPanel — socialPlatform conditional select (PR #319)', () => {
  it('platform select appears when prospectingSource is changed to social-media', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByTestId('prospect-info-add-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('prospect-info-add-btn'));

    // Default source (referral) — no platform select
    expect(screen.queryByLabelText('Social platform (required)')).not.toBeInTheDocument();

    // Switch to social-media
    fireEvent.change(screen.getByLabelText('Prospecting source'), { target: { value: 'social-media' } });
    expect(screen.getByLabelText('Social platform (required)')).toBeInTheDocument();
  });

  it('platform select disappears when source changes away from social-media', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByTestId('prospect-info-add-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('prospect-info-add-btn'));

    fireEvent.change(screen.getByLabelText('Prospecting source'), { target: { value: 'social-media' } });
    expect(screen.getByLabelText('Social platform (required)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Prospecting source'), { target: { value: 'referral' } });
    expect(screen.queryByLabelText('Social platform (required)')).not.toBeInTheDocument();
  });

  it('save button is disabled when social-media is selected but no platform chosen', async () => {
    mockGetProspectInfo.mockResolvedValue([]);
    render(<ProspectInfoPanel />);
    await waitFor(() => expect(screen.getByTestId('prospect-info-add-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('prospect-info-add-btn'));

    // Fill required fields so only social-media-without-platform disables the button
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Test Client' } });
    fireEvent.change(screen.getByLabelText('Intended appointment date (required)'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('Prospecting source'), { target: { value: 'social-media' } });

    // Platform not chosen — save should be disabled
    expect(screen.getByTestId('prospect-info-save-btn')).toBeDisabled();
  });
});
