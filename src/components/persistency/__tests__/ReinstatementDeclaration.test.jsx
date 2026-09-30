/**
 * FR-6 "Mark reinstated" (Option A) — the UI surfaces:
 *   · ReinstatementDeclarationControl (shared by the ledger drawer and the FR-3 planner)
 *   · the FR-3 planner: two figures in the header, the control on own lapsed rows
 *   · the ledger drawer: the control on an own lapsed policy, event history words
 *   · the Nexus Persistency hero: "with your declared reinstatements" beside the estimate
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  authValue: { tenantId: 't1', user: { uid: 'a1' } },
  getPolicyHistory: vi.fn(),
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../services/policiesService', () => ({
  getPolicyHistory: (...a) => hoisted.getPolicyHistory(...a),
}));
vi.mock('../../../services/prospectInfoService', () => ({ PROSPECTING_SOURCE_LABELS: {} }));

import ReinstatementDeclarationControl, { DeclaredReinstatedChip } from '../ReinstatementDeclaration';
import ReinstatementPlanner from '../../fr/money/ReinstatementPlanner';
import PolicyDrillDrawer from '../../agent/policyLedger/PolicyDrillDrawer';
import PersistencyOutlookHero from '../PersistencyOutlookHero';
import { reinstatementPlan } from '../../../lib/fr/moneyModel';
import { buildPersistencyOutlook } from '../../../lib/persistency/persistencyOutlook';

const ts = (iso) => ({ toDate: () => new Date(iso) });
const DECLARATION = { reinstatementDeclaredAt: ts('2026-09-12T16:00:00Z'), reinstatementDeclaredBy: 'a1', reinstatementNote: 'Receipt 4471' };
const TODAY = '2026-09-20';
function pol(n, status, api, dateIssued, extra = {}) {
  return { id: `doc-${n}`, agentId: 'a1', policyNumber: n, status, proposedAPI: api, dateIssued, productLine: 'life', ...extra };
}
const LEDGER = [
  pol('S1', 'settled', 100000, '2025-06-01'),
  pol('L1', 'lapsed', 5000, '2025-01-10', { ownerName: '[Client A]', ...DECLARATION }),
  pol('L2', 'lapsed', 3000, '2024-11-05'),
  pol('L4', 'lapsed', 4000, '2025-03-01'),
];

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getPolicyHistory.mockResolvedValue([]);
});

describe('ReinstatementDeclarationControl', () => {
  it('Mark reinstated opens a form; Confirm sends the trimmed note', () => {
    const onDeclare = vi.fn();
    render(<ReinstatementDeclarationControl declaration={null} onDeclare={onDeclare} onWithdraw={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark reinstated' }));
    const input = screen.getByLabelText('Receipt or reference (optional)');
    expect(input).toHaveAttribute('maxLength', '200');
    fireEvent.change(input, { target: { value: '  Receipt 9  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm — mark reinstated' }));
    expect(onDeclare).toHaveBeenCalledWith('Receipt 9');
  });

  it('Cancel closes the form without writing', () => {
    const onDeclare = vi.fn();
    render(<ReinstatementDeclarationControl declaration={null} onDeclare={onDeclare} onWithdraw={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark reinstated' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDeclare).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mark reinstated' })).toBeInTheDocument();
  });

  it('a declaration reads "waiting for head office" with its date and note, and offers Withdraw', () => {
    const onWithdraw = vi.fn();
    render(<ReinstatementDeclarationControl declaration={{ on: '2026-10-12', note: 'Receipt 4471', unconfirmed: false }} onDeclare={vi.fn()} onWithdraw={onWithdraw} />);
    expect(screen.getByText('Reinstated — waiting for head office (declared 12 Oct 2026)')).toBeInTheDocument();
    expect(screen.getByText('Note: Receipt 4471')).toBeInTheDocument();
    expect(screen.queryByText(/Not confirmed by head office/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('an unconfirmed declaration says so; a write error shows as an alert', () => {
    render(<ReinstatementDeclarationControl declaration={{ on: '2026-07-01', note: null, unconfirmed: true }} onDeclare={vi.fn()} onWithdraw={vi.fn()} error="Missing or insufficient permissions." />);
    expect(screen.getByText('Not confirmed by head office after 60 days')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Missing or insufficient permissions.');
  });

  it('the ledger chip', () => {
    render(<DeclaredReinstatedChip />);
    expect(screen.getByTestId('declared-reinstated-chip')).toHaveTextContent('Declared reinstated');
  });
});

describe('ReinstatementPlanner — FR-6', () => {
  const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });

  it('shows the evidenced figure and, beside it, the figure with declared reinstatements (2 dp)', () => {
    render(<ReinstatementPlanner plan={plan} />);
    // gross 112,000 − lapses 12,000 = 100,000 → 89.29 %; + 5,000 declared → 93.75 %
    expect(screen.getByTestId('planner-declared')).toHaveTextContent(
      '89.29% evidenced · with your declared reinstatements 93.75% (1 policy, waiting for head office)',
    );
  });

  it('no declaration → no second figure', () => {
    const plain = reinstatementPlan({ policies: LEDGER.map(({ reinstatementDeclaredAt: _a, reinstatementDeclaredBy: _b, reinstatementNote: _c, ...p }) => p), todayTT: TODAY });
    render(<ReinstatementPlanner plan={plain} />);
    expect(screen.queryByTestId('planner-declared')).toBeNull();
  });

  it('without actions the rows are read-only: a declared row says so, no buttons', () => {
    render(<ReinstatementPlanner plan={plan} />);
    expect(screen.getByTestId('planner-reinstate-L1-declared')).toHaveTextContent('Reinstated — waiting for head office');
    expect(screen.queryByRole('button', { name: 'Mark reinstated' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('with actions: Mark reinstated on undeclared own rows, Withdraw on the declared one; calls carry the doc id', () => {
    const actions = { canAct: vi.fn(() => true), declare: vi.fn(), withdraw: vi.fn(), busyId: null, errorFor: () => null };
    render(<ReinstatementPlanner plan={plan} actions={actions} />);
    expect(screen.getAllByRole('button', { name: 'Mark reinstated' })).toHaveLength(2); // L2, L4
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(actions.withdraw).toHaveBeenCalledWith('doc-L1');
    fireEvent.click(screen.getByTestId('planner-reinstate-L2-mark'));
    fireEvent.click(screen.getByTestId('planner-reinstate-L2-confirm'));
    expect(actions.declare).toHaveBeenCalledWith('doc-L2', '');
  });

  it('a row the user cannot act on gets no control', () => {
    const actions = { canAct: vi.fn((id) => id !== 'doc-L2'), declare: vi.fn(), withdraw: vi.fn(), busyId: null, errorFor: () => null };
    render(<ReinstatementPlanner plan={plan} actions={actions} />);
    expect(screen.queryByTestId('planner-reinstate-L2-mark')).toBeNull();
    expect(screen.getByTestId('planner-reinstate-L4-mark')).toBeInTheDocument();
  });
});

describe('PolicyDrillDrawer — FR-6', () => {
  const lapsed = {
    id: 'p1', agentId: 'a1', ownerName: 'Test Owner', status: 'lapsed', statusSource: 'oipa_import',
    proposedAPI: 5000, productLine: 'life', policyNumber: 'TRM1',
  };

  it('own lapsed policy: the Reinstatement section offers Mark reinstated', () => {
    const onDeclare = vi.fn();
    render(<PolicyDrillDrawer policy={lapsed} onClose={vi.fn()} onTransition={vi.fn()} onDeclareReinstatement={onDeclare} onWithdrawReinstatement={vi.fn()} />);
    expect(screen.getByTestId('drawer-reinstatement')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark reinstated' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm — mark reinstated' }));
    expect(onDeclare).toHaveBeenCalledWith('');
  });

  it('declared: Withdraw; the status pill still reads lapsed', () => {
    const onWithdraw = vi.fn();
    render(<PolicyDrillDrawer policy={{ ...lapsed, ...DECLARATION }} onClose={vi.fn()} onTransition={vi.fn()} onDeclareReinstatement={vi.fn()} onWithdrawReinstatement={onWithdraw} />);
    expect(screen.getByText(/Reinstated — waiting for head office \(declared 12 Sep 2026\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('no handlers (not the owner / role not admitted): no control; a declaration is read-only', () => {
    const { rerender } = render(<PolicyDrillDrawer policy={lapsed} onClose={vi.fn()} onTransition={vi.fn()} />);
    expect(screen.queryByTestId('drawer-reinstatement')).toBeNull();
    rerender(<PolicyDrillDrawer policy={{ ...lapsed, ...DECLARATION }} onClose={vi.fn()} onTransition={vi.fn()} />);
    expect(screen.getByTestId('drawer-reinstate-declared')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('a settled policy never shows the Reinstatement section', () => {
    render(<PolicyDrillDrawer policy={{ ...lapsed, status: 'settled' }} onClose={vi.fn()} onTransition={vi.fn()} onDeclareReinstatement={vi.fn()} onWithdrawReinstatement={vi.fn()} />);
    expect(screen.queryByTestId('drawer-reinstatement')).toBeNull();
  });

  it('history names the declaration events in words', async () => {
    hoisted.getPolicyHistory.mockResolvedValue([
      { id: 'h1', fromStatus: 'lapsed', toStatus: 'lapsed', event: 'reinstatement_declared', actorRole: 'agent', at: ts('2026-09-12T16:00:00Z') },
      { id: 'h2', fromStatus: 'lapsed', toStatus: 'lapsed', event: 'reinstatement_withdrawn', actorRole: 'agent', at: ts('2026-09-13T16:00:00Z') },
    ]);
    render(<PolicyDrillDrawer policy={lapsed} onClose={vi.fn()} onTransition={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Marked reinstated')).toBeInTheDocument());
    expect(screen.getByText('Reinstatement withdrawn')).toBeInTheDocument();
  });
});

describe('PersistencyOutlookHero — FR-6', () => {
  it('shows "with your declared reinstatements" beside the evidenced estimate', () => {
    const outlook = buildPersistencyOutlook({ policies: LEDGER, today: TODAY });
    render(<PersistencyOutlookHero outlook={outlook} />);
    expect(screen.getByTestId('persistency-outlook-declared')).toHaveTextContent(
      'With your declared reinstatements: 93.75% (1 policy, waiting for head office · evidenced 89.29%)',
    );
    // The evidenced estimate itself is unchanged.
    expect(screen.getByTestId('persistency-outlook-estimate-pct')).toHaveTextContent('89.29%');
  });

  it('no declaration → no declared line', () => {
    const outlook = buildPersistencyOutlook({ policies: LEDGER.filter((p) => p.policyNumber !== 'L1'), today: TODAY });
    render(<PersistencyOutlookHero outlook={outlook} />);
    expect(screen.queryByTestId('persistency-outlook-declared')).toBeNull();
  });
});
