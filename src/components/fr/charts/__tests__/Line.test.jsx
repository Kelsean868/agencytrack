import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Line from '../Line';
import { pathLength } from '../scales';

const labels = ['Jan', 'Feb', 'Mar'];
const series = [{ key: 'api', label: 'API', values: [10, 40, 20] }];
const linePath = (container) => container.querySelector('[data-part="line"]');

describe('Line', () => {
  it('renders the path, area, target and direct end label', () => {
    const { container } = render(
      <Line series={series} labels={labels} target={50} targetLabel="Target 50" format={(v) => `TTD ${v}`} />,
    );
    const path = linePath(container);
    // viewBox 600×180, x 6..594, y domain 0..niceMax(50)=50 over 176..14
    expect(path.getAttribute('d')).toBe('M6 143.6 L300 46.4 L594 111.2');
    expect(path).toHaveClass('stroke-chart-1', 'fill-none', 'fr-draw-a');
    expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    const pts = [
      { x: 6, y: 143.6 },
      { x: 300, y: 46.4 },
      { x: 594, y: 111.2 },
    ];
    expect(Number(path.style.getPropertyValue('--fr-len'))).toBe(Math.ceil(pathLength(pts)));
    expect(container.querySelector('[data-part="area"]')).toHaveClass('fill-chart-1', 'fr-wash-a');
    expect(container.querySelector('[data-part="target"]')).toHaveClass('stroke-ink-muted');
    expect(screen.getByText('Target 50')).toBeInTheDocument();
    expect(screen.getByText('TTD 20')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('API ends at TTD 20; target Target 50');
    const dot = container.querySelector('[data-part="end-dot"]');
    expect(dot.style.left).toBe('99%');
    expect(dot).toHaveClass('fr-dot-late', 'ring-card');
  });

  it('draws at most 3 gridlines', () => {
    const { container } = render(<Line series={series} labels={labels} />);
    expect(container.querySelectorAll('line.stroke-border')).toHaveLength(3);
  });

  it('shows an empty sentence with no values', () => {
    render(<Line series={[{ key: 'a', label: 'A', values: [] }]} labels={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('switches fr-draw-a → fr-draw-b on data change, not on an unrelated rerender, reusing the path node', () => {
    const { container, rerender } = render(<Line series={series} labels={labels} />);
    const path = linePath(container);
    const area = container.querySelector('[data-part="area"]');
    expect(path).toHaveClass('fr-draw-a');

    rerender(<Line series={[{ ...series[0] }]} labels={[...labels]} height={180} />);
    expect(linePath(container)).toBe(path);
    expect(path).toHaveClass('fr-draw-a');

    rerender(<Line series={[{ ...series[0], values: [10, 40, 45] }]} labels={labels} />);
    expect(linePath(container)).toBe(path);
    expect(path).toHaveClass('fr-draw-b');
    expect(path).not.toHaveClass('fr-draw-a');
    expect(area).toHaveClass('fr-wash-b');

    rerender(<Line series={[{ ...series[0], values: [5, 40, 45] }]} labels={labels} />);
    expect(path).toHaveClass('fr-draw-a');
  });

  it('re-keys the end dot on redraw so it fades in again', () => {
    const { container, rerender } = render(<Line series={series} labels={labels} />);
    const dot = container.querySelector('[data-part="end-dot"]');
    rerender(<Line series={[{ ...series[0], values: [10, 40, 30] }]} labels={labels} />);
    expect(container.querySelector('[data-part="end-dot"]')).not.toBe(dot);
  });

  it('colours series in fixed order and shows a legend for more than one', () => {
    const { container } = render(
      <Line
        series={[series[0], { key: 'b', label: 'Plan', values: [5, 5, 5] }]}
        labels={labels}
      />,
    );
    const paths = container.querySelectorAll('[data-part="line"]');
    expect(paths[0]).toHaveClass('stroke-chart-1');
    expect(paths[1]).toHaveClass('stroke-chart-2');
    expect(screen.getByRole('list')).toHaveTextContent('Plan');
  });
});
