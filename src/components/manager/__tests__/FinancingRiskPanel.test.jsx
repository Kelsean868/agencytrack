// Track K · K7 — FinancingRiskPanel (BM branch roster) tests.
//
// The panel was reshaped from a single-agent dropdown into a display-scoped branch
// roster (item 2.8; clause-5.3 notify affordance restored per orchestrator ruling).
// These tests lock: the Compliance-v2 per-agent fan-out read route (once-per-agent,
// not a collection query), the standing status-chip derivation, the branch
// aggregate counts (full read only), partial-fan-out degradation, and the restored
// notify duty: wired for WRITE_ROLES on the CONFIRMED active flag, lazy cooldown
// read per FLAGGED agent only, disabled-with-until-label on cooldown, no-recipient
// disabled state, inline success/failure per §1. The load is deterministic
// (allSettled over a stable input map) — the previous file's agent-switch races
// are gone.
//
// financingService is mocked via importActual so the PURE helpers (financingCeiling,
// financingMonthIndex) and the roster lib keep their real behavior; only the async
// reads are stubbed.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { role: 'branch_manager', tenantId: 't1', user: { uid: 'bm1' }, userProfile: { uid: 'bm1', branchId: 'branchA' } },
  getTenantUsers: vi.fn(),
  getFinancingTerms: vi.fn(),
  listFinancingMonths: vi.fn(),
  getFinancingConfig: vi.fn(),
  notifyFinancingAdjustment: vi.fn(),
  getFinancingNotifyRecord: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));
vi.mock('../../../services/financingService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getFinancingTerms: (...a) => hoisted.getFinancingTerms(...a),
    listFinancingMonths: (...a) => hoisted.listFinancingMonths(...a),
  };
});
vi.mock('../../../services/financingConfigService', () => ({ getFinancingConfig: (...a) => hoisted.getFinancingConfig(...a) }));
vi.mock('../../../services/financingNotifyService', () => ({
  notifyFinancingAdjustment: (...a) => hoisted.notifyFinancingAdjustment(...a),
  getFinancingNotifyRecord: (...a) => hoisted.getFinancingNotifyRecord(...a),
  FINANCING_NOTIFY_COOLDOWN_MS: 24 * 60 * 60 * 1000,
}));

import FinancingRiskPanel from '../FinancingRiskPanel';

// ── Ledger row helpers (settled-confirmed = the miss/flag basis) ──────────────
const missMonth = (month, extra = {}) => ({ month, basisSource: 'settled-confirmed', actualAPI: 10000, validatingAPI: 30000, ...extra });
const meetMonth = (month, extra = {}) => ({ month, basisSource: 'settled-confirmed', actualAPI: 31000, validatingAPI: 30000, ...extra });

const TERMS = (status = 'on_financing') => ({
  financingStatus: status,
  effectiveDate: '2025-12-01',
  agreedMonthlyFinancing: 8000,
  currentMonthlyFinancing: 8000, // ceiling = 6 × 8000 = 48000
});

// Branch fixture: 4 financed agents (amber / behind / clean+flag / clean) + one
// not-on-financing + one cleared (both must be EXCLUDED from the roster).
const USERS = [
  { id: 'a1', name: 'Ana Amber', role: 'agent' },
  { id: 'a2', name: 'Ben Behind', role: 'agent' },
  { id: 'a3', name: 'Cara Cut', role: 'agent' },
  { id: 'a6', name: 'Fay Fine', role: 'agent' },
  { id: 'a4', name: 'Dan Declined', role: 'agent' },
  { id: 'a5', name: 'Eve Cleared', role: 'agent' },
  { id: 'm1', name: 'Manager', role: 'unit_manager' }, // not an agent — never fanned as a row
];

const TERMS_BY_ID = {
  a1: TERMS(), a2: TERMS(), a3: TERMS(), a6: TERMS(),
  a4: TERMS('not_on_financing'),
  a5: TERMS('cleared'),
};

const LEDGER_BY_ID = {
  a1: [missMonth('2026_01', { managerFinancing: 4000, runningBalance: 5000 }), missMonth('2026_02', { managerFinancing: 4000, runningBalance: 9000 })], // 2 misses → amber
  a2: [missMonth('2026_01', { managerFinancing: 3000 }), missMonth('2026_02', { managerFinancing: 3000 }), missMonth('2026_03', { managerFinancing: 3000, runningBalance: 12000 })], // 3 → behind
  a3: [meetMonth('2026_02', { managerFinancing: 4300, adjustmentPct: 0.14, runningBalance: 31200 })], // clean + >10% cut → at-risk (flag)
  a6: [meetMonth('2026_02', { managerFinancing: 5000, runningBalance: 10000 })], // clean → on-track
  a4: [], a5: [],
};

function wireHappyPath() {
  hoisted.getTenantUsers.mockResolvedValue(USERS);
  hoisted.getFinancingTerms.mockImplementation((_t, id) => Promise.resolve(TERMS_BY_ID[id] ?? null));
  hoisted.listFinancingMonths.mockImplementation((_t, id) => Promise.resolve(LEDGER_BY_ID[id] ?? []));
  hoisted.getFinancingConfig.mockResolvedValue({ notifyRecipientUid: 'cro-1' });
  hoisted.getFinancingNotifyRecord.mockResolvedValue(null);
  hoisted.notifyFinancingAdjustment.mockResolvedValue({ success: true, recipientUid: 'cro-1', emailQueued: true });
}

describe('FinancingRiskPanel — BM branch roster (display scope + notify duty)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authValue = { role: 'branch_manager', tenantId: 't1', user: { uid: 'bm1' }, userProfile: { uid: 'bm1', branchId: 'branchA' } };
    wireHappyPath();
  });

  it('gates non-managers (UM) out of the branch monitor — no roster, no notify affordance', () => {
    hoisted.authValue = { role: 'unit_manager', tenantId: 't1' };
    render(<FinancingRiskPanel />);
    expect(screen.getByText(/available to Branch Managers and above/i)).toBeInTheDocument();
    expect(screen.queryByTestId('financing-notify-btn-a3')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notify/i })).not.toBeInTheDocument();
  });

  it('fans out per-agent and renders a row only for actively-financed agents', async () => {
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-table');
    expect(screen.getByTestId('financing-risk-row-a1')).toBeInTheDocument();
    expect(screen.getByTestId('financing-risk-row-a2')).toBeInTheDocument();
    expect(screen.getByTestId('financing-risk-row-a3')).toBeInTheDocument();
    expect(screen.getByTestId('financing-risk-row-a6')).toBeInTheDocument();
    // not_on_financing + cleared are excluded from the roster
    expect(screen.queryByTestId('financing-risk-row-a4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('financing-risk-row-a5')).not.toBeInTheDocument();
  });

  it('read route: reads terms + ledger exactly once per branch agent (fan-out, no re-reads)', async () => {
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-table');
    const agentIds = USERS.filter((u) => u.role === 'agent').map((u) => u.id);
    expect(hoisted.getFinancingTerms).toHaveBeenCalledTimes(agentIds.length);
    expect(hoisted.listFinancingMonths).toHaveBeenCalledTimes(agentIds.length);
    agentIds.forEach((id) => {
      expect(hoisted.getFinancingTerms).toHaveBeenCalledWith('t1', id);
      // P2b (SEC-08): the BM's per-agent ledger read carries its branch scope.
      expect(hoisted.listFinancingMonths).toHaveBeenCalledWith(
        't1', id, undefined, { role: 'branch_manager', uid: 'bm1', branchId: 'branchA' },
      );
    });
    // config is ONE read per surface, not per agent
    expect(hoisted.getFinancingConfig).toHaveBeenCalledTimes(1);
  });

  it('derives the standing status chip from the row risk signals (behind / at-risk / on-track)', async () => {
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-table');
    expect(screen.getByTestId('financing-risk-status-a2')).toHaveAttribute('data-chip', 'behind');   // 3 misses
    expect(screen.getByTestId('financing-risk-status-a1')).toHaveAttribute('data-chip', 'at-risk');  // amber
    expect(screen.getByTestId('financing-risk-status-a3')).toHaveAttribute('data-chip', 'at-risk');  // >10% flag
    expect(screen.getByTestId('financing-risk-status-a6')).toHaveAttribute('data-chip', 'on-track'); // clean
  });

  it('computes branch aggregate cards from the full read', async () => {
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-reality');
    expect(screen.getByTestId('frp-on-financing').textContent).toBe('4');
    expect(screen.getByTestId('frp-at-risk').textContent).toBe('3');       // amber + behind + flag
    expect(screen.getByTestId('frp-two-misses').textContent).toBe('2');    // a1(2) + a2(3)
    expect(screen.getByTestId('frp-adj-flags').textContent).toBe('1');     // a3
    expect(screen.getByTestId('frp-total-drawn').textContent).toMatch(/62,200/); // 9000+12000+31200+10000
    expect(screen.getByTestId('frp-confirmed').textContent).toMatch(/16,300/);   // 4000+3000+4300+5000
  });

  it('surfaces the >10% flag with a WIRED notify affordance for a BM (restored per ruling)', async () => {
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-adj-a3');
    expect(screen.getByTestId('financing-risk-adj-pct-a3').textContent).toMatch(/−14%|-14%/);
    const btn = await screen.findByTestId('financing-notify-btn-a3');
    await waitFor(() => expect(btn).toBeEnabled()); // cooldown record resolved null → enabled
    // lazy cooldown read: fired for the FLAGGED agent-month only, not the roster
    expect(hoisted.getFinancingNotifyRecord).toHaveBeenCalledTimes(1);
    expect(hoisted.getFinancingNotifyRecord).toHaveBeenCalledWith('t1', 'a3', '2026_02');
    // the clean/miss-only agents never surface a notify affordance
    expect(screen.queryByTestId('financing-notify-btn-a1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('financing-notify-btn-a6')).not.toBeInTheDocument();
  });

  it('fires the notify CF with the flagged agent-month args and surfaces inline success + cooldown', async () => {
    render(<FinancingRiskPanel />);
    const btn = await screen.findByTestId('financing-notify-btn-a3');
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() => expect(hoisted.notifyFinancingAdjustment).toHaveBeenCalledWith(
      'a3', '2026_02', expect.objectContaining({ adjustmentPct: 0.14, agentName: 'Cara Cut' }),
    ));
    // inline §1 success (no toast) + the cooldown chip stamps immediately
    await waitFor(() => expect(screen.getByTestId('financing-notify-result-a3')).toHaveTextContent(/duty logged/i));
    expect(screen.getByTestId('financing-notify-cooldown-a3')).toBeInTheDocument();
    expect(screen.getByTestId('financing-notify-btn-a3')).toBeDisabled();
  });

  it('reflects the CF non-fatal email leg honestly when emailQueued is false', async () => {
    hoisted.notifyFinancingAdjustment.mockResolvedValue({ success: true, recipientUid: 'cro-1', emailQueued: false });
    render(<FinancingRiskPanel />);
    const btn = await screen.findByTestId('financing-notify-btn-a3');
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('financing-notify-result-a3')).toHaveTextContent(/email could not be queued/i));
  });

  it('renders cooldown as disabled-with-until-label when a recent notify record exists', async () => {
    hoisted.getFinancingNotifyRecord.mockResolvedValue(Date.now() - 1000); // 1s ago → within 24h
    render(<FinancingRiskPanel />);
    const btn = await screen.findByTestId('financing-notify-btn-a3');
    await waitFor(() => expect(screen.getByTestId('financing-notify-cooldown-a3')).toBeInTheDocument());
    expect(btn).toBeDisabled();
    expect(screen.getByTestId('financing-notify-cooldown-a3')).toHaveTextContent(/re-enables/i);
    expect(hoisted.notifyFinancingAdjustment).not.toHaveBeenCalled();
  });

  it('disables the affordance with a "no recipient configured" state when unset', async () => {
    hoisted.getFinancingConfig.mockResolvedValue({ notifyRecipientUid: null });
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-adj-a3');
    expect(screen.getByTestId('financing-notify-no-recipient-a3')).toBeInTheDocument();
    expect(screen.queryByTestId('financing-notify-btn-a3')).not.toBeInTheDocument();
  });

  it('surfaces an inline error (role=alert) on a failed notify — button stays enabled to retry', async () => {
    hoisted.notifyFinancingAdjustment.mockRejectedValue(new Error('cf-down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<FinancingRiskPanel />);
      const btn = await screen.findByTestId('financing-notify-btn-a3');
      await waitFor(() => expect(btn).toBeEnabled());
      fireEvent.click(btn);
      const result = await screen.findByTestId('financing-notify-result-a3');
      expect(result).toHaveAttribute('role', 'alert');
      expect(result).toHaveTextContent(/notify failed/i);
      expect(screen.getByTestId('financing-notify-btn-a3')).toBeEnabled(); // no cooldown stamped
    } finally {
      errSpy.mockRestore();
    }
  });

  it('surfaces the 7.2c termination-condition flag for 3 confirmed misses (flag only)', async () => {
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-miss-a2');
    const card = screen.getByTestId('financing-risk-miss-a2');
    expect(card).toHaveAttribute('data-severity', 'critical');
    expect(card).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('financing-risk-termination-a2')).toHaveTextContent(/not an automatic termination/i);
  });

  it('degrades to resolved-rows-only on a partial fan-out (aggregates hidden, banner shown)', async () => {
    hoisted.getFinancingTerms.mockImplementation((_t, id) =>
      id === 'a2' ? Promise.reject(new Error('boom')) : Promise.resolve(TERMS_BY_ID[id] ?? null),
    );
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-partial');
    // resolved rows still render; the failed agent is absent; aggregates suppressed
    expect(screen.getByTestId('financing-risk-row-a1')).toBeInTheDocument();
    expect(screen.queryByTestId('financing-risk-row-a2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('financing-risk-reality')).not.toBeInTheDocument();
  });

  it('renders the empty state when no branch agent is on financing', async () => {
    hoisted.getFinancingTerms.mockImplementation((_t, id) =>
      Promise.resolve(TERMS(id === 'a5' ? 'cleared' : 'not_on_financing')),
    );
    render(<FinancingRiskPanel />);
    await screen.findByTestId('financing-risk-empty');
    expect(screen.getByText(/No agents on financing in your branch/i)).toBeInTheDocument();
  });

  it('renders an error card with a wired Retry when the whole load throws', async () => {
    hoisted.getTenantUsers.mockRejectedValue(new Error('no users'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<FinancingRiskPanel />);
      await screen.findByTestId('financing-risk-retry');
      // recover: Retry re-invokes the same load path
      hoisted.getTenantUsers.mockResolvedValue(USERS);
      screen.getByTestId('financing-risk-retry').click();
      await screen.findByTestId('financing-risk-table');
    } finally {
      errSpy.mockRestore();
    }
  });
});
