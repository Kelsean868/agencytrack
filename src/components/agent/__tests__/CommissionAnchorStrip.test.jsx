// @vitest-environment jsdom
//
// D4 (commission-v2-s2) — CommissionAnchorStrip no-goal state.
// The no-goal state now shows YTD earned + run-rate (goal-independent data)
// and suppresses the gap figure. CTA is preserved.

import React from 'react';
import { describe, it, expect } from 'vitest';
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
    expect(screen.getByRole('button', { name: /go to the ladder/i })).toBeInTheDocument();
  });
});
