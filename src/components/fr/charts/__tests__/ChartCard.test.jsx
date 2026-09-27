import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChartCard from '../ChartCard';

const table = {
  columns: [
    { key: 'label', label: 'Week' },
    { key: 'value', label: 'Calls' },
  ],
  rows: [
    { key: 'w1', label: 'Week 1', value: 14 },
    { key: 'w2', label: 'Week 2', value: 22 },
  ],
  caption: 'Calls per week',
};

describe('ChartCard', () => {
  it('renders title (h3), subtitle and the chart', () => {
    render(
      <ChartCard title="Calls are up 57%" subtitle="Calls per week" table={table}>
        <div data-testid="chart">chart</div>
      </ChartCard>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Calls are up 57%' })).toBeInTheDocument();
    expect(screen.getByText('Calls per week')).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });

  it('Table toggle swaps to a table of the same values, flips aria-pressed and cross-fades', () => {
    render(
      <ChartCard title="t" table={table}>
        <div data-testid="chart">chart</div>
      </ChartCard>,
    );
    const btn = screen.getByRole('button', { name: 'Table' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn.className).toMatch(/min-h-\[44px\]/);

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    const t = screen.getByRole('table', { name: 'Calls per week' });
    expect(t).toHaveTextContent('Week 1');
    expect(screen.getByRole('cell', { name: '22' })).toBeInTheDocument();
    expect(t.closest('.fr-fade-a')).not.toBeNull();

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('chart').closest('.fr-fade-b')).not.toBeNull();
  });

  it('has no toggle without a table, and renders actions', () => {
    render(
      <ChartCard title="t" actions={<button type="button">Month</button>}>
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
  });
});
