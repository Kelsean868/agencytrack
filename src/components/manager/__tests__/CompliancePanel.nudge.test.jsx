import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
// do not strip (layer a): userEvent/await not fireEvent — handleNudge is async; fireEvent.click does not drain
// the Promise chain (sendComplianceNudge await → setNudgeRecords) before waitFor polls. d936c69 fixed with
// act(async()=>{fireEvent.click()}); 28968bb (gemini-batch-a) stripped all 8 wrappers as "RTL anti-patterns"
// and flake returned immediately. userEvent default (delay:0) keeps per-step Promise.resolve() yields that hold
// handleNudge ahead of user.click() resolution — do not switch back to bare fireEvent.
// do not strip (layer b): NO delay:null — lab burn confirmed 57% chip-missing solo rate under delay:null:
// user.click() resolved before handleNudge's async continuation drained; RTL waitFor/act() polling did not
// recover the lost setState call. Default delay:0 per-step yields eliminate this failure mode entirely.
// do not strip (layer c): NO manual act()-wrapper strip — d936c69 added wrappers for this exact async race;
// 28968bb stripped them calling them anti-patterns and flake returned. Tripwires document why they must stay.
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
// do not strip: generous timeout for chip assertion — under full-suite load (50× burn, delay:0) per-step
// yields arrive late; ≤2% starvation-timeout at isolated runs 137/141/142 in the 200× burn. 3000ms gives
// 3× the default window. House pattern from 7df1295f (WizardFormV2RetirementR2 WAIT constant). Applied to
// both chip assertions (tests 1 + 2) so both share the same budget under load.
const CHIP_WAIT = { timeout: 3000 };

const USERS = [
  { id: 'agentA', name: 'Ann Agent',  role: 'agent', unitId: 'u1' },
  { id: 'agentB', name: 'Bob Agent',  role: 'agent', unitId: 'u1' },
  { id: 'agentC', name: 'Cara Agent', role: 'agent', unitId: 'u1' },
];
const SUB_A = { id: 'subA', agentId: 'agentA', status: 'submitted', weekStarting: WEEK, submittedAt: ON_TIME };

function renderPanel() {
  return render(<CompliancePanel selectedWeek={WEEK} setSelectedWeek={() => {}} />);
}

let user; // do not strip: userEvent instance, initialized per-test in beforeEach — see userEvent import above

beforeEach(() => {
  user = userEvent.setup(); // do not strip: TIMING-RACE flake fix (layers a+b+c) — NO delay:null, see import comment
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

    await user.click(nudgeBtns[0]); // do not strip: TIMING-RACE flake fix — see import comment; Bob (agentB)

    await waitFor(() => expect(hoisted.sendComplianceNudge).toHaveBeenCalledWith(['agentB'], WEEK, 'compliance.filing.nudge'));
    // The nudged row flips to a cooldown chip ("Nudged just now").
    // do not strip: findByTestId+CHIP_WAIT — 7df1295f house pattern; default 1000ms too short under suite load.
    await screen.findByTestId('compliance-cooldown-chip', undefined, CHIP_WAIT);
    expect(screen.getByText(/Nudged just now/)).toBeInTheDocument();
  });

  test('cooldown chip renders from an existing nudge record (persists across reload)', async () => {
    hoisted.getNudgeRecords.mockResolvedValue({ agentB: Date.now(), agentC: null });
    renderPanel();
    // agentB has a fresh record → chip; agentC has none → button.
    // do not strip: CHIP_WAIT — same 3000ms house pattern as test 1 (both assertions share the budget).
    await waitFor(() => expect(screen.getAllByTestId('compliance-cooldown-chip')).toHaveLength(1), CHIP_WAIT);
    expect(screen.getAllByTestId('compliance-nudge-btn')).toHaveLength(1);
  });

  test('Nudge-all confirm names count + scope; cancel does NOT fire; confirm fires CF with all uids', async () => {
    renderPanel();
    const nudgeAll = await screen.findByTestId('compliance-nudge-all');
    expect(nudgeAll).toHaveTextContent('Nudge all 2');

    await user.click(nudgeAll); // do not strip: TIMING-RACE flake fix — see import comment
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Nudge 2 agents\?/)).toBeInTheDocument();
    expect(within(dialog).getByText(/South Branch/)).toBeInTheDocument();

    // Cancel → no CF call.
    await user.click(within(dialog).getByRole('button', { name: /cancel/i })); // do not strip: TIMING-RACE flake fix
    expect(hoisted.sendComplianceNudge).not.toHaveBeenCalled();

    // Reopen → confirm → CF fires with both not-in uids.
    await user.click(screen.getByTestId('compliance-nudge-all')); // do not strip: TIMING-RACE flake fix
    const dialog2 = await screen.findByRole('dialog');
    await user.click(within(dialog2).getByRole('button', { name: /send 2 nudges/i })); // do not strip: TIMING-RACE flake fix
    await waitFor(() => expect(hoisted.sendComplianceNudge).toHaveBeenCalledWith(['agentB', 'agentC'], WEEK, 'compliance.filing.nudge'));
  });

  test('Unlock action calls unlockSubmission with the submission id behind the confirm (waiver wiring proof)', async () => {
    renderPanel();
    const unlockBtn = await screen.findByTestId('compliance-unlock-btn'); // only agentA submitted
    await user.click(unlockBtn); // do not strip: TIMING-RACE flake fix
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Unlock report for editing\?/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^unlock$/i })); // do not strip: TIMING-RACE flake fix
    await waitFor(() =>
      expect(hoisted.unlockSubmission).toHaveBeenCalledWith('T', 'subA', 'mgr1', 'Mgr One'));
  });

  test('View action opens the SubmissionViewer with the submission', async () => {
    renderPanel();
    const viewBtn = await screen.findByTestId('compliance-view-btn');
    await user.click(viewBtn); // do not strip: TIMING-RACE flake fix
    const viewer = await screen.findByTestId('submission-viewer');
    expect(viewer).toHaveTextContent('viewing:subA');
  });

  test('submitted rows get View + Unlock; not-in rows do not', async () => {
    renderPanel();
    await screen.findByTestId('compliance-nudge-all');
    expect(screen.getAllByTestId('compliance-row-actions')).toHaveLength(1); // agentA only
  });
});
