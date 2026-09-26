// @vitest-environment jsdom
//
// ProgressDonut — the shared ring (Home redesign R1). Arc length, tick
// position, clamp at 100%, role/aria-label, reduced-motion.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProgressDonut from '../ProgressDonut';
import { donutGeometry, DONUT_CIRCUMFERENCE } from '../progressDonutGeometry';

function setReducedMotion(reduced) {
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

afterEach(() => {
  cleanup();
  delete window.matchMedia;
});

const dashOf = (el) => Number(el.getAttribute('stroke-dasharray').split(' ')[0]);

describe('donutGeometry', () => {
  it('arc length is value ÷ max of the circumference', () => {
    const g = donutGeometry({ value: 27, max: 100 });
    expect(g.fraction).toBeCloseTo(0.27, 10);
    expect(g.dash).toBeCloseTo(0.27 * DONUT_CIRCUMFERENCE, 10);
    expect(g.dash + g.gap).toBeCloseTo(DONUT_CIRCUMFERENCE, 10);
  });

  it('clamps at 100% (and at 0)', () => {
    expect(donutGeometry({ value: 150, max: 100 }).fraction).toBe(1);
    expect(donutGeometry({ value: -5, max: 100 }).fraction).toBe(0);
    expect(donutGeometry({ value: 5, max: 0 }).fraction).toBe(0);
  });

  it('tick angle is tick × 360°, clamped', () => {
    expect(donutGeometry({ value: 1, max: 1, tick: 0.9 }).tickAngle).toBeCloseTo(324, 10);
    expect(donutGeometry({ value: 1, max: 1, tick: 1.4 }).tickAngle).toBe(360);
    expect(donutGeometry({ value: 1, max: 1 }).tickAngle).toBeNull();
  });
});

describe('ProgressDonut', () => {
  it('is role="img" with the given aria-label', () => {
    render(<ProgressDonut value={27} max={100} ariaLabel="API 27 percent of Champion target" />);
    expect(screen.getByRole('img', { name: 'API 27 percent of Champion target' })).toBeInTheDocument();
  });

  it('renders the arc at its final length (no matchMedia → no animation)', () => {
    render(<ProgressDonut value={73946} max={275000} ariaLabel="x" />);
    expect(dashOf(screen.getByTestId('donut-arc'))).toBeCloseTo((73946 / 275000) * DONUT_CIRCUMFERENCE, 6);
  });

  it('clamps the rendered arc at a full ring', () => {
    render(<ProgressDonut value={500} max={100} ariaLabel="x" />);
    expect(dashOf(screen.getByTestId('donut-arc'))).toBeCloseTo(DONUT_CIRCUMFERENCE, 6);
  });

  it('draws the tick at the gate position (90% → rotate 324)', () => {
    render(<ProgressDonut value={86.6} max={100} tick={0.9} tone="warning" ariaLabel="x" />);
    expect(screen.getByTestId('donut-tick').getAttribute('transform')).toBe('rotate(324 50 50)');
    expect(screen.getByTestId('donut-arc').getAttribute('class')).toContain('stroke-warning');
  });

  it('no arc for a zero value, and no tick unless asked', () => {
    render(<ProgressDonut value={0} max={100} ariaLabel="x" />);
    expect(screen.queryByTestId('donut-arc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('donut-tick')).not.toBeInTheDocument();
  });

  it('under prefers-reduced-motion the final arc renders immediately', () => {
    setReducedMotion(true);
    render(<ProgressDonut value={50} max={100} ariaLabel="x" />);
    expect(dashOf(screen.getByTestId('donut-arc'))).toBeCloseTo(DONUT_CIRCUMFERENCE / 2, 6);
  });

  it('with motion allowed the ring starts empty and draws after mount', async () => {
    setReducedMotion(false);
    render(<ProgressDonut value={50} max={100} ariaLabel="x" />);
    const arc = await screen.findByTestId('donut-arc');
    expect(dashOf(arc)).toBeCloseTo(DONUT_CIRCUMFERENCE / 2, 6);
    expect(arc.getAttribute('class')).toContain('motion-safe:transition-[stroke-dasharray]');
  });

  it('renders the centre and sub labels as aria-hidden text', () => {
    render(<ProgressDonut value={13} max={100} centerLabel="13%" subLabel="OF MDRT" ariaLabel="x" />);
    const img = screen.getByRole('img');
    expect(img).toHaveTextContent('13%');
    expect(img).toHaveTextContent('OF MDRT');
  });
});
