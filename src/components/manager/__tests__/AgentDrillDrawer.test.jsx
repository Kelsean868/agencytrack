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
    companyFloor: { api: 200000 },
    branchTarget: { api: 280000 },
    unitTarget: { api: 320000 },
    personal: { api: 250000 },
  }),
}));
vi.mock('../../../services/persistencyService', () => ({
  getAgentHistory: vi.fn().mockResolvedValue([]),
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
  });

  it('Goals tab degrades to a neutral state when the cascade read is denied', async () => {
    getGoalHierarchy.mockResolvedValueOnce(null);
    render(<AgentDrillDrawer agent={agent} submissions={submissions} tenantId="t1" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('drill-tab-goals'));
    expect(await screen.findByTestId('drill-goals-unavailable')).toBeInTheDocument();
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
