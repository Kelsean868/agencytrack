// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const mockUser     = { uid: 'bm1' };
const mockTenantId = 'test-tenant';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, userProfile: {}, role: 'branch_manager', tenantId: mockTenantId }),
}));

// Pin "this week" so weekStarting comparisons in the component are deterministic.
vi.mock('../../../utils/dateHelpers', () => ({
  getMostRecentSunday: () => '2026-07-12',
}));

// §2 count-up is inert-under-test elsewhere in the codebase via this exact
// identity mock (see MovementChipIntegration.test.jsx).
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

const mockGetAgentSubmissions = vi.fn();
vi.mock('../../../services/submissionService', () => ({
  getAgentSubmissions: (...args) => mockGetAgentSubmissions(...args),
}));

import MyWeekPanel from '../MyWeekPanel.jsx';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('MyWeekPanel — four states', () => {
  beforeEach(() => {
    mockGetAgentSubmissions.mockReset();
  });

  it('loading → skeleton', async () => {
    let resolvePromise;
    mockGetAgentSubmissions.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
    render(<MyWeekPanel />);
    expect(screen.getByTestId('my-week-panel-loading')).toBeInTheDocument();
    resolvePromise([]);
    await flush();
  });

  it('error → alert + Retry re-fetches', async () => {
    mockGetAgentSubmissions.mockRejectedValueOnce(new Error('boom'));
    render(<MyWeekPanel />);
    await waitFor(() => expect(screen.getByTestId('my-week-panel-error')).toBeInTheDocument());

    mockGetAgentSubmissions.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByTestId('my-week-panel-empty')).toBeInTheDocument());
    expect(mockGetAgentSubmissions).toHaveBeenCalledTimes(2);
  });

  it('none → honest "no report started" empty state (no own submission this week)', async () => {
    mockGetAgentSubmissions.mockResolvedValueOnce([
      { weekStarting: '2026-07-05', status: 'submitted', totalProductionCredit: 8500, applicationsSold: 1 },
    ]);
    render(<MyWeekPanel />);
    await waitFor(() => expect(screen.getByTestId('my-week-panel-empty')).toBeInTheDocument());
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  it('draft → shows Draft status + own KPIs', async () => {
    mockGetAgentSubmissions.mockResolvedValueOnce([
      { weekStarting: '2026-07-12', status: 'draft', totalProductionCredit: 3000, applicationsSold: 1 },
    ]);
    render(<MyWeekPanel />);
    await waitFor(() => expect(screen.getByText('Draft')).toBeInTheDocument());
    expect(screen.getByTestId('my-week-panel-api')).toHaveTextContent('TTD 3,000');
    expect(screen.getByTestId('my-week-panel-apps')).toHaveTextContent('1');
  });

  it('submitted → shows Submitted status + own KPIs', async () => {
    mockGetAgentSubmissions.mockResolvedValueOnce([
      { weekStarting: '2026-07-12', status: 'submitted', totalProductionCredit: 8200, applicationsSold: 3 },
    ]);
    render(<MyWeekPanel />);
    await waitFor(() => expect(screen.getByText('Submitted')).toBeInTheDocument());
    expect(screen.getByTestId('my-week-panel-api')).toHaveTextContent('TTD 8,200');
    expect(screen.getByTestId('my-week-panel-apps')).toHaveTextContent('3');
  });
});
