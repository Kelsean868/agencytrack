import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
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
vi.mock('../../submissions/SubmissionViewer', () => ({
  default: ({ submission, onClose }) => (
    <div data-testid="submission-viewer">
      viewing:{submission?.id}
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

const WEEK = '2026-06-07'; // Sunday
const ON_TIME = new Date('2026-06-08T12:00:00Z'); // within the deadline

const USERS = [
  { id: 'agentA', name: 'Ann Agent',  role: 'agent', unitId: 'u1' },
  { id: 'agentB', name: 'Bob Agent',  role: 'agent', unitId: 'u1' },
  { id: 'agentC', name: 'Cara Agent', role: 'agent', unitId: 'u1' },
];
const SUB_A = { id: 'subA', agentId: 'agentA', status: 'submitted', weekStarting: WEEK, submittedAt: ON_TIME };

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
  // agentA submitted this week; other weeks empty.
  hoisted.getWeeklySubmissions.mockImplementation((_t, week) =>
    Promise.resolve(week === WEEK ? [SUB_A] : []));
  hoisted.getTenantUsers.mockResolvedValue(USERS);
  hoisted.getNudgeRecords.mockResolvedValue({}); // no prior nudges
  hoisted.getWeeklyPlan.mockResolvedValue(null);  // filing-lens tests: plan data irrelevant
  hoisted.sendComplianceNudge.mockResolvedValue({ success: true });
  hoisted.unlockSubmission.mockResolvedValue(undefined);
});

describe('CompliancePanel — S2 nudge + re-home wiring', () => {
  test('single Nudge calls the CF with the agent uid + week, then shows the cooldown chip', async () => {
    renderPanel();
    const nudgeBtns = await screen.findAllByTestId('compliance-nudge-btn'); // agentB + agentC
    expect(nudgeBtns).toHaveLength(2);

    await act(async () => { fireEvent.click(nudgeBtns[0]); }); // Bob (agentB) — exceptions sorted by name

    await waitFor(() => expect(hoisted.sendComplianceNudge).toHaveBeenCalledWith(['agentB'], WEEK, 'compliance.filing.nudge'));
    // The nudged row flips to a cooldown chip ("Nudged just now").
    await waitFor(() => expect(screen.getAllByTestId('compliance-cooldown-chip').length).toBeGreaterThan(0));
    expect(screen.getByText(/Nudged just now/)).toBeInTheDocument();
  });

  test('cooldown chip renders from an existing nudge record (persists across reload)', async () => {
    hoisted.getNudgeRecords.mockResolvedValue({ agentB: Date.now(), agentC: null });
    renderPanel();
    // agentB has a fresh record → chip; agentC has none → button.
    await waitFor(() => expect(screen.getAllByTestId('compliance-cooldown-chip')).toHaveLength(1));
    expect(screen.getAllByTestId('compliance-nudge-btn')).toHaveLength(1);
  });

  test('Nudge-all confirm names count + scope; cancel does NOT fire; confirm fires CF with all uids', async () => {
    renderPanel();
    const nudgeAll = await screen.findByTestId('compliance-nudge-all');
    expect(nudgeAll).toHaveTextContent('Nudge all 2');

    await act(async () => { fireEvent.click(nudgeAll); });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Nudge 2 agents\?/)).toBeInTheDocument();
    expect(within(dialog).getByText(/South Branch/)).toBeInTheDocument();

    // Cancel → no CF call.
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i })); });
    expect(hoisted.sendComplianceNudge).not.toHaveBeenCalled();

    // Reopen → confirm → CF fires with both not-in uids.
    await act(async () => { fireEvent.click(screen.getByTestId('compliance-nudge-all')); });
    const dialog2 = await screen.findByRole('dialog');
    await act(async () => { fireEvent.click(within(dialog2).getByRole('button', { name: /send 2 nudges/i })); });
    await waitFor(() => expect(hoisted.sendComplianceNudge).toHaveBeenCalledWith(['agentB', 'agentC'], WEEK, 'compliance.filing.nudge'));
  });

  test('Unlock action calls unlockSubmission with the submission id behind the confirm (waiver wiring proof)', async () => {
    renderPanel();
    const unlockBtn = await screen.findByTestId('compliance-unlock-btn'); // only agentA submitted
    await act(async () => { fireEvent.click(unlockBtn); });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Unlock report for editing\?/)).toBeInTheDocument();

    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: /^unlock$/i })); });
    await waitFor(() =>
      expect(hoisted.unlockSubmission).toHaveBeenCalledWith('T', 'subA', 'mgr1', 'Mgr One'));
  });

  test('View action opens the SubmissionViewer with the submission', async () => {
    renderPanel();
    const viewBtn = await screen.findByTestId('compliance-view-btn');
    await act(async () => { fireEvent.click(viewBtn); });
    const viewer = await screen.findByTestId('submission-viewer');
    expect(viewer).toHaveTextContent('viewing:subA');
  });

  test('submitted rows get View + Unlock; not-in rows do not', async () => {
    renderPanel();
    await screen.findByTestId('compliance-nudge-all');
    expect(screen.getAllByTestId('compliance-row-actions')).toHaveLength(1); // agentA only
  });
});
