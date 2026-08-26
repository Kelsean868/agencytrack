// @vitest-environment jsdom
//
// CallSourcesTab — self-service model.
// Covers the token-reveal contract (shown once, explicit "will not be shown
// again"), the constrained owner-scoped query the rules require, the absence of
// any creditUid affordance, listing, and revoke.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  showToast: vi.fn(),
  getDocs: vi.fn(),
  httpsCallable: vi.fn(),
  callable: vi.fn(),
  where: vi.fn((field, op, value) => ({ __where: [field, op, value] })),
  query: vi.fn((...args) => ({ __query: args })),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.showToast }),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, path) => ({ __path: path })),
  query: hoisted.query,
  where: hoisted.where,
  getDocs: hoisted.getDocs,
}));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: hoisted.httpsCallable,
}));

import CallSourcesTab from '../CallSourcesTab';

const TENANT = 'tatillife_south';
const UID    = 'agentA';

function snapOf(docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}
function seedSources(docs = []) {
  hoisted.getDocs.mockResolvedValue(snapOf(docs));
}

function fillForm() {
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Assistant' } });
  fireEvent.change(screen.getByLabelText('Caller ID in that system'), { target: { value: 'kqm-77' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({ tenantId: TENANT, user: { uid: UID } });
  hoisted.httpsCallable.mockReturnValue(hoisted.callable);
  hoisted.where.mockImplementation((field, op, value) => ({ __where: [field, op, value] }));
  hoisted.query.mockImplementation((...args) => ({ __query: args }));
  seedSources([]);
});

// ── The constrained query — load-bearing, and easy to break silently ─────────
//
// The rules' read arm is `resource.data.creditUid == request.auth.uid`.
// Firestore evaluates a list against the QUERY, not the results, so dropping
// this where() does not return fewer rows — it returns permission-denied.

describe('CallSourcesTab — owner-scoped query', () => {
  it('queries with where(creditUid == the signed-in uid)', async () => {
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    expect(hoisted.where).toHaveBeenCalledWith('creditUid', '==', UID);
  });

  it('does not query at all before the uid is known', () => {
    hoisted.useAuth.mockReturnValue({ tenantId: TENANT, user: null });
    render(<CallSourcesTab />);
    expect(hoisted.getDocs).not.toHaveBeenCalled();
  });
});

// ── No cross-credit affordance anywhere in the UI ────────────────────────────

describe('CallSourcesTab — self-credit only', () => {
  it('renders no control for choosing who gets credited', async () => {
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    expect(screen.queryByLabelText('Credit calls to')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('states plainly that calls credit the signed-in user', async () => {
    render(<CallSourcesTab />);
    expect(await screen.findByTestId('cs-self-credit-note'))
      .toHaveTextContent('cannot attach a source for someone else');
  });

  it('never sends creditUid to the callable', async () => {
    hoisted.callable.mockResolvedValue({ data: { sourceId: 's1', token: 'abc123' } });
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fillForm();
    fireEvent.click(screen.getByTestId('cs-create'));

    await waitFor(() => expect(hoisted.callable).toHaveBeenCalled());
    const payload = hoisted.callable.mock.calls[0][0];
    expect(payload).not.toHaveProperty('creditUid');
    expect(payload).toEqual({
      sourceApp: 'kqm-calls',
      sourceUserId: 'kqm-77',
      label: 'Assistant',
    });
  });
});

// ── Listing ──────────────────────────────────────────────────────────────────

describe('CallSourcesTab — listing', () => {
  it('shows an empty state when there are none', async () => {
    render(<CallSourcesTab />);
    expect(await screen.findByTestId('cs-empty')).toBeInTheDocument();
  });

  it('lists a source with its system and expiry', async () => {
    seedSources([{
      id: 's1',
      label: 'Tracy-ann Nurse (assistant)',
      sourceApp: 'kqm-calls',
      creditUid: UID,
      expiresAt: new Date('2027-08-26T00:00:00Z'),
      revokedAt: null,
    }]);
    render(<CallSourcesTab />);

    expect(await screen.findByText('Tracy-ann Nurse (assistant)')).toBeInTheDocument();
    expect(screen.getByTestId('cs-row')).toHaveTextContent('kqm-calls');
  });

  it('sorts newest first without relying on an orderBy', async () => {
    seedSources([
      { id: 'old', label: 'Older', sourceApp: 'a', creditUid: UID, createdAt: new Date('2026-01-01'), revokedAt: null },
      { id: 'new', label: 'Newer', sourceApp: 'b', creditUid: UID, createdAt: new Date('2026-08-01'), revokedAt: null },
    ]);
    render(<CallSourcesTab />);

    const rows = await screen.findAllByTestId('cs-row');
    expect(rows[0]).toHaveTextContent('Newer');
    expect(rows[1]).toHaveTextContent('Older');
  });

  it('renders a Revoked badge instead of a Revoke button for a revoked source', async () => {
    seedSources([{
      id: 's1', label: 'Old link', sourceApp: 'kqm-calls', creditUid: UID,
      expiresAt: new Date('2027-08-26T00:00:00Z'), revokedAt: new Date('2026-08-01T00:00:00Z'),
    }]);
    render(<CallSourcesTab />);

    expect(await screen.findByTestId('cs-revoked-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('cs-revoke')).not.toBeInTheDocument();
  });
});

// ── Token reveal ─────────────────────────────────────────────────────────────

describe('CallSourcesTab — token reveal', () => {
  it('shows the raw token once, with an explicit not-shown-again warning', async () => {
    hoisted.callable.mockResolvedValue({ data: { sourceId: 's1', token: 'deadbeef'.repeat(8) } });
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fillForm();
    fireEvent.click(screen.getByTestId('cs-create'));

    const reveal = await screen.findByTestId('call-source-token-reveal');
    expect(reveal).toHaveTextContent('This will not be shown again');
    expect(screen.getByTestId('call-source-token-value')).toHaveTextContent('deadbeef'.repeat(8));
  });

  it('hides the token permanently once dismissed', async () => {
    hoisted.callable.mockResolvedValue({ data: { sourceId: 's1', token: 'abc123' } });
    render(<CallSourcesTab />);
    await screen.findByTestId('cs-empty');

    fillForm();
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

    fillForm();
    fireEvent.click(screen.getByTestId('cs-create'));

    expect(await screen.findByTestId('call-sources-error')).toHaveTextContent('permission denied');
    expect(screen.queryByTestId('call-source-token-reveal')).not.toBeInTheDocument();
  });
});

// ── Revoke ───────────────────────────────────────────────────────────────────

describe('CallSourcesTab — revoke', () => {
  it('calls revokeCallSource with the source id', async () => {
    seedSources([{
      id: 's1', label: 'Assistant', sourceApp: 'kqm-calls', creditUid: UID,
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
