// @vitest-environment jsdom
//
// Track J retirement R2 — StepTargetsNextWeek (step 11) component test.
// Proves the v2 extraction of legacy Step9Goals: same 8 goal keys, same
// direct on-change, same 500-char goalNotes cap + targeting banner.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import StepTargetsNextWeek from '../StepTargetsNextWeek';

vi.mock('../../../../utils/formatters', () => ({
  formatCurrency: (v) => `TTD ${Math.round(Number(v) || 0).toLocaleString('en-US')}`,
}));

afterEach(() => cleanup());

const NUMERIC = [
  ['Target Dials', 'targetDials'],
  ['Target Tel Contacts', 'targetTelContacts'],
  ['Target F2F Attempts', 'targetF2FAttempts'],
  ['Target FFI', 'targetFFI'],
  ['Target CI', 'targetCI'],
  ['Target Applications Sold', 'targetAppsSold'],
];

describe('StepTargetsNextWeek — goal fields + on-change parity', () => {
  it('writes each numeric goal key directly', () => {
    for (const [label, key] of NUMERIC) {
      const onChange = vi.fn();
      const { unmount } = render(<StepTargetsNextWeek data={{}} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText(label), { target: { value: '12' } });
      expect(onChange).toHaveBeenCalledWith(key, 12);
      unmount();
    }
  });

  it('writes targetAPI (currency) as a float', () => {
    const onChange = vi.fn();
    render(<StepTargetsNextWeek data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Target API (TTD)'), { target: { value: '24000' } });
    expect(onChange).toHaveBeenCalledWith('targetAPI', 24000);
  });

  it('shows the targeting banner when targetAPI > 0', () => {
    // Scope to this render's container so the assertion is immune to any
    // cross-file DOM left mounted by other suites in a shared jsdom.
    const { container } = render(<StepTargetsNextWeek data={{ targetAPI: 24000 }} onChange={vi.fn()} />);
    expect(within(container).getByText(/targeting TTD 24,000 in API next week/)).toBeInTheDocument();
  });

  it('hides the targeting banner when targetAPI is 0', () => {
    const { container } = render(<StepTargetsNextWeek data={{ targetAPI: 0 }} onChange={vi.fn()} />);
    // Match the BANNER sentence specifically ("You're targeting …") — NOT a
    // bare /targeting/, which would also catch the Target-API field's desc
    // ("…you are targeting for next week's sales", faithfully ported from the
    // legacy step and always present regardless of targetAPI).
    expect(within(container).queryByText(/You're targeting/)).toBeNull();
  });

  it('goalNotes writes directly + respects the 500-char cap', () => {
    const onChange = vi.fn();
    render(<StepTargetsNextWeek data={{}} onChange={onChange} />);
    const ta = screen.getByPlaceholderText('Optional — your goals for next week…');
    fireEvent.change(ta, { target: { value: 'Focus on referrals.' } });
    expect(onChange).toHaveBeenCalledWith('goalNotes', 'Focus on referrals.');

    onChange.mockClear();
    // Over the 500-char cap → onChange NOT called.
    fireEvent.change(ta, { target: { value: 'x'.repeat(501) } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
