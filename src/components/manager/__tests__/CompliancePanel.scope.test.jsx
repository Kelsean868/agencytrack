import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompliancePanel from '../CompliancePanel';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getWeeklySubmissions: vi.fn(),
  getTenantUsers: vi.fn(),
  sendComplianceNudge: vi.fn(),
  getNudgeRecords: vi.fn(),
  getWeeklyPlan: vi.fn(),
  unlockSubmission: vi.fn(),
  show: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/managerService', () => ({
  getWeeklySubmissions: hoisted.getWeeklySubmissions,
  getTenantUsers: hoisted.getTenantUsers,
}));
vi.mock('../../../services/nudgeService', () => ({
  NUDGE_TYPE: 'compliance.filing.nudge',
  PLAN_NUDGE_TYPE: 'compliance.plan.nudge',
  sendComplianceNudge: hoisted.sendComplianceNudge,
  getNudgeRecords: hoisted.getNudgeRecords,
}));
vi.mock('../../../services/weeklyPlanService', () => ({ getWeeklyPlan: hoisted.getWeeklyPlan }));
vi.mock('../../../services/unlockService', () => ({ unlockSubmission: hoisted.unlockSubmission }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: hoisted.show, dismiss: vi.fn() }) }));
vi.mock('../CoachingNotesModal', () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer', () => ({ default: () => <div data-testid="submission-viewer" /> }));

const WEEK = '2026-06-07'; // Sunday

// Branch roster spanning two units — agentA (Alpha) submitted, agentB (Alpha)
// and agentC (Beta) have not filed. Nudge-all population differs by scope.
const USERS_MULTI_UNIT = [
  { id: 'agentA', name: 'Ann Agent',  role: 'agent', unitId: 'u1', unitName: 'Alpha Unit' },
  { id: 'agentB', name: 'Bob Agent',  role: 'agent', unitId: 'u1', unitName: 'Alpha Unit' },
  { id: 'agentC', name: 'Cara Agent', role: 'agent', unitId: 'u2', unitName: 'Beta Unit' },
];
const SUB_A = { id: 'subA', agentId: 'agentA', status: 'submitted', weekStarting: WEEK, submittedAt: new Date('2026-06-08T12:00:00Z') };

// Single-unit roster (existing behavior baseline — no switch expected).
const USERS_SINGLE_UNIT = [
  { id: 'agentA', name: 'Ann Agent', role: 'agent', unitId: 'u1', unitName: 'Alpha Unit' },
  { id: 'agentB', name: 'Bob Agent', role: 'agent', unitId: 'u1', unitName: 'Alpha Unit' },
];

// >5 units — dense-roster collapse-to-select path.
const USERS_SIX_UNITS = Array.from({ length: 6 }, (_, i) => ({
  id: `agent${i}`, name: `Agent ${i}`, role: 'agent', unitId: `u${i}`, unitName: `Unit ${i}`,
}));

function renderPanel() {
  return render(<CompliancePanel selectedWeek={WEEK} setSelectedWeek={() => {}} />);
}

function mockAuth(overrides) {
  hoisted.useAuth.mockReturnValue({
    tenantId: 'T',
    user: { uid: 'mgr1', displayName: 'Mgr' },
    userProfile: { name: 'Mgr One', role: 'branch_manager', branchName: 'South Branch' },
    role: 'branch_manager',
    ...overrides,
  });
}

let user;

beforeEach(() => {
  user = userEvent.setup();
  vi.clearAllMocks();
  mockAuth();
  hoisted.getWeeklySubmissions.mockImplementation((_t, week) =>
    Promise.resolve(week === WEEK ? [SUB_A] : []));
  hoisted.getTenantUsers.mockResolvedValue(USERS_MULTI_UNIT);
  hoisted.getNudgeRecords.mockResolvedValue({});
  hoisted.getWeeklyPlan.mockResolvedValue(null);
  hoisted.sendComplianceNudge.mockResolvedValue({ success: true });
});

describe('CompliancePanel — S4 explicit ScopeSwitch', () => {
  test('renders for branch_manager with a multi-unit roster', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    expect(screen.getByTestId('compliance-scope-switch')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-scope-branch')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-scope-unit-u1')).toHaveTextContent('Alpha Unit');
    expect(screen.getByTestId('compliance-scope-unit-u2')).toHaveTextContent('Beta Unit');
    // Default = Branch, unfiltered — both not-in agents nudge-able.
    expect(screen.getByTestId('compliance-nudge-all')).toHaveTextContent('Nudge all 2');
  });

  test('hidden when the roster spans only one unit', async () => {
    hoisted.getTenantUsers.mockResolvedValue(USERS_SINGLE_UNIT);
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    expect(screen.queryByTestId('compliance-scope-switch')).not.toBeInTheDocument();
  });

  test('hidden for unit_manager even with a multi-unit-looking roster (single-scope by permission)', async () => {
    mockAuth({ userProfile: { name: 'Uma UM', role: 'unit_manager', unitName: 'Alpha Unit' }, role: 'unit_manager' });
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    expect(screen.queryByTestId('compliance-scope-switch')).not.toBeInTheDocument();
  });

  test('hidden for sales_manager (tenant-wide roster — current behavior kept, no cross-branch UI invented)', async () => {
    mockAuth({ userProfile: { name: 'Sam SM', role: 'sales_manager' }, role: 'sales_manager' });
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    expect(screen.queryByTestId('compliance-scope-switch')).not.toBeInTheDocument();
  });

  test('selecting a unit filters the roster rows + updates the nudge-all population; Branch restores', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');

    // Baseline — full branch roster (3 rows), 2 exceptions.
    expect(screen.getAllByTestId('compliance-roster-row')).toHaveLength(3);
    expect(screen.getByTestId('compliance-nudge-all')).toHaveTextContent('Nudge all 2');

    // Select Beta Unit (u2) — only agentC belongs to it.
    await user.click(screen.getByTestId('compliance-scope-unit-u2'));

    await waitFor(() => expect(screen.getAllByTestId('compliance-roster-row')).toHaveLength(1));
    expect(screen.getAllByTestId('compliance-roster-row')[0]).toHaveAttribute('data-status', 'not-in');
    expect(screen.getByTestId('compliance-nudge-all')).toHaveTextContent('Nudge all 1');
    const exceptionRows = screen.getAllByTestId('compliance-exception-row');
    expect(exceptionRows).toHaveLength(1);
    expect(exceptionRows[0]).toHaveAttribute('data-uid', 'agentC');

    // The Beta segment is pressed; Branch is not.
    expect(screen.getByTestId('compliance-scope-unit-u2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('compliance-scope-branch')).toHaveAttribute('aria-pressed', 'false');

    // Restore Branch — back to full roster.
    await user.click(screen.getByTestId('compliance-scope-branch'));
    await waitFor(() => expect(screen.getAllByTestId('compliance-roster-row')).toHaveLength(3));
    expect(screen.getByTestId('compliance-nudge-all')).toHaveTextContent('Nudge all 2');
  });

  test('nudge-all confirm copy names the selected unit as scope', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    await user.click(screen.getByTestId('compliance-scope-unit-u1'));
    await waitFor(() => expect(screen.getByTestId('compliance-nudge-all')).toHaveTextContent('Nudge all 1'));
    await user.click(screen.getByTestId('compliance-nudge-all'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Alpha Unit');
  });

  test('>5 unit segments collapse into a select beside the Branch button', async () => {
    hoisted.getTenantUsers.mockResolvedValue(USERS_SIX_UNITS);
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    expect(screen.getByTestId('compliance-scope-branch')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-scope-unit-select')).toBeInTheDocument();
    expect(screen.queryByTestId('compliance-scope-unit-u0')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('compliance-scope-unit-select'), 'u2');
    await waitFor(() => expect(screen.getAllByTestId('compliance-roster-row')).toHaveLength(1));
  });
});
