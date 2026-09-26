// @vitest-environment jsdom
//
// Home redesign R1 blocks 4 + 5 — Do next and This week, and the pure
// derivations behind them (homeDerivations.js).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DoNextList from '../DoNextList';
import ThisWeekTiles from '../ThisWeekTiles';
import {
  buildDoNextItems, thisWeekActuals, firstBehindStandardRow, formatHomeHeaderDate, weeklyFloors,
} from '../homeDerivations';

const GATE_BELOW = { threshold: 90, meetsThreshold: false, gap: { reinstateNeeded: 8154.95, settledApiNeeded: 40000 } };
const GATE_MET = { threshold: 90, meetsThreshold: true, gap: { reinstateNeeded: 0, settledApiNeeded: 0 } };
const BEHIND = { key: 'factFindsCompleted', needed: 2, noun: 'fact-finds' };

describe('buildDoNextItems — each item appears only on its condition', () => {
  it('confirm: shown with a count, hidden at 0 or unknown', () => {
    expect(buildDoNextItems({ awaitingConfirmCount: 4 })[0]).toMatchObject({
      id: 'confirm', title: 'Confirm settled policies', sub: '4 waiting', target: 'ledger-confirm',
    });
    expect(buildDoNextItems({ awaitingConfirmCount: 0 })).toEqual([]);
    expect(buildDoNextItems({ awaitingConfirmCount: null })).toEqual([]);
  });

  it('win back: shown below the gate with reinstateNeeded (rounded up); hidden at or above it', () => {
    expect(buildDoNextItems({ gateMonth: GATE_BELOW })[0]).toMatchObject({
      id: 'winback', title: 'Win back a lapsed policy', sub: 'TTD 8,155 reinstated clears the 90% gate', target: 'persistency',
    });
    expect(buildDoNextItems({ gateMonth: GATE_MET })).toEqual([]);
    expect(buildDoNextItems({ gateMonth: null })).toEqual([]);
  });

  it('standard: shown when behind, naming the activity and the shortfall', () => {
    expect(buildDoNextItems({ behind: BEHIND })[0]).toMatchObject({
      id: 'standard', title: 'Log 2 more fact-finds', sub: "To meet this week's standard", target: 'daily-log',
    });
    expect(buildDoNextItems({ behind: null })).toEqual([]);
  });

  it('keeps display order and caps at three', () => {
    const items = buildDoNextItems({ awaitingConfirmCount: 1, gateMonth: GATE_BELOW, behind: BEHIND });
    expect(items.map((i) => i.id)).toEqual(['confirm', 'winback', 'standard']);
  });
});

describe('DoNextList', () => {
  it('renders each item as a button that reports its target', () => {
    const onSelect = vi.fn();
    render(<DoNextList items={buildDoNextItems({ gateMonth: GATE_BELOW })} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('do-next-winback'));
    expect(onSelect).toHaveBeenCalledWith('persistency');
    expect(screen.queryByTestId('do-next-on-track')).not.toBeInTheDocument();
  });

  it('none apply → one line "You\'re on track this week."', () => {
    render(<DoNextList items={[]} />);
    expect(screen.getByTestId('do-next-on-track')).toHaveTextContent("You're on track this week.");
  });

  it('loading → skeleton, no on-track claim', () => {
    render(<DoNextList items={[]} loading />);
    expect(screen.getByTestId('do-next-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('do-next-on-track')).not.toBeInTheDocument();
  });

  it('ledger error → says checks are incomplete (with Retry) instead of claiming on-track', () => {
    const onRetry = vi.fn();
    render(<DoNextList items={[]} incomplete onRetry={onRetry} />);
    expect(screen.getByTestId('do-next-incomplete')).toBeInTheDocument();
    expect(screen.queryByTestId('do-next-on-track')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('thisWeekActuals', () => {
  const submitted = { status: 'submitted', weekStarting: '2026-09-20', referralCalls: 10, coldCalls: 32, ffiConducted: 3, ciConducted: 1, applicationsSold: 1 };

  it('a submitted report is final for every key', () => {
    const a = thisWeekActuals({ currentWeekSub: submitted, dailyDocs: [] });
    expect(a.source).toBe('final');
    expect(a.values.callsMade).toBe(42);
    expect(a.values.factFindsCompleted).toBe(3);
  });

  it('mid-week: daily-log keys from the daily entries; calls unknown (null) without a draft', () => {
    const a = thisWeekActuals({ currentWeekSub: null, dailyDocs: [{ ffiConducted: 2, ciConducted: 1, newBusiness: { apps: 1 } }] });
    expect(a.source).toBe('daily');
    expect(a.values.callsMade).toBeNull();
    expect(a.values.factFindsCompleted).toBe(2);
    expect(a.values.applicationsSubmitted).toBe(1);
  });

  it('mid-week with a draft: the larger of draft and daily, never the sum', () => {
    const draft = { ...submitted, status: 'draft', ffiConducted: 1 };
    const a = thisWeekActuals({ currentWeekSub: draft, dailyDocs: [{ ffiConducted: 2 }, { ffiConducted: 1 }] });
    expect(a.values.factFindsCompleted).toBe(3);
    expect(a.values.callsMade).toBe(42);
  });
});

describe('firstBehindStandardRow', () => {
  const floors = weeklyFloors({});

  it('returns the first row behind pace, in table order, with the shortfall to the floor', () => {
    const actuals = { source: 'daily', values: { callsMade: null, telContacts: 40, appointmentsScheduled: 20, interviewsKept: 15, factFindsCompleted: 1, closingInterviewsKept: 0 } };
    // Thursday (4 working days elapsed): fact finds 1 of 10 is behind pace.
    const row = firstBehindStandardRow({ floors, actuals, elapsed: 4 });
    expect(row).toEqual({ key: 'factFindsCompleted', needed: 9, noun: 'fact-finds' });
  });

  it('never "behind" on the first working day, and skips unknown actuals', () => {
    const actuals = { source: 'daily', values: { callsMade: null, factFindsCompleted: 0 } };
    expect(firstBehindStandardRow({ floors, actuals, elapsed: 1 })).toBeNull();
  });

  it('null when every known row is on pace', () => {
    const values = Object.fromEntries(Object.entries(floors).map(([k, v]) => [k, v]));
    expect(firstBehindStandardRow({ floors, actuals: { source: 'final', values }, elapsed: 6 })).toBeNull();
  });
});

describe('formatHomeHeaderDate', () => {
  it('SAT 26 SEP · WEEK 39', () => {
    expect(formatHomeHeaderDate('2026-09-26')).toBe('SAT 26 SEP · WEEK 39');
    expect(formatHomeHeaderDate('bad')).toBeNull();
  });
});

describe('ThisWeekTiles — loading / error / unknown', () => {
  const floors = weeklyFloors({});

  it('renders four tiles with done / target', () => {
    render(<ThisWeekTiles floors={floors} actuals={{ source: 'final', values: { callsMade: 42, factFindsCompleted: 3, closingInterviewsKept: 1, applicationsSubmitted: 1 } }} />);
    expect(screen.getByTestId('this-week-calls')).toHaveTextContent('42/60');
    expect(screen.getByTestId('this-week-ffis')).toHaveTextContent('3/10');
    expect(screen.getByTestId('this-week-cis')).toHaveTextContent('1/10');
    expect(screen.getByTestId('this-week-apps')).toHaveTextContent('1/1');
  });

  it('an unknown figure shows "—", never a confident 0', () => {
    render(<ThisWeekTiles floors={floors} actuals={{ source: 'daily', values: { callsMade: null, factFindsCompleted: 0 } }} />);
    expect(screen.getByTestId('this-week-calls')).toHaveTextContent('—/60');
  });

  it('loading → skeleton; error → inline alert', () => {
    const { unmount } = render(<ThisWeekTiles floors={floors} actuals={null} loading />);
    expect(screen.getByTestId('this-week-loading')).toBeInTheDocument();
    unmount();
    render(<ThisWeekTiles floors={floors} actuals={null} error />);
    expect(screen.getByTestId('this-week-error')).toBeInTheDocument();
  });
});
