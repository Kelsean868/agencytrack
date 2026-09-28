/**
 * FrTrophyRoom container (FR-5b) — award trophies from what the dashboard
 * already holds, through the shared award model; no new read.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { DEFAULT_RULESET_2026 } from '../../../../config/awardsRuleset/2026';

vi.mock('../useMyLeaderboardEntry', () => ({
  default: () => ({ loading: false, error: false, entry: { badges: ['first_submission'], points: 700, weeklyStreak: 1 }, retry: vi.fn() }),
}));

import FrTrophyRoom from '../FrTrophyRoom';

const NOW = new Date('2026-09-15T16:00:00Z');
const PROFILE = { uid: 'agent-1', usesPolicyLedger: false, monthsInIndustry: 60, monthsAtTatil: 60 };
const pol = (n, dateIssued, api) => ({ id: n, status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', dateIssued, proposedAPI: api });
const base = {
  tenantId: 't1', uid: 'agent-1', settlements: [], allSubmissions: [], userProfile: PROFILE,
  awardsRuleset: DEFAULT_RULESET_2026, activeCampaigns: [], now: NOW,
};

describe('FrTrophyRoom — award trophies', () => {
  it('ledger ready: award trophies from the engine (Q3 API qualified: TTD 135,000 settled in Q3, persistency 92%)', () => {
    // Persistency comes from settlements, merged into the ledger rows by periodKey (awardInputs).
    const settlements = ['2026-07', '2026-08', '2026-09'].map((periodKey) => ({ periodKey, persistency: 92 }));
    render(<FrTrophyRoom {...base} settlements={settlements} ledgerPolicies={[pol('A', '2026-07-08', 60000), pol('B', '2026-08-11', 45000), pol('C', '2026-09-02', 30000)]} />);
    const shelf = screen.getByTestId('trophy-shelf-awards');
    expect(within(screen.getByTestId('trophy-quarterly_api')).getByText('Qualified — Q3 2026')).toBeInTheDocument();
    expect(within(shelf).getByTestId('trophy-advisor_month_api')).toHaveTextContent('60% there');
    // Not a rookie / not new: those awards are not created, so no trophy for them.
    expect(screen.queryByTestId('trophy-rookie_of_year')).toBeNull();
    expect(screen.queryByTestId('trophy-new_bs_award')).toBeNull();
  });

  it('ledger still loading: the Awards group is a skeleton; badges and levels show', () => {
    render(<FrTrophyRoom {...base} ledgerPolicies={null} />);
    expect(screen.getByTestId('trophy-shelf-awards').querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByTestId('trophy-shelf-badges')).toBeInTheDocument();
  });

  it('ledger failed: inline error; Retry uses the dashboard retry path', () => {
    const onRetryPolicies = vi.fn();
    render(<FrTrophyRoom {...base} ledgerPolicies={null} ledgerError onRetryPolicies={onRetryPolicies} />);
    fireEvent.click(within(screen.getByTestId('trophy-shelf-awards')).getByRole('button', { name: 'Retry' }));
    expect(onRetryPolicies).toHaveBeenCalled();
  });

  it('an engine failure shows the Awards error, never "no awards"', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<FrTrophyRoom {...base} ledgerPolicies={[]} awardsRuleset={null} />);
    expect(within(screen.getByTestId('trophy-shelf-awards')).getByRole('alert')).toHaveTextContent('did not load');
    err.mockRestore();
  });
});
