// @vitest-environment jsdom
/**
 * AgentAwardsPanel — CHARACTERIZATION (FR-5b, brief § D2/D3).
 *
 * Pins what the Awards tab shows TODAY, through what the user sees, before the
 * award inputs move into a shared helper. The REAL awards engine, ledger
 * derivation, formatters and 2026 default ruleset run; only the network read
 * (getOwnPolicies), auth and the feature flag are mocked. `currentDate` is
 * fixed, so every figure is deterministic.
 *
 * This file must pass UNCHANGED after the move (no edits to assertions,
 * fixtures or its snapshot). If the move changes any pinned output, that is a
 * behaviour change, not a test to update.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ tenantId: 'tenant-test' })),
}));
vi.mock('../../../services/policiesService', () => ({
  getOwnPolicies: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => false),
}));

import AgentAwardsPanel from '../AgentAwardsPanel';
import { getOwnPolicies } from '../../../services/policiesService';
import { DEFAULT_RULESET_2026 } from '../../../config/awardsRuleset/2026';

// Mid-September 2026, midday in Trinidad (UTC-4): month Sep, Q3, year 2026.
const NOW = new Date('2026-09-15T16:00:00Z');

const PROFILE = { uid: 'agent-1', displayName: 'Test Agent', usesPolicyLedger: false, monthsInIndustry: 60, monthsAtTatil: 60 };
const ROOKIE = { ...PROFILE, monthsInIndustry: 6, monthsAtTatil: 6 };

const week = (weekStarting, n) => ({
  status: 'submitted', weekStarting, version: 2,
  apiSold: 4000 + n * 500, applicationsSold: 1 + (n % 3),
  ciConducted: 2 + (n % 2), ffiConducted: 3,
  referralCalls: 15 + n, followUpCalls: 10, coldCalls: 20, seminarTradeshowCalls: 5,
});
// Weeks in May–Sep 2026 (May and June have no settlement rows, so the engine
// supplements them from submissions — the "estimated" path is pinned too).
const SUBS = [
  '2026-05-03', '2026-05-17', '2026-06-07', '2026-06-21', '2026-07-05', '2026-07-19',
  '2026-08-02', '2026-08-16', '2026-08-30', '2026-09-06', '2026-09-13',
].map((d, i) => week(d, i));

const SETTLEMENTS = [
  { periodKey: '2026-07', settledAPI: 60000, settledApps: 4, persistency: 92 },
  { periodKey: '2026-08', settledAPI: 45000, settledApps: 3, persistency: 88 },
  { periodKey: '2026-09', settledAPI: 30000, settledApps: 2, persistency: 91 },
];
// Persistency for only some periods (case c: the merge is by periodKey).
const PERSISTENCY_ROWS = [
  { periodKey: '2026-07', settledAPI: 1, settledApps: 1, persistency: 93 },
  { periodKey: '2026-09', settledAPI: 1, settledApps: 1, persistency: 89 },
];

const pol = (n, dateIssued, api, extra = {}) => ({
  id: n, policyNumber: n, status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary',
  dateIssued, proposedAPI: api, ...extra,
});
const LEDGER = [
  pol('L-01', '2026-07-08', 36000),
  pol('L-02', '2026-07-22', 18000, { importSource: 'oipa_import' }),
  pol('L-03', '2026-08-11', 27500),
  pol('L-04', '2026-09-02', 52000),
  pol('L-05', '2026-09-09', 12000, { isSelfOrFamily: true }),
  pol('L-06', '2025-11-20', 40000), // prior year: no current award reads it
  { ...pol('L-07', '2026-09-10', 9000), status: 'submitted' }, // not settled
];

const GROUP_LABELS = ['✓ Qualified', '★ Almost there · 70%+', '↗ Making progress · 30–70%', '◯ Just starting · under 30%'];

/** Everything the panel shows, as text, plus every award's drill drawer. */
function readPanel() {
  const groups = {};
  for (const label of GROUP_LABELS) {
    const el = screen.queryByText(label);
    if (!el) continue;
    const section = el.parentElement.parentElement;
    groups[label] = [...section.querySelectorAll('[data-testid^="award-card-"]')]
      .map((c) => c.getAttribute('data-testid').replace('award-card-', ''));
  }
  const cardEls = screen.queryAllByTestId(/^award-card-/);
  const cards = {};
  const drawers = {};
  for (const card of cardEls) {
    const id = card.getAttribute('data-testid').replace('award-card-', '');
    cards[id] = card.textContent;
    fireEvent.click(card);
    const drawer = screen.getByTestId('award-drill-drawer');
    drawers[id] = drawer.textContent;
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
  }
  return {
    tracked: screen.queryByText(/awards tracked/)?.textContent ?? null,
    hero: screen.queryByTestId('hero-award-card')?.textContent ?? null,
    yearSettled: screen.queryByTestId('agent-awards-year-settled')?.textContent ?? null,
    ledgerPartial: screen.queryByTestId('agent-awards-ledger-partial')?.textContent ?? null,
    groups,
    cards,
    drawers,
  };
}

function renderPanel(props) {
  return render(
    <AgentAwardsPanel
      submissions={SUBS}
      confirmedSettlements={SETTLEMENTS}
      agentProfile={PROFILE}
      currentDate={NOW}
      ruleset={DEFAULT_RULESET_2026}
      activeCampaigns={[]}
      persistency={[]}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getOwnPolicies.mockResolvedValue([]);
});

describe('AgentAwardsPanel characterization (FR-5b commit 1)', () => {
  it('(a) settlements only, no ledger', async () => {
    renderPanel({});
    await screen.findByText(/awards tracked/);
    const out = readPanel();
    expect(out.groups).not.toEqual({});
    expect(out).toMatchSnapshot();
  });

  it('(b) ledger only: not flagged, has policies, no settlements', async () => {
    getOwnPolicies.mockResolvedValue(LEDGER);
    renderPanel({ confirmedSettlements: [] });
    await screen.findByText(/awards tracked/);
    expect(readPanel()).toMatchSnapshot();
  });

  it('(c) ledger + settlements with persistency for some periods (merged by periodKey)', async () => {
    getOwnPolicies.mockResolvedValue(LEDGER);
    renderPanel({ confirmedSettlements: PERSISTENCY_ROWS });
    await screen.findByText(/awards tracked/);
    expect(readPanel()).toMatchSnapshot();
  });

  it('(d) flagged usesPolicyLedger with an empty ledger', async () => {
    getOwnPolicies.mockResolvedValue([]);
    renderPanel({ agentProfile: { ...PROFILE, usesPolicyLedger: true } });
    await screen.findByText(/awards tracked/);
    expect(readPanel()).toMatchSnapshot();
  });

  it('(e) rookie profile (rookie_of_year and new_bs_award exist)', async () => {
    renderPanel({ agentProfile: ROOKIE });
    await screen.findByText(/awards tracked/);
    const out = readPanel();
    expect(Object.keys(out.cards)).toEqual(expect.arrayContaining(['rookie_of_year', 'new_bs_award']));
    expect(out).toMatchSnapshot();
  });

  it('(f) ledger load failure: partial notice + Retry re-reads the ledger', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    getOwnPolicies.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(LEDGER);
    renderPanel({});
    const notice = await screen.findByTestId('agent-awards-ledger-partial');
    const before = readPanel();
    expect(before).toMatchSnapshot('after the failed read');
    fireEvent.click(within(notice).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('agent-awards-ledger-partial')).toBeNull());
    expect(getOwnPolicies).toHaveBeenCalledTimes(2);
    expect(readPanel()).toMatchSnapshot('after Retry');
    err.mockRestore();
  });
});
