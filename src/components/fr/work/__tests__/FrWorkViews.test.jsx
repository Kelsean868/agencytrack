/**
 * FR-4 pure views: Focus (Calls / Paperwork / Win-back), Pipeline (Funnel /
 * Board) and the Numbers / Ledger headers — states, honesty, navigation.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import FrFocusView from '../FrFocusView';
import FrPipelineView from '../FrPipelineView';
import { FrNumbersHeaderView, FrLedgerHeaderView } from '../FrWorkHeaderViews';
import { focusCalls, paperwork, funnel, board, numbersTiles } from '../../../../lib/fr/workModel';
import { reinstatementPlan } from '../../../../lib/fr/moneyModel';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../../utils/weeklyActivityFloors';

const CALLS = focusCalls({
  appointments: [
    { id: 'a1', type: 'PC', startTime: '09:00', durationMin: 60, status: 'scheduled' },
    { id: 'a2', type: 'SC', prospectId: 'p1', startTime: '10:00', status: 'scheduled' },
    { id: 'a3', type: 'AI', prospectId: 'p2', startTime: '11:00', status: 'kept' },
  ],
  prospects: [{ id: 'p1', clientName: '[Client A]', phone: '868 555 0101' }, { id: 'p2', clientName: '[Client B]' }],
  dailyEntry: null,
});
const PAPER = paperwork({ policies: [{ id: 'x1', status: 'submitted', dateSubmitted: '2026-09-01', proposedAPI: 5000, ownerName: '[Client C]' }], todayTT: '2026-09-20' });
const pol = (n, status, api, dateIssued) => ({ id: n, policyNumber: n, status, proposedAPI: api, dateIssued, productLine: 'life' });
const PLAN = reinstatementPlan({
  policies: [pol('S1', 'settled', 100000, '2025-06-01'), pol('L1', 'lapsed', 5000, '2025-01-10'), pol('L2', 'lapsed', 3000, '2024-11-05'), pol('L4', 'lapsed', 4000, '2025-03-01')],
  todayTT: '2026-09-20',
});

describe('FrFocusView', () => {
  it('Calls: who to call with a tel: link, blocks listed as capacity, counts unknown until logged', () => {
    const onLogToday = vi.fn();
    render(<FrFocusView mode="calls" onMode={vi.fn()} calls={CALLS} paperwork={PAPER} plan={PLAN} onLogToday={onLogToday} />);
    expect(within(screen.getByTestId('focus-call-a2')).getByRole('link', { name: 'Call [Client A]' })).toHaveAttribute('href', 'tel:8685550101');
    expect(within(screen.getByTestId('focus-call-a3')).getByText('No number')).toBeInTheDocument();
    expect(screen.getByTestId('focus-block-a1')).toHaveTextContent('Prospecting call · 60 min');
    expect(screen.getByTestId('money-tile-dials')).toHaveTextContent('—');
    expect(screen.getByTestId('money-tile-dials')).toHaveTextContent('Not logged yet today');
    fireEvent.click(screen.getByTestId('focus-log-today'));
    expect(onLogToday).toHaveBeenCalled();
  });

  it('Calls writes nothing: its only controls are the log sheet, tel: links, planner and mode buttons', () => {
    render(<FrFocusView mode="calls" onMode={vi.fn()} calls={CALLS} />);
    const buttons = screen.getAllByRole('button').map((b) => b.textContent.trim());
    expect(buttons).toEqual(['Calls', 'Paperwork', 'Win-back', 'Log today’s calls', 'Open your week']);
  });

  it('switches mode; Paperwork is oldest first with age; Win-back is the reinstatement planner', () => {
    const onMode = vi.fn();
    const { rerender } = render(<FrFocusView mode="calls" onMode={onMode} calls={CALLS} paperwork={PAPER} plan={PLAN} />);
    fireEvent.click(screen.getByTestId('focus-mode-paperwork'));
    expect(onMode).toHaveBeenCalledWith('paperwork');
    rerender(<FrFocusView mode="paperwork" onMode={onMode} calls={CALLS} paperwork={PAPER} plan={PLAN} />);
    expect(screen.getByTestId('focus-mode-paperwork')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('focus-paper-x1')).toHaveTextContent('19 days');
    rerender(<FrFocusView mode="winback" onMode={onMode} calls={CALLS} paperwork={PAPER} plan={PLAN} />);
    expect(screen.getByTestId('reinstatement-planner')).toBeInTheDocument();
  });

  it('Calls: loading and error states', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<FrFocusView mode="calls" onMode={vi.fn()} calls={null} callsLoading />);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    rerender(<FrFocusView mode="calls" onMode={vi.fn()} calls={null} callsError onRetryCalls={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/did not load/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('FrPipelineView', () => {
  const floors = { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS };
  const STAGES = funnel({ values: { callsMade: 50, telContacts: 20, appointmentsScheduled: 10, factFindsCompleted: 5, closingInterviewsKept: 4, applicationsSubmitted: 1, clientsSold: 1 }, floors });

  it('Funnel: a row per ladder stage with conversion and shortfall; title counts the short stages', () => {
    render(<FrPipelineView view="funnel" onView={vi.fn()} period="week" onPeriod={vi.fn()} funnel={STAGES} periodNote="This week so far." board={null} />);
    expect(screen.getByRole('heading', { name: /stages short of the company minimum/ })).toBeInTheDocument();
    expect(screen.getByTestId('funnel-telContacts')).toHaveTextContent('40.0% of prospecting calls');
    expect(screen.getByTestId('funnel-callsMade')).toHaveTextContent('10 short');
  });

  it('Funnel with nothing logged says so (no fake 0 %)', () => {
    render(<FrPipelineView view="funnel" onView={vi.fn()} period="week" onPeriod={vi.fn()} funnel={funnel({ values: {}, floors })} board={null} />);
    expect(screen.getByRole('heading', { name: 'No activity logged for this period yet' })).toBeInTheDocument();
    expect(screen.queryByText(/0\.0%/)).toBeNull();
  });

  it('view and period switches call back; Board shows the ledger stages with Closed collapsed', () => {
    const onView = vi.fn();
    const onPeriod = vi.fn();
    const cols = board({ policies: [{ id: '1', status: 'submitted', proposedAPI: 1000 }, { id: '2', status: 'lapsed', proposedAPI: 700 }], todayTT: '2026-09-20' });
    const { rerender } = render(<FrPipelineView view="funnel" onView={onView} period="week" onPeriod={onPeriod} funnel={STAGES} board={cols} />);
    fireEvent.click(screen.getByTestId('pipeline-period-year'));
    expect(onPeriod).toHaveBeenCalledWith('year');
    fireEvent.click(screen.getByTestId('pipeline-view-board'));
    expect(onView).toHaveBeenCalledWith('board');
    rerender(<FrPipelineView view="board" onView={onView} period="week" onPeriod={onPeriod} funnel={STAGES} board={cols} />);
    expect(screen.getByTestId('board-col-submitted')).toHaveTextContent('TTD 1,000');
    expect(screen.queryByTestId('board-col-closed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show closed and lapsed \(1\)/ }));
    expect(screen.getByTestId('board-col-closed')).toBeInTheDocument();
  });
});

describe('FR-4 headers', () => {
  it('Numbers: weeks reported and ratios; unknown ratios read "—"', () => {
    render(<FrNumbersHeaderView tiles={numbersTiles({ submissions: [], year: 2026 })} />);
    expect(screen.getByTestId('money-tile-weeks-value')).toHaveTextContent('0');
    expect(screen.getByTestId('money-tile-contact-value')).toHaveTextContent('—');
  });

  it('Ledger: year tiles and a win-back lens that opens Focus · Win-back', () => {
    const onOpenWinback = vi.fn();
    const tiles = [{ id: 'settled', label: 'Settled API 2026', value: 87146, unit: 'ttd' }];
    render(<FrLedgerHeaderView tiles={tiles} plan={PLAN} onOpenWinback={onOpenWinback} />);
    expect(screen.getByTestId('ledger-winback-lens')).toHaveTextContent(/reinstated clears 90%/);
    fireEvent.click(screen.getByTestId('ledger-open-winback'));
    expect(onOpenWinback).toHaveBeenCalled();
  });

  it('Ledger lens with no plan says so and offers no win-back', () => {
    render(<FrLedgerHeaderView tiles={[]} plan={null} />);
    expect(screen.getByText('No persistency figure yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('ledger-open-winback')).toBeNull();
  });
});
