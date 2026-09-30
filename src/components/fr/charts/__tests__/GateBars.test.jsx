import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GateBars from '../GateBars';

// domain 70..100 over 180px → 6px per point; gate 90 → y = 60px
const data = [
  { key: 'jul', label: 'Jul', value: 93 },
  { key: 'aug', label: 'Aug', value: 86.5 },
  { key: 'sep', label: 'Sep', value: 91, projected: true },
];
const bars = (container) => [...container.querySelectorAll('[data-part="bar"]')];

describe('GateBars', () => {
  it('grows up from the gate when at/above it and down when below', () => {
    const { container } = render(<GateBars data={data} />);
    const [jul, aug, sep] = bars(container);
    expect(container.querySelector('[data-part="gate"]').style.top).toBe('60px');
    expect(screen.getByText('Gate 90%')).toBeInTheDocument();
    expect(jul.style.top).toBe('42px');
    expect(jul.style.height).toBe('18px');
    expect(jul).toHaveClass('bg-chart-1', 'rounded-t-[4px]', 'transition-[top,height]');
    expect(aug.style.top).toBe('60px');
    expect(aug.style.height).toBe('21px');
    expect(aug).toHaveClass('bg-fr-warm', 'rounded-b-[4px]');
    expect(sep).toHaveClass('bg-chart-1/40', 'border-dashed');
  });

  it('labels each month for screen readers and direct-labels values', () => {
    render(<GateBars data={data} />);
    expect(screen.getByRole('button', { name: 'Aug: 86.50%, below the 90% gate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sep: 91.00%, projected, at or above the 90% gate' })).toBeInTheDocument();
    expect(screen.getByText('~91.00%')).toBeInTheDocument();
  });

  it('clamps values outside the domain and marks them', () => {
    const { container } = render(<GateBars data={[{ key: 'x', label: 'Oct', value: 64 }]} />);
    const [bar] = bars(container);
    expect(bar.style.height).toBe('120px');
    expect(bar).toHaveAttribute('data-clamped', 'true');
    expect(screen.getByRole('button', { name: 'Oct: 64.00%, below the 90% gate, beyond the chart range' })).toBeInTheDocument();
  });

  it('shows an empty sentence with no data', () => {
    render(<GateBars data={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('re-render with new data reuses the same bar node as it crosses the gate', () => {
    const { container, rerender } = render(<GateBars data={data} />);
    const aug = bars(container)[1];
    rerender(<GateBars data={[data[0], { ...data[1], value: 95 }, data[2]]} />);
    expect(bars(container)[1]).toBe(aug);
    expect(aug.style.top).toBe('30px');
    expect(aug.style.height).toBe('30px');
    expect(aug).toHaveClass('bg-chart-1');
  });
});
