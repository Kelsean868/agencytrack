// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/settlementService', () => ({
  getSettlements: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/goalsService', () => ({
  getGoals: vi.fn().mockResolvedValue({ personalAnnualAPI: 250000 }),
  getGoalHierarchy: vi.fn().mockResolvedValue({
    companyFloor: { api: 200000, apps: 40 },
    branchTarget: { api: 280000 },
    unitTarget: { api: 320000 },
    personal: { api: 250000 },
  }),
}));
vi.mock('../../../services/persistencyService', () => ({
  getAgentHistory: vi.fn().mockResolvedValue([]),
}));

const mockUser = { uid: 'bm1' };
const mockRole = 'branch_manager';
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, role: mockRole, tenantId: 't1' }),
}));

vi.mock('../../../services/jointCallsService', () => ({
  getJointCalls: vi.fn().mockResolvedValue([]),
  MEETING_TYPES: [
    { value: 'demonstration', label: 'Demonstration' },
    { value: 'observation', label: 'Observation' },
    { value: 'collaboration', label: 'Collaboration' },
  ],
  NEEDS_COVERED: [
    { value: 'income_protection', label: 'Income Protection' },
    { value: 'other', label: 'Other' },
  ],
}));
vi.mock('../../../services/prospectInfoService', () => ({
  getProspectInfo: vi.fn().mockResolvedValue([]),
}));

// AgentReportView is exercised by its own tests — here we only assert the drill
// hosts it (narrow layout) and threads the agent's submissions into it.
vi.mock('../../profile/AgentReportView', () => ({
  default: (props) => (
    <div data-testid="mock-agent-report" data-layout={props.layout} data-subs={props.submissions.length}>
      report for {props.displayName}
    </div>
  ),
}));

import AgentDrillDrawer from '../AgentDrillDrawer';
import { getSettlements } from '../../../services/settlementService';
import { getGoalHierarchy } from '../../../services/goalsService';
import { getAgentHistory } from '../../../services/persistencyService';
import { getJointCalls } from '../../../services/jointCallsService';
import { getProspectInfo } from '../../../services/prospectInfoService';

const agent = {
  agentId: 'a1', name: 'Devin Lewis', initials: 'DL', unitId: 'S02',
  type: 'floor', tone: 'danger', kind: 'Below floor',
  ytdApi: 30000, floor: 200000, expectedByNow: 99726, spark: [40, 30, 22],
  contractStartDate: null, detail: 'behind floor pace', meta: 'Floor TTD 200,000',
};

const submissions = [
  { agentId: 'a1', weekStarting: '2026-06-28', apiSold: 30000, status: 'submitted' },
];

describe('AgentDrillDrawer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens with dialog semantics, header identity and the exception badge', () => {
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
    const dlg = screen.getByTestId('agent-drill-drawer');
    expect(dlg).toHaveAttribute('role', 'dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Devin Lewis')).toBeInTheDocument();
    expect(screen.getByText('Below floor')).toBeInTheDocument();
  });

  it('lazy-loads per-agent settlements / persistency / goal cascade on open', async () => {
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
    await waitFor(() => {
      expect(getSettlements).toHaveBeenCalledWith('t1', 'a1', new Date().getFullYear());
      expect(getAgentHistory).toHaveBeenCalledWith('t1', 'a1');
      expect(getGoalHierarchy).toHaveBeenCalledWith('t1', 'S02', new Date().getFullYear(), 'a1');
    });
  });

  it('Overview tab derives the pace/why-flagged coaching view', () => {
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
    expect(screen.getByTestId('drill-overview-hero')).toBeInTheDocument();
    expect(screen.getByText(/why flagged/i)).toBeInTheDocument();
  });

  it('Report tab hosts AgentReportView (narrow) fed with the agent submissions', async () => {
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
    await waitFor(() => expect(getSettlements).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('drill-tab-report'));
    const report = await screen.findByTestId('mock-agent-report');
    expect(report).toHaveAttribute('data-layout', 'narrow');
    expect(report).toHaveAttribute('data-subs', '1');
    expect(report).toHaveTextContent('Devin Lewis');
  });

  it('Goals tab renders the cascade from the hierarchy read', async () => {
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('drill-tab-goals'));
    const cascade = await screen.findByTestId('drill-goals-cascade');
    expect(cascade).toBeInTheDocument();
    expect(screen.getByTestId('drill-goal-2')).toHaveTextContent(/280[.,]?000/); // branch target
    expect(screen.getByTestId('drill-goal-3')).toHaveTextContent(/200[.,]?000/); // company floor
    expect(screen.getByTestId('drill-goal-3')).toHaveTextContent('· 40 apps'); // company apps minimum
  });

  it('Goals tab degrades to a neutral state when the cascade read is denied', async () => {
    getGoalHierarchy.mockResolvedValueOnce(null);
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('drill-tab-goals'));
    expect(await screen.findByTestId('drill-goals-unavailable')).toBeInTheDocument();
  });

  describe('Joint Work tab', () => {
    it('renders the tab and fetches read-only via the caller identity from useAuth', async () => {
      getJointCalls.mockResolvedValue([]);
      getProspectInfo.mockResolvedValue([]);
      render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
      fireEvent.click(screen.getByTestId('drill-tab-jointwork'));
      await waitFor(() => {
        expect(getJointCalls).toHaveBeenCalledWith({ tenantId: 't1', agentId: 'a1', callerRole: 'branch_manager', callerUid: 'bm1' });
        expect(getProspectInfo).toHaveBeenCalledWith({ tenantId: 't1', agentId: 'a1', callerRole: 'branch_manager', callerUid: 'bm1' });
      });
    });

    it('shows a loading skeleton while the reads are pending', () => {
      getJointCalls.mockReturnValue(new Promise(() => {}));
      getProspectInfo.mockReturnValue(new Promise(() => {}));
      render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
      fireEvent.click(screen.getByTestId('drill-tab-jointwork'));
      expect(screen.getByTestId('drill-jointwork-loading')).toBeInTheDocument();
    });

    it('shows an error card with Retry when the read fails, and Retry re-fetches', async () => {
      getJointCalls.mockRejectedValueOnce(new Error('denied'));
      getProspectInfo.mockResolvedValue([]);
      render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
      fireEvent.click(screen.getByTestId('drill-tab-jointwork'));
      expect(await screen.findByTestId('drill-jointwork-error')).toBeInTheDocument();

      getJointCalls.mockResolvedValueOnce([]);
      fireEvent.click(screen.getByTestId('drill-jointwork-retry'));
      expect(await screen.findByTestId('drill-jointwork-empty')).toBeInTheDocument();
    });

    it('shows the honest empty state when there are no preps or calls', async () => {
      getJointCalls.mockResolvedValue([]);
      getProspectInfo.mockResolvedValue([]);
      render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
      fireEvent.click(screen.getByTestId('drill-tab-jointwork'));
      const empty = await screen.findByTestId('drill-jointwork-empty');
      expect(empty).toHaveTextContent('No joint work logged');
    });

    it('renders the prep + call log + summary counts when data is present, and stays read-only (no add/edit/archive controls)', async () => {
      getJointCalls.mockResolvedValue([
        {
          id: 'c1', agentId: 'a1', meetingType: 'observation', needCovered: 'income_protection',
          appointmentDate: '2026-06-21', appointmentKept: true, saleMade: false, coachingMinutes: 25,
          comments: 'Devin led; I observed.', archived: false,
        },
        {
          id: 'c2', agentId: 'a1', meetingType: 'demonstration', needCovered: 'other',
          appointmentDate: '2026-06-14', appointmentKept: true, saleMade: true, coachingMinutes: 40,
          comments: '', archived: false,
        },
        {
          id: 'c3', agentId: 'a1', meetingType: 'observation', needCovered: 'other',
          appointmentDate: '2026-06-01', appointmentKept: false, saleMade: false, coachingMinutes: 0,
          comments: '', archived: true, // archived — must be excluded
        },
      ]);
      getProspectInfo.mockResolvedValue([
        { id: 'p1', clientName: 'Anita Gopaul', appointmentType: 'closing-interview', policyType: 'whole-life', intendedAppointmentDate: '2026-06-28' },
      ]);
      render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
      fireEvent.click(screen.getByTestId('drill-tab-jointwork'));

      const list = await screen.findByTestId('drill-jointwork-list');
      expect(list).toBeInTheDocument();

      // Summary counts exclude the archived call.
      expect(screen.getByTestId('drill-jointwork-summary-calls')).toHaveTextContent('2');
      expect(screen.getByTestId('drill-jointwork-summary-kept')).toHaveTextContent('2');
      expect(screen.getByTestId('drill-jointwork-summary-sales')).toHaveTextContent('1');

      // Prep row.
      expect(screen.getByTestId('drill-jointwork-prep-row')).toHaveTextContent('Anita Gopaul');

      // Call rows — only the two non-archived calls render.
      expect(screen.getAllByTestId('drill-jointwork-call-row')).toHaveLength(2);
      expect(screen.getByText('Devin led; I observed.')).toBeInTheDocument();

      // Read-only: no write affordances anywhere in the tab body.
      expect(screen.queryByRole('button', { name: /log joint call/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^add$/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/archive joint call/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/edit joint call/i)).not.toBeInTheDocument();
    });
  });

  it('close button and Escape both dismiss', async () => {
    const onClose = vi.fn();
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close coaching view/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
