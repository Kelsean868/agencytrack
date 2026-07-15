// @vitest-environment jsdom
//
// §1(b) four-states holdouts — manager PersistencyTab error state + Retry.
// Focused on the error/Retry affordance only; child rendering surfaces
// (PersRealityBar / PersAtRiskBook / PersRoster / modals) are mocked to keep
// this test scoped to the loader + error-card behavior owned by this file.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useToastShow: vi.fn(),
  getPersistencyForBranch: vi.fn(),
  getPersistencyForUnit: vi.fn(),
  getAvailableMonths: vi.fn(),
  getTenantUsers: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.useToastShow, dismiss: vi.fn() }),
}));
vi.mock('../../../services/persistencyService', () => ({
  getPersistencyForBranch: hoisted.getPersistencyForBranch,
  getPersistencyForUnit: hoisted.getPersistencyForUnit,
  getAvailableMonths: hoisted.getAvailableMonths,
}));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers: hoisted.getTenantUsers,
}));

// Child surfaces stubbed — this file's own error/Retry wiring is what's under test.
vi.mock('../PersRealityBar', () => ({ default: () => <div data-testid="reality-bar" /> }));
vi.mock('../PersAtRiskBook', () => ({ default: () => <div data-testid="at-risk-book" /> }));
vi.mock('../PersRoster', () => ({ default: () => <div data-testid="roster" /> }));
vi.mock('../CoachingNotesModal', () => ({ default: () => null }));
vi.mock('../PersistencyEntryForm', () => ({ default: () => null }));
vi.mock('../../persistency/PersistencyPlayground', () => ({ default: () => null }));

import PersistencyTab from '../PersistencyTab';

const DEFAULT_AUTH = {
  user: { uid: 'mgr1' },
  userProfile: { branchId: 'branch1', unitId: 'unit1', tenantId: 'tenant1' },
  role: 'branch_manager',
  tenantId: 'tenant1',
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue(DEFAULT_AUTH);
  hoisted.getAvailableMonths.mockResolvedValue(['2026-02']);
  hoisted.getPersistencyForBranch.mockResolvedValue([]);
  hoisted.getPersistencyForUnit.mockResolvedValue([]);
  hoisted.getTenantUsers.mockResolvedValue([]);
});

describe('manager PersistencyTab — error state + Retry', () => {
  it('renders an error card with role="alert" and a Retry button when loadRecords fails', async () => {
    hoisted.getPersistencyForBranch.mockRejectedValueOnce(new Error('Failed to load persistency.'));
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Failed to load persistency.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders an error card when the months lookup fails', async () => {
    hoisted.getAvailableMonths.mockRejectedValueOnce(new Error('Failed to load months.'));
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Failed to load months.')).toBeInTheDocument();
  });

  it('clicking Retry re-invokes the persistency loader and recovers once it succeeds', async () => {
    hoisted.getPersistencyForBranch.mockRejectedValueOnce(new Error('Failed to load persistency.'));
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    const callsBeforeRetry = hoisted.getPersistencyForBranch.mock.calls.length;
    hoisted.getPersistencyForBranch.mockResolvedValueOnce([]);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    });

    await waitFor(() =>
      expect(hoisted.getPersistencyForBranch.mock.calls.length).toBe(callsBeforeRetry + 1)
    );
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByTestId('persistency-tab')).toBeInTheDocument();
  });

  it('clicking Retry also re-invokes getAvailableMonths (both loaders retried together)', async () => {
    hoisted.getPersistencyForBranch.mockRejectedValueOnce(new Error('Failed to load persistency.'));
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    const monthsCallsBeforeRetry = hoisted.getAvailableMonths.mock.calls.length;
    hoisted.getPersistencyForBranch.mockResolvedValueOnce([]);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    });

    await waitFor(() =>
      expect(hoisted.getAvailableMonths.mock.calls.length).toBe(monthsCallsBeforeRetry + 1)
    );
  });
});
