import React from 'react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Celebration from '../v2chrome/Celebration.jsx';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

const base = {
  formData: {},
  weekStartingLabel: 'Sun, Jun 08',
  onClose: () => {},
};

describe('Celebration — points section', () => {
  it('shows earned and progress to next level (normal case)', () => {
    // priorPoints=800 (Associate), earned=165 → cumulative=965 → still Associate
    // nextLevel=Pro (threshold 1500), toNext = 1500-965 = 535
    render(<Celebration {...base} earnedPoints={165} priorPoints={800} />);
    expect(screen.getByTestId('wizard-celebration-earned').textContent).toBe('+165 pts');
    const progress = screen.getByTestId('wizard-celebration-progress');
    expect(progress.textContent).toContain('535');
    expect(progress.textContent).toContain('Pro');
  });

  it('shows level-up treatment when level advances', () => {
    // priorPoints=480 (Rookie, < 500), earned=50 → cumulative=530 (Associate, ≥ 500)
    render(<Celebration {...base} earnedPoints={50} priorPoints={480} />);
    expect(screen.getByTestId('wizard-celebration-earned').textContent).toBe('+50 pts');
    const levelUp = screen.getByTestId('wizard-celebration-level-up');
    expect(levelUp.textContent).toContain('Associate');
    expect(screen.queryByTestId('wizard-celebration-progress')).toBeNull();
  });

  it('shows gentle message on zero earned — no celebratory +0', () => {
    render(<Celebration {...base} earnedPoints={0} priorPoints={200} />);
    expect(screen.getByTestId('wizard-celebration-zero').textContent).toContain('keep building');
    expect(screen.queryByTestId('wizard-celebration-earned')).toBeNull();
  });

  it('shows at-top message when already at Legend with no level change', () => {
    // priorPoints=7000 (Legend), earned=50 → cumulative=7050 → still Legend, no next
    render(<Celebration {...base} earnedPoints={50} priorPoints={7000} />);
    expect(screen.getByTestId('wizard-celebration-earned').textContent).toBe('+50 pts');
    expect(screen.getByTestId('wizard-celebration-at-top').textContent).toContain('top');
    expect(screen.queryByTestId('wizard-celebration-progress')).toBeNull();
  });

  it('shows level-up to Legend when crossing the 7000 threshold', () => {
    // priorPoints=6900 (Elite, < 7000), earned=200 → cumulative=7100 (Legend, ≥ 7000)
    render(<Celebration {...base} earnedPoints={200} priorPoints={6900} />);
    expect(screen.getByTestId('wizard-celebration-earned').textContent).toBe('+200 pts');
    const levelUp = screen.getByTestId('wizard-celebration-level-up');
    expect(levelUp.textContent).toContain('Legend');
  });

  it('first submission: shows progress to Associate', () => {
    // priorPoints=0 (Rookie), earned=165 → cumulative=165 → still Rookie
    // nextLevel=Associate (threshold 500), toNext = 500-165 = 335
    render(<Celebration {...base} earnedPoints={165} priorPoints={0} />);
    expect(screen.getByTestId('wizard-celebration-earned').textContent).toBe('+165 pts');
    const progress = screen.getByTestId('wizard-celebration-progress');
    expect(progress.textContent).toContain('335');
    expect(progress.textContent).toContain('Associate');
  });

  it('renders core submission copy regardless of points', () => {
    render(<Celebration {...base} earnedPoints={0} priorPoints={0} />);
    expect(screen.getByTestId('wizard-v2-celebration')).toBeTruthy();
    expect(screen.getByTestId('wizard-v2-celebration-api')).toBeTruthy();
  });
});
