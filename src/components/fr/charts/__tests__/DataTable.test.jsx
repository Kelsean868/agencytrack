import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataTable from '../DataTable';

const columns = [
  { key: 'month', label: 'Month' },
  { key: 'api', label: 'API' },
];

describe('DataTable', () => {
  it('renders a real table with caption, scoped headers and right-aligned numbers', () => {
    render(<DataTable columns={columns} rows={[{ key: 'jan', month: 'Jan', api: 1200 }]} caption="API by month" />);
    const table = screen.getByRole('table', { name: 'API by month' });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Month' })).toHaveAttribute('scope', 'col');
    const cell = screen.getByRole('cell', { name: '1200' });
    expect(cell).toHaveClass('text-right', 'tabular-nums');
    expect(screen.getByRole('cell', { name: 'Jan' })).toHaveClass('text-left');
  });

  it('shows an empty sentence with no rows', () => {
    render(<DataTable columns={columns} rows={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('applies a column formatter', () => {
    render(<DataTable columns={[{ key: 'v', label: 'V', format: (v) => `TTD ${v}` }]} rows={[{ v: 5 }]} />);
    expect(screen.getByRole('cell', { name: 'TTD 5' })).toBeInTheDocument();
  });
});
