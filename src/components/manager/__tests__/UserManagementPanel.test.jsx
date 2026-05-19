import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted mocks — applied before the SUT and its transitive imports run.
const hoisted = vi.hoisted(() => ({
  getAllUsers:        vi.fn(),
  createUser:         vi.fn(),
  deactivateUser:     vi.fn(),
  getUnitManagers:    vi.fn(),
  getBranchManagers:  vi.fn(),
  resendInvite:       vi.fn(),
  toastShow:          vi.fn(),
}));

vi.mock('../../../services/agentManagementService', () => ({
  getAllUsers:       hoisted.getAllUsers,
  createUser:        hoisted.createUser,
  deactivateUser:    hoisted.deactivateUser,
  getUnitManagers:   hoisted.getUnitManagers,
  getBranchManagers: hoisted.getBranchManagers,
}));

vi.mock('../../../services/userService', () => ({
  resendInvite: hoisted.resendInvite,
}));

vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.toastShow, dismiss: vi.fn() }),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    role:        'tenant_admin',
    user:        { uid: 'admin-1', email: 'admin@example.com' },
    userProfile: { uid: 'admin-1', branchId: 'branch-1' },
    tenantId:    't1',
  }),
}));

// Stub heavy children — they're not under test and would pull firebase chains.
vi.mock('../EditUserDrawer',                 () => ({ default: () => null }));
vi.mock('../../admin/BulkImportUsersModal',  () => ({ default: () => null }));
vi.mock('../../admin/BulkImportGoalsModal',  () => ({ default: () => null }));

import UserManagementPanel from '../UserManagementPanel';

const ACTIVE_AGENT = {
  uid:     'agent-1',
  id:      'agent-1',
  role:    'agent',
  name:    'Active Agent',
  email:   'active@example.com',
  active:  true,
};

const INACTIVE_AGENT = {
  uid:     'agent-2',
  id:      'agent-2',
  role:    'agent',
  name:    'Inactive Agent',
  email:   'inactive@example.com',
  active:  false,
};

describe('UserManagementPanel — Resend invite UI', () => {
  beforeEach(() => {
    hoisted.getAllUsers.mockReset();
    hoisted.resendInvite.mockReset();
    hoisted.toastShow.mockReset();
  });

  it('renders Resend invite button for active users when caller canAct, hidden for inactive users', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT, INACTIVE_AGENT]);
    render(<UserManagementPanel />);

    // Wait for the user list to load.
    await waitFor(() => {
      expect(screen.getByTestId('user-resend-agent-1')).toBeInTheDocument();
    });
    // Active agent: button present with the right aria-label.
    const resendBtn = screen.getByTestId('user-resend-agent-1');
    expect(resendBtn).toHaveAttribute('aria-label', 'Resend invite email to Active Agent');

    // Inactive agent: button hidden (canAct && !isInactive gate).
    expect(screen.queryByTestId('user-resend-agent-2')).not.toBeInTheDocument();
  });

  it('click Resend → ConfirmDialog opens → confirm → resendInvite called with target uid, success toast shown', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    hoisted.resendInvite.mockResolvedValue({
      success: true,
      targetUid: 'agent-1',
      targetEmail: 'active@example.com',
      emailQueued: true,
    });
    render(<UserManagementPanel />);

    // Wait for the row to render.
    await waitFor(() => {
      expect(screen.getByTestId('user-resend-agent-1')).toBeInTheDocument();
    });

    // Open the confirm dialog.
    fireEvent.click(screen.getByTestId('user-resend-agent-1'));
    await waitFor(() => {
      expect(screen.getByText(/Resend invite email\?/i)).toBeInTheDocument();
    });
    // Edge-case copy banked in the FU body is present.
    expect(screen.getByText(/Previous reset email link will stop working/i)).toBeInTheDocument();

    // Confirm.
    fireEvent.click(screen.getByRole('button', { name: /^Resend$/ }));

    // resendInvite invoked with the target user's uid (CF payload shape).
    await waitFor(() => expect(hoisted.resendInvite).toHaveBeenCalledTimes(1));
    expect(hoisted.resendInvite).toHaveBeenCalledWith('agent-1');

    // Success toast surfaced.
    await waitFor(() => expect(hoisted.toastShow).toHaveBeenCalledTimes(1));
    expect(hoisted.toastShow).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'success',
      message: expect.stringMatching(/Invite email resent to Active Agent/i),
    }));
  });

  it('resendInvite returning emailQueued:false surfaces a warning toast, not success', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    hoisted.resendInvite.mockResolvedValue({
      success: true,
      targetUid: 'agent-1',
      targetEmail: 'active@example.com',
      emailQueued: false,
      emailError: 'mail/ write failed',
    });
    render(<UserManagementPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('user-resend-agent-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('user-resend-agent-1'));
    await waitFor(() => {
      expect(screen.getByText(/Resend invite email\?/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Resend$/ }));

    await waitFor(() => expect(hoisted.toastShow).toHaveBeenCalledTimes(1));
    expect(hoisted.toastShow).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'warning',
      message: expect.stringMatching(/may not have sent/i),
    }));
  });
});
