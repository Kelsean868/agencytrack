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

const WEEK      = '2026-06-07'; // Sunday (pre-cutoff)
const WEEK_POST = '2026-06-14'; // cutoff boundary Sunday (>= inclusive)
const ON_TIME   = new Date('2026-06-08T12:00:00Z');
const ON_TIME_POST = new Date('2026-06-15T12:00:00Z');

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

function renderPanelPost() {
  return render(<CompliancePanel selectedWeek={WEEK_POST} setSelectedWeek={() => {}} />);
}

// UM fixture — one agent + one UM (no plan tests needed here, so getWeeklyPlan → null)
const USERS_WITH_UM = [
  { id: 'agentA', name: 'Ann Agent',  role: 'agent',        unitId: 'u1' },
  { id: 'umA',    name: 'Uma Manager', role: 'unit_manager', unitId: 'u1', unitName: 'Unit 1' },
];
const SUB_A_POST  = { id: 'subApost',  agentId: 'agentA', status: 'submitted', weekStarting: WEEK_POST, submittedAt: ON_TIME_POST };
const SUB_UM_POST = { id: 'subUMpost', agentId: 'umA',    status: 'submitted', weekStarting: WEEK_POST, submittedAt: ON_TIME_POST };

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

// ── Phase 3 — UM mandatory filing (cutoff-conditional) ────────────────────────
describe('CompliancePanel — Phase 3 UM mandatory filing', () => {
  // Shared UM-fixture beforeEach builder
  function setupUM({ week, subs }) {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({
      tenantId: 'T',
      user: { uid: 'mgr1', displayName: 'Mgr' },
      userProfile: { name: 'Mgr One', role: 'branch_manager', branchName: 'South Branch' },
      role: 'branch_manager',
    });
    hoisted.getWeeklySubmissions.mockImplementation((_t, w) =>
      Promise.resolve(w === week ? subs : []));
    hoisted.getTenantUsers.mockResolvedValue(USERS_WITH_UM);
    hoisted.getNudgeRecords.mockResolvedValue({});
    hoisted.getWeeklyPlan.mockResolvedValue(null);
    hoisted.sendComplianceNudge.mockResolvedValue({ success: true });
  }

  describe('post-cutoff week (selectedWeek >= 2026-06-14)', () => {
    beforeEach(() => setupUM({ week: WEEK_POST, subs: [SUB_A_POST] }));

    test('non-filing UM appears in "Haven\'t filed" exception list', async () => {
      renderPanelPost();
      await screen.findByTestId('compliance-reality-bar');
      const rows = screen.getAllByTestId('compliance-exception-row');
      expect(rows.map((r) => r.getAttribute('data-uid'))).toContain('umA');
    });

    test('reality bar total counts UM in denominator — 1 filed of 2 → 50%', async () => {
      renderPanelPost();
      const filed = await screen.findByTestId('compliance-stat-filed');
      expect(filed).toHaveAttribute('data-value', '1 / 2 · 50%');
    });

    test('filing UM clears the exception list (all-clear shown)', async () => {
      hoisted.getWeeklySubmissions.mockImplementation((_t, w) =>
        Promise.resolve(w === WEEK_POST ? [SUB_A_POST, SUB_UM_POST] : []));
      renderPanelPost();
      await screen.findByTestId('compliance-reality-bar');
      expect(await screen.findByTestId('compliance-all-clear')).toBeInTheDocument();
    });
  });

  describe('pre-cutoff week (selectedWeek < 2026-06-14) — historical preserved', () => {
    beforeEach(() => setupUM({ week: WEEK, subs: [] }));

    test('UM NOT in roster — only agentA present (umA excluded, pre-cutoff)', async () => {
      renderPanel(); // WEEK = '2026-06-07' (pre-cutoff)
      await screen.findByTestId('compliance-reality-bar');
      // Only agentA in scope — 1 roster row, umA absent from both roster and exception list
      const rosterRows = screen.getAllByTestId('compliance-roster-row');
      expect(rosterRows).toHaveLength(1);
      const exceptionRows = screen.queryAllByTestId('compliance-exception-row');
      expect(exceptionRows.map((r) => r.getAttribute('data-uid'))).not.toContain('umA');
    });
  });

  describe('UM streak starts at the cutoff — no pre-cutoff miss', () => {
    beforeEach(() =>
      // umA filed WEEK_POST (the cutoff week); all prior weeks return empty
      setupUM({ week: WEEK_POST, subs: [SUB_UM_POST] })
    );

    test('umA filed cutoff week only — streak shows "1 wk" (pre-cutoff gaps not counted)', async () => {
      renderPanelPost();
      await screen.findByTestId('compliance-reality-bar');
      const rosterRows = await screen.findAllByTestId('compliance-roster-row');
      const umARow = rosterRows.find((r) => r.textContent.includes('Uma Manager'));
      expect(umARow).toBeTruthy();
      expect(umARow).toHaveTextContent('1 wk');
    });
  });
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
