// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Celebration from '../Celebration';

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
  it('renders the celebration container + production API + apps', () => {
    mockMatchMedia(false);
    render(<Celebration formData={FORM} weekStartingLabel="May 31, 2026" onClose={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-celebration')).toBeInTheDocument();
    // 18400 + 6000 + 60000*0.10 = 30400
    expect(screen.getByTestId('wizard-v2-celebration-api')).toHaveTextContent('TTD 30,400');
    // 2 + 1 = 3 apps
    expect(screen.getByTestId('wizard-v2-celebration-api')).toHaveTextContent('3 apps');
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
});
