import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Hoisted mock state.
const hoisted = vi.hoisted(() => ({
  getAgentHistory: vi.fn(),
  getAvailableMonths: vi.fn(),
  useAuth: vi.fn(),
  getOwnPolicies: vi.fn(),
}));

vi.mock('../../../services/persistencyService', () => ({
  getAgentHistory: hoisted.getAgentHistory,
  getAvailableMonths: hoisted.getAvailableMonths,
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

// The ledger fetch. DELIBERATELY UNFILTERED in the component -- persistency is
// the one reader that must see imported docs -- so the mock returns them raw.
vi.mock('../../../services/policiesService', () => ({
  getOwnPolicies: hoisted.getOwnPolicies,
}));

// Recharts requires a wrapper — stub it to avoid the ResizeObserver / SVG dependency.
vi.mock('recharts', () => ({
  LineChart:           ({ children }) => <div data-testid="chart">{children}</div>,
  Line:                () => null,
  ReferenceLine:       () => null,
  Tooltip:             () => null,
  XAxis:               () => null,
  YAxis:               () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

// Avoid loading the entry form / playground (they pull firebase deps via savePersistency).
vi.mock('../../manager/PersistencyEntryForm', () => ({
  default: () => <div data-testid="mock-entry-form" />,
}));
vi.mock('../../persistency/PersistencyPlayground', () => ({
  default: () => <div data-testid="mock-playground" />,
}));

import PersistencyTab from '../PersistencyTab';

const E3_RECORD = (overrides = {}) => ({
  agentId: 'a1',
  monthKey: '2026-02',
  year: 2026,
  month: 2,
  businessPlaced: 100000, notTakens: 0, incPPPs: 0, lumpsums100: 0,
  lapses: 5000, reinstatements: 1000,
  grossSettled: 100000, netSettled: 96000, persistency: 0.96,
  meetsAwardGate: true,
  enteredByRole: 'agent',
  ...overrides,
});

describe('agent PersistencyTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({
      user: { uid: 'a1' },
      role: 'agent',
      tenantId: 'tenant1',
    });
    // Default: no ledger. Without this the mock returns undefined and the
    // component's `.catch()` on the fetch throws a TypeError, taking the whole
    // load down -- which is a mock artefact, not a behaviour worth asserting.
    hoisted.getOwnPolicies.mockResolvedValue([]);
  });

  it('renders no award-gate banner when persistency >= 0.90', async () => {
    hoisted.getAgentHistory.mockResolvedValueOnce([E3_RECORD({ persistency: 0.95 })]);
    hoisted.getAvailableMonths.mockResolvedValueOnce(['2026-02']);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByTestId('agent-persistency-summary')).toBeInTheDocument());
    expect(screen.queryByTestId('award-gate-banner')).not.toBeInTheDocument();
  });

  it('renders award-gate banner when persistency < 0.90', async () => {
    hoisted.getAgentHistory.mockResolvedValueOnce([E3_RECORD({ persistency: 0.74 })]);
    hoisted.getAvailableMonths.mockResolvedValueOnce(['2026-02']);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByTestId('award-gate-banner')).toBeInTheDocument());
    // The banner text contains the persistency value scoped to the banner.
    const banner = screen.getByTestId('award-gate-banner');
    expect(banner.textContent).toMatch(/74\.0%/);
    expect(banner.textContent).toMatch(/Awards require 90%/i);
  });

  it('locks self-entry button when manager has entered for the same month', async () => {
    hoisted.getAgentHistory.mockResolvedValueOnce([
      E3_RECORD({ persistency: 0.85, enteredByRole: 'branch_manager' }),
    ]);
    hoisted.getAvailableMonths.mockResolvedValueOnce(['2026-02']);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByTestId('agent-persistency-edit-button')).toBeInTheDocument());
    expect(screen.getByTestId('agent-persistency-edit-button')).toBeDisabled();
  });

  it('shows trend chart container with available data', async () => {
    hoisted.getAgentHistory.mockResolvedValueOnce([
      E3_RECORD({ monthKey: '2025-12', persistency: 0.80 }),
      E3_RECORD({ monthKey: '2026-01', persistency: 0.85 }),
      E3_RECORD({ monthKey: '2026-02', persistency: 0.91 }),
    ]);
    hoisted.getAvailableMonths.mockResolvedValueOnce(['2026-02', '2026-01', '2025-12']);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByTestId('chart')).toBeInTheDocument());
    expect(screen.getByTestId('persistency-trend-chart')).toBeInTheDocument();
  });

  it('renders fallback message when no history', async () => {
    hoisted.getAgentHistory.mockResolvedValueOnce([]);
    hoisted.getAvailableMonths.mockResolvedValueOnce([]);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByText(/No history yet/i)).toBeInTheDocument());
  });

  describe('0.1b loading skeleton', () => {
    it('renders a PanelSkeleton (aria-busy) before the first successful load, no "—" placeholder figures', () => {
      hoisted.getAgentHistory.mockReturnValue(new Promise(() => {}));
      hoisted.getAvailableMonths.mockReturnValue(new Promise(() => {}));
      render(<PersistencyTab />);

      expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
      expect(screen.queryByTestId('agent-persistency-summary')).toBeNull();
    });
  });

  describe('§1 states contract (error / retry)', () => {
    it('renders a persistent inline error card with Retry when the load fails', async () => {
      hoisted.getAgentHistory.mockRejectedValueOnce(new Error('boom-history'));
      hoisted.getAvailableMonths.mockResolvedValueOnce([]);
      render(<PersistencyTab />);

      const card = await screen.findByTestId('agent-persistency-error');
      expect(card).toHaveAttribute('role', 'alert');
      expect(card).toHaveTextContent('boom-history');
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('clicking Retry re-invokes the same load path and recovers', async () => {
      hoisted.getAgentHistory.mockRejectedValueOnce(new Error('boom-history'));
      hoisted.getAvailableMonths.mockResolvedValueOnce([]);
      render(<PersistencyTab />);
      await screen.findByTestId('agent-persistency-error');

      hoisted.getAgentHistory.mockResolvedValueOnce([E3_RECORD({ persistency: 0.95 })]);
      hoisted.getAvailableMonths.mockResolvedValueOnce(['2026-02']);
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => expect(screen.queryByTestId('agent-persistency-error')).toBeNull());
      expect(hoisted.getAgentHistory).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('agent-persistency-summary')).toBeInTheDocument();
    });
  });
});

// ── P3 fix 2: the main card shows what the ledger WOULD give, unsaved ────────
describe('PersistencyTab — ledger preview line on the main card', () => {
  /** One placed, in-window, writing-agent imported policy. */
  const ledgerDoc = (overrides = {}) => ({
    policyNumber: 'LP0000001',
    status: 'settled',
    oipaSubStatus: 'Premium Paying',
    policyClass: 'whole_life',
    proposedAPI: 100000,
    totalPremiumPaid: null,
    dateIssued: '2026-01-15',
    paidToDate: '2026-10-01',
    isWritingAgent: true,
    importSource: 'oipa_import',
    exportDate: '2026-09-15',
    ...overrides,
  });

  beforeEach(() => {
    hoisted.useAuth.mockReturnValue({ user: { uid: 'a1' }, role: 'agent', tenantId: 't1' });
    hoisted.getAvailableMonths.mockResolvedValue(['2026-09']);
    hoisted.getAgentHistory.mockResolvedValue([]);   // nothing saved
  });

  it('shows the provenance, the percentage and "not saved yet"', async () => {
    // BOTH are placed, so both enter the denominator: gross 110000,
    // lapses 10000, net 100000 -> 100000/110000 = 90.9%.
    hoisted.getOwnPolicies.mockResolvedValue([
      ledgerDoc({ policyNumber: 'A1', proposedAPI: 100000 }),
      ledgerDoc({ policyNumber: 'A2', status: 'lapsed', proposedAPI: 10000 }),
    ]);

    render(<PersistencyTab />);

    const line = await screen.findByTestId('ledger-preview-line');
    expect(line.textContent).toMatch(/From portfolio import, 15 Sep 2026/);
    expect(line.textContent).toMatch(/90\.9%/);
    // The qualifier is the point: an unsaved derivation is not a record and
    // does not gate an award.
    expect(line.textContent).toMatch(/not saved yet/);
  });

  it('still shows the existing "no record" copy alongside it', async () => {
    hoisted.getOwnPolicies.mockResolvedValue([ledgerDoc()]);
    render(<PersistencyTab />);
    await screen.findByTestId('ledger-preview-line');
    expect(screen.getByText(/No record entered for this month yet/)).toBeTruthy();
  });

  it('shows NO preview line when the ledger has nothing in the window', async () => {
    hoisted.getOwnPolicies.mockResolvedValue([ledgerDoc({ dateIssued: '2019-01-01' })]);
    render(<PersistencyTab />);
    await screen.findByText(/No record entered for this month yet/);
    expect(screen.queryByTestId('ledger-preview-line')).toBeNull();
  });

  it('shows NO preview line when the ledger fetch fails', async () => {
    // A ledger failure must not take the tab down or invent a figure.
    hoisted.getOwnPolicies.mockRejectedValue(new Error('boom'));
    render(<PersistencyTab />);
    await screen.findByText(/No record entered for this month yet/);
    expect(screen.queryByTestId('ledger-preview-line')).toBeNull();
  });

  it('shows NO preview line once a record IS saved', async () => {
    // The saved record is the truth; a derivation must not sit beside it
    // competing for the reader's attention.
    hoisted.getAgentHistory.mockResolvedValue([E3_RECORD({ monthKey: '2026-09' })]);
    hoisted.getOwnPolicies.mockResolvedValue([ledgerDoc()]);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.queryByText(/No record entered/)).toBeNull());
    expect(screen.queryByTestId('ledger-preview-line')).toBeNull();
  });
});
