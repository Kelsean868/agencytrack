// @vitest-environment jsdom
//
// Track J item 14 — SuggestedWeekCard state coverage.
//
// Unit-level closure of the #445 Weekly Planner smoke-gap FU: the suggested-week
// card has five honest-framing resolutions (loading · error · no-anchor · floor
// fallback · derived) that the Slice-1 smoke could not exercise. These tests
// drive each state through the REAL goalDecomposition engine (no engine mock) —
// fixtures shape `submissions` so deriveRatiosFromHistory crosses the 8-week
// history threshold for the derived path and falls short for the floor path.
//
// Zero src changes — the shipped data-testids (suggested-week-card / -error /
// -no-anchor / -floor / -derived / -reveal) are sufficient.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import SuggestedWeekCard from '../SuggestedWeekCard';

// ── Fixtures ────────────────────────────────────────────────────────────────
// ≥8 submitted weeks with non-zero CI / apps / dials → deriveRatiosFromHistory
// returns hasHistory:true → derived mode.
const derivedSubmissions = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i}`,
  status: 'submitted',
  ciConducted: 5,
  applicationsSold: 2,
  referralCalls: 20,
}));

// <8 submitted weeks → hasHistory:false → floor fallback mode.
const sparseSubmissions = Array.from({ length: 3 }, (_, i) => ({
  id: `w${i}`,
  status: 'submitted',
  ciConducted: 5,
  applicationsSold: 2,
  referralCalls: 20,
}));

const FLOORS = {
  callsMade: 100,
  contactsMade: 40,
  factFindsCompleted: 8,
  closingInterviewsKept: 5,
  applicationsSubmitted: 3,
};

describe('SuggestedWeekCard — resolution states', () => {
  it('always renders the card shell with eyebrow + read-only badge', () => {
    render(<SuggestedWeekCard committedAnnualAPI={null} />);
    expect(screen.getByTestId('suggested-week-card')).toBeInTheDocument();
    expect(screen.getByText(/suggested weekly plan/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('loading → skeleton, no resolution body', () => {
    render(<SuggestedWeekCard loading committedAnnualAPI={120000} submissions={derivedSubmissions} />);
    expect(screen.getByLabelText(/loading your suggested week/i)).toBeInTheDocument();
    expect(screen.queryByTestId('suggested-week-derived')).not.toBeInTheDocument();
    expect(screen.queryByTestId('suggested-week-no-anchor')).not.toBeInTheDocument();
  });

  it('error → error panel + retry wired to onRetry', () => {
    const onRetry = vi.fn();
    render(<SuggestedWeekCard error committedAnnualAPI={120000} onRetry={onRetry} />);
    expect(screen.getByTestId('suggested-week-error')).toBeInTheDocument();
    expect(screen.getByText(/couldn.?t load your suggested plan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no anchor → CTA prompt wired to onBuildPlan', () => {
    const onBuildPlan = vi.fn();
    render(<SuggestedWeekCard committedAnnualAPI={null} onBuildPlan={onBuildPlan} />);
    expect(screen.getByTestId('suggested-week-no-anchor')).toBeInTheDocument();
    expect(screen.getByText(/set a plan to see your week/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /build your game plan/i }));
    expect(onBuildPlan).toHaveBeenCalledTimes(1);
  });

  it('treats a zero/negative committed API as no-anchor', () => {
    render(<SuggestedWeekCard committedAnnualAPI={0} submissions={derivedSubmissions} />);
    expect(screen.getByTestId('suggested-week-no-anchor')).toBeInTheDocument();
  });

  it('anchor but < 8 weeks history → floor fallback (5 metrics + company-floor label)', () => {
    render(
      <SuggestedWeekCard
        committedAnnualAPI={120000}
        submissions={sparseSubmissions}
        floors={FLOORS}
      />,
    );
    const floor = screen.getByTestId('suggested-week-floor');
    expect(floor).toBeInTheDocument();
    // All five floor metric concepts render on the floor path.
    // calls relabeled "Prospecting calls" (ratified 2026-06-04, serviceCalls excluded).
    ['Prospecting calls', 'Contacts', 'FFIs', 'CIs', 'Apps'].forEach((label) => {
      expect(within(floor).getByText(label)).toBeInTheDocument();
    });
    // Floor values come straight from the floors prop.
    expect(within(floor).getByText('100')).toBeInTheDocument();
    expect(within(floor).getByText('40')).toBeInTheDocument();
    // Capital-C label ("⎯ Company floor") — case-sensitive to avoid matching the
    // lowercase "…based on the company floor…" explanatory sentence below it.
    expect(within(floor).getByText(/Company floor/)).toBeInTheDocument();
    // It is NOT the derived path.
    expect(screen.queryByTestId('suggested-week-derived')).not.toBeInTheDocument();
  });

  it('floor fallback renders an em-dash for any missing floor key', () => {
    render(
      <SuggestedWeekCard committedAnnualAPI={120000} submissions={sparseSubmissions} floors={{ callsMade: 100 }} />,
    );
    const floor = screen.getByTestId('suggested-week-floor');
    // 4 of the 5 keys are absent → four em-dashes.
    expect(within(floor).getAllByText('—')).toHaveLength(4);
  });

  it('anchor + ≥ 8 weeks history → derived line with 3 chips', () => {
    render(<SuggestedWeekCard committedAnnualAPI={120000} submissions={derivedSubmissions} />);
    const derived = screen.getByTestId('suggested-week-derived');
    expect(derived).toBeInTheDocument();
    ['Dials', 'CIs', 'Apps'].forEach((label) => {
      expect(within(derived).getByText(label)).toBeInTheDocument();
    });
    // The reveal chain is collapsed until a chip is tapped.
    expect(screen.queryByTestId('suggested-week-reveal')).not.toBeInTheDocument();
  });

  it('tapping a derived chip expands the derivation chain incl. prospects', () => {
    render(<SuggestedWeekCard committedAnnualAPI={120000} submissions={derivedSubmissions} />);
    const dialsChip = screen.getByRole('button', { name: /dials:.*per week/i });
    expect(dialsChip).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(dialsChip);
    expect(dialsChip).toHaveAttribute('aria-expanded', 'true');
    const reveal = screen.getByTestId('suggested-week-reveal');
    expect(reveal).toBeInTheDocument();
    // The full chain (incl. prospects, which never appears on a chip) is revealed.
    expect(within(reveal).getByText(/prospects \/ wk/i)).toBeInTheDocument();
    expect(within(reveal).getByText(/annual api/i)).toBeInTheDocument();
    // Tapping again collapses it.
    fireEvent.click(dialsChip);
    expect(screen.queryByTestId('suggested-week-reveal')).not.toBeInTheDocument();
  });
});
