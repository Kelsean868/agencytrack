import React from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock state ───────────────────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  getTenantUsers:        vi.fn(),
  getGoals:              vi.fn(),
  setGoals:              vi.fn(),
  getCompanyMinimums:    vi.fn(),
  getUnitGoals:          vi.fn(),
  setUnitGoals:          vi.fn(),
  getBranchGoals:        vi.fn(),
  setBranchGoals:        vi.fn(),
  getSalesManagerGoals:  vi.fn(),
  setSalesManagerGoals:  vi.fn(),
  getSalesManagerUid:    vi.fn(),
  getGoalHierarchy:      vi.fn(),
  getAgentSubmissions:   vi.fn(),
  getSettlements:        vi.fn(),
  authRef:               { current: { user: { uid: 'mgr-1' }, userProfile: { unitId: 'unit-1', name: 'Mgr Name' }, role: 'branch_manager', tenantId: 'tenant-1' } },
}));

vi.mock('../../../services/managerService', () => ({
  getTenantUsers: (...args) => hoisted.getTenantUsers(...args),
}));

vi.mock('../../../services/submissionService', () => ({
  getAgentSubmissions: (...args) => hoisted.getAgentSubmissions(...args),
}));

vi.mock('../../../services/settlementService', () => ({
  getSettlements: (...args) => hoisted.getSettlements(...args),
}));

vi.mock('../../../services/goalsService', () => ({
  getGoals:              (...args) => hoisted.getGoals(...args),
  setGoals:              (...args) => hoisted.setGoals(...args),
  getCompanyMinimums:    (...args) => hoisted.getCompanyMinimums(...args),
  getUnitGoals:          (...args) => hoisted.getUnitGoals(...args),
  setUnitGoals:          (...args) => hoisted.setUnitGoals(...args),
  getBranchGoals:        (...args) => hoisted.getBranchGoals(...args),
  setBranchGoals:        (...args) => hoisted.setBranchGoals(...args),
  getSalesManagerGoals:  (...args) => hoisted.getSalesManagerGoals(...args),
  setSalesManagerGoals:  (...args) => hoisted.setSalesManagerGoals(...args),
  getSalesManagerUid:    (...args) => hoisted.getSalesManagerUid(...args),
  getGoalHierarchy:      (...args) => hoisted.getGoalHierarchy(...args),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => hoisted.authRef.current,
}));

// Stub heavy children so the tests stay focused on GoalsPanel's IA + flow.
vi.mock('../../goals/CommissionPlayground', () => ({
  default: () => <div data-testid="commission-playground" />,
}));
vi.mock('../../goals/RecommendLockDrawer', () => ({
  default: ({ open, onClose, agentName, onSave, saving }) =>
    open ? (
      <div data-testid="recommend-lock-drawer" data-agent={agentName}>
        <button onClick={onClose}>drawer-close</button>
        <button onClick={() => onSave({ targetAnnualAPI: 300000, targetAnnualApps: 50, targetAnnualPersistency: 92, targetWeeklyAPI: '' }, true)}>
          drawer-save-locked
        </button>
        {saving && <span>saving</span>}
      </div>
    ) : null,
}));
vi.mock('../../goals/GapAnalysisPanel', () => ({
  default: ({ title, hierarchy, ytdTotals }) => (
    <div
      data-testid="gap-analysis-panel"
      data-title={title}
      data-has-hierarchy={hierarchy ? 'yes' : 'no'}
      data-ytd-api={ytdTotals?.api ?? 0}
    >
      Gap Analysis Panel
    </div>
  ),
}));

vi.mock('../../goals/DerivedIncomePanel', () => ({
  default: ({ ytdTotals, commissionRate, loading }) => (
    <div
      data-testid="derived-income-panel"
      data-ytd-api={ytdTotals?.api ?? 0}
      data-commission-rate={commissionRate ?? 'none'}
      data-loading={loading ? 'true' : 'false'}
    >
      DerivedIncomePanel
    </div>
  ),
}));

vi.mock('../../goals/AwardsReachPanel', () => ({
  default: ({ submissions }) => (
    <div
      data-testid="awards-reach-panel"
      data-sub-count={submissions?.length ?? 0}
    >
      AwardsReachPanel
    </div>
  ),
}));

vi.mock('../../goals/MdrtTracker', () => ({
  default: ({ ytdTotals, loading }) => (
    <div
      data-testid="mdrt-tracker"
      data-ytd-api={ytdTotals?.api ?? 0}
      data-loading={loading ? 'true' : 'false'}
    >
      MdrtTracker
    </div>
  ),
}));

// Pure helpers — let real implementations through.
import GoalsPanel from '../GoalsPanel';

const THIS_YEAR = new Date().getFullYear();

// Known-value submission: totalProductionCredit=48000, apps=8 → predictable ytdTotals.
const OWN_SUBMISSION = {
  status: 'submitted',
  weekStarting: `${THIS_YEAR}-01-05`,
  totalProductionCredit: 48000,
  applicationsSold: '8',
  ffiConducted: '3',
  ciConducted: '2',
  totalTelAttempts: '30',
};

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
    hoisted.getSalesManagerGoals.mockResolvedValue(null);
    hoisted.setSalesManagerGoals.mockResolvedValue(undefined);
    hoisted.getSalesManagerUid.mockResolvedValue(null);
    hoisted.getGoalHierarchy.mockResolvedValue({
      companyFloor:       { api: 200000, apps: 42 },
      branchTarget:       { api: 1200000, apps: 240, ffiConducted: null, ciConducted: null, dials: null },
      salesManagerTarget: null,
      unitTarget:         { api: 600000,  apps: 120, ffiConducted: null, ciConducted: null, dials: null },
      personal:           { api: 250000,  apps: 48,  ffiConducted: null, ciConducted: null, dials: null },
    });
    hoisted.getAgentSubmissions.mockResolvedValue([OWN_SUBMISSION]);
    hoisted.getSettlements.mockResolvedValue([]);
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

    it('shows SM Target sub-tab for sales_manager', async () => {
      setRole('sales_manager');
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'SM Target' })).toBeInTheDocument();
      });
    });

    it('shows SM Target sub-tab for tenant_admin', async () => {
      setRole('tenant_admin');
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'SM Target' })).toBeInTheDocument();
      });
    });

    it('does NOT show SM Target sub-tab for branch_manager', async () => {
      setRole('branch_manager');
      render(<GoalsPanel />);
      await screen.findByRole('tab', { name: 'Branch' });
      expect(screen.queryByRole('tab', { name: 'SM Target' })).not.toBeInTheDocument();
    });

    it('calls getSalesManagerGoals when SM Target tab is clicked by sales_manager', async () => {
      setRole('sales_manager');
      hoisted.getSalesManagerGoals.mockResolvedValue(null);
      render(<GoalsPanel />);
      const smTab = await screen.findByRole('tab', { name: 'SM Target' });
      fireEvent.click(smTab);
      await waitFor(() => {
        // sales_manager uses own uid (mgr-1) — no getSalesManagerUid call needed
        expect(hoisted.getSalesManagerGoals).toHaveBeenCalledWith('tenant-1', 'mgr-1', expect.any(Number));
      });
    });

  });

  // ── Tier goal forms — activity targets (FFI/CI/Dials, item 2.3) ────────────
  // GoalLevelForm (shared by Unit/Branch/SM tabs) already ships optional
  // FFIs/CIs/Dials inputs alongside the required Annual API/Apps fields
  // (src/components/manager/GoalsPanel.jsx:194-209) and the service layer
  // already strips empty/zero values before writing (goalsService.test.js).
  // This block closes the one real gap: no test asserted the fields actually
  // render in each tier form, or that typed values reach the service call.
  describe('Tier goal forms — activity targets (FFI/CI/Dials)', () => {
    function fieldInput(label) {
      return screen.getByText(label).closest('div').querySelector('input');
    }

    it('renders the three optional activity-target inputs in the Branch tier form', async () => {
      render(<GoalsPanel />);
      const branchTab = await screen.findByRole('tab', { name: 'Branch' });
      fireEvent.click(branchTab);
      await waitFor(() => {
        expect(screen.getByText('FFIs (optional)')).toBeInTheDocument();
        expect(screen.getByText('CIs (optional)')).toBeInTheDocument();
        expect(screen.getByText('Dials (optional)')).toBeInTheDocument();
      });
      // Required fields are unaffected — still present alongside the optional trio.
      expect(screen.getByText('Annual API (TTD) *')).toBeInTheDocument();
      expect(screen.getByText('Annual Apps *')).toBeInTheDocument();
    });

    it('renders the three optional activity-target inputs in the Unit tier form', async () => {
      setRole('unit_manager');
      render(<GoalsPanel />);
      const unitTab = await screen.findByRole('tab', { name: 'Unit' });
      fireEvent.click(unitTab);
      await waitFor(() => {
        expect(screen.getByText('FFIs (optional)')).toBeInTheDocument();
        expect(screen.getByText('CIs (optional)')).toBeInTheDocument();
        expect(screen.getByText('Dials (optional)')).toBeInTheDocument();
      });
    });

    it('renders the three optional activity-target inputs in the SM tier form', async () => {
      setRole('sales_manager');
      hoisted.getSalesManagerGoals.mockResolvedValue(null);
      render(<GoalsPanel />);
      const smTab = await screen.findByRole('tab', { name: 'SM Target' });
      fireEvent.click(smTab);
      await waitFor(() => {
        expect(screen.getByText('FFIs (optional)')).toBeInTheDocument();
        expect(screen.getByText('CIs (optional)')).toBeInTheDocument();
        expect(screen.getByText('Dials (optional)')).toBeInTheDocument();
      });
    });

    it('passes typed activity-target values through to setBranchGoals on save (Branch tier)', async () => {
      render(<GoalsPanel />);
      const branchTab = await screen.findByRole('tab', { name: 'Branch' });
      fireEvent.click(branchTab);
      await screen.findByText('FFIs (optional)');

      fireEvent.change(fieldInput('Annual API (TTD) *'), { target: { value: '5000000' } });
      fireEvent.change(fieldInput('Annual Apps *'),       { target: { value: '400' } });
      fireEvent.change(fieldInput('FFIs (optional)'),      { target: { value: '850' } });
      fireEvent.change(fieldInput('CIs (optional)'),       { target: { value: '420' } });
      fireEvent.change(fieldInput('Dials (optional)'),     { target: { value: '9000' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save Branch Goals' }));

      await waitFor(() => {
        expect(hoisted.setBranchGoals).toHaveBeenCalled();
        const [, , payload] = hoisted.setBranchGoals.mock.calls.at(-1);
        expect(payload).toEqual({
          api:          '5000000',
          apps:         '400',
          ffiConducted: '850',
          ciConducted:  '420',
          dials:        '9000',
        });
      });
    });

    it('leaves activity-target fields blank in the payload when untouched (no zero-fill)', async () => {
      render(<GoalsPanel />);
      const branchTab = await screen.findByRole('tab', { name: 'Branch' });
      fireEvent.click(branchTab);
      await screen.findByText('FFIs (optional)');

      fireEvent.change(fieldInput('Annual API (TTD) *'), { target: { value: '3000000' } });
      fireEvent.change(fieldInput('Annual Apps *'),       { target: { value: '300' } });
      // FFIs / CIs / Dials left untouched — component passes them through as ''
      // and setBranchGoals (goalsService.test.js) strips '' / 0 before the write.

      fireEvent.click(screen.getByRole('button', { name: 'Save Branch Goals' }));

      await waitFor(() => {
        expect(hoisted.setBranchGoals).toHaveBeenCalled();
        const [, , payload] = hoisted.setBranchGoals.mock.calls.at(-1);
        expect(payload.ffiConducted).toBe('');
        expect(payload.ciConducted).toBe('');
        expect(payload.dials).toBe('');
      });
    });
  });

  describe('GapAnalysisPanel placement', () => {
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
      fireEvent.click(screen.getByRole('tab', { name: 'Agent' }));
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

  describe('Agent sub-tab — Slice 2 features', () => {
    async function gotoAgentTab() {
      render(<GoalsPanel />);
      await screen.findByRole('tab', { name: 'Agent' });
      fireEvent.click(screen.getByRole('tab', { name: 'Agent' }));
      await screen.findByText('Alice Above');
    }

    it('renders agents in exception-first order: unset → below → above', async () => {
      await gotoAgentTab();
      // Query all agent-row toggle buttons (they have aria-expanded attr)
      const toggleBtns = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-expanded'));
      const names = toggleBtns.map((b) => b.textContent);
      const carolIdx = names.findIndex((t) => /carol unset/i.test(t));
      const bobIdx   = names.findIndex((t) => /bob below/i.test(t));
      const aliceIdx = names.findIndex((t) => /alice above/i.test(t));
      expect(carolIdx).toBeLessThan(bobIdx);
      expect(bobIdx).toBeLessThan(aliceIdx);
    });

    it('shows "Game Plan committed" badge for agents with gamePlanCommitted:true', async () => {
      hoisted.getGoals.mockImplementation((_tenantId, agentId) => {
        const base = goalsByAgentId(agentId);
        if (agentId === 'agent-above') return Promise.resolve({ ...base, gamePlanCommitted: true });
        return Promise.resolve(base);
      });
      await gotoAgentTab();
      expect(screen.getByText(/Game Plan committed/i)).toBeInTheDocument();
    });

    it('does not show committed badge when gamePlanCommitted is absent', async () => {
      await gotoAgentTab();
      expect(screen.queryByText(/Game Plan committed/i)).not.toBeInTheDocument();
    });

    it('shows "Set target" or "Edit target" button for auto-expanded rows', async () => {
      await gotoAgentTab();
      // Bob is auto-expanded (below-floor). His mock goalsDoc has targetAnnualAPI=180000,
      // so hasManagerTarget=true → label is "Edit target".
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /(set|edit) target/i })).toBeInTheDocument();
      });
    });

    it('opens RecommendLockDrawer with correct agent name when target button is clicked', async () => {
      await gotoAgentTab();
      const setTargetBtn = screen.getByRole('button', { name: /(set|edit) target/i });
      fireEvent.click(setTargetBtn);
      await waitFor(() => {
        const drawer = screen.getByTestId('recommend-lock-drawer');
        expect(drawer).toBeInTheDocument();
        expect(drawer.getAttribute('data-agent')).toBe('Bob Below');
      });
    });

    it('calls setGoals with targetLocked when drawer save fires', async () => {
      await gotoAgentTab();
      fireEvent.click(screen.getByRole('button', { name: /(set|edit) target/i }));
      await screen.findByTestId('recommend-lock-drawer');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: /drawer-save-locked/i })));
      await waitFor(() => {
        expect(hoisted.setGoals).toHaveBeenCalledWith(
          'tenant-1',
          'agent-below',
          expect.objectContaining({ targetLocked: true, targetAnnualAPI: 300000 }),
          'mgr-1',
          'Mgr Name',
        );
      });
    });

    it('closes the drawer when drawer-close is clicked', async () => {
      await gotoAgentTab();
      fireEvent.click(screen.getByRole('button', { name: /(set|edit) target/i }));
      await screen.findByTestId('recommend-lock-drawer');
      fireEvent.click(screen.getByRole('button', { name: /drawer-close/i }));
      await waitFor(() => {
        expect(screen.queryByTestId('recommend-lock-drawer')).not.toBeInTheDocument();
      });
    });
  });

  describe('portfolio panels — producing-manager gate', () => {
    it('renders all three panels in Self tab for branch_manager', async () => {
      setRole('branch_manager');
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByTestId('derived-income-panel')).toBeInTheDocument();
        expect(screen.getByTestId('awards-reach-panel')).toBeInTheDocument();
        expect(screen.getByTestId('mdrt-tracker')).toBeInTheDocument();
      });
    });

    it('renders all three panels in Self tab for unit_manager', async () => {
      setRole('unit_manager');
      render(<GoalsPanel />);
      await waitFor(() => {
        expect(screen.getByTestId('derived-income-panel')).toBeInTheDocument();
        expect(screen.getByTestId('awards-reach-panel')).toBeInTheDocument();
        expect(screen.getByTestId('mdrt-tracker')).toBeInTheDocument();
      });
    });

    it('hides all three panels for sales_manager', async () => {
      setRole('sales_manager');
      render(<GoalsPanel />);
      // Wait for the Self tab to fully render (gap-analysis-panel is always present)
      await screen.findByTestId('gap-analysis-panel');
      expect(screen.queryByTestId('derived-income-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('awards-reach-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mdrt-tracker')).not.toBeInTheDocument();
    });

    it('hides all three panels for tenant_admin', async () => {
      setRole('tenant_admin');
      render(<GoalsPanel />);
      await screen.findByTestId('gap-analysis-panel');
      expect(screen.queryByTestId('derived-income-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('awards-reach-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mdrt-tracker')).not.toBeInTheDocument();
    });

    // hero-ledger H1 — the panel shows the manager's LEDGER production, from the
    // dashboard's useMyProduction() result. The weekly report (48000 in
    // OWN_SUBMISSION) is activity; the ledger's settled API (36000) is production.
    const OWN_PRODUCTION = {
      allSubmissions: [OWN_SUBMISSION],
      settlements: [],
      ytdTotals: { api: 36000, apps: 1, activityApps: 8, ffiConducted: 3, ciConducted: 2, dials: 30 },
      loading: false,
      ledgerPending: false,
      policiesError: false,
      loadPolicies: vi.fn(),
    };

    it('feeds the ledger settled API, not the weekly report, to DerivedIncomePanel and MdrtTracker', async () => {
      setRole('branch_manager');
      render(<GoalsPanel ownProduction={OWN_PRODUCTION} />);
      await waitFor(() => {
        expect(screen.getByTestId('derived-income-panel').getAttribute('data-ytd-api')).toBe('36000');
        expect(screen.getByTestId('mdrt-tracker').getAttribute('data-ytd-api')).toBe('36000');
      });
    });

    it('feeds own submissions array to AwardsReachPanel', async () => {
      setRole('branch_manager');
      render(<GoalsPanel ownProduction={OWN_PRODUCTION} />);
      await waitFor(() => {
        const panel = screen.getByTestId('awards-reach-panel');
        expect(panel.getAttribute('data-sub-count')).toBe('1');
      });
    });

    it('feeds the ledger ytdTotals to GapAnalysisPanel (not zeros, not weekly)', async () => {
      setRole('branch_manager');
      render(<GoalsPanel ownProduction={OWN_PRODUCTION} />);
      await waitFor(() => {
        expect(screen.getByTestId('gap-analysis-panel').getAttribute('data-ytd-api')).toBe('36000');
      });
    });

    it('shows loading while the ledger is pending', async () => {
      setRole('branch_manager');
      render(<GoalsPanel ownProduction={{ ...OWN_PRODUCTION, ledgerPending: true }} />);
      await waitFor(() => {
        expect(screen.getByTestId('mdrt-tracker').getAttribute('data-loading')).toBe('true');
      });
    });

    it('shows the ledger error card with a working retry', async () => {
      setRole('branch_manager');
      const loadPolicies = vi.fn();
      render(<GoalsPanel ownProduction={{ ...OWN_PRODUCTION, policiesError: true, loadPolicies }} />);
      const card = await screen.findByTestId('ledger-load-error');
      fireEvent.click(within(card).getByRole('button', { name: /retry/i }));
      expect(loadPolicies).toHaveBeenCalledTimes(1);
    });

    it('ignores ownProduction for a non-producing role and reads no submissions itself', async () => {
      setRole('sales_manager');
      hoisted.getAgentSubmissions.mockClear();
      render(<GoalsPanel ownProduction={OWN_PRODUCTION} />);
      const gap = await screen.findByTestId('gap-analysis-panel');
      expect(gap.getAttribute('data-ytd-api')).toBe('0');
      expect(hoisted.getAgentSubmissions).not.toHaveBeenCalled();
    });
  });
});
