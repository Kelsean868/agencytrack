// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Recharts needs layout jsdom does not have; the chart TYPE stays observable.
vi.mock('recharts', () => ({
  BarChart: ({ children }) => <div data-testid="chart-bars">{children}</div>,
  Bar: () => null,
  Cell: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

import PersistencyTrendChart from '../PersistencyTrendChart';

const ROWS = [
  { monthKey: '2025-12', pct: 80 },
  { monthKey: '2026-01', pct: null },
  { monthKey: '2026-02', pct: 90 },
];

describe('PersistencyTrendChart', () => {
  it.each([[false], [true]])('renders an empty-state line, not axes, with no readings (fr=%s)', (fr) => {
    const { rerender } = render(<PersistencyTrendChart data={[]} fr={fr} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-bars')).not.toBeInTheDocument();
    // Rows that are all "no reading" are empty too.
    rerender(<PersistencyTrendChart data={[{ monthKey: '2026-01', pct: null }]} fr={fr} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-bars')).not.toBeInTheDocument();
  });

  it('Nexus look: the readings are exposed to assistive tech in a table outside the role="img" chart', () => {
    render(<PersistencyTrendChart data={ROWS} />);
    const img = screen.getByRole('img');
    const table = screen.getByTestId('persistency-trend-table');
    expect(img.contains(table)).toBe(false);
    expect(img.getAttribute('aria-label')).toMatch(/table below/);
    const rows = within(table).getAllByRole('row').slice(1);
    // The null month is omitted; the others carry the 2-dp value and the gate verdict.
    expect(rows.map((r) => r.textContent)).toEqual([
      '2025-1280.00%, below the gate',
      '2026-0290.00%, at or above the gate',
    ]);
  });
});
