// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  listBranches:        vi.fn(),
  getBranch:           vi.fn(),
  setBranchActive:     vi.fn(),
  getBranchManagers:   vi.fn(),
  getAllUsers:          vi.fn(),
  toastShow:           vi.fn(),
}));

vi.mock('../../../services/branchService', () => ({
  listBranches:    hoisted.listBranches,
  getBranch:       hoisted.getBranch,
  setBranchActive: hoisted.setBranchActive,
}));

vi.mock('../../../services/agentManagementService', () => ({
  getBranchManagers: hoisted.getBranchManagers,
  getAllUsers:        hoisted.getAllUsers,
}));

vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.toastShow, dismiss: vi.fn() }),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ tenantId: 'tenant1', user: { uid: 'admin1' } }),
}));

// Stub heavy child modals — not under test here.
vi.mock('../BranchEditorModal', () => ({
  default: ({ mode, onClose, onSaved }) => (
    <div data-testid="branch-editor-modal" data-mode={mode}>
      <button onClick={onClose}>Close editor</button>
      <button onClick={onSaved}>Save</button>
    </div>
  ),
}));

vi.mock('../DeactivateBranchConfirmDialog', () => ({
  default: ({ branch, onConfirm, onCancel }) => (
    <div data-testid="deactivate-dialog" data-branch-id={branch?.id}>
      <button onClick={() => onConfirm(false)}>Confirm deactivate</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

import BranchesPanel from '../BranchesPanel';

const BRANCH_ACTIVE = {
  id: 'b1', name: 'South Branch', isActive: true,
  managerId: 'mgr1', createdAt: { toMillis: () => 1000 },
};
const BRANCH_INACTIVE = {
  id: 'b2', name: 'North Branch', isActive: false,
  managerId: null, createdAt: { toMillis: () => 500 },
};
const MANAGERS = [{ uid: 'mgr1', name: 'Carla Perez', email: 'carla@t.com' }];
const USERS = [
  { uid: 'a1', role: 'agent', branchId: 'b1', active: true },
  { uid: 'a2', role: 'agent', branchId: 'b1', active: true },
  { uid: 'a3', role: 'agent', branchId: 'b2', active: true },
];

function setup(overrides = {}) {
  hoisted.listBranches.mockResolvedValue(overrides.branches ?? [BRANCH_ACTIVE]);
  hoisted.getBranchManagers.mockResolvedValue(overrides.managers ?? MANAGERS);
  hoisted.getAllUsers.mockResolvedValue(overrides.users ?? USERS);
}

describe('BranchesPanel — loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.listBranches.mockReturnValue(new Promise(() => {})); // never resolves
    hoisted.getBranchManagers.mockResolvedValue(MANAGERS);
    hoisted.getAllUsers.mockResolvedValue(USERS);
  });

  it('renders skeleton pulses while loading', () => {
    const { container } = render(<BranchesPanel />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the Branches heading during load', () => {
    render(<BranchesPanel />);
    expect(screen.getByText('Branches')).toBeInTheDocument();
  });
});

describe('BranchesPanel — error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.listBranches.mockRejectedValue(new Error('Firestore unavailable'));
    hoisted.getBranchManagers.mockResolvedValue(MANAGERS);
    hoisted.getAllUsers.mockResolvedValue(USERS);
  });

  it('renders an alert when branches fetch fails', async () => {
    render(<BranchesPanel />);
    await screen.findByRole('alert');
    expect(screen.getByText(/Firestore unavailable/i)).toBeInTheDocument();
  });

  it('disables the Add branch button on error', async () => {
    render(<BranchesPanel />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /add branch/i })).toBeDisabled();
  });
});

describe('BranchesPanel — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup({ branches: [] });
  });

  it('renders empty state hint with Building2 icon placeholder', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText(/No branches yet/i)).toBeInTheDocument());
  });

  it('renders Add branch button when empty', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText(/No branches yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add branch/i })).toBeInTheDocument();
  });
});

describe('BranchesPanel — branches list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup({ branches: [BRANCH_ACTIVE, BRANCH_INACTIVE] });
  });

  it('renders both branch names', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('South Branch')).toBeInTheDocument());
    expect(screen.getByText('North Branch')).toBeInTheDocument();
  });

  it('renders the assigned manager name for active branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('Carla Perez')).toBeInTheDocument());
  });

  it('renders "Unassigned" for branch with no managerId', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('Unassigned')).toBeInTheDocument());
  });

  it('renders correct total user counts per branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByTestId('branch-user-count-b1')).toHaveTextContent('2 users'));
    expect(screen.getByTestId('branch-user-count-b2')).toHaveTextContent('1 user');
  });

  it('renders Active status badge for active branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });

  it('renders Inactive status badge for inactive branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('Inactive')).toBeInTheDocument());
  });

  it('renders Deactivate action for active branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument());
  });

  it('renders Reactivate action for inactive branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument());
  });
});

describe('BranchesPanel — sort order', () => {
  beforeEach(() => vi.clearAllMocks());

  it('places active branches before inactive ones', async () => {
    setup({ branches: [BRANCH_INACTIVE, BRANCH_ACTIVE] });
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('South Branch')).toBeInTheDocument());
    const names = screen.getAllByText(/Branch/).map(el => el.textContent);
    const southIdx = names.indexOf('South Branch');
    const northIdx = names.indexOf('North Branch');
    expect(southIdx).toBeLessThan(northIdx);
  });
});

describe('BranchesPanel — table column headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup({ branches: [BRANCH_ACTIVE] });
  });

  it('renders Name, Manager, Users, Status, Actions column headers', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('South Branch')).toBeInTheDocument());
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});

describe('BranchesPanel — zero user count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup({ branches: [BRANCH_ACTIVE], users: [] });
  });

  it('renders 0 users when no users are assigned to branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('South Branch')).toBeInTheDocument());
    expect(screen.getByTestId('branch-user-count-b1')).toHaveTextContent('0 users');
  });
});

describe('BranchesPanel — total user count (all roles)', () => {
  // b1 carries a mix of roles; one deactivated agent must be excluded.
  const MIXED_USERS = [
    { uid: 'a1',  role: 'agent',          branchId: 'b1', active: true },
    { uid: 'a2',  role: 'agent',          branchId: 'b1', active: true },
    { uid: 'um1', role: 'unit_manager',   branchId: 'b1', active: true },
    { uid: 'bm1', role: 'branch_manager', branchId: 'b1', active: true },
    { uid: 'sm1', role: 'sales_manager',  branchId: 'b1', active: true },
    { uid: 'd1',  role: 'agent',          branchId: 'b1', active: false }, // deactivated → excluded
    { uid: 'o1',  role: 'agent',          branchId: 'b2', active: true },  // other branch
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    setup({ branches: [BRANCH_ACTIVE], users: MIXED_USERS });
  });

  it('counts ALL roles, not just agents (total > agent-only)', async () => {
    render(<BranchesPanel />);
    // 2 agents + 1 UM + 1 BM + 1 SM = 5 active (deactivated agent excluded)
    await waitFor(() => expect(screen.getByTestId('branch-user-count-b1')).toHaveTextContent('5 users'));
  });

  it('renders the per-role breakdown in tier order', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByTestId('branch-user-count-b1')).toBeInTheDocument());
    expect(screen.getByText('2 agents, 1 UM, 1 BM, 1 SM')).toBeInTheDocument();
  });

  it('excludes deactivated users from the total (active-only)', async () => {
    render(<BranchesPanel />);
    // 6 docs target b1 but one is inactive → total is 5, not 6.
    await waitFor(() => expect(screen.getByTestId('branch-user-count-b1')).toHaveTextContent('5 users'));
    expect(screen.getByTestId('branch-user-count-b1')).not.toHaveTextContent('6 users');
  });

  it('does not count users from other branches', async () => {
    render(<BranchesPanel />);
    // b2's agent (o1) must not inflate b1's count.
    await waitFor(() => expect(screen.getByTestId('branch-user-count-b1')).toHaveTextContent('5 users'));
  });
});
