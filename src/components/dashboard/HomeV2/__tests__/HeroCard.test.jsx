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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import HeroCard from '../HeroCard';
import { MDRT_THRESHOLDS_2026 } from '../../../../config/mdrtThresholds/2026';
import { formatCurrency } from '../../../../utils/formatters';

const MDRT_THRESHOLD = MDRT_THRESHOLDS_2026.mdrt;

// §2 count-up — HeroCard's YTD figure now animates via useCountUp on mount.
// Force prefers-reduced-motion so the REAL hook (not a mock) takes its
// synchronous "snap to target" branch — every test below observes the exact
// final value immediately, and this doubles as the reduced-motion/
// final-value correctness coverage (see the dedicated test at the bottom).
function mockMatchMedia(reduced) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  mockMatchMedia(true);
});

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

describe('HeroCard — ledger figures and the R4 reconciliation note (hero-ledger H1)', () => {
  const production = (over = {}) => ({
    year: 2026,
    settled: { api: 87146.28, apps: 5, count: 5 },
    submitted: { api: 123146.28, apps: 6, count: 6, datedByIssue: true, weekApi: 0 },
    weekly: { ytdApi: 30000, weekApi: 4800 },
    mismatch: { ytd: 30000 - 123146.28, week: 4800 },
    ...over,
  });

  it('shows settled apps, submitted API with the dated-by-issue marker, and submitted apps', () => {
    render(<HeroCard ytdApi={87146.28} personalAnnualAPI={MDRT_THRESHOLD} onSubmit={() => {}} production={production()} />);
    expect(screen.getByTestId('hero-settled-api')).toHaveTextContent(formatCurrency(87146.28));
    expect(screen.getByTestId('hero-settled-apps')).toHaveTextContent('5');
    expect(screen.getByTestId('hero-submitted-api')).toHaveTextContent(formatCurrency(123146.28));
    expect(screen.getByTestId('dated-by-issue')).toHaveTextContent(/dated by issue/i);
    expect(screen.getByTestId('hero-submitted-apps')).toHaveTextContent('6');
  });

  it('omits the marker when every submitted policy carries a real submit date', () => {
    const p = production();
    render(<HeroCard ytdApi={1} personalAnnualAPI={MDRT_THRESHOLD} onSubmit={() => {}} production={{ ...p, submitted: { ...p.submitted, datedByIssue: false } }} />);
    expect(screen.queryByTestId('dated-by-issue')).not.toBeInTheDocument();
  });

  it('states both sides of the reconciliation and flags a gap over TTD 1, with a link to the ledger form', () => {
    const onOpenLedgerCreate = vi.fn();
    render(<HeroCard ytdApi={1} personalAnnualAPI={MDRT_THRESHOLD} onSubmit={() => {}} production={production()} onOpenLedgerCreate={onOpenLedgerCreate} />);
    const note = screen.getByTestId('ledger-reconciliation');
    expect(note).toHaveTextContent(
      `Weekly reports say you submitted ${formatCurrency(30000)} this year (${formatCurrency(4800)} this week). Your ledger shows ${formatCurrency(123146.28)}.`,
    );
    expect(screen.getByTestId('ledger-mismatch')).toHaveTextContent(formatCurrency(93146.28));
    fireEvent.click(screen.getByRole('button', { name: /add a policy to your ledger/i }));
    expect(onOpenLedgerCreate).toHaveBeenCalledTimes(1);
  });

  it('never hides the note when the two agree — it says they match', () => {
    render(<HeroCard ytdApi={1} personalAnnualAPI={MDRT_THRESHOLD} onSubmit={() => {}} production={production({ mismatch: { ytd: 0.5, week: 0 } })} />);
    expect(screen.getByTestId('ledger-match')).toHaveTextContent('Matches your weekly reports.');
    expect(screen.queryByTestId('ledger-mismatch')).not.toBeInTheDocument();
  });

  it('shows a loading state, not a confident TTD 0, while the ledger loads', () => {
    render(<HeroCard ytdApi={0} personalAnnualAPI={MDRT_THRESHOLD} onSubmit={() => {}} pending />);
    expect(screen.getByTestId('hero-ledger-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-settled-api')).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the ledger fails to load', () => {
    const onRetry = vi.fn();
    render(<HeroCard ytdApi={0} personalAnnualAPI={MDRT_THRESHOLD} onSubmit={() => {}} error onRetry={onRetry} />);
    expect(screen.getByTestId('hero-ledger-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('HeroCard — §2 count-up numeral (reduced-motion + final-value correctness)', () => {
  it('renders the EXACT ytdApi value immediately under prefers-reduced-motion, including cents (no rounding drift)', () => {
    // Non-round figure with cents — proves useCountUp's decimals:2 option
    // preserves TTD money-correctness rather than truncating to a whole dollar.
    const ytdApi = 123456.78;
    render(<HeroCard ytdApi={ytdApi} personalAnnualAPI={MDRT_THRESHOLD * 2} onSubmit={() => {}} />);
    expect(screen.getByText(formatCurrency(ytdApi))).toBeInTheDocument();
  });
});
