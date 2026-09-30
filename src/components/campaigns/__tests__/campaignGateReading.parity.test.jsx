// @vitest-environment jsdom
//
// R2-1b — parity of the PAYOUT reading (ruling 1, 29-09-2026): for one final-
// month record near the gate, the gate verdict (payout band), the campaign
// card, the Campaign screen, the standings pill, the Persistency screen and
// Today print the SAME string and reach the SAME verdict. Before R2-1b the
// campaign engine read a whole percent (89.994 → "90%", paid) while every
// other screen printed "89.99%" below the gate.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../../services/persistencyService', () => ({ savePersistency: vi.fn() }));

import CampaignHeroCard from '../CampaignHeroCard';
import { GatePill } from '../CampaignStandings';
import PersistencyOutlookHero from '../../persistency/PersistencyOutlookHero';
import { persistencyPctForGate, gateBandFor, normalizeGate } from '../../../utils/campaignEngine';
import { campaignPersistencyReading } from '../../../lib/campaignPersistencyReading';
import { buildPersistencyOutlook } from '../../../lib/persistency/persistencyOutlook';
import { persistencyNowFrom } from '../../../lib/fr/todayModel';
import { formatPersistencyPct } from '../../../lib/persistency/persistencyRounding';

const TODAY = '2026-12-20';
const CAMPAIGN = {
  id: 'xmas26', name: 'Christmas test campaign', startDate: '2026-07-01', endDate: '2026-12-31',
  structure: 'qualify',
  persistencyGate: { mode: 'binary', basis: 'finalMonth', threshold: 90 },
  tiers: [{ level: 1, name: 'Champion', api: 275_000, apps: 35 }],
};
const GATE = normalizeGate(CAMPAIGN);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T15:00:00Z`));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each([
  [0.89996, '90.00%', true],
  [0.89994, '89.99%', false],
])('final-month record %s', (fraction, printed, paid) => {
  const records = [{ monthKey: '2026-12', year: 2026, month: 12, persistency: fraction, grossSettled: 100000, netSettled: fraction * 100000 }];

  it('the gate verdict: payout band and the reading string', () => {
    const reading = persistencyPctForGate(records, CAMPAIGN);
    expect(formatPersistencyPct(reading)).toBe(printed);
    expect(gateBandFor(reading, GATE).payout).toBe(paid ? 1 : 0);
  });

  it('campaign card, Campaign screen and standings pill print the same string and verdict', () => {
    const known = campaignPersistencyReading({ campaign: CAMPAIGN, records, today: TODAY });
    expect(known.label).toBe(printed);
    expect(known.below).toBe(!paid);

    render(<CampaignHeroCard campaign={CAMPAIGN} policies={[]} persistencyRecords={records} />);
    expect(screen.getByTestId('campaign-hero-row-persistency')).toHaveTextContent(printed);
    cleanup();

    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={[]} persistencyRecords={records} />);
    const block = screen.getByTestId('campaign-screen-progress-persistency');
    expect(block).toHaveTextContent(printed);
    if (paid) expect(block).not.toHaveTextContent('Below the gate');
    else expect(block).toHaveTextContent('Below the gate');
    cleanup();

    render(<GatePill persPct={persistencyPctForGate(records, CAMPAIGN)} band={gateBandFor(persistencyPctForGate(records, CAMPAIGN), GATE)} />);
    expect(screen.getByText(printed)).toBeInTheDocument();
    expect(screen.getByText(paid ? '100%' : 'DQ')).toBeInTheDocument();
  });

  it('the Persistency screen and Today print the same string for the same record', () => {
    const outlook = buildPersistencyOutlook({ policies: [], records, today: TODAY });
    render(<PersistencyOutlookHero outlook={outlook} canConfirm={false} onConfirm={() => {}} />);
    expect(screen.getByTestId('persistency-outlook-confirmed-pct').textContent).toBe(printed);
    expect(formatPersistencyPct(persistencyNowFrom(outlook).pct)).toBe(printed);
    expect(persistencyNowFrom(outlook).pct >= 90).toBe(paid);
  });
});
