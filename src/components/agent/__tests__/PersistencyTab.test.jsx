import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Hoisted mock state.
const hoisted = vi.hoisted(() => ({
  getAgentHistory: vi.fn(),
  getAvailableMonths: vi.fn(),
  useAuth: vi.fn(),
  useFeatureFlag: vi.fn(() => false),
}));

vi.mock('../../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: hoisted.useFeatureFlag,
}));

vi.mock('../../../services/persistencyService', () => ({
  getAgentHistory: hoisted.getAgentHistory,
  getAvailableMonths: hoisted.getAvailableMonths,
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
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
    hoisted.useFeatureFlag.mockReturnValue(false);
    hoisted.useAuth.mockReturnValue({
      user: { uid: 'a1' },
      role: 'agent',
      tenantId: 'tenant1',
    });
  });

  it('3.4 flag OFF — the v2 rolling-model shell is absent (byte-identical tab)', async () => {
    hoisted.getAgentHistory.mockResolvedValueOnce([E3_RECORD({ persistency: 0.95 })]);
    hoisted.getAvailableMonths.mockResolvedValueOnce(['2026-02']);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByTestId('agent-persistency-summary')).toBeInTheDocument());
    expect(screen.queryByTestId('persistency-v2-shell')).not.toBeInTheDocument();
  });

  it('3.4 flag ON — the v2 rolling-model shell renders inside the tab', async () => {
    hoisted.useFeatureFlag.mockImplementation((k) => k === 'persistencyV2');
    hoisted.getAgentHistory.mockResolvedValueOnce([E3_RECORD({ persistency: 0.95 })]);
    hoisted.getAvailableMonths.mockResolvedValueOnce(['2026-02']);
    render(<PersistencyTab />);
    await waitFor(() => expect(screen.getByTestId('persistency-v2-shell')).toBeInTheDocument());
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
