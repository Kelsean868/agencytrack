// @vitest-environment jsdom
//
// Track J retirement R2 — StepRateYourWeek (step 10) component test.
// Proves the v2 extraction of legacy Step8SelfEvaluation: 5 rating keys via
// 1-10 button rows + notes textarea, same direct on-change.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import StepRateYourWeek from '../StepRateYourWeek';

afterEach(() => cleanup());

const RATINGS = [
  ['Planning Effectiveness & Effort', 'ratingPlanning'],
  ['Time & Priority Management', 'ratingTimeManagement'],
  ['Sales Performance & Effectiveness', 'ratingSalesPerformance'],
  ['Prospecting Effort & Effectiveness', 'ratingProspecting'],
  ['Overall Rating of Your Week', 'ratingOverall'],
];

describe('StepRateYourWeek — 5 rating cards + notes', () => {
  it('renders all 5 rating cards', () => {
    render(<StepRateYourWeek data={{}} onChange={vi.fn()} />);
    for (const [label] of RATINGS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('each rating row writes its key with the clicked value', () => {
    for (const [label, key] of RATINGS) {
      const onChange = vi.fn();
      const { unmount } = render(<StepRateYourWeek data={{}} onChange={onChange} />);
      // Scope to the card containing this label, click the "8" button.
      const labelEl = screen.getByText(label);
      const card = labelEl.closest('.rounded-xl');
      const btn8 = within(card).getByRole('button', { name: /^rate 8 out of 10$/i });
      fireEvent.click(btn8);
      expect(onChange).toHaveBeenCalledWith(key, 8);
      unmount();
    }
  });

  it('notes textarea writes notes directly', () => {
    const onChange = vi.fn();
    render(<StepRateYourWeek data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Add any notes here…'), { target: { value: 'Strong week.' } });
    expect(onChange).toHaveBeenCalledWith('notes', 'Strong week.');
  });

  it('shows the /10 readout when a rating is set', () => {
    render(<StepRateYourWeek data={{ ratingOverall: 7 }} onChange={vi.fn()} />);
    expect(screen.getByText('7/10')).toBeInTheDocument();
  });
});
