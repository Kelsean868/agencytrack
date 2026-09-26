// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useFeatureFlag: vi.fn(),
  useAuth: vi.fn(),
  getActiveCampaignsForAgent: vi.fn(),
  getUserPrefs: vi.fn(),
  setLedgerTargetTier: vi.fn(),
}));

vi.mock('../../../../hooks/useFeatureFlag', () => ({ useFeatureFlag: hoisted.useFeatureFlag }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../../services/campaignService', () => ({
  getActiveCampaignsForAgent: hoisted.getActiveCampaignsForAgent,
}));
vi.mock('../../../../services/userPrefsService', () => ({
  getUserPrefs: hoisted.getUserPrefs,
  setLedgerTargetTier: hoisted.setLedgerTargetTier,
}));
vi.mock('../../../../utils/dateInputs', () => ({ getTodayTT: () => '2026-09-26' }));

import AwardLensPanel from '../AwardLensPanel';
import { __resetLedgerTargetTierStore } from '../../../../hooks/useLedgerTargetTier';
import { CHRISTMAS, POLICIES } from '../../../../lib/__tests__/fixtures/awardLensFixtures';

const PROMISE_RE = /\b(qualif(y|ies|ied)|you'?ll win|you win)\b/i;

beforeEach(() => {
  vi.clearAllMocks();
  __resetLedgerTargetTierStore();
  hoisted.useAuth.mockReturnValue({ user: { uid: 'a1' }, userProfile: { unitId: 'u1' }, tenantId: 't1' });
  hoisted.useFeatureFlag.mockReturnValue(true);
  hoisted.getActiveCampaignsForAgent.mockResolvedValue([CHRISTMAS]);
  hoisted.getUserPrefs.mockResolvedValue(null);
  hoisted.setLedgerTargetTier.mockResolvedValue();
});
afterEach(() => cleanup());

const onOpen = vi.fn();
const renderPanel = (props = {}) => render(<AwardLensPanel policies={POLICIES} onOpen={onOpen} {...props} />);
const card = () => screen.getByTestId('award-lens-card');
const groupCount = (g) => within(screen.getByTestId(`award-lens-group-${g}`)).queryAllByTestId(/^policy-card-[A-Z]$/).length;

async function waitForCampaign() {
  await waitFor(() => expect(screen.getByTestId('award-lens-option-campaign:xmas26')).toBeInTheDocument());
}

describe('AwardLensPanel — selector and default', () => {
  it('flag OFF: no campaign fetch, no campaign option; this month is the default', () => {
    hoisted.useFeatureFlag.mockReturnValue(false);
    renderPanel();
    expect(hoisted.getActiveCampaignsForAgent).not.toHaveBeenCalled();
    expect(screen.queryByTestId('award-lens-option-campaign:xmas26')).not.toBeInTheDocument();
    expect(screen.getByTestId('award-lens-option-month:2026-09')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('award-lens-title')).toHaveTextContent('Your September credit');
  });

  it('flag ON: the ★ campaign is pinned first and selected by default', async () => {
    renderPanel();
    await waitForCampaign();
    const radios = within(screen.getByTestId('award-lens-selector')).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['★ Christmas', 'Sep 2026', 'Q3 2026', '2026 awards', 'MDRT 2026']);
    await waitFor(() => expect(radios[0]).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByTestId('award-lens-title')).toHaveTextContent('Christmas Campaign & Retreat');
  });

  it('shows a loading chip while campaigns load', () => {
    hoisted.getActiveCampaignsForAgent.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(screen.getByTestId('award-lens-campaigns-loading')).toBeInTheDocument();
    expect(screen.getByTestId('award-lens-card')).toBeInTheDocument(); // other awards still render
  });

  it('campaign load error: alert + Retry, the other awards still show', async () => {
    hoisted.getActiveCampaignsForAgent.mockRejectedValueOnce(new Error('offline'));
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('award-lens-campaigns-error')).toBeInTheDocument());
    expect(screen.getByTestId('award-lens-title')).toHaveTextContent('Your September credit');
    fireEvent.click(within(screen.getByTestId('award-lens-campaigns-error')).getByRole('button', { name: 'Retry' }));
    await waitForCampaign();
    expect(hoisted.getActiveCampaignsForAgent).toHaveBeenCalledTimes(2);
  });

  it('Past period… selects a closed period', async () => {
    renderPanel();
    await waitForCampaign();
    fireEvent.change(screen.getByTestId('award-lens-past'), { target: { value: 'month:2026-08' } });
    expect(screen.getByTestId('award-lens-title')).toHaveTextContent('Your August credit (final)');
    expect(screen.getByTestId('award-lens-chip')).toHaveTextContent('Closed · final credit');
    expect(screen.getByTestId('award-lens-line1')).toHaveTextContent('Closed period. Nothing more can count.');
  });
});

describe('AwardLensPanel — card variant per award type', () => {
  it('campaign (D1/D3): API + Applications rings + target tier picker + pace + export proof', async () => {
    renderPanel();
    await waitForCampaign();
    expect(within(card()).getByTestId('award-lens-rings')).toBeInTheDocument();
    const api = within(card()).getByTestId('award-lens-ring-api');
    expect(within(api).getByText('73.9K / 275K')).toBeInTheDocument();
    expect(within(api).getByText('+36K submitted')).toBeInTheDocument();
    expect(within(api).getByText('73,946 + 36,000 submitted')).toBeInTheDocument(); // D3 strip wording
    const apps = within(card()).getByTestId('award-lens-ring-apps');
    expect(within(apps).getByText('32 to go · +1 sub.')).toBeInTheDocument();
    expect(within(apps).getByText('3 + 1 submitted / 35')).toBeInTheDocument();
    expect(screen.getByTestId('award-lens-pending-note')).toHaveTextContent(
      'Plus TTD 36,000 (1 app) submitted — the faint ring. It counts when head office settles it.',
    );
    expect(screen.getByTestId('ledger-target-tier-Champion')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('award-lens-line1')).toHaveTextContent('TTD 14.7K a week to reach Champion.');
    expect(screen.getByTestId('award-lens-export-proof')).toBeInTheDocument();
  });

  it.each([
    ['month:2026-09', 'Your September credit'],
    ['quarter:2026-Q3', 'Your Q3 credit'],
    ['annual:2026', 'Your 2026 award credit'],
  ])('%s: ranked boxes, no ring, no picker, no promise', async (key, title) => {
    renderPanel();
    await waitForCampaign();
    fireEvent.click(screen.getByTestId(`award-lens-option-${key}`));
    expect(screen.getByTestId('award-lens-title')).toHaveTextContent(title);
    expect(within(card()).getByTestId('award-lens-boxes')).toBeInTheDocument();
    expect(within(card()).queryByTestId('award-lens-ring')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ledger-target-tier')).not.toBeInTheDocument();
    expect(card().textContent).not.toMatch(PROMISE_RE);
    expect(within(card()).getByText('Settled — counts')).toBeInTheDocument();
    expect(within(card()).getByText('Submitted — waiting')).toBeInTheDocument();
  });

  it('MDRT: ring against the MDRT line (688,800, same as Home), family counts', async () => {
    renderPanel();
    await waitForCampaign();
    fireEvent.click(screen.getByTestId('award-lens-option-mdrt:2026'));
    expect(within(card()).getByTestId('award-lens-ring')).toBeInTheDocument();
    expect(within(card()).getByText(/^of 688,800 ·/)).toBeInTheDocument();
    expect(screen.getByTestId('award-lens-line2')).toHaveTextContent('Family and self policies count here.');
    expect(groupCount('counting')).toBe(5);
  });
});

describe('AwardLensPanel — target tier', () => {
  it('switching the tier changes target and pace, and persists the choice', async () => {
    renderPanel();
    await waitForCampaign();
    fireEvent.click(screen.getByTestId('ledger-target-tier-VIP'));
    expect(screen.getByTestId('ledger-target-tier-VIP')).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByTestId('award-lens-ring-api')).getByText('73.9K / 375K')).toBeInTheDocument();
    expect(screen.getByTestId('award-lens-line1')).toHaveTextContent('TTD 22K a week to reach VIP.');
    expect(hoisted.setLedgerTargetTier).toHaveBeenCalledWith('t1', 'a1', 'xmas26', 'VIP');
  });

  it('a failed save keeps the choice for the session, with no error shown', async () => {
    hoisted.setLedgerTargetTier.mockRejectedValue(new Error('permission-denied'));
    renderPanel();
    await waitForCampaign();
    fireEvent.click(screen.getByTestId('ledger-target-tier-Elite'));
    await waitFor(() => expect(hoisted.setLedgerTargetTier).toHaveBeenCalled());
    expect(screen.getByTestId('ledger-target-tier-Elite')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reads the saved tier from prefs', async () => {
    hoisted.getUserPrefs.mockResolvedValue({ ledgerTargetTiers: { xmas26: 'Premier' } });
    renderPanel();
    await waitForCampaign();
    await waitFor(() => expect(screen.getByTestId('ledger-target-tier-Premier')).toHaveAttribute('aria-checked', 'true'));
  });
});

describe('AwardLensPanel — grouped list', () => {
  it('campaign grouping counts, reasons and the HO flag', async () => {
    renderPanel();
    await waitForCampaign();
    expect(groupCount('counting')).toBe(3);
    expect(groupCount('pending')).toBe(1);
    expect(groupCount('not')).toBe(5);
    const not = screen.getByTestId('award-lens-group-not');
    expect(within(not).getByText('Family policy — counts for MDRT only')).toBeInTheDocument();
    expect(within(not).getByText('NTU — replaced by ···2403')).toBeInTheDocument();
    expect(within(screen.getByTestId('policy-card-C')).getByTestId('policy-card-ho-flag')).toBeInTheDocument();
    expect(within(screen.getByTestId('policy-card-B')).queryByTestId('policy-card-ho-flag')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('policy-card-D')).getByText('Counts when settled')).toBeInTheDocument();
  });

  it('each card keeps its tap-through', async () => {
    renderPanel();
    await waitForCampaign();
    fireEvent.click(screen.getByTestId('policy-card-A'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'A' }));
  });

  it('empty state per group with no policies', () => {
    hoisted.useFeatureFlag.mockReturnValue(false);
    renderPanel({ policies: [] });
    expect(screen.getByTestId('award-lens-empty-counting')).toHaveTextContent('Nothing counts toward this yet.');
    expect(screen.getByTestId('award-lens-empty-pending')).toHaveTextContent('Nothing waiting to settle here.');
    expect(screen.getByTestId('award-lens-empty-not')).toHaveTextContent('Every policy here counts.');
  });

  it('the ledger filter narrows the list, never the award totals', async () => {
    renderPanel({ visibleIds: new Set(['A']) });
    await waitForCampaign();
    expect(groupCount('counting')).toBe(1);
    expect(screen.getByTestId('award-lens-empty-pending')).toHaveTextContent('No policies here match this filter.');
    expect(within(card()).getByText('73,946 + 36,000 submitted')).toBeInTheDocument();
  });
});
