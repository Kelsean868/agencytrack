// @vitest-environment jsdom
// PolicyCard — insured-name-differs-from-owner display (Run 7, Tier-2 #12).
// Design source: docs/design-system/screens-v2/app-policy-v2.jsx lines 516-523
// (`{p.insured !== p.owner ? 'Insured · ${p.insured} · ' : ''}{p.plan}`).
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../../../services/prospectInfoService', () => ({
  PROSPECTING_SOURCE_LABELS: { referral: 'Referral' },
}));

vi.mock('../../../../constants/policyLifecycle', () => ({
  LEGAL_AGENT_TRANSITIONS: {
    submitted: ['rated', 'postponed', 'ntu', 'denied', 'settled'],
  },
  POLICY_STATUS_LABELS: {
    submitted: 'Submitted',
  },
}));

import PolicyCard from '../PolicyCard';
import { awardWindowsForPolicy } from '../../../../lib/ledgerProduction';
import { awardLensPeriods } from '../../../../utils/awardsEngine';
import { TODAY, CHRISTMAS, POLICIES } from '../../../../lib/__tests__/fixtures/awardLensFixtures';

function makePolicy(overrides = {}) {
  return {
    id: 'p1',
    ownerName: 'Devon Holder',
    insuredName: 'Devon Holder',
    status: 'submitted',
    proposedAPI: 18600,
    planName: 'Tatil Term 20',
    sourceOfProspect: 'referral',
    cashWithApp: { collected: false, amount: '' },
    confirmedAt: null,
    ...overrides,
  };
}

describe('PolicyCard — insured name', () => {
  it('shows only the plan name when insured matches owner', () => {
    render(<PolicyCard policy={makePolicy()} onOpen={() => {}} />);
    expect(screen.getByText('Tatil Term 20')).toBeInTheDocument();
    expect(screen.queryByText(/Insured ·/)).not.toBeInTheDocument();
  });

  it('prefixes the plan line with "Insured · <name>" when insured differs from owner', () => {
    render(
      <PolicyCard
        policy={makePolicy({ ownerName: 'Devon Holder', insuredName: 'Marisa Holder' })}
        onOpen={() => {}}
      />
    );
    expect(screen.getByText('Insured · Marisa Holder · Tatil Term 20')).toBeInTheDocument();
  });

  it('renders no plan line at all when there is no planName and insured matches owner', () => {
    render(<PolicyCard policy={makePolicy({ planName: null })} onOpen={() => {}} />);
    expect(screen.queryByText(/Insured ·/)).not.toBeInTheDocument();
  });

  it('still shows the insured prefix when there is no planName but insured differs', () => {
    render(
      <PolicyCard
        policy={makePolicy({ planName: null, insuredName: 'Marisa Holder' })}
        onOpen={() => {}}
      />
    );
    expect(screen.getByText(/Insured · Marisa Holder/)).toBeInTheDocument();
  });
});

// ── L3 — "Counts toward" chips (docs/briefs/ledger-lens-build.md § L3) ──────
//
// `awardWindows` rows come straight from `awardWindowsForPolicy` — the SAME
// engine helper the "Counts toward" lens itself reads — against the fixtures
// L1's engine tests already pin (src/lib/__tests__/awardLens.test.js), so the
// expected labels/groups here are not re-derived, only rendered.
const periods = awardLensPeriods({ today: TODAY, campaigns: [CHRISTMAS] });
const byId = (id) => POLICIES.find((p) => p.id === id);
const windowsFor = (id) => awardWindowsForPolicy(byId(id), periods.current);

describe('PolicyCard — "Counts toward" chips (L3)', () => {
  it('a settled policy gets gold "Counts toward" chips for every open window it counts in', () => {
    render(<PolicyCard policy={byId('B')} onOpen={() => {}} awardWindows={windowsFor('B')} />);
    const chips = screen.getByTestId('award-window-chips');
    expect(within(chips).getByText('Counts toward')).toBeInTheDocument();
    expect(within(chips).queryByText('Will count toward')).not.toBeInTheDocument();
    // B settles inside every current window: campaign, month, quarter, annual, MDRT.
    expect(within(chips).getByTestId('award-window-chip-campaign:xmas26')).toHaveTextContent('★ Christmas');
    expect(within(chips).getByTestId('award-window-chip-month:2026-09')).toHaveTextContent('Sep 2026');
    expect(within(chips).getByTestId('award-window-chip-quarter:2026-Q3')).toHaveTextContent('Q3 2026');
    expect(within(chips).getByTestId('award-window-chip-annual:2026')).toHaveTextContent('2026 awards');
    expect(within(chips).getByTestId('award-window-chip-mdrt:2026')).toHaveTextContent('MDRT 2026');
  });

  it('a submitted (not settled) policy gets grey "Will count toward" chips', () => {
    render(<PolicyCard policy={byId('D')} onOpen={() => {}} awardWindows={windowsFor('D')} />);
    const chips = screen.getByTestId('award-window-chips');
    expect(within(chips).getByText('Will count toward')).toBeInTheDocument();
    expect(within(chips).queryByText('Counts toward')).not.toBeInTheDocument();
    expect(within(chips).getByTestId('award-window-chip-campaign:xmas26')).toBeInTheDocument();
  });

  it('a family policy shows MDRT only, even though it is settled', () => {
    render(<PolicyCard policy={byId('G')} onOpen={() => {}} awardWindows={windowsFor('G')} />);
    const chips = screen.getByTestId('award-window-chips');
    expect(within(chips).getByTestId('award-window-chip-mdrt:2026')).toBeInTheDocument();
    expect(within(chips).queryByTestId('award-window-chip-campaign:xmas26')).not.toBeInTheDocument();
    expect(within(chips).queryByTestId('award-window-chip-annual:2026')).not.toBeInTheDocument();
  });

  it('an NTU policy counts toward nothing and renders no chip row', () => {
    render(<PolicyCard policy={byId('F')} onOpen={() => {}} awardWindows={windowsFor('F')} />);
    expect(screen.queryByTestId('award-window-chips')).not.toBeInTheDocument();
  });

  it('a policy issued outside every open window renders no chip row', () => {
    render(<PolicyCard policy={byId('H')} onOpen={() => {}} awardWindows={windowsFor('H')} />);
    expect(screen.queryByTestId('award-window-chips')).not.toBeInTheDocument();
  });

  it('omitting awardWindows renders no chip row at all (back-compat)', () => {
    render(<PolicyCard policy={makePolicy()} onOpen={() => {}} />);
    expect(screen.queryByTestId('award-window-chips')).not.toBeInTheDocument();
  });
});
