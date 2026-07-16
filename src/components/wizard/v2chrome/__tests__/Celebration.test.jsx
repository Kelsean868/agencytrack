// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Celebration from '../Celebration';
import { weekNumber } from '../../../../utils/dateHelpers';

vi.mock('../../../../utils/formatters', () => ({
  formatCurrency: (v) => `TTD ${Math.round(Number(v) || 0).toLocaleString('en-US')}`,
}));

// §2 count-up — the API + earned-points stat numerals now animate via
// useCountUp on mount. Mocked to the identity function so these tests keep
// asserting the exact final formatted text synchronously.
vi.mock('../../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

const FORM = {
  newBusiness:  { apps: 2, api: 18400 },
  pppIncreases: { apps: 1, apiIncrease: 6000 },
  lumpsums:     { grossAmount: 60000 },
};

function mockMatchMedia(reduced) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (q) => ({
      matches: reduced && q === '(prefers-reduced-motion: reduce)',
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('Celebration — renders submit success + leaderboard messaging', () => {
  it('renders the celebration container + production API headline', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-celebration')).toBeInTheDocument();
    // 18400 + 6000 + 60000*0.10 = 30400
    expect(screen.getByTestId('wizard-v2-celebration-api')).toHaveTextContent('TTD 30,400');
    // Apps moved out of the headline block into its own stat card (below).
    expect(screen.getByTestId('wizard-v2-celebration-api')).not.toHaveTextContent(/apps/i);
  });

  it('exposes the API number in isolation via the -value testid (smoke read affordance)', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    // The -value testid wraps ONLY the formatted API number, so a smoke
    // reading it gets "TTD 30,400" without the surrounding "You shipped" /
    // "3 apps" text that would otherwise concatenate when digits are stripped.
    const valueEl = screen.getByTestId('wizard-v2-celebration-api-value');
    expect(valueEl).toHaveTextContent('TTD 30,400');
    expect(valueEl.textContent).not.toMatch(/apps|shipped/i);
  });

  it('renders the leaderboard messaging (existing submit→aggregate path)', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    const msg = screen.getByTestId('wizard-v2-celebration-leaderboard');
    expect(msg).toHaveTextContent(/leaderboard/i);
    // Honest about the hourly schedule (not "you're now ranked").
    expect(screen.getByText(/refresh.*hourly/i)).toBeInTheDocument();
  });

  it('renders weekStarting label in the subtitle', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    expect(screen.getByText(/May 31, 2026/)).toBeInTheDocument();
  });

  it('Back to Dashboard button calls onClose', () => {
    mockMatchMedia(false);
    const onClose = vi.fn();
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('role=status + aria-live=polite for screen readers', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    const region = screen.getByTestId('wizard-v2-celebration');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });
});

describe('Celebration — gold WEEK-N medal', () => {
  it('derives the medal number from weekStarting via the canonical weekNumber() helper', () => {
    mockMatchMedia(false);
    render(
      <Celebration
        formData={FORM}
        weekStartingLabel="May 31, 2026"
        weekStarting="2026-05-31"
        onClose={vi.fn()}
      />,
    );
    // Cross-checks against the SAME helper Celebration uses internally
    // (src/utils/dateHelpers.js) rather than a hand-computed constant — this
    // verifies the wiring (right prop → right helper call), not the helper's
    // own arithmetic (which has its own coverage elsewhere).
    const expectedWeek = weekNumber('2026-05-31');
    expect(screen.getByTestId('wizard-v2-celebration-week-value')).toHaveTextContent(String(expectedWeek));
  });

  it('falls back to the current week when weekStarting is omitted (does not crash)', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-celebration-week-value')).toBeInTheDocument();
  });
});

describe('Celebration — stat-card pair (Apps written + Est. Commission)', () => {
  it('shows apps-written count in its own stat card', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    // 2 (newBusiness.apps) + 1 (pppIncreases.apps) = 3
    expect(screen.getByTestId('wizard-v2-celebration-stat-apps-value')).toHaveTextContent('3');
  });

  it('computes Est. Commission from formData + commissionRate via estCommission()', () => {
    mockMatchMedia(false);
    render(
      <Celebration
        formData={FORM}
        weekStartingLabel="May 31, 2026"
        commissionRate={7.5}
        onClose={vi.fn()}
      />,
    );
    // newBusiness.api(18400) * 7.5% + lumpsums.grossAmount(60000) * 0.5% = 1380 + 300 = 1680
    expect(screen.getByTestId('wizard-v2-celebration-stat-commission-value')).toHaveTextContent('TTD 1,680');
  });

  it('defaults commissionRate to 0 when omitted (lumpsum-only commission, no crash)', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    // newBusiness.api * 0% + 60000 * 0.5% = 300
    expect(screen.getByTestId('wizard-v2-celebration-stat-commission-value')).toHaveTextContent('TTD 300');
  });
});

describe('Celebration — secondary "View submission" CTA', () => {
  it('renders and fires onViewSubmission when the prop is provided', () => {
    mockMatchMedia(false);
    const onViewSubmission = vi.fn();
    render(
      <Celebration
        formData={FORM}
        weekStartingLabel="May 31, 2026"
        onClose={vi.fn()}
        onViewSubmission={onViewSubmission}
      />,
    );
    fireEvent.click(screen.getByTestId('wizard-v2-celebration-view-submission'));
    expect(onViewSubmission).toHaveBeenCalledTimes(1);
  });

  it('does not render the CTA when onViewSubmission is omitted (backward-compatible)', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    expect(screen.queryByTestId('wizard-v2-celebration-view-submission')).toBeNull();
    // Back to Dashboard still works standalone.
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
  });

  it('View submission and Back to Dashboard are independent handlers', () => {
    mockMatchMedia(false);
    const onClose = vi.fn();
    const onViewSubmission = vi.fn();
    render(
      <Celebration
        formData={FORM}
        weekStartingLabel="May 31, 2026"
        onClose={onClose}
        onViewSubmission={onViewSubmission}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onViewSubmission).not.toHaveBeenCalled();
  });
});

describe('Celebration — motion-reduce safe', () => {
  it('hides confetti + sparkles when prefers-reduced-motion: reduce', () => {
    mockMatchMedia(true);
    const { container } = render(
      <Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />,
    );
    // The confetti/sparkle layers should NOT be in the DOM when reduced.
    const decorativeSpans = container.querySelectorAll('span[style*="confetti-fall"], span[style*="sparkle-pop"]');
    expect(decorativeSpans.length).toBe(0);
  });

  it('static halo still renders when reduced (numeric content unchanged)', () => {
    mockMatchMedia(true);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-celebration-halo')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-celebration-api')).toHaveTextContent('TTD 30,400');
  });

  it('medal + stat cards still render their numeric content when reduced', () => {
    mockMatchMedia(true);
    render(
      <Celebration
        formData={FORM}
        weekStartingLabel="May 31, 2026"
        weekStarting="2026-05-31"
        commissionRate={7.5}
        onClose={vi.fn()}
      />,
    );
    const expectedWeek = weekNumber('2026-05-31');
    expect(screen.getByTestId('wizard-v2-celebration-week-value')).toHaveTextContent(String(expectedWeek));
    expect(screen.getByTestId('wizard-v2-celebration-stat-apps-value')).toHaveTextContent('3');
    expect(screen.getByTestId('wizard-v2-celebration-stat-commission-value')).toHaveTextContent('TTD 1,680');
    // Halo drops the motion-safe pulse class when reduced (existing behavior,
    // preserved unchanged by this pass).
    const halo = screen.getByTestId('wizard-v2-celebration-halo');
    expect(halo.className).not.toMatch(/motion-safe:animate-pulse/);
  });
});
