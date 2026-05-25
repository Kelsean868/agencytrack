import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DailyFAB from '../DailyFAB';

describe('DailyFAB', () => {
  it('renders button with accessible label', () => {
    render(<DailyFAB onClick={() => {}} todayLogged={true} />);
    expect(screen.getByRole('button', { name: /log today/i })).toBeTruthy();
  });

  it('calls onClick when tapped', () => {
    const onClick = vi.fn();
    render(<DailyFAB onClick={onClick} todayLogged={true} />);
    fireEvent.click(screen.getByRole('button', { name: /log today/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows state dot when today is not logged', () => {
    const { container } = render(<DailyFAB onClick={() => {}} todayLogged={false} />);
    expect(container.querySelector('[aria-hidden="true"].rounded-full.bg-warning')).toBeTruthy();
  });

  it('hides state dot when today is already logged', () => {
    const { container } = render(<DailyFAB onClick={() => {}} todayLogged={true} />);
    expect(container.querySelector('.bg-warning')).toBeNull();
  });

  it('has data-testid for smoke targeting', () => {
    render(<DailyFAB onClick={() => {}} todayLogged={true} />);
    expect(screen.getByTestId('daily-fab')).toBeTruthy();
  });
});
