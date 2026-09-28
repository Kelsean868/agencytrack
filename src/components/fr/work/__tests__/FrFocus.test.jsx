/**
 * FrFocus container — reads today's planner items and prospects through the
 * EXISTING services, derives calls, and never writes (FR-D11).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getAgentDay: vi.fn(),
  getProspectInfo: vi.fn(),
}));
vi.mock('../../../../services/plannerService', () => ({ getAgentDay: hoisted.getAgentDay }));
vi.mock('../../../../services/prospectInfoService', () => ({ getProspectInfo: hoisted.getProspectInfo }));
vi.mock('../../../../utils/dateInputs', async (orig) => ({ ...(await orig()), getTodayTT: () => '2026-09-20' }));

import FrFocus from '../FrFocus';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getAgentDay.mockResolvedValue([
    { id: 'a1', type: 'SC', prospectId: 'p1', startTime: '10:00', status: 'scheduled' },
  ]);
  hoisted.getProspectInfo.mockResolvedValue([{ id: 'p1', clientName: '[Client A]', phone: '868-555-0101' }]);
});

describe('FrFocus', () => {
  it('reads today and the prospects with the agent’s own ids; renders the call with a tel: link', async () => {
    render(<FrFocus tenantId="t1" uid="u1" mode="calls" onMode={vi.fn()} policies={[]} campaignPolicies={[]} persistency={[]} todayDailyEntry={{ dials: 7, telContacts: 3 }} />);
    expect(await screen.findByRole('link', { name: 'Call [Client A]' })).toHaveAttribute('href', 'tel:8685550101');
    expect(hoisted.getAgentDay).toHaveBeenCalledWith('t1', 'u1', '2026-09-20');
    expect(hoisted.getProspectInfo).toHaveBeenCalledWith({ tenantId: 't1', agentId: 'u1', callerRole: 'agent', callerUid: 'u1' });
    expect(screen.getByTestId('money-tile-dials-value')).toHaveTextContent('7');
  });

  it('a failed read shows Retry, which reads again', async () => {
    hoisted.getAgentDay.mockRejectedValueOnce(new Error('offline'));
    render(<FrFocus tenantId="t1" uid="u1" mode="calls" onMode={vi.fn()} policies={[]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'Call [Client A]' })).toBeInTheDocument();
    expect(hoisted.getAgentDay).toHaveBeenCalledTimes(2);
  });

  it('a missing prospect list is not fatal: the call shows, without a number', async () => {
    hoisted.getProspectInfo.mockRejectedValueOnce(new Error('denied'));
    render(<FrFocus tenantId="t1" uid="u1" mode="calls" onMode={vi.fn()} policies={[]} />);
    expect(await screen.findByText('No number')).toBeInTheDocument();
  });
});
