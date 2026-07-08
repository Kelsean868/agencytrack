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
  getInviteLink:      vi.fn(),
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
  resendInvite:  hoisted.resendInvite,
  getInviteLink: hoisted.getInviteLink,
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

const FAKE_LINK = 'https://agencytrack.vercel.app/__/auth/action?oobCode=FAKETOKEN';

// Clipboard mock
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

describe('UserManagementPanel — Invite control', () => {
  beforeEach(() => {
    hoisted.getAllUsers.mockReset();
    hoisted.resendInvite.mockReset();
    hoisted.getInviteLink.mockReset();
    hoisted.toastShow.mockReset();
    navigator.clipboard.writeText.mockReset().mockResolvedValue(undefined);
  });

  // ── Visibility ─────────────────────────────────────────────────────────────

  it('renders Invite button for active users, hidden for inactive users', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT, INACTIVE_AGENT]);
    render(<UserManagementPanel />);

    await waitFor(() => expect(screen.getByTestId('user-invite-agent-1')).toBeInTheDocument());

    expect(screen.getByTestId('user-invite-agent-1')).toHaveAttribute(
      'aria-label', 'Invite options for Active Agent'
    );
    expect(screen.queryByTestId('user-invite-agent-2')).not.toBeInTheDocument();
  });

  // ── Dropdown ───────────────────────────────────────────────────────────────

  it('clicking Invite button opens dropdown with Copy link and Resend email items', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByTestId('user-invite-agent-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('user-invite-agent-1'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument());
    expect(screen.getByRole('menuitem', { name: /Resend email/i })).toBeInTheDocument();
  });

  // ── Resend email path ──────────────────────────────────────────────────────

  it('Resend email → ConfirmDialog → confirm → resendInvite called, success toast shown', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    hoisted.resendInvite.mockResolvedValue({
      success: true,
      targetUid: 'agent-1',
      targetEmail: 'active@example.com',
      emailQueued: true,
    });
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByTestId('user-invite-agent-1')).toBeInTheDocument());

    // Open dropdown
    fireEvent.click(screen.getByTestId('user-invite-agent-1'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Resend email/i })).toBeInTheDocument());

    // Click Resend email item → opens ConfirmDialog
    fireEvent.click(screen.getByRole('menuitem', { name: /Resend email/i }));
    await waitFor(() => expect(screen.getByText(/Resend invite email\?/i)).toBeInTheDocument());
    expect(screen.getByText(/Previous reset email link will stop working/i)).toBeInTheDocument();

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: /^Resend$/ }));

    await waitFor(() => expect(hoisted.resendInvite).toHaveBeenCalledWith('agent-1'));
    await waitFor(() => expect(hoisted.toastShow).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'success',
      message: expect.stringMatching(/Invite email resent to Active Agent/i),
    })));
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
    await waitFor(() => expect(screen.getByTestId('user-invite-agent-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('user-invite-agent-1'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Resend email/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('menuitem', { name: /Resend email/i }));
    await waitFor(() => expect(screen.getByText(/Resend invite email\?/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Resend$/ }));

    await waitFor(() => expect(hoisted.toastShow).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'warning',
      message: expect.stringMatching(/may not have sent/i),
    })));
  });

  // ── Copy link path ─────────────────────────────────────────────────────────

  it('Copy link → getInviteLink called → modal shows link and caveats', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    hoisted.getInviteLink.mockResolvedValue(FAKE_LINK);
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByTestId('user-invite-agent-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('user-invite-agent-1'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy link/i }));

    await waitFor(() => expect(hoisted.getInviteLink).toHaveBeenCalledWith('agent-1'));
    await waitFor(() => expect(screen.getByTestId('copy-link-input')).toBeInTheDocument());

    expect(screen.getByTestId('copy-link-input')).toHaveValue(FAKE_LINK);
    expect(screen.getByText(/expires in approximately 1 hour/i)).toBeInTheDocument();
    expect(screen.getByText(/invalidates any previous invite link/i)).toBeInTheDocument();
    expect(screen.getByText(/Send it privately/i)).toBeInTheDocument();
  });

  it('Copy button writes link to clipboard and shows Copied!', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    hoisted.getInviteLink.mockResolvedValue(FAKE_LINK);
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByTestId('user-invite-agent-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('user-invite-agent-1'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy link/i }));
    await waitFor(() => expect(screen.getByTestId('copy-link-button')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('copy-link-button'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(FAKE_LINK));
    await waitFor(() => expect(screen.getByTestId('copy-link-button')).toHaveTextContent('Copied!'));
  });

  it('getInviteLink error → error toast shown, modal closed', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    hoisted.getInviteLink.mockRejectedValue(
      Object.assign(new Error('permission-denied: not allowed'), { code: 'permission-denied' })
    );
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByTestId('user-invite-agent-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('user-invite-agent-1'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Copy link/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy link/i }));

    await waitFor(() => expect(hoisted.toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' })
    ));
    expect(screen.queryByTestId('copy-link-input')).not.toBeInTheDocument();
  });
});

describe('UserManagementPanel — §5 dense-table contract', () => {
  beforeEach(() => {
    hoisted.getAllUsers.mockReset();
  });

  it('renders a live footer count with active/deactivated breakdown', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT, INACTIVE_AGENT]);
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    const footer = screen.getByTestId('user-roster-footer');
    expect(footer).toHaveTextContent('2 users');
    expect(footer).toHaveTextContent('1 active');
    expect(footer).toHaveTextContent('1 deactivated');
  });

  it('renders an Active status pill for active users and Deactivated for inactive', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT, INACTIVE_AGENT]);
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
  });

  it('header row is sticky (card-scoped scroll contract)', async () => {
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    const { container } = render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells.length).toBeGreaterThan(0);
    headerCells.forEach((th) => expect(th.className).toContain('sticky'));
  });
});
