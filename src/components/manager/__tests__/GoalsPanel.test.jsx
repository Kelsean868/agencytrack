import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock state ───────────────────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  getTenantUsers:    vi.fn(),
  getGoals:          vi.fn(),
  setGoals:          vi.fn(),
  getCompanyMinimums: vi.fn(),
  getUnitGoals:      vi.fn(),
  setUnitGoals:      vi.fn(),
  getBranchGoals:    vi.fn(),
  setBranchGoals:    vi.fn(),
  getGoalHierarchy:  vi.fn(),
  authRef:           { current: { user: { uid: 'mgr-1' }, userProfile: { unitId: 'unit-1', name: 'Mgr Name' }, role: 'branch_manager', tenantId: 'tenant-1' } },
}));

vi.mock('../../../services/managerService', () => ({
  getTenantUsers: (...args) => hoisted.getTenantUsers(...args),
}));

vi.mock('../../../services/goalsService', () => ({
  getGoals:           (...args) => hoisted.getGoals(...args),
  setGoals:           (...args) => hoisted.setGoals(...args),
  getCompanyMinimums: (...args) => hoisted.getCompanyMinimums(...args),
  getUnitGoals:       (...args) => hoisted.getUnitGoals(...args),
  setUnitGoals:       (...args) => hoisted.setUnitGoals(...args),
  getBranchGoals:     (...args) => hoisted.getBranchGoals(...args),
  setBranchGoals:     (...args) => hoisted.setBranchGoals(...args),
  getGoalHierarchy:   (...args) => hoisted.getGoalHierarchy(...args),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => hoisted.authRef.current,
}));

// Stub heavy children so the tests stay focused on GoalsPanel's IA + flow.
vi.mock('../../goals/CommissionPlayground', () => ({
  default: () => <div data-testid="commission-playground" />,
}));
vi.mock('../../goals/GapAnalysisPanel', () => ({
  default: ({ title, hierarchy }) => (
    <div data-testid="gap-analysis-panel" data-title={title} data-has-hierarchy={hierarchy ? 'yes' : 'no'}>
      Gap Analysis Panel
    </div>
  ),
}));

// Pure helpers — let real implementations through.
import GoalsPanel from '../GoalsPanel';

const MINIMUMS = { annualAPI: 200000, annualApps: 42, persistency: 90 };

const AGENTS = [
  { id: 'agent-above', name: 'Alice Above',  role: 'agent', photoURL: null },
  { id: 'agent-below', name: 'Bob Below',    role: 'agent', photoURL: null },
  { id: 'agent-unset', name: 'Carol Unset',  role: 'agent', photoURL: null },
  { id: 'manager-1',   name: 'Mgr Name',     role: 'branch_manager', photoURL: null },
];

function goalsByAgentId(id) {
  if (id === 'agent-above') {
    return { targetAnnualAPI: 250000, targetAnnualApps: 48, targetAnnualPersistency: 92, updatedAt: null };
  }
  if (id === 'agent-below') {
    return { targetAnnualAPI: 180000, targetAnnualApps: 36, targetAnnualPersistency: 88, updatedAt: null };
  }
  if (id === 'agent-unset') return null;
  return null;
}

function setRole(role, extras = {}) {
  hoisted.authRef.current = {
    user: { uid: 'mgr-1' },
    userProfile: { unitId: 'unit-1', name: 'Mgr Name', ...extras },
    role,
    tenantId: 'tenant-1',
  };
}

describe('GoalsPanel', () => {
  beforeEach(() => {
    hoisted.getTenantUsers.mockResolvedValue(AGENTS);
    hoisted.getGoals.mockImplementation((_tenantId, agentId) => Promise.resolve(goalsByAgentId(agentId)));
    hoisted.setGoals.mockResolvedValue(undefined);
    hoisted.getCompanyMinimums.mockResolvedValue(MINIMUMS);
    hoisted.getUnitGoals.mockResolvedValue(null);
    hoisted.setUnitGoals.mockResolvedValue(undefined);
    hoisted.getBranchGoals.mockResolvedValue(null);
    hoisted.setBranchGoals.mockResolvedValue(undefined);
    hoisted.getGoalHierarchy.mockResolvedValue({
      companyFloor: { api: 200000, apps: 42 },
      branchTarget: { api: 1200000, apps: 240, ffiConducted: null, ciConducted: null, dials: null },
      unitTarget:   { api: 600000,  apps: 120, ffiConducted: null, ciConducted: null, dials: null },
      personal:     { api: 250000,  apps: 48,  ffiConducted: null, ciConducted: null, dials: null },
    });
    setRole('branch_manager');
  });

  describe('IA + sub-tab role gating', () => {
    it('renders single sub-tab row with 4 items for branch_manager', async () => {
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Self'   })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Agent'  })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Unit'   })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Branch' })).toBeInTheDocument();
      });
    });

    it('hides Branch sub-tab for unit_manager', async () => {
      setRole('unit_manager');
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Self'  })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Agent' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Unit'  })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Branch' })).not.toBeInTheDocument();
      });
    });

    it('shows Branch sub-tab for sales_manager (bundled fix)', async () => {
      setRole('sales_manager');
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Branch' })).toBeInTheDocument();
      });
    });

    it('renders GapAnalysisPanel above the sub-tab row', async () => {
      render(<GoalsPanel />);
      const panel = await screen.findByTestId('gap-analysis-panel');
      expect(panel).toBeInTheDocument();
      expect(panel.getAttribute('data-title')).toBe('Goal Cascade');
      // Hierarchy has resolved.
      await waitFor(() => {
        expect(screen.getByTestId('gap-analysis-panel').getAttribute('data-has-hierarchy')).toBe('yes');
      });
    });
  });

  describe('Self sub-tab', () => {
    it('renders CommissionPlayground + Personal Target placeholder by default', async () => {
      hoisted.getGoals.mockImplementation((_t, uid) => {
        if (uid === 'mgr-1') return Promise.resolve(null);  // no manager personal goal saved
        return Promise.resolve(goalsByAgentId(uid));
      });
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByTestId('commission-playground')).toBeInTheDocument();
        expect(screen.getByText('Your Personal Annual Target')).toBeInTheDocument();
        expect(screen.getByText(/No personal target set/)).toBeInTheDocument();
      });
    });
  });

  describe('Agent sub-tab — expand/collapse', () => {
    async function gotoAgentTab() {
      render(<GoalsPanel />);
      await screen.findByRole('tab', { name: 'Agent' });
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'Agent' }));
      });
      // Wait for agents to load.
      await screen.findByText('Alice Above');
    }

    it('auto-expands agents whose goals are below the company floor', async () => {
      await gotoAgentTab();
      // Above-floor row toggle has aria-expanded="false"
      const aliceBtn = screen.getByRole('button', { name: /Alice Above/ });
      expect(aliceBtn.getAttribute('aria-expanded')).toBe('false');
      // Below-floor row toggle has aria-expanded="true"
      const bobBtn = screen.getByRole('button', { name: /Bob Below/ });
      expect(bobBtn.getAttribute('aria-expanded')).toBe('true');
      // Not-set row stays collapsed.
      const carolBtn = screen.getByRole('button', { name: /Carol Unset/ });
      expect(carolBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('renders the correct status chip per row', async () => {
      await gotoAgentTab();
      expect(screen.getByText('Above floor')).toBeInTheDocument();
      expect(screen.getByText('Below floor')).toBeInTheDocument();
      expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    it('toggling a row expands it; clicking again collapses it (multi-expand)', async () => {
      await gotoAgentTab();
      const aliceBtn = screen.getByRole('button', { name: /Alice Above/ });
      const bobBtn   = screen.getByRole('button', { name: /Bob Below/ });

      // Bob is already auto-expanded (below-floor). Expand Alice too — multi-expand.
      await act(async () => fireEvent.click(aliceBtn));
      expect(aliceBtn.getAttribute('aria-expanded')).toBe('true');
      expect(bobBtn.getAttribute('aria-expanded')).toBe('true');

      // Collapse Alice; Bob remains expanded.
      await act(async () => fireEvent.click(aliceBtn));
      expect(aliceBtn.getAttribute('aria-expanded')).toBe('false');
      expect(bobBtn.getAttribute('aria-expanded')).toBe('true');
    });

    it('renders Tap-to-set hint copy for not-set agents', async () => {
      await gotoAgentTab();
      const year = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`Tap to set ${year} targets`))).toBeInTheDocument();
    });

    it('invokes setGoals when Save Goals is clicked in an expanded row', async () => {
      await gotoAgentTab();
      // Bob is already expanded — find his Save Goals button. There may be
      // multiple Save Goals buttons if multiple rows are expanded; pick the
      // first one (Bob's, since he's the only auto-expanded row).
      const saveBtns = screen.getAllByRole('button', { name: 'Save Goals' });
      expect(saveBtns.length).toBeGreaterThan(0);
      await act(async () => fireEvent.click(saveBtns[0]));
      await waitFor(() => {
        expect(hoisted.setGoals).toHaveBeenCalledTimes(1);
        const [tenantId, agentId, _payload, managerUid] = hoisted.setGoals.mock.calls[0];
        expect(tenantId).toBe('tenant-1');
        expect(agentId).toBe('agent-below');
        expect(managerUid).toBe('mgr-1');
      });
    });
  });
});
