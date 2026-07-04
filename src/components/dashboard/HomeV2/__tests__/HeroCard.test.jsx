// @vitest-environment jsdom
//
// Track J item 23 — HeroCard marker/label + progress logic coverage.
//
// HeroCard had no test file. The riskiest logic is the MDRT-marker on-scale
// gating (the marker/label collision fix: the marker must be HIDDEN when MDRT
// exceeds the goal rather than clamped onto the "Goal" label) plus the goal
// fallback and the pct clamp. Fixtures are expressed relative to the shared
// MDRT_THRESHOLDS_2026.mdrt constant (not a hardcoded number) so they track the source.
// Zero src changes.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import HeroCard from '../HeroCard';
import { MDRT_THRESHOLDS_2026 } from '../../../../config/mdrtThresholds/2026';
import { formatCurrency } from '../../../../utils/formatters';

const MDRT_THRESHOLD = MDRT_THRESHOLDS_2026.mdrt;

describe('HeroCard — progress + MDRT marker logic', () => {
  it('renders the YTD figure and a progressbar with the computed pct', () => {
    const goal = MDRT_THRESHOLD * 2; // on-scale goal
    const ytdApi = goal / 2;
    render(<HeroCard ytdApi={ytdApi} personalAnnualAPI={goal} onSubmit={() => {}} />);
    expect(screen.getByText(formatCurrency(ytdApi))).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps pct to 100 when YTD exceeds the goal', () => {
    const goal = MDRT_THRESHOLD * 2;
    render(<HeroCard ytdApi={goal * 5} personalAnnualAPI={goal} onSubmit={() => {}} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('pct is 0 when YTD is 0', () => {
    render(<HeroCard ytdApi={0} personalAnnualAPI={MDRT_THRESHOLD * 2} onSubmit={() => {}} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('falls back to the MDRT threshold as the goal when no personal goal is set', () => {
    // personalAnnualAPI 0 → goal = MDRT_THRESHOLD; YTD at half → 50%.
    render(<HeroCard ytdApi={MDRT_THRESHOLD / 2} personalAnnualAPI={0} onSubmit={() => {}} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('SHOWS the MDRT marker when MDRT is on-scale (goal ≥ MDRT)', () => {
    render(<HeroCard ytdApi={0} personalAnnualAPI={MDRT_THRESHOLD * 2} onSubmit={() => {}} />);
    expect(screen.getByText(/MDRT/)).toBeInTheDocument();
  });

  it('shows the MDRT marker in the goal-fallback case (goal === MDRT, on-scale)', () => {
    render(<HeroCard ytdApi={0} personalAnnualAPI={0} onSubmit={() => {}} />);
    expect(screen.getByText(/MDRT/)).toBeInTheDocument();
  });

  it('HIDES the MDRT marker when MDRT is off-scale (goal < MDRT) — the collision fix', () => {
    // Personal goal below MDRT → marker must not clamp onto the Goal label.
    render(<HeroCard ytdApi={0} personalAnnualAPI={MDRT_THRESHOLD / 2} onSubmit={() => {}} />);
    expect(screen.queryByText(/MDRT/)).not.toBeInTheDocument();
  });

  it('fires onSubmit when the CTA is clicked', () => {
    const onSubmit = vi.fn();
    render(<HeroCard ytdApi={1000} personalAnnualAPI={MDRT_THRESHOLD} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit weekly report/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
