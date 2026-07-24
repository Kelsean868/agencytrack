// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PlannerDesktopBoard from '../PlannerDesktopBoard.jsx';

const TODAY = '2026-07-24';
const WEEK_DATES = [
  '2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22',
  '2026-07-23', '2026-07-24', '2026-07-25',
];

// Two appts on today, one on the next day, one on Sunday (week-only).
const byDate = new Map([
  [TODAY, [
    { id: 'a1', startTime: '09:00', type: 'FFI' },
    { id: 'a2', startTime: '13:00', type: 'CI' },
  ]],
  ['2026-07-25', [{ id: 'a3', startTime: '10:00', type: 'PC' }]],
  ['2026-07-19', [{ id: 'a4', startTime: '11:00', type: 'FFI' }]],
]);

const renderCard = (a) => <div key={a.id} data-testid={`card-${a.id}`}>{a.startTime}</div>;

function renderBoard(props = {}) {
  return render(
    <PlannerDesktopBoard
      span="3day"
      onSpanChange={vi.fn()}
      today={TODAY}
      weekDates={WEEK_DATES}
      byDate={byDate}
      onBook={vi.fn()}
      renderCard={renderCard}
      followupsSlot={<div data-testid="fu-slot">follow-ups</div>}
      followupsCount={2}
      {...props}
    />,
  );
}

describe('PlannerDesktopBoard — E1 desktop day-column board', () => {
  it('renders the board root + a 4-option view toggle (Day / 3 days / Week / Follow-ups)', () => {
    renderBoard();
    expect(screen.getByTestId('planner-desktop-board')).toBeInTheDocument();
    expect(screen.getByTestId('planner-span-day')).toHaveTextContent('Day');
    expect(screen.getByTestId('planner-span-3day')).toHaveTextContent('3 days');
    expect(screen.getByTestId('planner-span-week')).toHaveTextContent('Week');
    expect(screen.getByTestId('planner-span-followups')).toHaveTextContent('Follow-ups');
  });

  it('marks the active span selected and reflects the follow-ups count', () => {
    renderBoard({ span: 'week' });
    expect(screen.getByTestId('planner-span-week')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('planner-span-day')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('planner-span-followups')).toHaveTextContent('(2)');
  });

  it('Day span renders exactly 1 day column (today)', () => {
    renderBoard({ span: 'day' });
    expect(screen.getByTestId(`planner-day-col-${TODAY}`)).toBeInTheDocument();
    expect(screen.queryByTestId('planner-day-col-2026-07-25')).toBeNull();
  });

  it('3-day span renders 3 today-anchored columns (today, +1, +2)', () => {
    renderBoard({ span: '3day' });
    expect(screen.getByTestId(`planner-day-col-${TODAY}`)).toBeInTheDocument();
    expect(screen.getByTestId('planner-day-col-2026-07-25')).toBeInTheDocument();
    expect(screen.getByTestId('planner-day-col-2026-07-26')).toBeInTheDocument();
    expect(screen.queryByTestId('planner-day-col-2026-07-27')).toBeNull();
  });

  it('Week span renders the 7 Sun–Sat weekDates columns', () => {
    const { container } = renderBoard({ span: 'week' });
    const cols = container.querySelectorAll('[data-testid^="planner-day-col-"]');
    expect(cols).toHaveLength(7);
    WEEK_DATES.forEach((d) => expect(screen.getByTestId(`planner-day-col-${d}`)).toBeInTheDocument());
  });

  it('renders each day\'s appointments via renderCard, and "No appointments" for empty days', () => {
    renderBoard({ span: '3day' });
    const todayCol = screen.getByTestId(`planner-day-col-${TODAY}`);
    expect(within(todayCol).getByTestId('card-a1')).toBeInTheDocument();
    expect(within(todayCol).getByTestId('card-a2')).toBeInTheDocument();
    // 2026-07-26 has no appts → empty message
    expect(screen.getByTestId('planner-day-empty-2026-07-26')).toHaveTextContent('No appointments');
  });

  it('Follow-ups span renders the followupsSlot instead of day columns', () => {
    renderBoard({ span: 'followups' });
    expect(screen.getByTestId('fu-slot')).toBeInTheDocument();
    expect(screen.queryByTestId(`planner-day-col-${TODAY}`)).toBeNull();
  });

  it('clicking a toggle option calls onSpanChange with its key', () => {
    const onSpanChange = vi.fn();
    renderBoard({ onSpanChange });
    fireEvent.click(screen.getByTestId('planner-span-week'));
    expect(onSpanChange).toHaveBeenCalledWith('week');
    fireEvent.click(screen.getByTestId('planner-span-followups'));
    expect(onSpanChange).toHaveBeenCalledWith('followups');
  });

  it('clicking a column Add button calls onBook with that column\'s date', () => {
    const onBook = vi.fn();
    renderBoard({ span: 'day', onBook });
    fireEvent.click(screen.getByTestId(`planner-day-add-${TODAY}`));
    expect(onBook).toHaveBeenCalledWith(TODAY);
  });
});
