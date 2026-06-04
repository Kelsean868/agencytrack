// @vitest-environment jsdom
//
// Weekly Planner v2 Slice 3b — StandardDetail drawer: three honest states.
//   1. No-plan:        floor-only + nudge link (D4 state 1)
//   2. Committed/mid-week: plan-metric mini tracks + "mid-week · daily capture"
//      chip; calls hatched (no daily source) (D4 state 2 / D3 mid-week)
//   3. Committed/final:  plan-metric mini tracks + "final · submitted" chip;
//      calls resolved to the 4-sum prospecting calls (D4 state 3 / D3 final)

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Fix "today" to Thursday of the plan week (2026-06-07 Sun → elapsed 4)
vi.mock('../../../../utils/dateInputs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getTodayTT: () => '2026-06-11' };
});

import StandardDetail from '../StandardDetail';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../../utils/weeklyActivityFloors';

const WEEK_START = '2026-06-07';
const MINIMUMS = { weeklyActivityFloors: DEFAULT_WEEKLY_ACTIVITY_FLOORS };

const COMMITTED_PLAN = {
  targets: {
    callsMade: 50, contactsMade: 40, factFindsCompleted: 12,
    closingInterviewsKept: 6, applicationsSubmitted: 2,
  },
  provenance: {
    callsMade: 'agent', contactsMade: 'floor', factFindsCompleted: 'agent',
    closingInterviewsKept: 'derived', applicationsSubmitted: 'derived',
  },
};

const DAILY_DOCS = [{
  qualifiedApproaches: 20, ffiConducted: 6, ciConducted: 5, newBusiness: { apps: 2 },
}];

// A v2 flat submitted weekly report
const FINAL_SUBMISSION = {
  status: 'submitted', weekStarting: WEEK_START, version: 2,
  referralCalls: 10, followUpCalls: 5, coldCalls: 3, seminarTradeshowCalls: 2, serviceCalls: 4,
  qualifiedApproaches: 40, ffiConducted: 12, ciConducted: 6,
  newBusiness: { apps: 2, api: 24000 },
};

const BASE_PROPS = {
  minimums: MINIMUMS,
  currentWeekSub: null,
  committedPlan: null,
  dailyDocs: [],
  weekStart: WEEK_START,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  onOpenGamePlan: vi.fn(),
};

describe('StandardDetail — loading (committedPlan undefined)', () => {
  it('renders a skeleton while the plan fetch is in-flight', () => {
    render(<StandardDetail {...BASE_PROPS} committedPlan={undefined} />);
    const rows = document.querySelectorAll('.animate-pulse');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('StandardDetail — no-plan state (D4 state 1)', () => {
  it('renders the drawer with 10 floor rows and the nudge link', () => {
    render(<StandardDetail {...BASE_PROPS} committedPlan={null} />);
    // All 10 floor-row labels present (calls relabeled "Prospecting calls" — ratified 2026-06-04)
    expect(screen.getByText('Prospecting calls')).toBeInTheDocument();
    expect(screen.getByText('Contacts Made')).toBeInTheDocument();
    expect(screen.getByText('Appointments Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Fact Finds Completed')).toBeInTheDocument();
    expect(screen.getByText('Closing Interviews Kept')).toBeInTheDocument();
    expect(screen.getByText('Applications Submitted')).toBeInTheDocument();
  });

  it('shows the "Commit a plan" nudge that fires onOpenGamePlan', () => {
    const onOpenGamePlan = vi.fn();
    render(<StandardDetail {...BASE_PROPS} committedPlan={null} onOpenGamePlan={onOpenGamePlan} />);
    const nudge = screen.getByTestId('standard-drawer-game-plan-nudge');
    expect(nudge).toBeInTheDocument();
    fireEvent.click(nudge);
    expect(onOpenGamePlan).toHaveBeenCalledTimes(1);
  });

  it('does NOT show a source chip when no plan is committed', () => {
    render(<StandardDetail {...BASE_PROPS} committedPlan={null} />);
    expect(screen.queryByTestId('standard-drawer-source-chip')).not.toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<StandardDetail {...BASE_PROPS} committedPlan={null} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('StandardDetail — mid-week / daily source (D3 + D4 state 2)', () => {
  function renderMidWeek() {
    return render(
      <StandardDetail
        {...BASE_PROPS}
        committedPlan={COMMITTED_PLAN}
        dailyDocs={DAILY_DOCS}
        weekStart={WEEK_START}
        currentWeekSub={null}
      />,
    );
  }

  it('shows the "mid-week · daily capture" source chip', () => {
    renderMidWeek();
    expect(screen.getByTestId('standard-drawer-source-chip')).toHaveTextContent(/mid-week · daily capture/i);
  });

  it('renders mini-track rows for the 5 plan metrics', () => {
    renderMidWeek();
    ['callsMade', 'contactsMade', 'factFindsCompleted', 'closingInterviewsKept', 'applicationsSubmitted'].forEach((k) => {
      expect(screen.getByTestId(`drawer-plan-row-${k}`)).toBeInTheDocument();
    });
  });

  it('calls row is hatched (no daily source mid-week)', () => {
    renderMidWeek();
    expect(screen.getByTestId('drawer-nodaily-callsMade')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-actual-callsMade')).not.toBeInTheDocument();
  });

  it('daily-sourced metrics show actuals from the aggregate', () => {
    renderMidWeek();
    expect(screen.getByTestId('drawer-actual-contactsMade')).toHaveTextContent('20');
    expect(screen.getByTestId('drawer-actual-factFindsCompleted')).toHaveTextContent('6');
    expect(screen.getByTestId('drawer-actual-closingInterviewsKept')).toHaveTextContent('5');
    expect(screen.getByTestId('drawer-actual-applicationsSubmitted')).toHaveTextContent('2');
  });

  it('non-plan rows (appointments, interviews-kept, clients-sold, api, new-names) still render as standard floor rows', () => {
    renderMidWeek();
    // These labels come from WEEKLY_ACTIVITY_FLOOR_ROWS and are rendered by StandardRow
    expect(screen.getByText('Appointments Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Interviews Kept')).toBeInTheDocument();
    expect(screen.getByText('Clients Sold')).toBeInTheDocument();
  });

  it('nudge is absent when a plan is committed', () => {
    renderMidWeek();
    expect(screen.queryByTestId('standard-drawer-game-plan-nudge')).not.toBeInTheDocument();
  });
});

describe('StandardDetail — final / submitted source (D3 + D4 state 3)', () => {
  function renderFinal() {
    return render(
      <StandardDetail
        {...BASE_PROPS}
        committedPlan={COMMITTED_PLAN}
        dailyDocs={[]}
        weekStart={WEEK_START}
        currentWeekSub={FINAL_SUBMISSION}
      />,
    );
  }

  it('shows the "final · submitted" source chip', () => {
    renderFinal();
    expect(screen.getByTestId('standard-drawer-source-chip')).toHaveTextContent(/final · submitted/i);
  });

  // Consciously evolved: 4-sum prospecting calls (ratified 2026-06-04, serviceCalls excluded).
  it('calls resolves to the 4-sum prospecting calls — serviceCalls excluded', () => {
    renderFinal();
    // 10+5+3+2 = 20 (serviceCalls=4 EXCLUDED)
    expect(screen.getByTestId('drawer-actual-callsMade')).toHaveTextContent('20');
  });

  it('contacts resolves from the submission qualifiedApproaches', () => {
    renderFinal();
    expect(screen.getByTestId('drawer-actual-contactsMade')).toHaveTextContent('40');
  });

  it('calls row is NOT hatched when the final source is active', () => {
    renderFinal();
    expect(screen.queryByTestId('drawer-nodaily-callsMade')).not.toBeInTheDocument();
    expect(screen.getByTestId('drawer-actual-callsMade')).toBeInTheDocument();
  });
});

describe('StandardDetail — D5 contrast (no text-ink-faint on new text)', () => {
  it('renders without any text-ink-faint class on text nodes in the committed view', () => {
    const { container } = render(
      <StandardDetail
        {...BASE_PROPS}
        committedPlan={COMMITTED_PLAN}
        dailyDocs={DAILY_DOCS}
        weekStart={WEEK_START}
      />,
    );
    // The decorative floor-tick bg-ink-faint (a background on a div) is allowed;
    // check that no text element carries the class.
    const faintTextEls = container.querySelectorAll('.text-ink-faint');
    expect(faintTextEls.length).toBe(0);
  });
});
