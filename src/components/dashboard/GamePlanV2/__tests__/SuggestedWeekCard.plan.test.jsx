// @vitest-environment jsdom
//
// Weekly Planner v2 Slice 2 — SuggestedWeekCard planning modes (edit / commit /
// committed / reset). The Slice-1 read-only states live in SuggestedWeekCard.test.jsx
// and stay untouched; these tests exercise the new props (onCommit / committedPlan /
// planBusy / planError) that gate the planning UI.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

import SuggestedWeekCard from '../SuggestedWeekCard';

// ≥8 submitted weeks → derived mode.
const derivedSubmissions = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i}`, status: 'submitted', ciConducted: 5, applicationsSold: 2, referralCalls: 20,
}));
const sparseSubmissions = Array.from({ length: 3 }, (_, i) => ({
  id: `w${i}`, status: 'submitted', ciConducted: 5, applicationsSold: 2, referralCalls: 20,
}));

const FLOORS = {
  callsMade: 100, contactsMade: 40, factFindsCompleted: 8,
  closingInterviewsKept: 5, applicationsSubmitted: 3,
};

const committedPlan = {
  id: 'agent-1_2026-06-07',
  agentId: 'agent-1',
  targets: { callsMade: 120, contactsMade: 45, factFindsCompleted: 8, closingInterviewsKept: 6, applicationsSubmitted: 4 },
  provenance: { callsMade: 'agent', contactsMade: 'agent', factFindsCompleted: 'floor', closingInterviewsKept: 'derived', applicationsSubmitted: 'derived' },
  committedAt: { toDate: () => new Date('2026-06-04T12:00:00Z') },
};

describe('SuggestedWeekCard — Slice 2 planning (gated on onCommit)', () => {
  it('read-only parity: no planning UI when onCommit is absent', () => {
    render(<SuggestedWeekCard committedAnnualAPI={120000} submissions={derivedSubmissions} floors={FLOORS} />);
    expect(screen.getByTestId('suggested-week-derived')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-this-week')).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('derived state: "Plan this week" opens 5 floor-clamped steppers', () => {
    render(
      <SuggestedWeekCard committedAnnualAPI={120000} submissions={derivedSubmissions} floors={FLOORS} onCommit={vi.fn()} />,
    );
    expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument(); // planning enabled
    fireEvent.click(screen.getByTestId('plan-this-week'));
    const edit = screen.getByTestId('weekly-plan-edit');
    ['callsMade', 'contactsMade', 'factFindsCompleted', 'closingInterviewsKept', 'applicationsSubmitted'].forEach((k) => {
      expect(within(edit).getByTestId(`plan-step-${k}-value`)).toBeInTheDocument();
    });
  });

  it('floor state also offers planning (all five from floor)', () => {
    render(
      <SuggestedWeekCard committedAnnualAPI={120000} submissions={sparseSubmissions} floors={FLOORS} onCommit={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('plan-this-week'));
    const edit = screen.getByTestId('weekly-plan-edit');
    expect(within(edit).getByTestId('plan-step-callsMade-value')).toHaveTextContent('100');
  });

  it('stepper clamps at the floor: decrement disabled, increment flips provenance to Custom', () => {
    render(
      <SuggestedWeekCard committedAnnualAPI={120000} submissions={sparseSubmissions} floors={FLOORS} onCommit={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('plan-this-week'));
    // contactsMade seeds at its floor (40) → decrement disabled.
    expect(screen.getByTestId('plan-step-contactsMade-dec')).toBeDisabled();
    expect(screen.getByTestId('plan-step-contactsMade-value')).toHaveTextContent('40');
    fireEvent.click(screen.getByTestId('plan-step-contactsMade-inc'));
    expect(screen.getByTestId('plan-step-contactsMade-value')).toHaveTextContent('41');
    expect(screen.getByTestId('plan-step-contactsMade-dec')).toBeEnabled();
  });

  it('Reset returns steppers to the current suggestions', () => {
    render(
      <SuggestedWeekCard committedAnnualAPI={120000} submissions={sparseSubmissions} floors={FLOORS} onCommit={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('plan-this-week'));
    fireEvent.click(screen.getByTestId('plan-step-callsMade-inc'));
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('101');
    fireEvent.click(screen.getByTestId('weekly-plan-reset'));
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('100');
  });

  it('Commit calls onCommit with targets, provenance, and the anchor', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(
      <SuggestedWeekCard committedAnnualAPI={120000} submissions={sparseSubmissions} floors={FLOORS} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByTestId('plan-this-week'));
    fireEvent.click(screen.getByTestId('plan-step-callsMade-inc')); // → callsMade 101, provenance 'agent'
    fireEvent.click(screen.getByTestId('weekly-plan-commit'));
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    const [targets, provenance, anchor] = onCommit.mock.calls[0];
    expect(targets.callsMade).toBe(101);
    expect(provenance.callsMade).toBe('agent');
    expect(anchor).toBe(120000);
  });

  it('committed plan renders "Your weekly plan" with values + provenance chips + Edit', () => {
    render(
      <SuggestedWeekCard
        committedAnnualAPI={120000}
        submissions={derivedSubmissions}
        floors={FLOORS}
        onCommit={vi.fn()}
        committedPlan={committedPlan}
      />,
    );
    expect(screen.getByText(/your weekly plan/i)).toBeInTheDocument();
    const committed = screen.getByTestId('weekly-plan-committed');
    expect(within(committed).getByTestId('plan-committed-callsMade-value')).toHaveTextContent('120');
    expect(within(committed).getAllByText('Custom').length).toBe(2);    // two 'agent'-provenance metrics
    expect(within(committed).getAllByText('Personal').length).toBe(2);  // two 'derived'-provenance metrics
    expect(within(committed).getByText('Floor')).toBeInTheDocument();   // one 'floor'-provenance metric
    expect(within(committed).getByText(/committed/i)).toBeInTheDocument();
    // The read-only suggestion is replaced by the committed view.
    expect(screen.queryByTestId('suggested-week-derived')).not.toBeInTheDocument();
  });

  it('Cancel discards stepper changes and returns to the read-only suggestion (no write)', () => {
    const onCommit = vi.fn();
    render(
      <SuggestedWeekCard committedAnnualAPI={120000} submissions={sparseSubmissions} floors={FLOORS} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByTestId('plan-this-week'));
    fireEvent.click(screen.getByTestId('plan-step-callsMade-inc')); // dirty the state → 101
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('101');
    fireEvent.click(screen.getByTestId('weekly-plan-cancel'));
    // Back to the read-only suggestion, no commit attempted.
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByTestId('weekly-plan-edit')).not.toBeInTheDocument();
    expect(screen.getByTestId('suggested-week-floor')).toBeInTheDocument();
    // Re-opening shows the pristine suggestion (the +1 was discarded).
    fireEvent.click(screen.getByTestId('plan-this-week'));
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('100');
  });

  it('Cancel from a committed-plan edit returns to the committed view unchanged', () => {
    render(
      <SuggestedWeekCard
        committedAnnualAPI={120000}
        submissions={derivedSubmissions}
        floors={FLOORS}
        onCommit={vi.fn()}
        committedPlan={committedPlan}
      />,
    );
    fireEvent.click(screen.getByTestId('weekly-plan-edit-btn'));
    fireEvent.click(screen.getByTestId('plan-step-callsMade-inc')); // 120 → 121
    fireEvent.click(screen.getByTestId('weekly-plan-cancel'));
    const committed = screen.getByTestId('weekly-plan-committed');
    // Committed values are untouched (still 120, the +1 was discarded).
    expect(within(committed).getByTestId('plan-committed-callsMade-value')).toHaveTextContent('120');
    expect(screen.queryByTestId('weekly-plan-edit')).not.toBeInTheDocument();
  });

  it('Edit on a malformed committed plan (no targets) falls back to the suggestion', () => {
    render(
      <SuggestedWeekCard
        committedAnnualAPI={120000}
        submissions={sparseSubmissions}
        floors={FLOORS}
        onCommit={vi.fn()}
        committedPlan={{ id: 'x', agentId: 'a', committedAt: { toDate: () => new Date('2026-06-04') } }}
      />,
    );
    fireEvent.click(screen.getByTestId('weekly-plan-edit-btn'));
    // Steppers seed from the floor suggestion, not undefined.
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('100');
  });

  it('Edit on a committed plan seeds steppers from the stored values', () => {
    render(
      <SuggestedWeekCard
        committedAnnualAPI={120000}
        submissions={derivedSubmissions}
        floors={FLOORS}
        onCommit={vi.fn()}
        committedPlan={committedPlan}
      />,
    );
    fireEvent.click(screen.getByTestId('weekly-plan-edit-btn'));
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('120');
    expect(screen.getByTestId('plan-step-closingInterviewsKept-value')).toHaveTextContent('6');
  });

  it('surfaces a save error and stays in edit mode', () => {
    render(
      <SuggestedWeekCard
        committedAnnualAPI={120000}
        submissions={sparseSubmissions}
        floors={FLOORS}
        onCommit={vi.fn()}
        planError
      />,
    );
    fireEvent.click(screen.getByTestId('plan-this-week'));
    expect(screen.getByTestId('weekly-plan-error')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-plan-edit')).toBeInTheDocument();
  });
});
