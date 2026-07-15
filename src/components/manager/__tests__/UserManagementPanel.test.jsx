import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

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
  listBranches:       vi.fn(),
}));

vi.mock('../../../services/agentManagementService', () => ({
  getAllUsers:       hoisted.getAllUsers,
  createUser:        hoisted.createUser,
  deactivateUser:    hoisted.deactivateUser,
  getUnitManagers:   hoisted.getUnitManagers,
  getBranchManagers: hoisted.getBranchManagers,
}));

// CreateUserDrawer (defined in the SUT file) fetches unit managers + branches
// on mount for non-unit_manager callers. Only exercised once the drawer
// actually opens — the openCreateSignal describe block below is the first
// coverage in this file to mount it.
vi.mock('../../../services/branchService', () => ({
  listBranches: hoisted.listBranches,
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

// Roster v2 (Tier-4 #17) fixtures — one user per hierarchy role so search /
// role-chip filters / RoleChip / Branch·Unit resolution all have real
// distinct rows to exercise. UNIT_MANAGER carries an explicit unitName so
// getUnitDisplayName() resolves a literal label rather than the "<name>'s
// Unit" fallback, matching CreateUserDrawer's unit_manager form field.
const BRANCH_FIXTURE = { id: 'branch-1', name: 'Phoenix Branch', isActive: true };

const UNIT_MANAGER = {
  uid: 'um-1', id: 'um-1', role: 'unit_manager',
  name: 'Uma Manager', email: 'uma@example.com', active: true,
  branchId: 'branch-1', unitName: 'Phoenix Unit',
};
const BRANCH_MANAGER = {
  uid: 'bm-1', id: 'bm-1', role: 'branch_manager',
  name: 'Bree Manager', email: 'bree@example.com', active: true,
  branchId: 'branch-1',
};
const SALES_MANAGER = {
  uid: 'sm-1', id: 'sm-1', role: 'sales_manager',
  name: 'Sam Sales', email: 'sam@example.com', active: true,
};
const TENANT_ADMIN = {
  uid: 'ta-1', id: 'ta-1', role: 'tenant_admin',
  name: 'Tina Admin', email: 'tina@example.com', active: true,
};
// Agent assigned to UNIT_MANAGER's unit — the unitId is the unit manager's
// own uid (see buildUserDoc in scripts/staging/seed-staging.mjs and
// CreateUserDrawer's unit <select> options, both keyed by `um.uid`).
const AGENT_WITH_UNIT = {
  uid: 'agent-3', id: 'agent-3', role: 'agent',
  name: 'Andy Agent', email: 'andy@example.com', active: true,
  branchId: 'branch-1', unitId: 'um-1',
};
const FULL_ROSTER = [
  ACTIVE_AGENT, INACTIVE_AGENT, UNIT_MANAGER, BRANCH_MANAGER,
  SALES_MANAGER, TENANT_ADMIN, AGENT_WITH_UNIT,
];

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
    // Roster v2 (Tier-4 #17) — the main panel now loads branches directly
    // (Branch·Unit column resolution), not just CreateUserDrawer. Default to
    // an empty list; individual tests override when branch names matter.
    hoisted.listBranches.mockReset();
    hoisted.listBranches.mockResolvedValue([]);
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
    hoisted.listBranches.mockReset();
    hoisted.listBranches.mockResolvedValue([]);
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
    // Scoped to the table — roster v2's stat strip also renders standalone
    // "Active" / "Deactivated" tile labels (user-stat-active / -deactivated),
    // so an unscoped getByText would now match more than one element.
    const table = screen.getByRole('table', { name: 'User roster' });
    expect(within(table).getByText('Active')).toBeInTheDocument();
    expect(within(table).getByText('Deactivated')).toBeInTheDocument();
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

describe('UserManagementPanel — openCreateSignal (Tier 1 · 1.3 external create trigger)', () => {
  beforeEach(() => {
    hoisted.getAllUsers.mockReset();
    hoisted.getAllUsers.mockResolvedValue([ACTIVE_AGENT]);
    // CreateUserDrawer (role: tenant_admin, per the top-of-file AuthContext
    // mock) fetches unit managers + branches on mount — stub both so opening
    // the drawer in these tests doesn't hit an unconfigured mock / real
    // Firestore call.
    hoisted.getUnitManagers.mockReset();
    hoisted.getUnitManagers.mockResolvedValue([]);
    hoisted.listBranches.mockReset();
    hoisted.listBranches.mockResolvedValue([]);
  });

  it('does not auto-open the create drawer on initial render with the default signal', async () => {
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    expect(screen.queryByText('Add New User')).toBeNull();
  });

  it('does not auto-open when explicitly mounted with openCreateSignal={0}', async () => {
    render(<UserManagementPanel openCreateSignal={0} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    expect(screen.queryByText('Add New User')).toBeNull();
  });

  it('opens the create drawer immediately when MOUNTED FRESH with a nonzero signal (Quick-Add remount path)', async () => {
    // TenantAdminDashboard's UserManagementPanel is conditionally rendered
    // per tab, so it mounts fresh already carrying the Quick-Add signal —
    // this is the real-world path, distinct from a prop change on an
    // already-mounted instance (covered below).
    render(<UserManagementPanel openCreateSignal={1} />);
    await waitFor(() => expect(screen.getByText('Add New User')).toBeInTheDocument());
  });

  // Tier-3 3.1 — CREATABLE_ROLES gating: a tenant_admin (top-of-file useAuth
  // mock) can create a CRO, mirroring the CF CREATION_MATRIX.
  it('offers the CRO role in the create-user role picker for a tenant_admin', async () => {
    render(<UserManagementPanel openCreateSignal={1} />);
    await waitFor(() => expect(screen.getByText('Add New User')).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'CRO' })).toBeInTheDocument();
  });

  it('opens the create drawer when openCreateSignal CHANGES on an already-mounted instance', async () => {
    const { rerender } = render(<UserManagementPanel openCreateSignal={0} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    expect(screen.queryByText('Add New User')).toBeNull();

    rerender(<UserManagementPanel openCreateSignal={1} />);
    await waitFor(() => expect(screen.getByText('Add New User')).toBeInTheDocument());
  });

  it('does not re-open when the signal changes but stays at 0 (e.g. a no-op re-render)', async () => {
    const { rerender } = render(<UserManagementPanel openCreateSignal={0} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    rerender(<UserManagementPanel openCreateSignal={0} />);
    expect(screen.queryByText('Add New User')).toBeNull();
  });

  it('create drawer meets the dialog contract: role=dialog, aria-modal, labelled title, 44px close', async () => {
    render(<UserManagementPanel openCreateSignal={1} />);
    await waitFor(() => expect(screen.getByText('Add New User')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog', { name: 'Add New User' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const closeBtn = screen.getByRole('button', { name: 'Close create user drawer' });
    expect(closeBtn.className).toContain('w-11');
    expect(closeBtn.className).toContain('h-11');
  });

  it('create drawer closes on Escape', async () => {
    render(<UserManagementPanel openCreateSignal={1} />);
    await waitFor(() => expect(screen.getByText('Add New User')).toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Add New User')).toBeNull());
  });
});

describe('UserManagementPanel — roster v2 (Tier-4 #17: stat strip, search, role filters, RoleChip, Branch·Unit)', () => {
  beforeEach(() => {
    hoisted.getAllUsers.mockReset();
    hoisted.getAllUsers.mockResolvedValue(FULL_ROSTER);
    hoisted.listBranches.mockReset();
    hoisted.listBranches.mockResolvedValue([BRANCH_FIXTURE]);
  });

  async function renderRoster() {
    render(<UserManagementPanel />);
    await waitFor(() => expect(screen.getByText('Andy Agent')).toBeInTheDocument());
  }

  // ── Stat strip ───────────────────────────────────────────────────────────

  it('stat strip shows total / active / deactivated + one tile per role present', async () => {
    await renderRoster();
    expect(screen.getByTestId('user-stat-total')).toHaveTextContent('7');
    expect(screen.getByTestId('user-stat-active')).toHaveTextContent('6');
    expect(screen.getByTestId('user-stat-deactivated')).toHaveTextContent('1');
    expect(screen.getByTestId('user-stat-role-agent')).toHaveTextContent('3');
    expect(screen.getByTestId('user-stat-role-unit_manager')).toHaveTextContent('1');
    expect(screen.getByTestId('user-stat-role-branch_manager')).toHaveTextContent('1');
    expect(screen.getByTestId('user-stat-role-sales_manager')).toHaveTextContent('1');
    expect(screen.getByTestId('user-stat-role-tenant_admin')).toHaveTextContent('1');
    // No cro/platform_admin in the fixture roster — those tiles must not render.
    expect(screen.queryByTestId('user-stat-role-cro')).toBeNull();
    expect(screen.queryByTestId('user-stat-role-platform_admin')).toBeNull();
  });

  it('stat strip reflects the full roster even while search/filters narrow the table', async () => {
    await renderRoster();
    fireEvent.change(screen.getByTestId('user-search-input'), { target: { value: 'andy' } });
    await waitFor(() => expect(screen.queryByText('Tina Admin')).toBeNull());
    // Stat strip totals are unchanged — they summarize the full roster, not
    // the filtered table.
    expect(screen.getByTestId('user-stat-total')).toHaveTextContent('7');
    expect(screen.getByTestId('user-stat-role-agent')).toHaveTextContent('3');
  });

  // ── Search ───────────────────────────────────────────────────────────────

  it('search narrows the table by name (case-insensitive substring)', async () => {
    await renderRoster();
    fireEvent.change(screen.getByTestId('user-search-input'), { target: { value: 'ANDY' } });
    await waitFor(() => {
      expect(screen.getByText('Andy Agent')).toBeInTheDocument();
      expect(screen.queryByText('Active Agent')).toBeNull();
      expect(screen.queryByText('Tina Admin')).toBeNull();
    });
  });

  it('search narrows the table by email', async () => {
    await renderRoster();
    fireEvent.change(screen.getByTestId('user-search-input'), { target: { value: 'sam@example' } });
    await waitFor(() => {
      expect(screen.getByText('Sam Sales')).toBeInTheDocument();
      expect(screen.queryByText('Andy Agent')).toBeNull();
    });
  });

  it('search with no matches shows the empty state with a Clear filters affordance', async () => {
    await renderRoster();
    fireEvent.change(screen.getByTestId('user-search-input'), { target: { value: 'nobody-matches-this' } });
    await waitFor(() => expect(screen.getByTestId('user-roster-empty-filtered')).toBeInTheDocument());
    expect(screen.getByText(/No users match your search or filters/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('user-clear-filters-empty'));
    await waitFor(() => expect(screen.getByText('Andy Agent')).toBeInTheDocument());
    expect(screen.getByTestId('user-search-input')).toHaveValue('');
  });

  // ── Role filter chips ────────────────────────────────────────────────────

  it('role filter chip narrows the table to that role only', async () => {
    await renderRoster();
    fireEvent.click(screen.getByTestId('role-filter-unit_manager'));
    await waitFor(() => {
      expect(screen.getByText('Uma Manager')).toBeInTheDocument();
      expect(screen.queryByText('Andy Agent')).toBeNull();
      expect(screen.queryByText('Tina Admin')).toBeNull();
    });
    expect(screen.getByTestId('role-filter-unit_manager')).toHaveAttribute('aria-pressed', 'true');
  });

  it('multiple role filter chips compose with OR (any selected role shows)', async () => {
    await renderRoster();
    fireEvent.click(screen.getByTestId('role-filter-sales_manager'));
    fireEvent.click(screen.getByTestId('role-filter-tenant_admin'));
    await waitFor(() => {
      expect(screen.getByText('Sam Sales')).toBeInTheDocument();
      expect(screen.getByText('Tina Admin')).toBeInTheDocument();
      expect(screen.queryByText('Andy Agent')).toBeNull();
      expect(screen.queryByText('Uma Manager')).toBeNull();
    });
  });

  it('role filter chip toggles off on second click', async () => {
    await renderRoster();
    const chip = screen.getByTestId('role-filter-agent');
    fireEvent.click(chip);
    await waitFor(() => expect(screen.queryByText('Tina Admin')).toBeNull());
    fireEvent.click(chip);
    await waitFor(() => expect(screen.getByText('Tina Admin')).toBeInTheDocument());
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  // ── Search + role filter compose (AND) ───────────────────────────────────

  it('search and role filter compose with AND semantics', async () => {
    await renderRoster();
    fireEvent.click(screen.getByTestId('role-filter-agent'));
    fireEvent.change(screen.getByTestId('user-search-input'), { target: { value: 'andy' } });
    await waitFor(() => {
      // Matches role=agent AND name contains "andy" → only Andy Agent.
      expect(screen.getByText('Andy Agent')).toBeInTheDocument();
      expect(screen.queryByText('Active Agent')).toBeNull(); // agent role, but name doesn't match search
      expect(screen.queryByText('Tina Admin')).toBeNull();    // matches neither
    });

    // Clear filters affordance appears once any filter is active, and resets both.
    fireEvent.click(screen.getByTestId('user-clear-filters'));
    await waitFor(() => expect(screen.getByText('Tina Admin')).toBeInTheDocument());
    expect(screen.getByTestId('user-search-input')).toHaveValue('');
    expect(screen.getByTestId('role-filter-agent')).toHaveAttribute('aria-pressed', 'false');
  });

  // ── RoleChip ─────────────────────────────────────────────────────────────

  it('RoleChip renders the correct label for each role in the table', async () => {
    await renderRoster();
    const table = screen.getByRole('table', { name: 'User roster' });
    expect(within(table).getAllByTestId('role-chip-agent')).toHaveLength(3);
    expect(within(table).getByTestId('role-chip-unit_manager')).toHaveTextContent('Unit Manager');
    expect(within(table).getByTestId('role-chip-branch_manager')).toHaveTextContent('Branch Manager');
    expect(within(table).getByTestId('role-chip-sales_manager')).toHaveTextContent('Sales Manager');
    expect(within(table).getByTestId('role-chip-tenant_admin')).toHaveTextContent('Tenant Admin');
  });

  // ── Branch · Unit column ─────────────────────────────────────────────────

  it('Branch·Unit column resolves branch + unit display names for an agent', async () => {
    await renderRoster();
    // AGENT_WITH_UNIT.branchId → BRANCH_FIXTURE.name; unitId → UNIT_MANAGER's
    // own uid → getUnitDisplayName(UNIT_MANAGER) → its explicit unitName.
    expect(screen.getByTestId('user-branch-unit-agent-3')).toHaveTextContent('Phoenix Branch · Phoenix Unit');
  });

  it('Branch·Unit column resolves a unit_manager\'s own unit (not via unitId)', async () => {
    await renderRoster();
    expect(screen.getByTestId('user-branch-unit-um-1')).toHaveTextContent('Phoenix Branch · Phoenix Unit');
  });

  it('Branch·Unit column shows branch only when no unit applies', async () => {
    await renderRoster();
    expect(screen.getByTestId('user-branch-unit-bm-1')).toHaveTextContent('Phoenix Branch');
  });

  it('Branch·Unit column shows an em dash when neither branch nor unit resolve', async () => {
    await renderRoster();
    expect(screen.getByTestId('user-branch-unit-sm-1')).toHaveTextContent('—');
  });
});
