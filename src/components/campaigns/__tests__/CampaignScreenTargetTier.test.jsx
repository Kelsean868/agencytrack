// @vitest-environment jsdom
//
// L1 — "My target tier" on the Campaign screen hero (R2) and its sync with the
// Policy Ledger's campaign card: both read and write ONE pref through
// useLedgerTargetTier, so a choice on either screen moves the other.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useFeatureFlag: vi.fn(),
  getActiveCampaignsForAgent: vi.fn(),
  getUserPrefs: vi.fn(),
  setLedgerTargetTier: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../hooks/useFeatureFlag', () => ({ useFeatureFlag: hoisted.useFeatureFlag }));
vi.mock('../../../services/campaignService', () => ({ getActiveCampaignsForAgent: hoisted.getActiveCampaignsForAgent }));
vi.mock('../../../services/userPrefsService', () => ({
  getUserPrefs: hoisted.getUserPrefs,
  setLedgerTargetTier: hoisted.setLedgerTargetTier,
}));
vi.mock('../../../utils/dateInputs', async (importOriginal) => ({
  ...(await importOriginal()),
  getTodayTT: () => '2026-09-26',
}));

import CampaignHeroCard from '../CampaignHeroCard';
import CampaignScreenWithTier from '../CampaignScreenWithTier';
import AwardLensPanel from '../../agent/policyLedger/AwardLensPanel';
import { __resetLedgerTargetTierStore } from '../../../hooks/useLedgerTargetTier';
import { CHRISTMAS, POLICIES } from '../../../lib/__tests__/fixtures/awardLensFixtures';

beforeEach(() => {
  vi.clearAllMocks();
  __resetLedgerTargetTierStore();
  hoisted.useAuth.mockReturnValue({ user: { uid: 'a1' }, userProfile: {}, tenantId: 't1' });
  hoisted.useFeatureFlag.mockReturnValue(true);
  hoisted.getActiveCampaignsForAgent.mockResolvedValue([CHRISTMAS]);
  hoisted.getUserPrefs.mockResolvedValue(null);
  hoisted.setLedgerTargetTier.mockResolvedValue();
});
afterEach(() => cleanup());

describe('CampaignHeroCard screen variant — target tier', () => {
  it('without a picker handler the screen renders exactly as before (no picker)', () => {
    render(<CampaignHeroCard variant="screen" campaign={CHRISTMAS} policies={POLICIES} />);
    expect(screen.queryByTestId('campaign-screen-target-tier')).not.toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen')).toHaveTextContent('Aiming for Champion');
  });

  it('a chosen tier moves the header, the API ring target and the pace', () => {
    const { rerender } = render(
      <CampaignHeroCard variant="screen" campaign={CHRISTMAS} policies={POLICIES} targetTierName={null} onTargetTierChange={() => {}} />,
    );
    expect(screen.getByTestId('campaign-screen-target-tier-Champion')).toHaveAttribute('aria-checked', 'true');
    const apiBefore = screen.getByTestId('campaign-screen-progress-api').textContent;
    const paceBefore = screen.getByTestId('campaign-screen-takes-api').textContent;

    rerender(
      <CampaignHeroCard variant="screen" campaign={CHRISTMAS} policies={POLICIES} targetTierName="Elite" onTargetTierChange={() => {}} />,
    );
    expect(screen.getByTestId('campaign-screen-target-tier-Elite')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('campaign-screen')).toHaveTextContent('Aiming for Elite');
    expect(screen.getByTestId('campaign-screen-progress-api')).toHaveTextContent('of 675K');
    expect(screen.getByTestId('campaign-screen-progress-api').textContent).not.toBe(apiBefore);
    expect(screen.getByTestId('campaign-screen-takes-api').textContent).not.toBe(paceBefore);
    // The tier ladder's NEXT TIER stays a fact about the ladder, not the choice.
    expect(screen.getByTestId('campaign-screen-tier-row-Champion')).toHaveTextContent('Next tier');
  });
});

describe('Campaign screen ⇄ Policy Ledger — one pref, both pickers in sync', () => {
  it('choosing on the Campaign screen moves the ledger card, and persists once', async () => {
    render(
      <>
        <CampaignScreenWithTier campaign={CHRISTMAS} policies={POLICIES} />
        <AwardLensPanel policies={POLICIES} onOpen={() => {}} />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('ledger-target-tier-Champion')).toHaveAttribute('aria-checked', 'true'));

    fireEvent.click(screen.getByTestId('campaign-screen-target-tier-Premier'));

    expect(screen.getByTestId('campaign-screen-target-tier-Premier')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('ledger-target-tier-Premier')).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByTestId('award-lens-ring-api')).getByText('73.9K / 475K')).toBeInTheDocument();
    expect(hoisted.setLedgerTargetTier).toHaveBeenCalledTimes(1);
    expect(hoisted.setLedgerTargetTier).toHaveBeenCalledWith('t1', 'a1', 'xmas26', 'Premier');
  });
});
