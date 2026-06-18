// @vitest-environment jsdom
//
// Weekly Planner v2 Slice 3a — SuggestedWeekCard committed-view PACE ROWS.
// The S1 read-only states (SuggestedWeekCard.test.jsx) and S2 planning states
// (SuggestedWeekCard.plan.test.jsx) stay untouched-green; these tests exercise
// the committed view's new plan-vs-actual + variance grammar (source switch,
// hatched calls row, variance chips, preserved S2 testids).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Fix "today" to Thursday of the plan week (2026-06-07 Sun → elapsed 4 working
// days) so variance/pace assertions are deterministic. parseDateOnlyTT stays real.
vi.mock('../../../../utils/dateInputs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getTodayTT: () => '2026-06-11' };
});

import SuggestedWeekCard from '../SuggestedWeekCard';

const WEEK_START = '2026-06-07';
const FLOORS = {
  callsMade: 60, telContacts: 40, factFindsCompleted: 10,
  closingInterviewsKept: 10, applicationsSubmitted: 1,
};
// ≥8 submitted weeks → derived mode → planning enabled.
const derivedSubmissions = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i}`, status: 'submitted', ciConducted: 5, applicationsSold: 2, referralCalls: 20,
}));
const committedPlan = {
  id: 'agent-1_2026-06-07',
  agentId: 'agent-1',
  targets: { callsMade: 50, telContacts: 40, factFindsCompleted: 12, closingInterviewsKept: 6, applicationsSubmitted: 2 },
  provenance: { callsMade: 'agent', telContacts: 'floor', factFindsCompleted: 'agent', closingInterviewsKept: 'derived', applicationsSubmitted: 'derived' },
  committedAt: { toDate: () => new Date('2026-06-08T12:00:00Z') },
};

function v2Submission() {
  return {
    version: 2, status: 'submitted', weekStarting: WEEK_START,
    referralCalls: 10, followUpCalls: 5, coldCalls: 3, seminarTradeshowCalls: 2, serviceCalls: 4,
    qualifiedApproaches: 44, ffiConducted: 12, ciConducted: 6, newBusiness: { apps: 2, api: 24000 },
  };
}

function renderDaily(extra = {}) {
  return render(
    <SuggestedWeekCard
      committedAnnualAPI={120000}
      submissions={derivedSubmissions}
      floors={FLOORS}
      onCommit={vi.fn()}
      committedPlan={committedPlan}
      weekStart={WEEK_START}
      dailyDocs={[{ telContacts: 40, ffiConducted: 6, ciConducted: 5, newBusiness: { apps: 2 } }]}
      {...extra}
    />,
  );
}

describe('SuggestedWeekCard — Slice 3a pace rows (mid-week / daily source)', () => {
  it('shows the "mid-week · daily capture" source chip and the live pace readout', () => {
    renderDaily();
    expect(screen.getByTestId('weekly-plan-source-chip')).toHaveTextContent(/mid-week · daily capture/i);
    expect(screen.getByTestId('weekly-plan-pace-readout')).toHaveTextContent(/Day 4 of 6/i);
  });

  it('renders all five pace rows', () => {
    renderDaily();
    ['callsMade', 'telContacts', 'factFindsCompleted', 'closingInterviewsKept', 'applicationsSubmitted'].forEach((k) => {
      expect(screen.getByTestId(`pace-row-${k}`)).toBeInTheDocument();
    });
  });

  it('calls row is the hatched "no daily source" state (no actual, no variance chip)', () => {
    renderDaily();
    expect(screen.getByTestId('pace-nodaily-callsMade')).toHaveTextContent(/weekly only · no daily pace/i);
    expect(screen.queryByTestId('pace-actual-callsMade')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pace-variance-callsMade')).not.toBeInTheDocument();
  });

  it('daily-sourced metrics show actuals from the aggregate', () => {
    renderDaily();
    expect(screen.getByTestId('pace-actual-telContacts')).toHaveTextContent('40');
    expect(screen.getByTestId('pace-actual-factFindsCompleted')).toHaveTextContent('6');
    expect(screen.getByTestId('pace-actual-applicationsSubmitted')).toHaveTextContent('2');
  });

  it('variance states match pace (apps Ahead, FFI Behind, CIs On track)', () => {
    renderDaily();
    expect(screen.getByTestId('pace-variance-applicationsSubmitted')).toHaveTextContent(/Ahead/i);
    expect(screen.getByTestId('pace-variance-factFindsCompleted')).toHaveTextContent(/Behind/i);
    expect(screen.getByTestId('pace-variance-closingInterviewsKept')).toHaveTextContent(/On track/i);
  });

  it('preserves the Slice-2 plan-committed value + provenance idioms', () => {
    renderDaily();
    const committed = screen.getByTestId('weekly-plan-committed');
    expect(within(committed).getByTestId('plan-committed-callsMade-value')).toHaveTextContent('50');
    expect(within(committed).getAllByText('Custom').length).toBe(2);   // two 'agent'
    expect(within(committed).getAllByText('Personal').length).toBe(2); // two 'derived'
    expect(within(committed).getByText('Floor')).toBeInTheDocument();  // one 'floor'
    expect(within(committed).getByText(/committed/i)).toBeInTheDocument();
  });

  it('contacts row is telContacts (real field, no proxy clarifier as of v2 Phase 1b)', () => {
    renderDaily();
    const row = screen.getByTestId('pace-row-telContacts');
    expect(row).toBeInTheDocument();
  });
});

describe('SuggestedWeekCard — Slice 3a pace rows (final / submitted source)', () => {
  function renderFinal() {
    return render(
      <SuggestedWeekCard
        committedAnnualAPI={120000}
        submissions={derivedSubmissions}
        floors={FLOORS}
        onCommit={vi.fn()}
        committedPlan={committedPlan}
        weekStart={WEEK_START}
        weekSubmission={v2Submission()}
        dailyDocs={[]}
      />,
    );
  }

  it('shows the "final · submitted" chip and no live pace readout', () => {
    renderFinal();
    expect(screen.getByTestId('weekly-plan-source-chip')).toHaveTextContent(/final · submitted/i);
    expect(screen.queryByTestId('weekly-plan-pace-readout')).not.toBeInTheDocument();
  });

  // Consciously evolved: 4-sum prospecting calls (ratified 2026-06-04, serviceCalls excluded).
  it('calls resolves to the 4-sum prospecting calls once submitted (no serviceCalls)', () => {
    renderFinal();
    expect(screen.queryByTestId('pace-nodaily-callsMade')).not.toBeInTheDocument();
    expect(screen.getByTestId('pace-actual-callsMade')).toHaveTextContent('20'); // 10+5+3+2; serviceCalls(4) excluded
  });

  it('final actuals come from the submission via extractFields (apps = newBusiness.apps)', () => {
    renderFinal();
    expect(screen.getByTestId('pace-actual-applicationsSubmitted')).toHaveTextContent('2');
    expect(screen.getByTestId('pace-actual-closingInterviewsKept')).toHaveTextContent('6');
  });
});

describe('SuggestedWeekCard — Slice 3a renders under dark theme', () => {
  it('renders the pace rows inside a .dark subtree (token-driven, no per-theme branch)', () => {
    render(
      <div className="dark">
        <SuggestedWeekCard
          committedAnnualAPI={120000}
          submissions={derivedSubmissions}
          floors={FLOORS}
          onCommit={vi.fn()}
          committedPlan={committedPlan}
          weekStart={WEEK_START}
          dailyDocs={[{ telContacts: 40, ffiConducted: 6, ciConducted: 5, newBusiness: { apps: 2 } }]}
        />
      </div>,
    );
    expect(screen.getByTestId('weekly-plan-pace-rows')).toBeInTheDocument();
    expect(screen.getByTestId('pace-nodaily-callsMade')).toBeInTheDocument();
  });
});
