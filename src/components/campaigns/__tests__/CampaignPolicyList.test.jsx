// @vitest-environment jsdom
//
// R2-4 — "Policies in this campaign" on the Campaign screen (CampaignHeroCard
// variant="screen", which both the FR Campaign route and the Nexus Awards tab
// render). The list is grouped off the SAME lens as the screen's figures, and a
// status change is a hand-off to the Policy ledger's own drawer — never a write
// from here.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getUserPrefs: vi.fn(),
  setLedgerTargetTier: vi.fn(),
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/userPrefsService', () => ({
  getUserPrefs: hoisted.getUserPrefs,
  setLedgerTargetTier: hoisted.setLedgerTargetTier,
}));
vi.mock('../../../utils/dateInputs', async (importOriginal) => ({
  ...(await importOriginal()),
  getTodayTT: () => '2026-09-26',
}));

import CampaignHeroCard from '../CampaignHeroCard';
import FrCampaign from '../../fr/compete/FrCampaign';
import { __resetLedgerTargetTierStore } from '../../../hooks/useLedgerTargetTier';
import { derivePolicyLens } from '../../../lib/policyCampaignLens';
import { formatCurrency } from '../../../utils/formatters';
import { CHRISTMAS, POLICIES } from '../../../lib/__tests__/fixtures/awardLensFixtures';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-26T15:00:00Z'));
  vi.clearAllMocks();
  __resetLedgerTargetTierStore();
  hoisted.useAuth.mockReturnValue({ user: { uid: 'a1' }, userProfile: {}, tenantId: 't1' });
  hoisted.getUserPrefs.mockResolvedValue(null);
  hoisted.setLedgerTargetTier.mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderScreen(props = {}) {
  return render(
    <CampaignHeroCard variant="screen" campaign={CHRISTMAS} policies={POLICIES} persistencyRecords={[]} {...props} />,
  );
}

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

describe('Campaign screen — Policies in this campaign', () => {
  it('renders the three groups with the lens reasons on Not counting rows', () => {
    renderScreen();
    const list = screen.getByTestId('campaign-policies');
    expect(within(list).getByRole('heading', { name: 'Policies in this campaign' })).toBeInTheDocument();
    const counting = screen.getByTestId('campaign-policies-counting');
    expect(within(counting).getByTestId('campaign-policy-row-A')).toBeInTheDocument();
    expect(within(counting).getByTestId('campaign-policy-row-B')).toBeInTheDocument();
    expect(within(counting).getByTestId('campaign-policy-row-C')).toBeInTheDocument();
    expect(within(screen.getByTestId('campaign-policies-waiting')).getByTestId('campaign-policy-row-D')).toBeInTheDocument();
    const notCounting = screen.getByTestId('campaign-policies-not-counting');
    expect(screen.getByTestId('campaign-policy-row-reason-H')).toHaveTextContent('Issued before the campaign');
    expect(screen.getByTestId('campaign-policy-row-reason-G')).toHaveTextContent('Self / family — excluded');
    // Folded by default — on a live book it holds most of the ledger.
    expect(notCounting.open).toBe(false);
  });

  it('each row shows client, policy number, status, API and the date the lens tested', () => {
    renderScreen();
    const row = screen.getByTestId('campaign-policy-row-A');
    expect(row).toHaveTextContent('Policyholder A');
    expect(row).toHaveTextContent('#FX0002381');
    expect(screen.getByTestId('campaign-policy-row-status-A')).toHaveTextContent('Settled');
    expect(screen.getByTestId('campaign-policy-row-api-A')).toHaveTextContent(formatCurrency(24_600));
    expect(row).toHaveTextContent('Issued 12 Aug 2026');
    expect(screen.getByTestId('campaign-policy-row-D')).toHaveTextContent('Not issued yet');
  });

  it('parity — the Counting and Waiting totals printed are the campaign figures (lens api/apps current, pending)', () => {
    renderScreen();
    const lens = derivePolicyLens(POLICIES, CHRISTMAS);
    expect(screen.getByTestId('campaign-policies-counting-header-total'))
      .toHaveTextContent(`${plural(lens.apps.current, 'app')} · ${formatCurrency(lens.api.current)}`);
    expect(screen.getByTestId('campaign-policies-waiting-header-total'))
      .toHaveTextContent(`would add ${plural(lens.pending.apps, 'app')} · ${formatCurrency(lens.pending.api)}`);
    // And the fixture's figures, stated plainly, so a lens change cannot move
    // both sides of the comparison at once unnoticed.
    expect(screen.getByTestId('campaign-policies-counting-header-total')).toHaveTextContent('3 apps · TTD 73,946');
    expect(screen.getByTestId('campaign-policies-waiting-header-total')).toHaveTextContent('would add 1 app · TTD 36,000');
  });

  it('a head-office row offers no status change and says why', () => {
    renderScreen({ onOpenPolicy: vi.fn() });
    // A (settled) and F (ntu) came from the OIPA export.
    expect(screen.queryByTestId('campaign-policy-row-change-A')).toBeNull();
    expect(screen.getByTestId('campaign-policy-row-locked-A')).toHaveTextContent('Status set by head office');
    expect(screen.queryByTestId('campaign-policy-row-change-F')).toBeNull();
    // C is settled by the agent: the ledger drawer offers no status change on
    // a settled policy either, so neither does the list (but it is not "head office").
    expect(screen.queryByTestId('campaign-policy-row-change-C')).toBeNull();
    expect(screen.queryByTestId('campaign-policy-row-locked-C')).toBeNull();
  });

  it('"Change status" hands the policy id to onOpenPolicy — no write happens here', () => {
    const onOpenPolicy = vi.fn();
    renderScreen({ onOpenPolicy });
    const btn = screen.getByTestId('campaign-policy-row-change-D');
    expect(btn).toHaveAccessibleName('Change status of Policyholder D, policy FX0002415');
    fireEvent.click(btn);
    expect(onOpenPolicy).toHaveBeenCalledTimes(1);
    expect(onOpenPolicy).toHaveBeenCalledWith('D');
  });

  it('without onOpenPolicy the list is read-only (no Change status anywhere)', () => {
    renderScreen();
    expect(screen.queryAllByText('Change status')).toHaveLength(0);
  });

  it('after a status change the list reflects the new docs (D settles → moves to Counting, totals follow)', () => {
    const { rerender } = renderScreen();
    const after = POLICIES.map((p) => (p.id === 'D'
      ? { ...p, status: 'settled', statusSource: 'agent', settledAPI: 36_000, dateIssued: '2026-09-20' }
      : p));
    rerender(<CampaignHeroCard variant="screen" campaign={CHRISTMAS} policies={after} persistencyRecords={[]} />);
    expect(within(screen.getByTestId('campaign-policies-counting')).getByTestId('campaign-policy-row-D')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-policies-counting-header-total')).toHaveTextContent('4 apps · TTD 109,946');
    expect(screen.getByTestId('campaign-policies-waiting-header-total')).toHaveTextContent('would add 0 apps · TTD 0');
  });

  it('a credit that differs from the policy API is stated on the row (Platinum Edge: an app, no API)', () => {
    const pe = { id: 'PE', ownerName: 'Policyholder PE', status: 'settled', productLine: 'life', newBusinessType: 'platinum_edge', settledAPI: 12_000, dateIssued: '2026-08-01', statusSource: 'agent' };
    render(<CampaignHeroCard variant="screen" campaign={CHRISTMAS} policies={[pe]} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-policy-row-api-PE')).toHaveTextContent('TTD 12,000');
    expect(screen.getByTestId('campaign-policy-row-credit-PE')).toHaveTextContent('Counts TTD 0 · 1 app');
    expect(screen.getByTestId('campaign-policies-counting-header-total')).toHaveTextContent('1 app · TTD 0');
  });

  it('the compact and full variants are unchanged — no list', () => {
    render(<CampaignHeroCard variant="compact" campaign={CHRISTMAS} policies={POLICIES} persistencyRecords={[]} />);
    expect(screen.queryByTestId('campaign-policies')).toBeNull();
    cleanup();
    render(<CampaignHeroCard campaign={CHRISTMAS} policies={POLICIES} persistencyRecords={[]} />);
    expect(screen.queryByTestId('campaign-policies')).toBeNull();
  });
});

describe('FR Campaign route — wiring', () => {
  it('passes onOpenPolicy through to the list rows', () => {
    const onOpenPolicy = vi.fn();
    render(
      <FrCampaign
        activeCampaigns={[CHRISTMAS]}
        campaignPolicies={POLICIES}
        ledgerError={false}
        persistency={[]}
        onOpenPolicy={onOpenPolicy}
      />,
    );
    fireEvent.click(screen.getByTestId('campaign-policy-row-change-D'));
    expect(onOpenPolicy).toHaveBeenCalledWith('D');
  });
});
