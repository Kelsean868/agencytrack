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

// ── E2 drag-drop reschedule ────────────────────────────────────────────────
describe('PlannerDesktopBoard — E2 drag-drop', () => {
  const byDateE2 = new Map([
    [TODAY, [
      { id: 'a1', startTime: '09:00', durationMin: 30, type: 'FFI', status: 'scheduled' },
      { id: 'a2', startTime: '13:00', durationMin: 60, type: 'CI', status: 'scheduled' },
    ]],
    ['2026-07-25', [{ id: 'a3', startTime: '10:00', durationMin: 30, type: 'PC', status: 'cancelled' }]],
  ]);
  const dt = () => ({ setData: vi.fn(), effectAllowed: '' });

  function renderE2(props = {}) {
    return render(
      <PlannerDesktopBoard
        span="3day" onSpanChange={vi.fn()} today={TODAY} weekDates={WEEK_DATES}
        byDate={byDateE2} onBook={vi.fn()} renderCard={renderCard}
        onReschedule={vi.fn()} {...props}
      />,
    );
  }

  it('live cards are draggable; retired cards are not', () => {
    renderE2();
    expect(screen.getByTestId('planner-drag-a1')).toHaveAttribute('draggable', 'true');
    // a3 is cancelled → not draggable
    expect(screen.getByTestId('planner-drag-a3')).not.toHaveAttribute('draggable', 'true');
  });

  it('gap slots appear only while dragging', () => {
    renderE2();
    expect(screen.queryByTestId(`planner-gap-${TODAY}-gap-top`)).toBeNull();
    fireEvent.dragStart(screen.getByTestId('planner-drag-a1'), { dataTransfer: dt() });
    expect(screen.getByTestId(`planner-gap-${TODAY}-gap-top`)).toBeInTheDocument();
    expect(screen.getByTestId(`planner-gap-${TODAY}-gap-after-a1`)).toBeInTheDocument();
    fireEvent.dragEnd(screen.getByTestId('planner-drag-a1'));
    expect(screen.queryByTestId(`planner-gap-${TODAY}-gap-top`)).toBeNull();
  });

  it('dropping a card on another day column reschedules to that DAY, keeping the time', () => {
    const onReschedule = vi.fn();
    renderE2({ onReschedule });
    fireEvent.dragStart(screen.getByTestId('planner-drag-a1'), { dataTransfer: dt() });
    const nextCol = screen.getByTestId('planner-day-col-2026-07-25');
    fireEvent.dragOver(nextCol, { dataTransfer: dt() });
    fireEvent.drop(nextCol, { dataTransfer: dt() });
    expect(onReschedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1' }),
      { date: '2026-07-25', startTime: '09:00' },
    );
  });

  it('dropping a card into a gap slot reschedules to that TIME (the hole after the prior card)', () => {
    const onReschedule = vi.fn();
    renderE2({ onReschedule });
    fireEvent.dragStart(screen.getByTestId('planner-drag-a2'), { dataTransfer: dt() });
    // gap-after-a1 = a1 end = 09:00 + 30m = 09:30, in today's column
    const gap = screen.getByTestId(`planner-gap-${TODAY}-gap-after-a1`);
    fireEvent.drop(gap, { dataTransfer: dt() });
    expect(onReschedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a2' }),
      { date: TODAY, startTime: '09:30' },
    );
  });
});
