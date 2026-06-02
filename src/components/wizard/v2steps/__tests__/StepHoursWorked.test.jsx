// @vitest-environment jsdom
//
// Track J retirement R2 — StepHoursWorked (step 9) component test.
// Proves the v2 extraction of legacy Step7TimeManagement: same fields,
// same direct on-change, same office/field time-split display.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StepHoursWorked from '../StepHoursWorked';

afterEach(() => cleanup());

describe('StepHoursWorked — fields + on-change parity', () => {
  it('writes officeHours / fieldHours directly', () => {
    const onChange = vi.fn();
    render(<StepHoursWorked data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Office Hours'), { target: { value: '20' } });
    expect(onChange).toHaveBeenCalledWith('officeHours', 20);
    fireEvent.change(screen.getByLabelText('Field Hours'), { target: { value: '15' } });
    expect(onChange).toHaveBeenCalledWith('fieldHours', 15);
  });

  it('shows the empty-state prompt when no hours entered', () => {
    render(<StepHoursWorked data={{}} onChange={vi.fn()} />);
    expect(screen.getByText(/Enter hours above to see your time split/)).toBeInTheDocument();
  });

  it('renders the office/field split when hours present', () => {
    render(<StepHoursWorked data={{ officeHours: 30, fieldHours: 10 }} onChange={vi.fn()} />);
    // 30 of 40 = 75% office, 25% field
    expect(screen.getByText(/Office 75%/)).toBeInTheDocument();
    expect(screen.getByText(/Field 25%/)).toBeInTheDocument();
    expect(screen.getByText(/Total: 40h/)).toBeInTheDocument();
  });
});
