// @vitest-environment jsdom
//
// C1 — the gate LADDER on screen, for both gate modes.
//
// The engine tests prove the arithmetic. These prove the thing an advisor
// actually looks at: a binary campaign must show TWO rows, not four, and it
// must highlight the row the advisor is standing in. A four-row ladder on a
// campaign graded by a single cliff advertises half and quarter prizes that
// Rule 5 does not offer.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersistencyGateStrip } from '../CampaignStandings';

const BINARY = {
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  persistencyGate: { mode: 'binary', threshold: 90, basis: 'finalMonth' },
};
const LEGACY = { startDate: '2026-01-01', endDate: '2026-12-31' };

const rows = () => screen.getByRole('group', { name: /persistency gate bands/i }).children;

describe('C1 — PersistencyGateStrip', () => {
  it('renders four rows for a legacy banded campaign', () => {
    render(<PersistencyGateStrip campaign={LEGACY} currentPct={87} />);
    expect(rows()).toHaveLength(4);
    expect(screen.getByText('≥90%')).toBeTruthy();
    expect(screen.getByText('85–89%')).toBeTruthy();
  });

  it('renders exactly two rows for a binary campaign', () => {
    render(<PersistencyGateStrip campaign={BINARY} currentPct={89} />);
    expect(rows()).toHaveLength(2);
    expect(screen.getByText('≥90%')).toBeTruthy();
    expect(screen.getByText('<90%')).toBeTruthy();
    expect(screen.queryByText('85–89%')).toBeNull();
  });

  it('marks the advisor’s row, matched on threshold rather than object identity', () => {
    // binaryGateBands() builds fresh objects on every call, so an identity
    // comparison would silently never highlight anything.
    render(<PersistencyGateStrip campaign={BINARY} currentPct={89} />);
    const marks = screen.getAllByText('YOU');
    expect(marks).toHaveLength(1);
    // 89% is below the threshold, so the DQ row is the one marked.
    expect(marks[0].parentElement.textContent).toContain('DQ');
  });

  it('marks the passing row at exactly the threshold', () => {
    render(<PersistencyGateStrip campaign={BINARY} currentPct={90} />);
    const mark = screen.getByText('YOU');
    expect(mark.parentElement.textContent).toContain('100%');
  });

  it('marks nothing when persistency is unknown — abstains, never disqualifies', () => {
    render(<PersistencyGateStrip campaign={BINARY} currentPct={null} />);
    expect(rows()).toHaveLength(2);
    expect(screen.queryByText('YOU')).toBeNull();
  });

  it('honours a non-default threshold in the labels', () => {
    render(<PersistencyGateStrip
      campaign={{ persistencyGate: { mode: 'binary', threshold: 85 } }}
      currentPct={86}
    />);
    expect(screen.getByText('≥85%')).toBeTruthy();
    expect(screen.getByText('<85%')).toBeTruthy();
  });

  it('with no campaign at all, falls back to the legacy four-band ladder', () => {
    render(<PersistencyGateStrip currentPct={95} />);
    expect(rows()).toHaveLength(4);
  });
});
