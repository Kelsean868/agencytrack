import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SeriesEditChoice from '../SeriesEditChoice';

function setup(over = {}) {
  const props = {
    contextLine: 'Marsha Singh · Weekly · 2 of 6',
    onEditThisOnly: vi.fn(),
    onEditFuture: vi.fn(),
    onEditAll: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<SeriesEditChoice {...props} />);
  return props;
}

describe('SeriesEditChoice (Run 9 F3d)', () => {
  it('renders all three live scope options + a cancel, plus the context line', () => {
    setup();
    expect(screen.getByTestId('series-edit-choice')).toBeInTheDocument();
    expect(screen.getByTestId('series-edit-this-only')).toBeInTheDocument();
    expect(screen.getByTestId('series-edit-future')).toBeInTheDocument();
    expect(screen.getByTestId('series-edit-all')).toBeInTheDocument();
    expect(screen.getByTestId('series-edit-cancel')).toBeInTheDocument();
    expect(screen.getByText('Marsha Singh · Weekly · 2 of 6')).toBeInTheDocument();
  });

  it('the "all" option names R1 — past appointments never change', () => {
    setup();
    expect(screen.getByTestId('series-edit-all')).toHaveTextContent(/past appointments never change/i);
  });

  it('each option is a real live button (no aria-disabled), ≥44px touch targets', () => {
    setup();
    ['series-edit-this-only', 'series-edit-future', 'series-edit-all', 'series-edit-cancel'].forEach((id) => {
      const el = screen.getByTestId(id);
      expect(el.tagName).toBe('BUTTON');
      expect(el).not.toHaveAttribute('aria-disabled');
      expect(el.className).toMatch(/min-h-\[44px\]/);
    });
  });

  it('fires the matching handler for each scope', () => {
    const props = setup();
    fireEvent.click(screen.getByTestId('series-edit-this-only'));
    expect(props.onEditThisOnly).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('series-edit-future'));
    expect(props.onEditFuture).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('series-edit-all'));
    expect(props.onEditAll).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('series-edit-cancel'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
