import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Donut from '../Donut';

const parts = [
  { key: 'life', label: 'Life', value: 3 },
  { key: 'health', label: 'Health', value: 1 },
];
const arcs = (container) => [...container.querySelectorAll('[data-part="arc"]')];

describe('Donut', () => {
  it('renders arcs sized by share in fixed colour order, with a legend and centre value', () => {
    const { container } = render(<Donut parts={parts} centerValue="4" centerLabel="policies" />);
    const [a, b] = arcs(container);
    expect(a.style.strokeDasharray).toBe('75 25');
    expect(a).toHaveClass('stroke-chart-1');
    expect(b.style.strokeDasharray).toBe('25 75');
    expect(b.style.strokeDashoffset).toBe('-75');
    expect(b).toHaveClass('stroke-chart-2');
    expect(screen.getByText('policies')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('Life 3 (75%), Health 1 (25%)');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows an empty sentence with no parts or a zero total', () => {
    const { rerender } = render(<Donut parts={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    rerender(<Donut parts={[{ key: 'a', label: 'A', value: 0 }]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('throws in DEV with 6 parts', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ key: `p${i}`, label: `P${i}`, value: 1 }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Donut parts={six} />)).toThrow(/at most 5/);
    spy.mockRestore();
  });

  it('re-render with new values reuses the arc nodes (so parts glide)', () => {
    const { container, rerender } = render(<Donut parts={parts} />);
    const [a] = arcs(container);
    rerender(<Donut parts={[{ ...parts[0], value: 1 }, parts[1]]} />);
    expect(arcs(container)[0]).toBe(a);
    expect(a.style.strokeDasharray).toBe('50 50');
  });
});
