import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Columns from '../Columns';

const data = [
  { key: 'jan', label: 'Jan', value: 50 },
  { key: 'feb', label: 'Feb', value: 100, ghost: 20, highlight: true },
  { key: 'mar', label: 'Mar', value: 30 },
];
const parts = (container, name) => [...container.querySelectorAll(`[data-part="${name}"]`)];

describe('Columns', () => {
  it('renders bars with heights from the data (max = niceMax(150) = 200 over 160px)', () => {
    const { container } = render(<Columns data={data} target={150} targetLabel="MDRT 150" />);
    const values = parts(container, 'value');
    expect(values.map((n) => n.style.height)).toEqual(['40px', '80px', '24px']);
    expect(values[0]).toHaveClass('fr-glide-h', 'bg-chart-1/35');
    expect(values[1]).toHaveClass('bg-chart-1');
    const ghosts = parts(container, 'ghost');
    expect(ghosts[1].style.height).toBe('16px');
    expect(ghosts[1]).toHaveClass('bg-fr-ghost', 'rounded-t-[4px]');
    expect(values[1]).not.toHaveClass('rounded-t-[4px]');
    expect(parts(container, 'target')[0].style.height).toBe('120px');
    expect(screen.getByText('MDRT 150')).toBeInTheDocument();
  });

  it('exposes each value through a focusable column with an aria-label', () => {
    render(<Columns data={data} format={(v) => `TTD ${v}`} />);
    expect(screen.getByRole('button', { name: 'Feb: TTD 100, plus TTD 20 waiting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jan: TTD 50' })).toBeInTheDocument();
  });

  it('direct-labels highlighted and last bars', () => {
    const { container } = render(<Columns data={data} />);
    const direct = [...container.querySelectorAll('span.text-ink')].map((s) => s.textContent);
    expect(direct).toEqual(['100', '30']);
  });

  it('emphasis="all" paints every bar in chart-1', () => {
    const { container } = render(<Columns data={data} emphasis="all" />);
    parts(container, 'value').forEach((n) => expect(n).toHaveClass('bg-chart-1'));
  });

  it('shows an empty sentence with no data', () => {
    render(<Columns data={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('entrance plays only for bars present at first mount', () => {
    const { container, rerender } = render(<Columns data={data} />);
    expect(container.querySelectorAll('.fr-grow-y')).toHaveLength(3);
    rerender(<Columns data={[...data, { key: 'apr', label: 'Apr', value: 10 }]} />);
    expect(container.querySelectorAll('.fr-grow-y')).toHaveLength(3);
    const aprStack = parts(container, 'value')[3].parentElement;
    expect(aprStack).not.toHaveClass('fr-grow-y');
  });

  it('re-render with new data reuses the same DOM nodes (so heights glide)', () => {
    const { container, rerender } = render(<Columns data={data} target={150} />);
    const bar = parts(container, 'value')[0];
    const target = parts(container, 'target')[0];
    rerender(<Columns data={[{ ...data[0], value: 150 }, data[1], data[2]]} target={100} />);
    expect(parts(container, 'value')[0]).toBe(bar);
    expect(parts(container, 'target')[0]).toBe(target);
    expect(bar.style.height).toBe('120px');
    expect(target.style.height).toBe('80px');
  });
});
