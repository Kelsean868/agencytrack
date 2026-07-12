// @vitest-environment jsdom
// PolicyCard — insured-name-differs-from-owner display (Run 7, Tier-2 #12).
// Design source: docs/design-system/screens-v2/app-policy-v2.jsx lines 516-523
// (`{p.insured !== p.owner ? 'Insured · ${p.insured} · ' : ''}{p.plan}`).
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
