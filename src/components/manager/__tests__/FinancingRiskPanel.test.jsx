import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { role: 'branch_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  listFinancingMonths: vi.fn(),
  getFinancingConfig: vi.fn(),
  notifyFinancingAdjustment: vi.fn(),
  getFinancingNotifyRecord: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../hooks/useToast', () => ({ default: () => ({ show: hoisted.showToast, dismiss: vi.fn() }) }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));
vi.mock('../../../services/financingService', () => ({ listFinancingMonths: (...a) => hoisted.listFinancingMonths(...a) }));
vi.mock('../../../services/financingConfigService', () => ({ getFinancingConfig: (...a) => hoisted.getFinancingConfig(...a) }));
vi.mock('../../../services/financingNotifyService', () => ({
  notifyFinancingAdjustment: (...a) => hoisted.notifyFinancingAdjustment(...a),
  getFinancingNotifyRecord: (...a) => hoisted.getFinancingNotifyRecord(...a),
  FINANCING_NOTIFY_COOLDOWN_MS: 24 * 60 * 60 * 1000,
}));

import FinancingRiskPanel from '../FinancingRiskPanel';

// Confirmed-basis row helpers.
const miss = (month) => ({ month, actualAPI: 20000, validatingAPI: 30000, basisSource: 'settled-confirmed' });
const meet = (month) => ({ month, actualAPI: 31000, validatingAPI: 30000, basisSource: 'settled-confirmed' });
const flagRow = (month, adjustmentPct) => ({ month, actualAPI: 30000, validatingAPI: 30000, basisSource: 'settled-confirmed', managerFinancing: 1000, adjustmentPct });
// A >10% cut on a PROVISIONAL (unconfirmed) basis — the CF rejects this as
// condition-not-met, so the panel must not surface a clickable Notify for it.
const provisionalFlagRow = (month, adjustmentPct) => ({ month, actualAPI: 30000, validatingAPI: 30000, basisSource: 'submitted-provisional', managerFinancing: 1000, adjustmentPct });

async function selectAgent() {
  await waitFor(() => expect(screen.getByTestId('financing-risk-agent-select')).toBeInTheDocument());
  fireEvent.change(screen.getByTestId('financing-risk-agent-select'), { target: { value: 'agent-1' } });
}

// CI resource-contention flake fix (banked FOLLOW_UPS.md; 3rd timeout occurrence
// at PR #802). Several tests here chain multiple sequential `waitFor`/`findBy`
// drains (mount → agent-select → ledger load → notify CF → cooldown read).
// `test-setup.js` sets RTL `asyncUtilTimeout: 5000`, which equals vitest's default
// 5000ms per-test budget — so on a starved CI runner a single slow poll can eat
// the whole test's time window even though every service mock resolves instantly,
// producing a test-level timeout (observed 5022ms) rather than an assertion
// failure. Raising the file's per-test timeout gives the async chain headroom;
// a genuine hang still fails (at 15s). Test-only — no product or behavior change.
vi.setConfig({ testTimeout: 15000 });

describe('FinancingRiskPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authValue = { role: 'branch_manager', tenantId: 't1' };
    hoisted.getTenantUsers.mockResolvedValue([{ id: 'agent-1', name: 'Ana Agent', role: 'agent' }]);
    hoisted.listFinancingMonths.mockResolvedValue([]);
    hoisted.getFinancingConfig.mockResolvedValue({ notifyRecipientUid: 'cro-1' });
    hoisted.getFinancingNotifyRecord.mockResolvedValue(null);
    hoisted.notifyFinancingAdjustment.mockResolvedValue({ success: true, recipientUid: 'cro-1' });
  });

  it('gates non-managers (UM) out of the monitor', () => {
    hoisted.authValue = { role: 'unit_manager', tenantId: 't1' };
    render(<FinancingRiskPanel />);
    expect(screen.getByText(/available to Branch Managers and above/i)).toBeInTheDocument();
  });

  it('shows an empty-ledger prompt when the agent has no confirmed months', async () => {
    render(<FinancingRiskPanel />);
    await selectAgent();
    await waitFor(() => expect(screen.getByText(/No financing ledger for/i)).toBeInTheDocument());
  });

  it('amber at 2 consecutive misses', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([miss('2026_01'), miss('2026_02')]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    const monitor = await screen.findByTestId('financing-risk-miss-monitor');
    expect(monitor).toHaveAttribute('data-severity', 'amber');
    expect(monitor).toHaveAttribute('data-count', '2');
    expect(screen.queryByTestId('financing-risk-termination-flag')).not.toBeInTheDocument();
  });

  it('critical at 3 — surfaces the 7.2c condition-met flag (FLAG ONLY)', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([miss('2026_01'), miss('2026_02'), miss('2026_03')]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    const monitor = await screen.findByTestId('financing-risk-miss-monitor');
    expect(monitor).toHaveAttribute('data-severity', 'critical');
    const flag = screen.getByTestId('financing-risk-termination-flag');
    expect(flag).toHaveTextContent(/not an automatic termination/i);
  });

  it('a confirmed meet resets the streak', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([miss('2026_01'), miss('2026_02'), meet('2026_03')]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    const monitor = await screen.findByTestId('financing-risk-miss-monitor');
    expect(monitor).toHaveAttribute('data-count', '0');
    expect(monitor).toHaveAttribute('data-severity', 'none');
  });

  it('surfaces the >10% flag + notify affordance for a flagged month', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([flagRow('2026_05', 0.14)]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    const flag = await screen.findByTestId('financing-risk-adjustment-flag');
    expect(flag).toHaveAttribute('data-month', '2026_05');
    expect(screen.getByTestId('financing-risk-adjustment-pct')).toHaveTextContent('−14%');
    expect(screen.getByTestId('financing-notify-btn')).toBeEnabled();
  });

  it('does NOT flag a <=10% routine adjustment', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([flagRow('2026_05', 0.05)]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    await waitFor(() => expect(screen.getByText(/No .*10% downward adjustments flagged/i)).toBeInTheDocument());
    expect(screen.queryByTestId('financing-notify-btn')).not.toBeInTheDocument();
  });

  it('does NOT surface a notify affordance for a PROVISIONAL >10% month (CF gate parity)', async () => {
    // A provisional cut past 10% is unconfirmed — the CF returns condition-not-met
    // and writes nothing. The panel must filter it out so no dead-end Notify shows.
    hoisted.listFinancingMonths.mockResolvedValue([provisionalFlagRow('2026_05', 0.14)]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    await waitFor(() => expect(screen.getByText(/No .*10% downward adjustments flagged/i)).toBeInTheDocument());
    expect(screen.queryByTestId('financing-risk-adjustment-flag')).not.toBeInTheDocument();
    expect(screen.queryByTestId('financing-notify-btn')).not.toBeInTheDocument();
  });

  it('ignores a more-recent PROVISIONAL flag and surfaces the CONFIRMED month as the active duty', async () => {
    // Confirmed 0.14 cut at 2026_05 + a later provisional 0.18 cut at 2026_07.
    // The confirmed-basis filter must run BEFORE the most-recent selection, so the
    // active duty is the confirmed 2026_05 — NOT the more-recent provisional 2026_07.
    hoisted.listFinancingMonths.mockResolvedValue([
      flagRow('2026_05', 0.14),
      provisionalFlagRow('2026_07', 0.18),
    ]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    const flag = await screen.findByTestId('financing-risk-adjustment-flag');
    expect(flag).toHaveAttribute('data-month', '2026_05');
    expect(screen.getByTestId('financing-risk-adjustment-pct')).toHaveTextContent('−14%');
    expect(screen.getByTestId('financing-notify-btn')).toBeEnabled();
  });

  it('disables the affordance with a "no recipient configured" state when unset', async () => {
    hoisted.getFinancingConfig.mockResolvedValue({ notifyRecipientUid: null });
    hoisted.listFinancingMonths.mockResolvedValue([flagRow('2026_05', 0.14)]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    await screen.findByTestId('financing-risk-adjustment-flag');
    expect(screen.getByTestId('financing-notify-no-recipient')).toBeInTheDocument();
    expect(screen.queryByTestId('financing-notify-btn')).not.toBeInTheDocument();
  });

  it('fires the notify CF and shows the cooldown after a successful notify', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([flagRow('2026_05', 0.14)]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    const btn = await screen.findByTestId('financing-notify-btn');
    fireEvent.click(btn);
    await waitFor(() => expect(hoisted.notifyFinancingAdjustment).toHaveBeenCalledWith(
      'agent-1', '2026_05', expect.objectContaining({ adjustmentPct: 0.14 }),
    ));
    await waitFor(() => expect(screen.getByTestId('financing-notify-cooldown')).toBeInTheDocument());
    expect(hoisted.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('renders the cooldown (button disabled) when a recent notify record exists', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([flagRow('2026_05', 0.14)]);
    hoisted.getFinancingNotifyRecord.mockResolvedValue(Date.now() - 1000); // 1s ago → within 24h
    render(<FinancingRiskPanel />);
    await selectAgent();
    await screen.findByTestId('financing-risk-adjustment-flag');
    await waitFor(() => expect(screen.getByTestId('financing-notify-cooldown')).toBeInTheDocument());
    expect(screen.getByTestId('financing-notify-btn')).toBeDisabled();
  });

  it('uses the most recent flagged month as the active duty', async () => {
    hoisted.listFinancingMonths.mockResolvedValue([flagRow('2026_03', 0.12), flagRow('2026_07', 0.18)]);
    render(<FinancingRiskPanel />);
    await selectAgent();
    const flag = await screen.findByTestId('financing-risk-adjustment-flag');
    expect(flag).toHaveAttribute('data-month', '2026_07');
    expect(screen.getByTestId('financing-risk-adjustment-pct')).toHaveTextContent('−18%');
  });

  // ── Async switch races (latestAgentReqRef guard) ──────────────────────────
  it('drops a stale ledger load when the agent is switched mid-flight', async () => {
    hoisted.getTenantUsers.mockResolvedValue([
      { id: 'agent-1', name: 'Ana Agent', role: 'agent' },
      { id: 'agent-2', name: 'Bob Agent', role: 'agent' },
    ]);
    let resolveAgent1;
    hoisted.listFinancingMonths.mockImplementation((_t, agentId) =>
      agentId === 'agent-1'
        ? new Promise((res) => { resolveAgent1 = res; }) // hangs until we resolve it
        : Promise.resolve([]),                            // agent-2: empty ledger
    );
    render(<FinancingRiskPanel />);
    await waitFor(() => expect(screen.getByTestId('financing-risk-agent-select')).toBeInTheDocument());

    // Select agent-1 (load hangs), then switch to agent-2 (resolves empty).
    fireEvent.change(screen.getByTestId('financing-risk-agent-select'), { target: { value: 'agent-1' } });
    fireEvent.change(screen.getByTestId('financing-risk-agent-select'), { target: { value: 'agent-2' } });
    await waitFor(() => expect(screen.getByText(/No financing ledger for Bob Agent/i)).toBeInTheDocument());

    // The stale agent-1 load now resolves with a critical 3-miss ledger — it must
    // NOT paint agent-1's termination flag onto agent-2's view.
    resolveAgent1([miss('2026_01'), miss('2026_02'), miss('2026_03')]);
    await waitFor(() => expect(screen.getByText(/No financing ledger for Bob Agent/i)).toBeInTheDocument());
    expect(screen.queryByTestId('financing-risk-termination-flag')).not.toBeInTheDocument();
    expect(screen.queryByTestId('financing-risk-miss-monitor')).not.toBeInTheDocument();
  });

  it('does not stamp the cooldown on a new agent when a notify resolves after a switch', async () => {
    hoisted.getTenantUsers.mockResolvedValue([
      { id: 'agent-1', name: 'Ana Agent', role: 'agent' },
      { id: 'agent-2', name: 'Bob Agent', role: 'agent' },
    ]);
    hoisted.listFinancingMonths.mockImplementation((_t, agentId) =>
      agentId === 'agent-1' ? Promise.resolve([flagRow('2026_05', 0.14)]) : Promise.resolve([]),
    );
    let resolveNotify;
    hoisted.notifyFinancingAdjustment.mockImplementation(() => new Promise((res) => { resolveNotify = res; }));
    render(<FinancingRiskPanel />);
    await waitFor(() => expect(screen.getByTestId('financing-risk-agent-select')).toBeInTheDocument());

    // Fire the notify for agent-1 (CF in flight), then switch to agent-2.
    fireEvent.change(screen.getByTestId('financing-risk-agent-select'), { target: { value: 'agent-1' } });
    const btn = await screen.findByTestId('financing-notify-btn');
    fireEvent.click(btn);
    fireEvent.change(screen.getByTestId('financing-risk-agent-select'), { target: { value: 'agent-2' } });
    await waitFor(() => expect(screen.getByText(/No financing ledger for Bob Agent/i)).toBeInTheDocument());

    // The stale notify success must NOT paint a cooldown chip on agent-2's view.
    resolveNotify({ success: true, recipientUid: 'cro-1' });
    await waitFor(() => expect(screen.getByText(/No financing ledger for Bob Agent/i)).toBeInTheDocument());
    expect(screen.queryByTestId('financing-notify-cooldown')).not.toBeInTheDocument();
  });

  it('clears ledger-derived state on switch so no mismatched cooldown read fires', async () => {
    hoisted.getTenantUsers.mockResolvedValue([
      { id: 'agent-1', name: 'Ana Agent', role: 'agent' },
      { id: 'agent-2', name: 'Bob Agent', role: 'agent' },
    ]);
    hoisted.listFinancingMonths.mockImplementation((_t, agentId) =>
      agentId === 'agent-1' ? Promise.resolve([flagRow('2026_05', 0.14)]) : Promise.resolve([]),
    );
    render(<FinancingRiskPanel />);
    await waitFor(() => expect(screen.getByTestId('financing-risk-agent-select')).toBeInTheDocument());

    // agent-1 carries a flag at 2026_05.
    fireEvent.change(screen.getByTestId('financing-risk-agent-select'), { target: { value: 'agent-1' } });
    await screen.findByTestId('financing-risk-adjustment-flag');
    hoisted.getFinancingNotifyRecord.mockClear();

    // Switching to agent-2 must clear the derived activeFlag immediately — the
    // cooldown read must NEVER fire with the new agent + the previous agent's month.
    fireEvent.change(screen.getByTestId('financing-risk-agent-select'), { target: { value: 'agent-2' } });
    await waitFor(() => expect(screen.getByText(/No financing ledger for Bob Agent/i)).toBeInTheDocument());
    expect(hoisted.getFinancingNotifyRecord).not.toHaveBeenCalledWith('t1', 'agent-2', '2026_05');
  });
});
