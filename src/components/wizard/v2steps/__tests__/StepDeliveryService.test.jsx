// @vitest-environment jsdom
//
// Track J retirement R1 — StepDeliveryService (step 8) component test.
// Proves the v2 extraction of legacy Step6DeliveriesService:
//   - renders deliveries fields + writes the same persisted keys,
//   - preserves the lastWeek-derived suggestedOutstanding,
//   - preserves the hasServiceWork toggle gating the conditional block.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StepDeliveryService from '../StepDeliveryService';

afterEach(() => cleanup());

describe('StepDeliveryService — deliveries + suggested outstanding', () => {
  it('writes policiesReceived / policiesDelivered directly', () => {
    const onChange = vi.fn();
    render(<StepDeliveryService data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('New Policies Received'), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith('policiesReceived', 5);
    fireEvent.change(screen.getByLabelText('Policies Delivered'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith('policiesDelivered', 3);
  });

  it('suggestedOutstanding = max(0, lastWeek.outstanding + received - delivered)', () => {
    render(
      <StepDeliveryService
        data={{ policiesReceived: 5, policiesDelivered: 3 }}
        lastWeekData={{ policiesOutstanding: 4 }}
        onChange={vi.fn()}
      />
    );
    // 4 + 5 - 3 = 6
    expect(screen.getByText(/Suggested: 6/)).toBeInTheDocument();
  });

  it('suggestedOutstanding clamps to 0 (never negative)', () => {
    render(
      <StepDeliveryService
        data={{ policiesReceived: 0, policiesDelivered: 10 }}
        lastWeekData={{ policiesOutstanding: 2 }}
        onChange={vi.fn()}
      />
    );
    // max(0, 2 + 0 - 10) = 0 → suggestion of 0 is not shown (SuggestedField hides <= 0)
    expect(screen.queryByText(/Suggested:/)).toBeNull();
  });

  it('policiesOutstanding writes directly via onChange', () => {
    const onChange = vi.fn();
    render(<StepDeliveryService data={{}} lastWeekData={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Total Policies Outstanding'), { target: { value: '6' } });
    expect(onChange).toHaveBeenCalledWith('policiesOutstanding', 6);
  });
});

describe('StepDeliveryService — hasServiceWork toggle + conditional block', () => {
  it('service block hidden until hasServiceWork is true', () => {
    render(<StepDeliveryService data={{}} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Total Service Contacts Made')).toBeNull();
  });

  it('Yes toggle writes hasServiceWork=true', () => {
    const onChange = vi.fn();
    render(<StepDeliveryService data={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Yes$/ }));
    expect(onChange).toHaveBeenCalledWith('hasServiceWork', true);
  });

  it('No toggle writes hasServiceWork=false', () => {
    const onChange = vi.fn();
    render(<StepDeliveryService data={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^No$/ }));
    expect(onChange).toHaveBeenCalledWith('hasServiceWork', false);
  });

  it('conditional service fields render + write their keys when hasServiceWork=true', () => {
    const onChange = vi.fn();
    render(<StepDeliveryService data={{ hasServiceWork: true }} onChange={onChange} />);
    const checks = [
      ['Total Service Contacts Made', 'serviceContacts', 8],
      ['Premium Collection Meetings', 'premiumCollectionMeetings', 2],
      ['Withdrawal & Loan Requests', 'withdrawalsLoans', 1],
      ['Surrender Requests', 'surrenders', 0],
      ['Policy Change Forms Submitted', 'policyChanges', 3],
      ['Annual Reviews Conducted', 'annualReviews', 4],
      ['Orphan Reviews Conducted', 'orphanReviews', 1],
      ['Orphans Adopted', 'orphansAdopted', 2],
      ['Reinstatement Applications Submitted', 'reinstatementsSubmitted', 1],
    ];
    for (const [label, key, val] of checks) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: String(val) } });
      expect(onChange).toHaveBeenCalledWith(key, val);
    }
  });

  it('currency service fields (reinstatementAPI, renewalPremiumsCollected) write floats', () => {
    const onChange = vi.fn();
    render(<StepDeliveryService data={{ hasServiceWork: true }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Service API Reinstated (TTD)'), { target: { value: '1200' } });
    expect(onChange).toHaveBeenCalledWith('reinstatementAPI', 1200);
    fireEvent.change(screen.getByLabelText('Renewal Premiums Collected (TTD)'), { target: { value: '850.5' } });
    expect(onChange).toHaveBeenCalledWith('renewalPremiumsCollected', 850.5);
  });
});
