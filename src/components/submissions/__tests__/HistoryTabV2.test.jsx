// @vitest-environment jsdom
//
// HistoryTab v2 (item 2.6) — drill reskin + wizard edit path + filters +
// heatmap enrichment derivations. Value-level assertions.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import HistoryTab from '../HistoryTab';
import { isAwardWeek, longestStreakWeeks } from '../../../utils/historyDerivations';

const WEEKLY_TARGET = 10000;

// Three consecutive submitted weeks (a 3-streak), one below-target draft, one unlocked.
const SUBS = [
  { id: 'w1', weekStarting: '2026-06-07', status: 'submitted', apiSold: 12000, applicationsSold: 3, ciConducted: 2, referralCalls: 5, overallRating: 8, evaluationNotes: 'Strong prospecting week' },
  { id: 'w2', weekStarting: '2026-06-14', status: 'submitted', apiSold: 25000, applicationsSold: 5, ciConducted: 4, referralCalls: 8, overallRating: 9, evaluationNotes: 'Best momentum yet' },
  { id: 'w3', weekStarting: '2026-06-21', status: 'submitted', apiSold: 15000, applicationsSold: 4, ciConducted: 3, referralCalls: 6, overallRating: 7 },
  { id: 'w4', weekStarting: '2026-07-05', status: 'draft',     apiSold: 2000,  applicationsSold: 1, ciConducted: 0, referralCalls: 2 },
  { id: 'w5', weekStarting: '2026-05-31', status: 'draft',     apiSold: 30000, applicationsSold: 6, ciConducted: 5, unlockedBy: 'mgr-1', unlockedByName: 'Tom Ramjit' },
];

function renderTab(props = {}) {
  return render(
    <HistoryTab
      submissions={SUBS}
      loading={false}
      onDownload={vi.fn()}
      generating={false}
      weeklyTarget={WEEKLY_TARGET}
      onEditWeek={vi.fn()}
      {...props}
    />,
  );
}

describe('HistoryTab v2 — pure derivations', () => {
  it('isAwardWeek: submitted week at/above target is award-eligible; below-target and non-submitted are not', () => {
    expect(isAwardWeek(SUBS[1], WEEKLY_TARGET)).toBe(true);   // 25000 >= 10000
    expect(isAwardWeek(SUBS[0], WEEKLY_TARGET)).toBe(true);   // 12000 >= 10000
    expect(isAwardWeek(SUBS[3], WEEKLY_TARGET)).toBe(false);  // draft
    expect(isAwardWeek(SUBS[4], WEEKLY_TARGET)).toBe(false);  // unlocked (unlockedBy set)
    expect(isAwardWeek({ ...SUBS[0], apiSold: 500 }, WEEKLY_TARGET)).toBe(false); // below target
  });

  it('longestStreakWeeks: returns the member weeks of the longest consecutive-submitted run', () => {
    const run = longestStreakWeeks(SUBS, 2026);
    // w1/w2/w3 are 7 days apart → a 3-week run; w5 draft/unlocked breaks it.
    expect(run).toEqual(['2026-06-07', '2026-06-14', '2026-06-21']);
    expect(longestStreakWeeks([], 2026)).toEqual([]);
  });
});

describe('HistoryTab v2 — drill status-driven footer CTA', () => {
  it('submitted week → Download PDF CTA (calls onDownload)', () => {
    const onDownload = vi.fn();
    renderTab({ onDownload });
    // Open the drill for the first submitted week.
    fireEvent.click(screen.getByRole('button', { name: /open submission from sun 21 jun/i }));
    const footer = screen.getByTestId('history-drill-footer');
    const cta = within(footer).getByTestId('drill-cta-download');
    expect(cta).toHaveTextContent(/download pdf/i);
    fireEvent.click(cta);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('draft week → Continue editing CTA calls onEditWeek with that weekStarting', () => {
    const onEditWeek = vi.fn();
    renderTab({ onEditWeek });
    fireEvent.click(screen.getByRole('button', { name: /open submission from sun 05 jul/i }));
    const footer = screen.getByTestId('history-drill-footer');
    const cta = within(footer).getByTestId('drill-cta-edit');
    expect(cta).toHaveTextContent(/continue editing/i);
    fireEvent.click(cta);
    expect(onEditWeek).toHaveBeenCalledTimes(1);
    expect(onEditWeek).toHaveBeenCalledWith('2026-07-05', expect.objectContaining({ id: 'w4' }));
  });

  it('unlocked week → Edit & resubmit CTA calls onEditWeek with that weekStarting', () => {
    const onEditWeek = vi.fn();
    renderTab({ onEditWeek });
    fireEvent.click(screen.getByRole('button', { name: /open submission from sun 31 may/i }));
    const footer = screen.getByTestId('history-drill-footer');
    const cta = within(footer).getByTestId('drill-cta-edit');
    expect(cta).toHaveTextContent(/edit & resubmit/i);
    fireEvent.click(cta);
    expect(onEditWeek).toHaveBeenCalledWith('2026-05-31', expect.objectContaining({ id: 'w5' }));
  });

  it('submitted drill hides Download CTA when onDownload is absent (manager own-history parity)', () => {
    render(
      <HistoryTab submissions={SUBS} loading={false} weeklyTarget={WEEKLY_TARGET} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open submission from sun 21 jun/i }));
    expect(screen.queryByTestId('drill-cta-download')).toBeNull();
  });
});

describe('HistoryTab v2 — filters', () => {
  it('award-weeks toggle filters to award-eligible submitted weeks only', () => {
    renderTab();
    // Before: draft week card is present.
    expect(screen.getByRole('button', { name: /open submission from sun 05 jul/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /award weeks/i }));
    // After: only submitted at/above target remain; draft + unlocked gone.
    expect(screen.queryByRole('button', { name: /open submission from sun 05 jul/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /open submission from sun 31 may/i })).toBeNull();
    expect(screen.getByRole('button', { name: /open submission from sun 14 jun/i })).toBeInTheDocument();
  });

  it('month dropdown filters to a single month', () => {
    renderTab();
    fireEvent.change(screen.getByLabelText(/filter by month/i), { target: { value: '07' } });
    expect(screen.getByRole('button', { name: /open submission from sun 05 jul/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open submission from sun 14 jun/i })).toBeNull();
  });

  it('search filters by stored note text', () => {
    renderTab();
    fireEvent.change(screen.getByLabelText(/search notes and goals/i), { target: { value: 'momentum' } });
    expect(screen.getByRole('button', { name: /open submission from sun 14 jun/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open submission from sun 21 jun/i })).toBeNull();
  });

  it('year dropdown filters out other years', () => {
    const withPrior = [...SUBS, { id: 'y1', weekStarting: '2025-03-02', status: 'submitted', apiSold: 9000, applicationsSold: 2 }];
    renderTab({ submissions: withPrior });
    fireEvent.change(screen.getByLabelText(/filter by year/i), { target: { value: '2025' } });
    expect(screen.getByRole('button', { name: /open submission from sun 02 mar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open submission from sun 14 jun/i })).toBeNull();
  });
});

describe('HistoryTab v2 — WeekCard badges + deltas', () => {
  it('marks the max-API submitted week as BEST WEEK', () => {
    renderTab();
    const card = screen.getByRole('button', { name: /open submission from sun 14 jun/i });
    expect(within(card).getByText(/best week/i)).toBeInTheDocument();
  });

  it('shows delta magnitude on the API chip vs prior week', () => {
    renderTab();
    // w3 (15000) vs prior w2 (25000) → API down 10000 → magnitude "10K".
    const card = screen.getByRole('button', { name: /open submission from sun 21 jun/i });
    expect(within(card).getByText(/▼\s*10K/)).toBeInTheDocument();
  });
});
