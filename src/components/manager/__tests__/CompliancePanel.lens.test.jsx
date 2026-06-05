import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
const ON_TIME = new Date('2026-06-08T12:00:00Z');

// agentA: submitted + plan  → filing OK,    plan committed
// agentB: NOT submitted + plan → filing not-in, plan committed
// agentC: submitted + NO plan  → filing OK,    plan NOT committed
// So filing exception = [agentB]; plan exception = [agentC] (proves lockstep swap).
const USERS = [
  { id: 'agentA', name: 'Ann Agent',  role: 'agent', unitId: 'u1' },
  { id: 'agentB', name: 'Bob Agent',  role: 'agent', unitId: 'u1' },
  { id: 'agentC', name: 'Cara Agent', role: 'agent', unitId: 'u1' },
];
const SUB_A = { id: 'subA', agentId: 'agentA', status: 'submitted', weekStarting: WEEK, submittedAt: ON_TIME };
const SUB_C = { id: 'subC', agentId: 'agentC', status: 'submitted', weekStarting: WEEK, submittedAt: ON_TIME };

function renderPanel() {
  return render(<CompliancePanel selectedWeek={WEEK} setSelectedWeek={() => {}} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({
    tenantId: 'T',
    user: { uid: 'mgr1', displayName: 'Mgr' },
    userProfile: { name: 'Mgr One', role: 'branch_manager', branchName: 'South Branch' },
    role: 'branch_manager',
  });
  hoisted.getWeeklySubmissions.mockImplementation((_t, week) =>
    Promise.resolve(week === WEEK ? [SUB_A, SUB_C] : []));
  hoisted.getTenantUsers.mockResolvedValue(USERS);
  hoisted.getNudgeRecords.mockResolvedValue({});
  hoisted.getWeeklyPlan.mockImplementation((_t, uid) =>
    Promise.resolve(uid === 'agentA' || uid === 'agentB' ? { id: `${uid}_${WEEK}`, agentId: uid } : null));
  hoisted.sendComplianceNudge.mockResolvedValue({ success: true });
});

describe('CompliancePanel — S3 plan-adoption lens', () => {
  test('filing lens (default): filing bar + "Haven\'t filed" + agentB is the exception', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    expect(screen.getByTestId('compliance-stat-filed')).toBeInTheDocument();
    expect(screen.getByText("Haven't filed")).toBeInTheDocument();
    const rows = screen.getAllByTestId('compliance-exception-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-uid', 'agentB');
    // Filing-lens-only sections present.
    expect(screen.getByTestId('compliance-roster')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-cbtt-section')).toBeInTheDocument();
  });

  test('toggle count chips reflect each lens (filing 1 not in · plan 1 no plan)', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    await waitFor(() => expect(screen.getByTestId('compliance-lens-plan')).toHaveTextContent('1 no plan'));
    expect(screen.getByTestId('compliance-lens-filing')).toHaveTextContent('1 not in');
  });

  test('toggle to plan: plan bar + "Haven\'t committed a plan" + agentC exception; roster/CBTT hidden', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    await waitFor(() => expect(screen.getByTestId('compliance-lens-plan')).toHaveTextContent('no plan'));

    fireEvent.click(screen.getByTestId('compliance-lens-plan'));

    // Bar swaps to plan metrics.
    await screen.findByTestId('compliance-stat-committed');
    expect(screen.queryByTestId('compliance-stat-filed')).toBeNull();
    // Exception list swaps in lockstep: B (filing) → C (plan).
    expect(screen.getByText("Haven't committed a plan")).toBeInTheDocument();
    const rows = screen.getAllByTestId('compliance-exception-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-uid', 'agentC');
    // Filing-only sections hidden in the plan lens.
    expect(screen.queryByTestId('compliance-roster')).toBeNull();
    expect(screen.queryByTestId('compliance-cbtt-section')).toBeNull();
  });

  test('plan bar derivation is exact: committed 2/3 · 67%, not committed 1', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    await waitFor(() => expect(screen.getByTestId('compliance-lens-plan')).toHaveTextContent('no plan'));
    fireEvent.click(screen.getByTestId('compliance-lens-plan'));

    const committed = await screen.findByTestId('compliance-stat-committed');
    expect(committed).toHaveAttribute('data-value', '2 / 3 · 67%');
    expect(screen.getByTestId('compliance-stat-notcommitted')).toHaveAttribute('data-value', '1');
  });

  test('plan-nudge fires the CF with the PLAN type', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    await waitFor(() => expect(screen.getByTestId('compliance-lens-plan')).toHaveTextContent('no plan'));
    fireEvent.click(screen.getByTestId('compliance-lens-plan'));

    const nudgeBtn = await screen.findByTestId('compliance-nudge-btn'); // only agentC
    fireEvent.click(nudgeBtn);
    await waitFor(() =>
      expect(hoisted.sendComplianceNudge).toHaveBeenCalledWith(['agentC'], WEEK, 'compliance.plan.nudge'));
  });

  test('plan Nudge-all confirm names plan count + scope, fires plan-type CF for all not-committed', async () => {
    renderPanel();
    await screen.findByTestId('compliance-reality-bar');
    await waitFor(() => expect(screen.getByTestId('compliance-lens-plan')).toHaveTextContent('no plan'));
    fireEvent.click(screen.getByTestId('compliance-lens-plan'));

    const nudgeAll = await screen.findByTestId('compliance-nudge-all');
    expect(nudgeAll).toHaveTextContent('Nudge all 1');
    fireEvent.click(nudgeAll);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/hasn't committed a plan/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /send 1 nudge/i }));
    await waitFor(() =>
      expect(hoisted.sendComplianceNudge).toHaveBeenCalledWith(['agentC'], WEEK, 'compliance.plan.nudge'));
  });
});
