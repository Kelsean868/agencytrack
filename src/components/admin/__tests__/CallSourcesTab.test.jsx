// @vitest-environment jsdom
//
// CallSourcesTab — linked call sources (slice A).
// Covers the token-reveal contract (shown once, explicit "will not be shown
// again"), the decision-5 non-agent warning, listing, and revoke.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  showToast: vi.fn(),
  getTenantUsers: vi.fn(),
  getDocs: vi.fn(),
  httpsCallable: vi.fn(),
  callable: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.showToast }),
}));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers: hoisted.getTenantUsers,
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  getDocs: hoisted.getDocs,
}));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: hoisted.httpsCallable,
}));

import CallSourcesTab from '../CallSourcesTab';

const TENANT = 'tatillife_south';

const AGENT = { id: 'agentA', name: 'Ann Agent', role: 'agent' };
const UM    = { id: 'um1',    name: 'Uma Manager', role: 'unit_manager' };

function snapOf(docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}

function seedSources(docs = []) {
  hoisted.getDocs.mockResolvedValue(snapOf(docs));
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({ tenantId: TENANT });
  hoisted.getTenantUsers.mockResolvedValue([AGENT, UM]);
  hoisted.httpsCallable.mockReturnValue(hoisted.callable);
  seedSources([]);
});

describe('CallSourcesTab — listing', () => {
  it('shows an empty state when there are no sources', async () => {
    render(<CallSourcesTab />);
    expect(await screen.findByTestId('cs-empty')).toBeInTheDocument();
  });

  it('lists a source with its credited agent and expiry', async () => {
    seedSources([{
      id: 's1',
      label: 'Tracy-ann Nurse (assistant)',
      sourceApp: 'kqm-calls',
      creditUid: 'agentA',
      expiresAt: new Date('2027-08-26T00:00:00Z'),
      revokedAt: null,
    }]);
    render(<CallSourcesTab />);

    expect(await screen.findByText('Tracy-ann Nurse (assistant)')).toBeInTheDocument();
    const row = screen.getByTestId('cs-row');
    expect(row).toHaveTextContent('kqm-calls');
    expect(row).toHaveTextContent('Ann Agent');
  });

  it('renders a Revoked badge instead of a Revoke button for a revoked source', async () => {
    seedSources([{
      id: 's1', label: 'Old link', sourceApp: 'kqm-calls', creditUid: 'agentA',
      expiresAt: new Date('2027-08-26T00:00:00Z'), revokedAt: new Date('2026-08-01T00:00:00Z'),
    }]);
    render(<CallSourcesTab />);

    expect(await screen.findByTestId('cs-revoked-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('cs-revoke')).not.toBeInTheDocument();
  });
});

describe('CallSourcesTab — token reveal (decision 4)', () => {
  it('shows the raw token once, with an explicit not-shown-again warning', async () => {
    hoisted.callable.mockResolvedValue({ data: { sourceId: 's1', token: 'deadbeef'.repeat(8) } });
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Assistant' } });
    fireEvent.change(screen.getByLabelText('Credit calls to'), { target: { value: 'agentA' } });
    fireEvent.change(screen.getByLabelText('Caller ID in that system'), { target: { value: 'kqm-77' } });
    fireEvent.click(screen.getByTestId('cs-create'));

    const reveal = await screen.findByTestId('call-source-token-reveal');
    expect(reveal).toHaveTextContent('This will not be shown again');
    expect(screen.getByTestId('call-source-token-value')).toHaveTextContent('deadbeef'.repeat(8));
  });

  it('hides the token permanently once dismissed', async () => {
    hoisted.callable.mockResolvedValue({ data: { sourceId: 's1', token: 'abc123' } });
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Assistant' } });
    fireEvent.change(screen.getByLabelText('Credit calls to'), { target: { value: 'agentA' } });
    fireEvent.change(screen.getByLabelText('Caller ID in that system'), { target: { value: 'kqm-77' } });
    fireEvent.click(screen.getByTestId('cs-create'));

    await screen.findByTestId('call-source-token-reveal');
    fireEvent.click(screen.getByTestId('call-source-token-dismiss'));

    await waitFor(() => {
      expect(screen.queryByTestId('call-source-token-reveal')).not.toBeInTheDocument();
    });
  });

  it('does not reveal a token when creation fails', async () => {
    hoisted.callable.mockRejectedValue(new Error('permission denied'));
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Assistant' } });
    fireEvent.change(screen.getByLabelText('Credit calls to'), { target: { value: 'agentA' } });
    fireEvent.change(screen.getByLabelText('Caller ID in that system'), { target: { value: 'kqm-77' } });
    fireEvent.click(screen.getByTestId('cs-create'));

    expect(await screen.findByTestId('call-sources-error')).toHaveTextContent('permission denied');
    expect(screen.queryByTestId('call-source-token-reveal')).not.toBeInTheDocument();
  });
});

describe('CallSourcesTab — non-agent credit warning (decision 5)', () => {
  it('warns when the credited user is not an agent', async () => {
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fireEvent.change(screen.getByLabelText('Credit calls to'), { target: { value: 'um1' } });

    const warning = await screen.findByTestId('cs-role-warning');
    expect(warning).toHaveTextContent('unit manager');
    expect(warning).toHaveTextContent('Calls will still be credited to them');
  });

  it('does not warn for an agent', async () => {
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fireEvent.change(screen.getByLabelText('Credit calls to'), { target: { value: 'agentA' } });

    await waitFor(() => {
      expect(screen.queryByTestId('cs-role-warning')).not.toBeInTheDocument();
    });
  });
});

describe('CallSourcesTab — revoke', () => {
  it('calls revokeCallSource with the source id', async () => {
    seedSources([{
      id: 's1', label: 'Assistant', sourceApp: 'kqm-calls', creditUid: 'agentA',
      expiresAt: new Date('2027-08-26T00:00:00Z'), revokedAt: null,
    }]);
    hoisted.callable.mockResolvedValue({ data: { success: true } });
    render(<CallSourcesTab />);

    fireEvent.click(await screen.findByTestId('cs-revoke'));

    await waitFor(() => {
      expect(hoisted.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'revokeCallSource');
      expect(hoisted.callable).toHaveBeenCalledWith({ sourceId: 's1' });
    });
  });
});
