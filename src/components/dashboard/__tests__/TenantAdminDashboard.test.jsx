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

vi.mock('../../../services/branchService', () => ({
  listBranches: vi.fn().mockResolvedValue([]),
}));

// S5: exception-lead panel needs company minimums (tenure API floors) via
// deriveExceptions. Not previously loaded on this surface.
vi.mock('../../../services/goalsService', () => ({
  getCompanyMinimums: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../utils/extractFields', () => ({
  extractFields: (s) => (s.id === 's1' ? { apiSold: 100 } : { apiSold: 50 }),
  // deriveExceptions (via managerExceptions.js) calls this for every
  // submission bucketed to a real agentId. Existing tests' mock submissions
  // carry no agentId so this never fires for them; the S5 exception tests
  // below supply `totalProductionCredit` directly on their mock subs.
  extractTotalProductionCredit: (s) => Number(s?.totalProductionCredit) || 0,
}));

vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (v) => `$${v}`,
  getRoleLabel: () => 'Tenant Admin',
  // deriveExceptions (via managerExceptions.js) calls this unconditionally
  // per in-scope agent while building each candidate row.
  initials: (name) => String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '—',
}));

// Shell mock — exposes the navItems prop list so tests can assert against
// what TenantAdminDashboard chose to render. Also renders children so tab
// content is exercised.
vi.mock('../../shell/Shell', () => ({
  default: ({ navItems, bottomNavItems, drawerNavItems, activeTab, setActiveTab, topbarTitle, children }) => (
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
      <nav data-testid="ta-drawer-nav">
        {(drawerNavItems ?? []).map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`drawer-${item.id}`}
            onClick={() => item.tabId && setActiveTab(item.tabId)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div data-testid="active-tab">{activeTab}</div>
      <main>{children}</main>
    </div>
  ),
}));

// Company Config tab now renders the unified Company Config surface (Run 5),
// which replaced the three stacked admin panels.
vi.mock('../../admin/companyConfig/CompanyConfigSurface', () => ({
  default: () => <div data-testid="company-config-surface">Company Config Surface</div>,
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
vi.mock('../../planner/manager/TeamPlannerPanel', () => ({
  default: (props) => (
    <div data-testid="team-planner-panel" data-caller-role={props.callerRole}>
      Team Planner Panel
    </div>
  ),
}));
vi.mock('../../profile/ProfileScreen', () => ({
  default: () => <div data-testid="profile-screen">Profile Screen</div>,
}));

import TenantAdminDashboard from '../TenantAdminDashboard';
import { getAllYTDSubmissions } from '../../../services/managerService';

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

describe('TenantAdminDashboard — 0.1b stat tile loading skeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a skeleton (aria-busy) in the YTD stat tile instead of "—" while the fetch is pending', async () => {
    getAllYTDSubmissions.mockReturnValue(new Promise(() => {}));
    const { container } = render(<TenantAdminDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Total API · YTD/i)).toBeInTheDocument();
    });
    expect(container.querySelector('[aria-busy="true"], [role="status"]')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });
});

describe('TenantAdminDashboard — NAV_ITEMS shape', () => {
  it('renders exactly the 7 expected sidebar nav items (incl. D3 Team Planner)', () => {
    render(<TenantAdminDashboard />);
    const expected = ['dashboard', 'branches', 'users', 'planner', 'config', 'campaigns', 'profile'];
    for (const id of expected) {
      expect(screen.getByTestId(`sidebar-${id}`)).toBeInTheDocument();
    }
    // No extra sidebar items beyond the expected set.
    expect(screen.getAllByTestId(/^sidebar-/)).toHaveLength(expected.length);
  });

  it('D3: Team Planner is in the Company section (inherits, no own header)', () => {
    render(<TenantAdminDashboard />);
    expect(screen.getByTestId('sidebar-planner').dataset.section).toBe('');
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

  it('clicking Company Config sidebar routes to the Company Config surface', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('sidebar-config'));
    await waitFor(() => expect(screen.getByTestId('company-config-surface')).toBeInTheDocument());
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

  it('D3: clicking Team Planner sidebar mounts TeamPlannerPanel with callerRole=tenant_admin', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('sidebar-planner'));
    await waitFor(() => expect(screen.getByTestId('team-planner-panel')).toBeInTheDocument());
    expect(screen.getByTestId('team-planner-panel').dataset.callerRole).toBe('tenant_admin');
  });
});

describe('TenantAdminDashboard — mobile nav v2 reorder', () => {
  it('Profile is NOT in the mobile bottom nav', () => {
    render(<TenantAdminDashboard />);
    expect(screen.queryByTestId('bottom-profile')).toBeNull();
  });

  it('the bottom nav is exactly [Dashboard, Config, Users, Campaigns]', () => {
    render(<TenantAdminDashboard />);
    for (const id of ['dashboard', 'config', 'users', 'campaigns']) {
      expect(screen.getByTestId(`bottom-${id}`)).toBeInTheDocument();
    }
    // Four tabs + the auto-appended "More" = a 5-slot nav.
    expect(screen.getAllByTestId(/^bottom-/)).toHaveLength(4);
  });

  it('the "More" drawer is wired and contains Profile (not stranded)', () => {
    render(<TenantAdminDashboard />);
    const profile = screen.getByTestId('drawer-profile');
    expect(profile).toBeInTheDocument();
    expect(profile).toHaveTextContent('Profile');
  });

  it('the "More" drawer also surfaces Branches (closes the TA-MOBILE gap)', () => {
    render(<TenantAdminDashboard />);
    expect(screen.getByTestId('drawer-branches')).toBeInTheDocument();
  });

  it('D3: the "More" drawer surfaces Team Planner (sidebar-only, mirrors Branches)', () => {
    render(<TenantAdminDashboard />);
    expect(screen.getByTestId('drawer-planner')).toBeInTheDocument();
    // BOTTOM_NAV stays the locked 4-tab set — Team Planner is NOT in it.
    expect(screen.queryByTestId('bottom-planner')).toBeNull();
  });

  it('clicking the drawer Profile row routes to ProfileScreen', async () => {
    render(<TenantAdminDashboard />);
    fireEvent.click(screen.getByTestId('drawer-profile'));
    await waitFor(() => expect(screen.getByTestId('profile-screen')).toBeInTheDocument());
  });
});

describe('TenantAdminDashboard — §1 states contract (error / partial / retry)', () => {
  // clearAllMocks() only resets call history, not implementations set via
  // mockRejectedValue/mockResolvedValue — re-establish a known-good baseline
  // before every test so one test's permanent-reject override can't leak
  // into the next.
  //
  // S5 note: this surface now has 4 data sources (users, branches, YTD subs,
  // company minimums) — the failure-count contract tests below were updated
  // from "3" to "4" accordingly (TOTAL_DATA_SOURCES in the component).
  beforeEach(async () => {
    vi.clearAllMocks();
    const managerService = await import('../../../services/managerService');
    const branchService = await import('../../../services/branchService');
    const goalsService = await import('../../../services/goalsService');
    managerService.getTenantUsers.mockResolvedValue([
      { uid: 'u1', role: 'agent', branchId: 'branch_a', active: true },
    ]);
    managerService.getAllYTDSubmissions.mockResolvedValue([]);
    branchService.listBranches.mockResolvedValue([]);
    goalsService.getCompanyMinimums.mockResolvedValue(null);
  });

  it('all 4 fetches failing renders a blocking error card with Retry (never a silent console.error swallow)', async () => {
    const managerService = await import('../../../services/managerService');
    const branchService = await import('../../../services/branchService');
    const goalsService = await import('../../../services/goalsService');
    managerService.getTenantUsers.mockRejectedValue(new Error('boom-users'));
    managerService.getAllYTDSubmissions.mockRejectedValue(new Error('boom-ytd'));
    branchService.listBranches.mockRejectedValue(new Error('boom-branches'));
    goalsService.getCompanyMinimums.mockRejectedValue(new Error('boom-mins'));

    render(<TenantAdminDashboard />);

    await waitFor(() => expect(screen.getByTestId('tenant-dashboard-error')).toBeInTheDocument());
    expect(screen.getByTestId('tenant-dashboard-error')).toHaveAttribute('role', 'alert');
    // Stat tiles are not shown alongside a full-failure error card.
    expect(screen.queryByText('Total API · YTD')).toBeNull();
  });

  it('Retry on full failure re-invokes all four failed loaders', async () => {
    const managerService = await import('../../../services/managerService');
    const branchService = await import('../../../services/branchService');
    const goalsService = await import('../../../services/goalsService');
    managerService.getTenantUsers.mockRejectedValueOnce(new Error('boom-users'))
      .mockResolvedValueOnce([{ uid: 'u1', role: 'agent', branchId: 'b1', active: true }]);
    managerService.getAllYTDSubmissions.mockRejectedValueOnce(new Error('boom-ytd'))
      .mockResolvedValueOnce([]);
    branchService.listBranches.mockRejectedValueOnce(new Error('boom-branches'))
      .mockResolvedValueOnce([]);
    goalsService.getCompanyMinimums.mockRejectedValueOnce(new Error('boom-mins'))
      .mockResolvedValueOnce(null);

    render(<TenantAdminDashboard />);
    await waitFor(() => expect(screen.getByTestId('tenant-dashboard-error')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('Total API · YTD')).toBeInTheDocument());
    expect(managerService.getTenantUsers).toHaveBeenCalledTimes(2);
    expect(managerService.getAllYTDSubmissions).toHaveBeenCalledTimes(2);
    expect(branchService.listBranches).toHaveBeenCalledTimes(2);
    expect(goalsService.getCompanyMinimums).toHaveBeenCalledTimes(2);
  });

  it('one of four fetches failing renders a partial-failure warning banner naming the count', async () => {
    const managerService = await import('../../../services/managerService');
    managerService.getAllYTDSubmissions.mockRejectedValue(new Error('boom-ytd'));

    render(<TenantAdminDashboard />);

    await waitFor(() => expect(screen.getByTestId('tenant-dashboard-partial')).toBeInTheDocument());
    expect(screen.getByTestId('tenant-dashboard-partial')).toHaveTextContent('1 of 4 data sources failed to load');
    // Available data still renders alongside the banner.
    expect(screen.getByText('Total API · YTD')).toBeInTheDocument();
  });
});

describe('TenantAdminDashboard — S5 exception-lead panel (tenant-wide, operator-ruled)', () => {
  // Baseline: one flagged agent (no reports at all this year) + one agent
  // with a filed, unremarkable report — both tenant-wide (no branch/unit
  // scoping in the tenant_admin surface). Uses a real contractStartDate so
  // resolveAnnualAPIFloor + deriveExceptions run their real (unmocked) math.
  beforeEach(async () => {
    vi.clearAllMocks();
    const branchService = await import('../../../services/branchService');
    const goalsService = await import('../../../services/goalsService');
    branchService.listBranches.mockResolvedValue([]);
    goalsService.getCompanyMinimums.mockResolvedValue(null);
  });

  it('renders the exception panel heading and a flagged agent row from real derived data', async () => {
    const managerService = await import('../../../services/managerService');
    managerService.getTenantUsers.mockResolvedValue([
      {
        id: 'agent-flagged', uid: 'agent-flagged', role: 'agent', name: 'Alex Behind',
        branchId: 'branch_a', unitId: 'unit_a', active: true, contractStartDate: '2020-01-01',
      },
      {
        id: 'agent-filed', uid: 'agent-filed', role: 'agent', name: 'Sam Filer',
        branchId: 'branch_a', unitId: 'unit_a', active: true, contractStartDate: '2020-01-01',
      },
    ]);
    // Only agent-filed has a submission this year — agent-flagged has none,
    // which deriveExceptions surfaces as a "No reports" exception once a
    // latestWeek exists for the tenant (agent-filed's week). agent-filed's
    // credit is set far above any possible pace target (frac-independent)
    // so it never itself trips the floor/pace exception arms. Year computed
    // from the real clock (deriveExceptions filters subs by the current
    // year) rather than hardcoded, so the test doesn't rot at year rollover.
    const thisYear = new Date().getFullYear();
    managerService.getAllYTDSubmissions.mockResolvedValue([
      { agentId: 'agent-filed', weekStarting: `${thisYear}-01-04`, totalProductionCredit: 10000000 },
    ]);

    render(<TenantAdminDashboard />);

    await waitFor(() => expect(screen.getByTestId('exception-lead-panel')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('exception-lead-list')).toBeInTheDocument());
    expect(screen.getByText('Alex Behind')).toBeInTheDocument();
    expect(screen.getByTestId('exception-row-agent-flagged')).toBeInTheDocument();
    // The on-pace filer is not itself an exception row.
    expect(screen.queryByTestId('exception-row-agent-filed')).toBeNull();
  });

  it('renders the honest "All clear" empty state when no agent has an exception', async () => {
    const managerService = await import('../../../services/managerService');
    managerService.getTenantUsers.mockResolvedValue([]);
    managerService.getAllYTDSubmissions.mockResolvedValue([]);

    render(<TenantAdminDashboard />);

    await waitFor(() => expect(screen.getByTestId('exception-lead-empty')).toBeInTheDocument());
    expect(screen.getByText('All clear')).toBeInTheDocument();
  });

  it('renders the exception panel error state when the backing user fetch fails', async () => {
    const managerService = await import('../../../services/managerService');
    managerService.getTenantUsers.mockRejectedValue(new Error('boom-users'));
    managerService.getAllYTDSubmissions.mockResolvedValue([]);

    render(<TenantAdminDashboard />);

    // usersError alone keeps failedCount (1) below TOTAL_DATA_SOURCES (4), so
    // the dashboard content (and the panel within it) still renders — this
    // exercises the panel's own error state, not the page-level error card.
    await waitFor(() => expect(screen.getByTestId('exception-lead-error')).toBeInTheDocument());
  });
});
