import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Sparkline from '../Sparkline';

describe('Sparkline', () => {
  it('renders a line and an accent end dot with an accessible name', () => {
    const { container } = render(<Sparkline values={[1, 3, 2]} label="Calls" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Calls: last 2');
    expect(container.querySelector('path')).toHaveClass('stroke-ink-faint');
    const dot = container.querySelector('[data-part="end-dot"]');
    expect(dot).toHaveClass('fill-chart-1');
    expect(dot.getAttribute('cx')).toBe('93');
  });

  it('keeps only the last 12 points', () => {
    const values = Array.from({ length: 20 }, (_, i) => i);
    const { container } = render(<Sparkline values={values} label="x" />);
    const d = container.querySelector('path').getAttribute('d');
    expect(d.split(' L')).toHaveLength(12);
    expect(screen.getByRole('img')).toHaveAccessibleName('x: last 19');
  });

  it('shows an empty sentence with no values', () => {
    render(<Sparkline values={[]} label="x" />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('re-render with new data reuses the end dot node', () => {
    const { container, rerender } = render(<Sparkline values={[1, 2, 3]} label="x" />);
    const dot = container.querySelector('[data-part="end-dot"]');
    rerender(<Sparkline values={[1, 3, 2]} label="x" />);
    expect(container.querySelector('[data-part="end-dot"]')).toBe(dot);
    expect(dot.getAttribute('cy')).toBe('14');
  });
});
