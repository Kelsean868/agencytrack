// @vitest-environment jsdom
//
// Track J retirement R3 — StepNewNamesAdded (step 5) component test.
// Proves the v2 extraction of legacy Step5NewNames: same input keys, same
// lastWeek-derived oldNamesPool suggestion, same ReadOnly event-name fields,
// same totalNewNames banner.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StepNewNamesAdded from '../StepNewNamesAdded';

afterEach(() => cleanup());

const INPUTS = [
  ['Referrals Sought', 'referralsSought'],
  ['Referrals Obtained', 'referralsObtained'],
  ['Names from Cold Canvass', 'namesFromColdCanvass'],
  ['Names from Other Sources', 'namesFromOther'],
  ['Portfolio Clients Identified', 'portfolioClientsIdentified'],
];

describe('StepNewNamesAdded — inputs + on-change parity', () => {
  it('writes each numeric input key directly', () => {
    for (const [label, key] of INPUTS) {
      const onChange = vi.fn();
      const { unmount } = render(<StepNewNamesAdded data={{}} lastWeekData={{}} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText(label), { target: { value: '4' } });
      expect(onChange).toHaveBeenCalledWith(key, 4);
      unmount();
    }
  });

  it('oldNamesPool writes directly', () => {
    const onChange = vi.fn();
    render(<StepNewNamesAdded data={{}} lastWeekData={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Old Names Pool (Carry-Over)'), { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith('oldNamesPool', 12);
  });
});

describe('StepNewNamesAdded — lastWeek-derived suggestedPool', () => {
  it('suggestedPool = max(0, lastWeek.oldNamesPool + newNames − callsUsed)', () => {
    render(
      <StepNewNamesAdded
        data={{
          referralsObtained: 5, namesFromColdCanvass: 3, namesFromOther: 2,   // newNames = 10
          referralCalls: 2, followUpCalls: 1, coldCalls: 1,                    // callsUsed = 4
        }}
        lastWeekData={{ oldNamesPool: 8 }}
        onChange={vi.fn()}
      />
    );
    // 8 + 10 − 4 = 14
    expect(screen.getByText(/Suggested: 14/)).toBeInTheDocument();
  });

  it('suggestedPool clamps to 0 (never negative)', () => {
    render(
      <StepNewNamesAdded
        data={{ referralCalls: 50 }}
        lastWeekData={{ oldNamesPool: 1 }}
        onChange={vi.fn()}
      />
    );
    // max(0, 1 + 0 − 50) = 0 → SuggestedField hides a 0 suggestion.
    expect(screen.queryByText(/Suggested:/)).toBeNull();
  });
});

describe('StepNewNamesAdded — event-name ReadOnly + total banner', () => {
  it('shows the auto-pulled "From Events" read-only values', () => {
    render(
      <StepNewNamesAdded
        data={{ namesFromSeminarsConducted: 3, namesFromTradeshowsAttended: 2 }}
        lastWeekData={{}}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('From Seminars Conducted')).toBeInTheDocument();
    expect(screen.getByText('From Tradeshows Attended')).toBeInTheDocument();
  });

  it('totalNewNames banner appears when names entered (referrals + events + other)', () => {
    render(
      <StepNewNamesAdded
        data={{ referralsObtained: 2, namesFromSeminarsConducted: 3 }}
        lastWeekData={{}}
        onChange={vi.fn()}
      />
    );
    // 2 + 3 = 5
    expect(screen.getByText('New Names Added This Week')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
