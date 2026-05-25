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
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/Firestore unavailable/i)).toBeInTheDocument();
  });

  it('disables the Add branch button on error', async () => {
    render(<BranchesPanel />);
    await waitFor(() => screen.getByRole('alert'));
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
    await waitFor(() => screen.getByText(/No branches yet/i));
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

  it('renders correct agent counts per branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => expect(screen.getByText('2 agents')).toBeInTheDocument());
    expect(screen.getByText('1 agents')).toBeInTheDocument();
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
    await waitFor(() => screen.getByText('South Branch'));
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

  it('renders Name, Manager, Agents, Status, Actions column headers', async () => {
    render(<BranchesPanel />);
    await waitFor(() => screen.getByText('South Branch'));
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});

describe('BranchesPanel — zero agent count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup({ branches: [BRANCH_ACTIVE], users: [] });
  });

  it('renders 0 agents when no users are assigned to branch', async () => {
    render(<BranchesPanel />);
    await waitFor(() => screen.getByText('South Branch'));
    expect(screen.getByText('0 agents')).toBeInTheDocument();
  });
});
