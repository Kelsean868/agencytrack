// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DeliveryStripCard from '../DeliveryStripCard';

// Fixed "today" so clawback derivation is deterministic. Issue dates chosen
// relative to it; the strip itself derives via the shared clawbackClock util.
function mkPolicy(overrides) {
  return {
    id: 'p1',
    status: 'settled',
    policyDeliveryDate: null,
    dateIssued: '2026-01-15',
    ownerName: 'Anil Boodram',
    policyNumber: 'TL-2026-08661',
    ...overrides,
  };
}

describe('DeliveryStripCard (Tier-3 3.1 un-stub)', () => {
  afterEach(cleanup);

  it('renders null when policies is undefined (self-guard)', () => {
    const { container } = render(<DeliveryStripCard />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when policies is an empty array', () => {
    const { container } = render(<DeliveryStripCard policies={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when there are no settled+undelivered policies', () => {
    const { container } = render(<DeliveryStripCard policies={[
      mkPolicy({ id: 'a', status: 'submitted' }),                          // not settled
      mkPolicy({ id: 'b', policyDeliveryDate: '2026-02-01' }),             // already delivered
      mkPolicy({ id: 'c', status: 'settled', dateIssued: null }),         // no issue date
    ]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the strip with settled, undelivered policies', () => {
    render(<DeliveryStripCard policies={[
      mkPolicy({ id: 'a', ownerName: 'Anil Boodram' }),
      mkPolicy({ id: 'b', ownerName: 'Sara Khan', policyNumber: 'TL-2026-08655' }),
      mkPolicy({ id: 'c', status: 'submitted' }), // filtered out
    ]} />);
    expect(screen.getByTestId('delivery-strip-card')).toBeInTheDocument();
    expect(screen.getByText('Policies to deliver')).toBeInTheDocument();
    expect(screen.getByText('Anil Boodram')).toBeInTheDocument();
    expect(screen.getByText('Sara Khan')).toBeInTheDocument();
    // count reflects only the 2 deliverable policies
    expect(screen.getByText('2')).toBeInTheDocument();
    // each deliverable policy carries a clawback chip
    expect(screen.getAllByTestId('clawback-chip')).toHaveLength(2);
  });
});
