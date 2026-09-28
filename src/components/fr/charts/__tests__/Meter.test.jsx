import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Meter, { MeterList } from '../Meter';

const fill = (container) => container.querySelector('[data-part="fill"]');

describe('Meter', () => {
  it('renders label, value / target and a proportional fill', () => {
    const { container } = render(<Meter label="Calls" value={15} target={20} />);
    expect(screen.getByText('Calls')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('/ 20')).toBeInTheDocument();
    expect(fill(container).style.width).toBe('75%');
    expect(fill(container)).toHaveClass('bg-fr-accent', 'fr-glide-w');
  });

  it('shows a check icon when met, capped at 100%', () => {
    const { container } = render(<Meter label="FFIs" value={6} target={5} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(', met')).toBeInTheDocument();
    expect(fill(container).style.width).toBe('100%');
  });

  it('turns warm with an icon and words only when tone="warm" and below target', () => {
    const { container, rerender } = render(<Meter label="CIs" value={1} target={4} />);
    expect(screen.queryByText('Behind')).not.toBeInTheDocument();
    rerender(<Meter label="CIs" value={1} target={4} tone="warm" />);
    expect(screen.getByText('Behind')).toBeInTheDocument();
    expect(fill(container)).toHaveClass('bg-fr-warm');
  });

  it('re-render with new data reuses the same fill node', () => {
    const { container, rerender } = render(<Meter label="Calls" value={5} target={20} />);
    const node = fill(container);
    rerender(<Meter label="Calls" value={10} target={20} />);
    expect(fill(container)).toBe(node);
    expect(node.style.width).toBe('50%');
  });
});

describe('MeterList', () => {
  it('renders a list of meters', () => {
    render(
      <MeterList
        items={[
          { key: 'c', label: 'Calls', value: 1, target: 2 },
          { key: 'f', label: 'FFIs', value: 1, target: 2, format: (v) => `${v} x` },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('/ 2 x')).toBeInTheDocument();
  });

  it('shows an empty sentence', () => {
    render(<MeterList items={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });
});
