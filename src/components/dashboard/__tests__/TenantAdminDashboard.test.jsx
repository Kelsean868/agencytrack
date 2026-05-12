// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocks must be declared before the component import so vi.mock hoists correctly.

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { name: 'Test Admin', email: 'admin@example.com' },
    role: 'tenant_admin',
    tenantId: 'tenant-test',
  }),
}));

vi.mock('../../../services/authService', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/managerService', () => ({
  getTenantUsers: vi.fn().mockResolvedValue([
    { uid: 'u1', role: 'agent',          branchId: 'branch_a', active: true },
    { uid: 'u2', role: 'agent',          branchId: 'branch_a', active: true },
    { uid: 'u3', role: 'unit_manager',   branchId: 'branch_b', active: true },
    { uid: 'u4', role: 'branch_manager', branchId: 'branch_b', active: false },
    { uid: 'u5', role: 'tenant_admin',   branchId: 'branch_a', active: true },
  ]),
  getAllYTDSubmissions: vi.fn().mockResolvedValue([
    { id: 's1' },
    { id: 's2' },
  ]),
}));

vi.mock('../../../utils/extractFields', () => ({
  extractFields: (s) => (s.id === 's1' ? { apiSold: 100 } : { apiSold: 50 }),
}));

vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (v) => `$${v}`,
  getRoleLabel: () => 'Tenant Admin',
}));

// Shell mock — exposes the navItems prop list so tests can assert against
// what TenantAdminDashboard chose to render. Also renders children so tab
// content is exercised.
vi.mock('../../shell/Shell', () => ({
  default: ({ navItems, bottomNavItems, activeTab, setActiveTab, topbarTitle, children }) => (
    <div data-testid="shell">
      <div data-testid="topbar-title">{topbarTitle}</div>
      <nav data-testid="ta-sidebar">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`sidebar-${item.id}`}
            data-section={item.sectionLabel ?? ''}
            data-disabled={item.disabled ? 'true' : 'false'}
            onClick={() => item.tabId && setActiveTab(item.tabId)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <nav data-testid="ta-bottom-nav">
        {bottomNavItems.map((item) => (
          <span key={item.id} data-testid={`bottom-${item.id}`}>{item.label}</span>
        ))}
      </nav>
      <div data-testid="active-tab">{activeTab}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock('../../admin/CompanyConfigPanel', () => ({
  default: () => <div data-testid="company-config-panel">Company Config Panel</div>,
}));
vi.mock('../../admin/RoleDistributionCard', () => ({
  default: () => <div data-testid="role-distribution-card">Role Distribution</div>,
}));
vi.mock('../../admin/BranchHealthCards', () => ({
  default: () => <div data-testid="branch-health-cards">Branch Health</div>,
}));
vi.mock('../../admin/BranchesPanel', () => ({
  default: () => <div data-testid="branches-panel">Branches Panel</div>,
}));
vi.mock('../../manager/UserManagementPanel', () => ({
  default: () => <div data-testid="user-management-panel">User Management Panel</div>,
}));
vi.mock('../../campaigns/CampaignPanel', () => ({
  default: () => <div data-testid="campaign-panel">Campaign Panel</div>,
}));
vi.mock('../../profile/ProfileScreen', () => ({
  default: () => <div data-testid="profile-screen">Profile Screen</div>,
}));

import TenantAdminDashboard from '../TenantAdminDashboard';

describe('TenantAdminDashboard — no placeholder text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('contains no "Coming soon" text anywhere in the rendered output', async () => {
    const { container } = render(<TenantAdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId('topbar-title')).toBeInTheDocument();
    });
    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it('does not render a "System Health" stat tile', async () => {
    render(<TenantAdminDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Total API · YTD/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/System Health/i)).toBeNull();
    expect(screen.queryByText(/Uptime monitoring/i)).toBeNull();
  });
});

describe('TenantAdminDashboard — NAV_ITEMS shape', () => {
  it('renders exactly the 6 expected sidebar nav items', () => {
    render(<TenantAdminDashboard />);
    const expected = ['dashboard', 'branches', 'users', 'config', 'campaigns', 'profile'];
    for (const id of expected) {
      expect(screen.getByTestId(`sidebar-${id}`)).toBeInTheDocument();
    }
  });

  it('does not render Roles & Permissions / Audit Log / Billing / Settings sidebar items', () => {
    render(<TenantAdminDashboard />);
    for (const id of ['roles', 'audit', 'billing', 'settings']) {
      expect(screen.queryByTestId(`sidebar-${id}`)).toBeNull();
    }
  });

  it('renders three section headers: Company, Configuration, Account', () => {
    render(<TenantAdminDashboard />);
    expect(screen.getByTestId('sidebar-dashboard').dataset.section).toBe('Company');
    expect(screen.getByTestId('sidebar-config').dataset.section).toBe('Configuration');
    expect(screen.getByTestId('sidebar-profile').dataset.section).toBe('Account');
  });

  it('renders no sidebar items in a "System" section', () => {
    render(<TenantAdminDashboard />);
    const items = screen.getAllByTestId(/^sidebar-/);
    for (const el of items) {
      expect(el.dataset.section).not.toBe('System');
    }
  });

  it('has no disabled sidebar items', () => {
    render(<TenantAdminDashboard />);
    const items = screen.getAllByTestId(/^sidebar-/);
    for (const el of items) {
      expect(el.dataset.disabled).toBe('false');
    }
  });
});

describe('TenantAdminDashboard — Dashboard stats grid', () => {
  it('renders exactly 3 stat tiles (System Health removed)', async () => {
    render(<TenantAdminDashboard />);
    await waitFor(() => expect(screen.getByText('Total API · YTD')).toBeInTheDocument());
    // Use exact-case labels so /Active Branches/i doesn't double-match
    // against the sub-copy "Active branches".
    expect(screen.getByText('Total API · YTD')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Active Branches')).toBeInTheDocument();
    expect(screen.queryByText(/System Health/i)).toBeNull();
  });

  it('uses plural "Active branches" when branch count > 1', async () => {
    render(<TenantAdminDashboard />);
    // Mock data has branchIds: branch_a, branch_b → 2 branches → plural copy
    await waitFor(() => expect(screen.getByText(/Active branches/)).toBeInTheDocument());
    expect(screen.getByText(/Active branches/)).toBeInTheDocument();
    expect(screen.queryByText(/^Active branch$/)).toBeNull();
  });
});

describe('TenantAdminDashboard — Active Branches singular copy', () => {
  it('uses singular "Active branch" when branch count is exactly 1', async () => {
    // Re-mock getTenantUsers to a single-branch dataset for this test.
    const managerService = await import('../../../services/managerService');
    managerService.getTenantUsers.mockResolvedValueOnce([
      { uid: 'u1', role: 'agent', branchId: 'only_branch', active: true },
      { uid: 'u2', role: 'agent', branchId: 'only_branch', active: true },
    ]);
    render(<TenantAdminDashboard />);
    await waitFor(() => expect(screen.getByText(/^Active branch$/)).toBeInTheDocument());
  });
});

describe('TenantAdminDashboard — tab routing', () => {
  it('Dashboard tab renders RoleDistributionCard and BranchHealthCards', async () => {
    render(<TenantAdminDashboard />);
    await waitFor(() => expect(screen.getByTestId('role-distribution-card')).toBeInTheDocument());
    expect(screen.getByTestId('branch-health-cards')).toBeInTheDocument();
  });

  it('clicking Branches sidebar routes to BranchesPanel', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('sidebar-branches'));
    await waitFor(() => expect(screen.getByTestId('branches-panel')).toBeInTheDocument());
  });

  it('clicking All Users sidebar routes to UserManagementPanel', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('sidebar-users'));
    await waitFor(() => expect(screen.getByTestId('user-management-panel')).toBeInTheDocument());
  });

  it('clicking Company Config sidebar routes to CompanyConfigPanel', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('sidebar-config'));
    await waitFor(() => expect(screen.getByTestId('company-config-panel')).toBeInTheDocument());
  });

  it('clicking Campaigns sidebar routes to CampaignPanel', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('sidebar-campaigns'));
    await waitFor(() => expect(screen.getByTestId('campaign-panel')).toBeInTheDocument());
  });

  it('clicking Profile sidebar routes to ProfileScreen', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('sidebar-profile'));
    await waitFor(() => expect(screen.getByTestId('profile-screen')).toBeInTheDocument());
  });
});
