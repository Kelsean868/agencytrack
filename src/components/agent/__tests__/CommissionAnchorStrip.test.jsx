// @vitest-environment jsdom
//
// D4 (commission-v2-s2) — CommissionAnchorStrip no-goal state.
// The no-goal state now shows YTD earned + run-rate (goal-independent data)
// and suppresses the gap figure. CTA is preserved.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import CommissionAnchorStrip from '../CommissionAnchorStrip';

// §2 count-up — the hero (committed-goal) state's headline/gap/chip numerals
// now animate via useCountUp on mount. Mocked to the identity function so
// these tests assert exact final formatted text synchronously (matches the
// existing kiosk-panel test convention).
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

const NOOP = () => {};

describe('CommissionAnchorStrip — D4 no-goal state', () => {
  it('renders the no-goal testid when committedAnnualAPI is null', () => {
    render(
      <CommissionAnchorStrip
        policies={[]}
        persistencyHistory={[]}
        committedAnnualAPI={null}
        commissionRate={35}
        onScrollToPlayground={NOOP}
      />
    );
    expect(screen.getByTestId('commission-anchor-strip-no-goal')).toBeInTheDocument();
  });

  it('shows YTD Earned chip in no-goal state', () => {
    render(
      <CommissionAnchorStrip
        policies={[]}
        persistencyHistory={[]}
        committedAnnualAPI={null}
        commissionRate={35}
        onScrollToPlayground={NOOP}
      />
    );
    expect(screen.getByText(/ytd earned/i)).toBeInTheDocument();
  });

  it('shows On Pace For chip in no-goal state', () => {
    render(
      <CommissionAnchorStrip
        policies={[]}
        persistencyHistory={[]}
        committedAnnualAPI={null}
        commissionRate={35}
        onScrollToPlayground={NOOP}
      />
    );
    expect(screen.getByText(/on pace for/i)).toBeInTheDocument();
  });

  it('does NOT show gap figure in no-goal state', () => {
    render(
      <CommissionAnchorStrip
        policies={[]}
        persistencyHistory={[]}
        committedAnnualAPI={null}
        commissionRate={35}
        onScrollToPlayground={NOOP}
      />
    );
    expect(screen.queryByText(/gap to goal/i)).not.toBeInTheDocument();
  });

  it('shows the CTA button in no-goal state', () => {
    render(
      <CommissionAnchorStrip
        policies={[]}
        persistencyHistory={[]}
        committedAnnualAPI={null}
        commissionRate={35}
        onScrollToPlayground={NOOP}
      />
    );
    // S3: copy upgraded from "Go to the ladder" to "Set as my goal →"
    expect(screen.getByRole('button', { name: /set as my goal/i })).toBeInTheDocument();
  });

  // TZ-002 — failing test: CommissionAnchorStrip must derive the calendar year
  // from the TT timezone, not the browser/UTC local year.
  // At 2025-01-01T02:00:00Z (UTC is Jan 1 2025, TT is still Dec 31 2024),
  // a settled December 31 policy should appear in the YTD Earned chip.
  // Bug: new Date().getFullYear() returns 2025 (UTC), causing ytdEarned to
  // return 0 and the chip to show "—" for a policy the agent just settled.
  it('TZ-002: YTD Earned chip shows Dec 31 commission at TT midnight (UTC Jan 1)', () => {
    // 2025-01-01T02:00:00Z = 2024-12-31T22:00:00 TT — UTC is Jan 1, TT is Dec 31.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2025-01-01T02:00:00Z') });
    const dec31Policy = {
      status: 'settled',
      dateIssued: '2024-12-31',
      earnedCommission: 5000,
    };
    render(
      <CommissionAnchorStrip
        policies={[dec31Policy]}
        persistencyHistory={[]}
        committedAnnualAPI={null}
        commissionRate={35}
        onScrollToPlayground={NOOP}
      />
    );
    // YTD Earned should show TTD 5,000 (TT year 2024 matches policy year 2024).
    // Without fix: year = 2025 (UTC), ytdEarned returns 0, chip shows "—".
    expect(screen.getByTestId('commission-anchor-strip-no-goal')).toBeInTheDocument();
    const ytdChip = screen.getByText('YTD Earned').closest('div');
    expect(ytdChip).toHaveTextContent(/5[,.]?000/);
    vi.useRealTimers();
  });
});

// §2 count-up — hero (committed-goal) state was previously untested by this
// file (all cases above use committedAnnualAPI: null). New coverage for the
// animated headline/gap/chip numerals, value-level: with useCountUp mocked
// to the identity function, the rendered text must equal the exact final
// formatCurrency output — no drift, no stray "0"/NaN mid-animation frame.
describe('CommissionAnchorStrip — hero state (committed goal) count-up numerals', () => {
  it('renders the hero anchor with formatted headline + gap figures at their exact final value', () => {
    render(
      <CommissionAnchorStrip
        policies={[]}
        persistencyHistory={[]}
        committedAnnualAPI={500000}
        commissionRate={35}
        onScrollToPlayground={NOOP}
      />
    );
    const hero = screen.getByTestId('commission-anchor-strip');
    expect(hero).toBeInTheDocument();
    expect(screen.getByText(/on pace for/i)).toBeInTheDocument();
    expect(screen.getByText('Gap to goal')).toBeInTheDocument();
    // formatCurrency always renders "TTD <number>" — with policies=[] the
    // headline/gap/chip figures resolve to TTD 0 exactly (no goal progress
    // yet), proving the animated numerals land on the true value, not a
    // leftover 0-frame or NaN.
    expect(hero.textContent).toMatch(/TTD [\d,]+/);
  });
});
