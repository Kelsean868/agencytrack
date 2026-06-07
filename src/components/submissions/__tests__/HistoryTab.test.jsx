// @vitest-environment jsdom
//
// HistoryTab — targeted tests for the Gemini dials-calculation bug (PR #390).
// The `getSubmissionAPI` helper at WeekCard line 346 was missing
// seminarTradeshowCalls and serviceCalls from the DIALS sum.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HistoryTab from '../HistoryTab';

// Minimal submission fixture with all call types populated
const SUBMISSION_FULL_CALLS = {
  id: 'sub-001',
  weekStarting: '2026-06-01',
  status: 'submitted',
  // Call fields
  referralCalls:          5,
  followUpCalls:          3,
  coldCalls:              4,
  seminarTradeshowCalls: 10,  // these two are the bug: missing from dials sum
  serviceCalls:           6,
  // Other fields needed for render
  apiSold: 18000,
  ciConducted: 3,
  newBusiness: { apps: 2, api: 18000 },
};

// Correct total = 5 + 3 + 4 + 10 + 6 = 28
const CORRECT_DIALS = 28;
// Buggy total (missing seminarTradeshowCalls + serviceCalls) = 5 + 3 + 4 = 12
const BUGGY_DIALS   = 12;

describe('HistoryTab — WeekCard dials calculation', () => {
  it('shows correct DIALS total including seminarTradeshowCalls + serviceCalls (falsy-sum bug)', () => {
    // This test FAILS before the fix because the dials sum at line 346
    // only adds referralCalls + followUpCalls + coldCalls (= 12) and omits
    // seminarTradeshowCalls (10) + serviceCalls (6).
    render(
      <HistoryTab
        submissions={[SUBMISSION_FULL_CALLS]}
        onView={vi.fn()}
        loading={false}
        onDownload={vi.fn()}
        generating={false}
        weeklyTarget={4800}
      />,
    );

    // Find the DIALS label, then verify the value rendered next to it
    // matches the canonical sum (5+3+4+10+6 = 28).
    // Structure: outer div > (inner flex div > span[DIALS]) + span[value]
    // closest('.p-2') or parentElement.parentElement gets to the outer cell div.
    const dialsLabel = screen.getByText('DIALS');
    const outerCell = dialsLabel.closest('div').parentElement;  // outer KPI cell
    expect(outerCell).toBeTruthy();
    // The value span is a direct child of the outer cell
    const valueSpan = Array.from(outerCell.children).find(
      (el) => el.tagName === 'SPAN' && el.className.includes('text-base'),
    );
    expect(valueSpan).toBeTruthy();

    const rendered = Number(valueSpan.textContent);
    // Assert correct (28) not buggy (12)
    expect(rendered).toBe(CORRECT_DIALS);
    expect(rendered).not.toBe(BUGGY_DIALS);
  });
});
