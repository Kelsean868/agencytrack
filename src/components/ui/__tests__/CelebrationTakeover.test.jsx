// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CelebrationTakeover from '../CelebrationTakeover';

afterEach(() => {
  cleanup();
  // Reset any matchMedia stub between tests.
  delete window.matchMedia;
});

function setReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

const baseProps = {
  open: true,
  eyebrow: 'STREAK MILESTONE',
  title: '5 days in a row',
  body: 'Consistency wins.',
  stats: [
    { label: 'DAY STREAK', value: '5', highlight: true },
    { label: 'TODAY', value: 'TTD 8,400.00' },
  ],
  primaryCta: { label: 'Keep it going', onClick: vi.fn() },
  testId: 'celebration-takeover',
};

describe('CelebrationTakeover — dialog contract (§4)', () => {
  it('renders a labelled modal dialog when open', () => {
    render(<CelebrationTakeover {...baseProps} onClose={vi.fn()} />);
    const dialog = screen.getByTestId('celebration-takeover');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('renders nothing when closed (removed from tab order)', () => {
    render(<CelebrationTakeover {...baseProps} open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('celebration-takeover')).not.toBeInTheDocument();
  });

  it('Escape closes', () => {
    const onClose = vi.fn();
    render(<CelebrationTakeover {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('the X dismiss button closes', () => {
    const onClose = vi.fn();
    render(<CelebrationTakeover {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss celebration/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('the primary CTA fires its handler', () => {
    const onClick = vi.fn();
    render(
      <CelebrationTakeover {...baseProps} primaryCta={{ label: 'Keep it going', onClick }} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('celebration-primary-cta'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('CelebrationTakeover — content + reduced motion (§2)', () => {
  it('renders eyebrow, title, body, and stat values', () => {
    render(<CelebrationTakeover {...baseProps} onClose={vi.fn()} />);
    expect(screen.getByText('STREAK MILESTONE')).toBeInTheDocument();
    expect(screen.getByText('5 days in a row')).toBeInTheDocument();
    expect(screen.getByText('Consistency wins.')).toBeInTheDocument();
    expect(screen.getByText('TTD 8,400.00')).toBeInTheDocument();
  });

  it('reduced motion → no confetti, but content + exact values still render', () => {
    setReducedMotion(true);
    render(<CelebrationTakeover {...baseProps} onClose={vi.fn()} />);
    // Confetti pieces carry the celebration-confetti-fall animation inline; none
    // should be present under reduced motion.
    const confetti = document.querySelectorAll('[style*="celebration-confetti-fall"]');
    expect(confetti.length).toBe(0);
    // Final content is still visible (never opacity:0-stranded).
    expect(screen.getByText('5 days in a row')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-stats')).toBeInTheDocument();
  });

  it('no-preference → confetti renders', () => {
    setReducedMotion(false);
    render(<CelebrationTakeover {...baseProps} onClose={vi.fn()} />);
    const confetti = document.querySelectorAll('[style*="celebration-confetti-fall"]');
    expect(confetti.length).toBeGreaterThan(0);
  });
});
