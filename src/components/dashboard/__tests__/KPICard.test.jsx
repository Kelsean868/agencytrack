// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPICard from '../KPICard.jsx';

// Recharts' ResponsiveContainer needs a measured box that jsdom does not provide;
// stub the chart layer so these formatting assertions don't depend on it.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  Line: () => null,
}));

describe('KPICard — value formatting', () => {
  it('renders a percentage with a "%" suffix when isPercent (Compliance Rate 13 → "13%")', () => {
    render(<KPICard label="Compliance Rate" values={[13]} isPercent />);
    expect(screen.getByText('13%')).toBeInTheDocument();
  });

  it('renders a plain count with no suffix by default', () => {
    render(<KPICard label="Weekly Apps" values={[9]} />);
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.queryByText('9%')).toBeNull();
  });

  it('isCurrency takes precedence over isPercent (renders the exact TTD value, never a "%")', () => {
    render(<KPICard label="Weekly API" values={[44000]} isCurrency isPercent />);
    expect(screen.getByText('TTD 44,000')).toBeInTheDocument();
    expect(screen.queryByText('44000%')).toBeNull();
    expect(screen.queryByText('44,000%')).toBeNull();
    expect(screen.queryByText('TTD 44,000%')).toBeNull();
  });

  it('percentage delta also carries the "%" suffix', () => {
    render(<KPICard label="Compliance Rate" values={[85, 88]} isPercent />);
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText(/\+3% vs last week/)).toBeInTheDocument();
  });
});
