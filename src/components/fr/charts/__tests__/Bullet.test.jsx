import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Bullet from '../Bullet';

const part = (container, name) => container.querySelector(`[data-part="${name}"]`);

describe('Bullet', () => {
  it('renders fill, ghost and target geometry from the data', () => {
    const { container } = render(
      <Bullet value={30} ghostValue={10} target={60} max={80} label="API" valueText="TTD 30" targetText="Target 60" />,
    );
    expect(part(container, 'fill').style.width).toBe('37.5%');
    expect(part(container, 'fill')).toHaveClass('fr-glide-w', 'bg-fr-accent');
    expect(part(container, 'ghost').style.width).toBe('12.5%');
    expect(part(container, 'tick').style.left).toBe('75%');
    expect(part(container, 'tick')).toHaveClass('fr-glide-x');
    expect(part(container, 'target-label').style.left).toBe('75%');
    expect(screen.getByRole('img')).toHaveAccessibleName('API: TTD 30, target Target 60, plus 10 waiting');
  });

  it('shows an empty sentence with no value', () => {
    render(<Bullet value={null} label="API" />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('uses the tone class', () => {
    const { container } = render(<Bullet value={1} max={2} label="x" tone="gold" />);
    expect(part(container, 'fill')).toHaveClass('bg-fr-gold');
  });

  it('re-render with new data reuses the same DOM nodes (so widths glide)', () => {
    const { container, rerender } = render(<Bullet value={30} target={60} max={80} label="API" />);
    const fill = part(container, 'fill');
    const tick = part(container, 'tick');
    rerender(<Bullet value={60} target={40} max={80} label="API" />);
    expect(part(container, 'fill')).toBe(fill);
    expect(part(container, 'tick')).toBe(tick);
    expect(fill.style.width).toBe('75%');
    expect(tick.style.left).toBe('50%');
  });
});
