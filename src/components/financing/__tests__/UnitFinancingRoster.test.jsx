import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { role: 'unit_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  getFinancingTerms: vi.fn(),
  listFinancingMonths: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));

// Partial-mock financingService: keep the REAL financingCeiling + BASIS/STATUS
// label maps (the badges import them) and only override the two per-agent reads.
vi.mock('../../../services/financingService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getFinancingTerms: (...a) => hoisted.getFinancingTerms(...a),
    listFinancingMonths: (...a) => hoisted.listFinancingMonths(...a),
  };
});

// Light stub for the reused coaching modal — assert it's invoked with the right
// props (esp. agentUnitId) without mounting its heavy subtree.
vi.mock('../../manager/CoachingNotesModal', () => ({
  default: ({ agentId, agentName, agentUnitId, onClose }) => (
    <div data-testid="coaching-modal" data-agent-id={agentId} data-agent-unit-id={agentUnitId}>
      Coaching — {agentName}
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

import UnitFinancingRoster from '../UnitFinancingRoster';

// Confirmed-basis ledger month.
const confirmed = (month, f = {}) => ({ month, basisSource: 'settled-confirmed', ...f });

const TERMS = (over = {}) => ({
  financingStatus: 'on_financing',
  effectiveDate: '2025-12-01',
  agreedMonthlyFinancing: 8000,
  currentMonthlyFinancing: 8000,
  ...over,
});

// R.Seepersad — 2 confirmed misses (amber), no adj flag.
const MISS_AGENT = { id: 'a1', name: 'R. Seepersad', role: 'agent', unitId: 'um-uid' };
const MISS_LEDGER = [
  confirmed('2026_01', { actualAPI: 15000, validatingAPI: 30000, managerFinancing: 4000, adjustmentPct: 0, runningBalance: 18000 }),
  confirmed('2026_02', { actualAPI: 15000, validatingAPI: 30000, managerFinancing: 4000, adjustmentPct: 0, runningBalance: 22400 }),
];

// M.Baptiste — confirmed −14% cut (>10% flag), on-ceiling balance.
const ADJ_AGENT = { id: 'a2', name: 'M. Baptiste', role: 'agent', unitId: 'um-uid' };
const ADJ_LEDGER = [
  confirmed('2026_02', { actualAPI: 30000, validatingAPI: 30000, managerFinancing: 4300, adjustmentPct: 0.14, runningBalance: 31200 }),
];

// P.Mohan — surplus (negative balance), clean.
const SURPLUS_AGENT = { id: 'a3', name: 'P. Mohan', role: 'agent', unitId: 'um-uid' };
const SURPLUS_LEDGER = [
  confirmed('2026_02', { actualAPI: 40000, validatingAPI: 30000, managerFinancing: 8000, adjustmentPct: 0, runningBalance: -3100 }),
];

function mockUnit(agents, ledgers, termsByAgent = {}) {
  hoisted.getTenantUsers.mockResolvedValue(agents);
  hoisted.getFinancingTerms.mockImplementation((_t, aid) => Promise.resolve(termsByAgent[aid] ?? TERMS()));
  hoisted.listFinancingMonths.mockImplementation((_t, aid) => {
    const l = ledgers[aid];
    return l instanceof Error ? Promise.reject(l) : Promise.resolve(l ?? []);
  });
}

describe('UnitFinancingRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authValue = { role: 'unit_manager', tenantId: 't1' };
  });

  it('guards non-unit-managers out (a BM uses the full Financing tab)', () => {
    hoisted.authValue = { role: 'branch_manager', tenantId: 't1' };
    render(<UnitFinancingRoster tenantId="t1" />);
    expect(screen.getByText(/Unit Manager's view of their own unit/i)).toBeInTheDocument();
  });

  it('shows the empty state when no unit agent is actively financed', async () => {
    mockUnit(
      [{ id: 'a1', name: 'Ana', role: 'agent', unitId: 'um-uid' }],
      { a1: [] },
      { a1: TERMS({ financingStatus: 'not_on_financing' }) },
    );
    render(<UnitFinancingRoster tenantId="t1" />);
    await waitFor(() => expect(screen.getByTestId('unit-financing-empty')).toBeInTheDocument());
  });

  it('excludes the UM\'s own row (role filter) and renders only unit agents on financing', async () => {
    mockUnit(
      [MISS_AGENT, { id: 'um-uid', name: 'D. Rampersad', role: 'unit_manager', unitId: 'um-uid' }],
      { a1: MISS_LEDGER },
    );
    render(<UnitFinancingRoster tenantId="t1" />);
    await waitFor(() => expect(screen.getByTestId('unit-financing-row-a1')).toBeInTheDocument());
    expect(screen.queryByTestId('unit-financing-row-um-uid')).not.toBeInTheDocument();
  });

  it('renders the MONTHLY-miss count on the confirmed basis', async () => {
    mockUnit([MISS_AGENT], { a1: MISS_LEDGER });
    render(<UnitFinancingRoster tenantId="t1" />);
    const monitor = await screen.findByTestId('unit-financing-miss-a1');
    expect(monitor).toHaveAttribute('data-count', '2');
    expect(monitor).toHaveAttribute('data-severity', 'amber');
  });

  it('renders confirmed draw + adjustmentPct as LOCKED readouts — no proration input, no Confirm button', async () => {
    mockUnit([ADJ_AGENT], { a2: ADJ_LEDGER });
    render(<UnitFinancingRoster tenantId="t1" />);
    await screen.findByTestId('unit-financing-row-a2');
    // Locked confirmed draw renders the value.
    expect(screen.getByTestId('unit-financing-draw-a2')).toHaveTextContent(/4,300/);
    // The write affordances from the BM proration panel must be ABSENT.
    expect(screen.queryByTestId('proration-manager-input')).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirm financing/i)).not.toBeInTheDocument();
  });

  it('shows the >10% flag as a STATUS ("with Branch Manager"), not an actionable notify control', async () => {
    mockUnit([ADJ_AGENT], { a2: ADJ_LEDGER });
    render(<UnitFinancingRoster tenantId="t1" />);
    await screen.findByTestId('unit-financing-adj-a2');
    expect(screen.getByTestId('unit-financing-notify-status-a2')).toHaveTextContent(/with Branch Manager/i);
    // The BM's real Notify button (from FinancingRiskPanel) must not be present.
    expect(screen.queryByTestId('financing-notify-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('unit-financing-adj-pct-a2')).toHaveTextContent('−14%');
  });

  it('renders a surplus row (negative balance) as success-green "owed to agent", not an error', async () => {
    mockUnit([SURPLUS_AGENT], { a3: SURPLUS_LEDGER });
    render(<UnitFinancingRoster tenantId="t1" />);
    const row = await screen.findByTestId('unit-financing-row-a3');
    expect(row).toHaveTextContent(/owed to agent/i);
  });

  it('opens the reused CoachingNotesModal from a row Coach action, passing agentUnitId', async () => {
    mockUnit([MISS_AGENT], { a1: MISS_LEDGER });
    render(<UnitFinancingRoster tenantId="t1" />);
    await screen.findByTestId('unit-financing-row-a1');
    fireEvent.click(screen.getByTestId('unit-financing-coach-a1'));
    const modal = await screen.findByTestId('coaching-modal');
    expect(modal).toHaveAttribute('data-agent-id', 'a1');
    expect(modal).toHaveAttribute('data-agent-unit-id', 'um-uid');
  });

  it('opens the read-only drawer from View; it has no write inputs', async () => {
    mockUnit([ADJ_AGENT], { a2: ADJ_LEDGER });
    render(<UnitFinancingRoster tenantId="t1" />);
    await screen.findByTestId('unit-financing-row-a2');
    fireEvent.click(screen.getByTestId('unit-financing-view-a2'));
    const drawer = await screen.findByTestId('unit-financing-drawer');
    expect(drawer).toHaveTextContent(/set by your Branch Manager/i);
    // Deferred Flag-to-BM degrades to a disabled control, never a dead write.
    expect(screen.getByTestId('unit-financing-drawer-flag')).toBeDisabled();
  });

  it('on a PARTIAL fan-out failure shows resolved rows only and hides the unit aggregates', async () => {
    mockUnit(
      [MISS_AGENT, ADJ_AGENT],
      { a1: MISS_LEDGER, a2: new Error('read failed') },
    );
    render(<UnitFinancingRoster tenantId="t1" />);
    await waitFor(() => expect(screen.getByTestId('unit-financing-partial')).toBeInTheDocument());
    // Resolved row present…
    expect(screen.getByTestId('unit-financing-row-a1')).toBeInTheDocument();
    // …failed row absent, and NO reality-strip aggregate computed from a partial read.
    expect(screen.queryByTestId('unit-financing-row-a2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unit-financing-reality')).not.toBeInTheDocument();
  });

  it('computes unit aggregates only on a full read', async () => {
    mockUnit(
      [MISS_AGENT, ADJ_AGENT, SURPLUS_AGENT],
      { a1: MISS_LEDGER, a2: ADJ_LEDGER, a3: SURPLUS_LEDGER },
    );
    render(<UnitFinancingRoster tenantId="t1" />);
    const reality = await screen.findByTestId('unit-financing-reality');
    expect(reality).toBeInTheDocument();
    expect(screen.getByTestId('ufr-on-financing')).toHaveTextContent('3');
    // at-risk = amber-miss agent (a1) + adj-flag agent (a2) = 2
    expect(screen.getByTestId('ufr-at-risk')).toHaveTextContent('2');
    expect(screen.getByTestId('ufr-adj-bm')).toHaveTextContent('1');
  });

  it('renders a basisSource badge for confirmed figures', async () => {
    mockUnit([ADJ_AGENT], { a2: ADJ_LEDGER });
    render(<UnitFinancingRoster tenantId="t1" />);
    await screen.findByTestId('unit-financing-row-a2');
    fireEvent.click(screen.getByTestId('unit-financing-view-a2'));
    await screen.findByTestId('unit-financing-drawer');
    // Value-level: assert the actual basis, not just badge presence — catches a
    // regression to the wrong basisSource fallback.
    expect(screen.getByTestId('financing-basis-badge')).toHaveAttribute('data-basis', 'settled-confirmed');
  });
});
