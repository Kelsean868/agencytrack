// @vitest-environment jsdom
//
// D4 (commission-v2-s2) — CommissionAnchorStrip no-goal state.
// The no-goal state now shows YTD earned + run-rate (goal-independent data)
// and suppresses the gap figure. CTA is preserved.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import CommissionAnchorStrip from '../CommissionAnchorStrip';

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
