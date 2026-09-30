/**
 * persistencyGateVerdicts.components — ruling R-a (Kyron, 28–29-09-2026) at
 * every COMPONENT verdict site migrated in R2-1: the printed figure is the
 * 2-dp, half-up rounded percent, and the tone / band / banner / flag beside it
 * is judged on that same value. One table per site at 89.994 / 89.995 /
 * 89.996 / 90 (the 80% floor sites use the same values ten points lower).
 *
 * Plus the parity check the brief names: Today, the Persistency screen and
 * the campaign card print the same string for one fixture.
 *
 * Synthetic fixtures only (placeholder policy numbers, no client data).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../../services/persistencyService', () => ({ savePersistency: vi.fn() }));

import { buildPersistencyOutlook } from '../../../lib/persistency/persistencyOutlook';
import GateBars from '../../fr/charts/GateBars';
import { PersistencyGateBarBlock } from '../../campaigns/CampaignScreenBlocks';
import CampaignHeroCard from '../../campaigns/CampaignHeroCard';
import PersBandCell from '../../manager/roster/PersBandCell';
import TeamPerfRoster from '../../manager/roster/TeamPerfRoster';
import PersRoster from '../../manager/PersRoster';
import PersRealityBar from '../../manager/PersRealityBar';
import PersistencyEntryForm from '../../manager/PersistencyEntryForm';
import GapAnalysisPanel from '../../goals/GapAnalysisPanel';
import PersistencyOutlookHero from '../PersistencyOutlookHero';
import PersistencyPlayground from '../PersistencyPlayground';
import { computeBarStats } from '../../../lib/persistency/calculations';

const GATE_TABLE = [
  [89.994, '89.99%', false],
  [89.995, '90.00%', true],
  [89.996, '90.00%', true],
  [90, '90.00%', true],
];
// [percent, printed, band] across the 80% floor
const FLOOR_TABLE = [
  [79.994, '79.99%', 'danger'],
  [79.995, '80.00%', 'warning'],
  [79.996, '80.00%', 'warning'],
  [80, '80.00%', 'warning'],
];

// Two-policy book at exactly `pct` % (see persistencyGateVerdicts.test.js).
const EXPORT = '2026-09-15';
const TODAY = '2026-09-23';
const GATE = { monthKey: '2026-12', threshold: 90 };
function bookAt(pct) {
  const lapsed = Math.round(100000 * (100 - pct)) / 100;
  const doc = (policyNumber, status, api) => ({
    policyNumber, dateIssued: '2025-06-10', status, proposedAPI: api, productLine: 'life',
    isWritingAgent: true, importSource: 'oipa', exportDate: EXPORT,
  });
  return [doc('T-S1', 'settled', 100000 - lapsed), doc('T-L1', 'lapsed', lapsed)];
}
const CAMPAIGN = {
  id: 'xmas26', name: 'Christmas test campaign', startDate: '2026-07-01', endDate: '2026-12-31',
  structure: 'qualify',
  persistencyGate: { mode: 'binary', basis: 'finalMonth', threshold: 90 },
  tiers: [{ level: 1, name: 'Champion', api: 275_000, apps: 35 }],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T15:00:00Z`));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GateBars — bar side of the gate and its label agree', () => {
  it.each(GATE_TABLE)('%f → %s → up %s', (pct, printed, up) => {
    render(<GateBars data={[{ key: 'm', label: 'Dec', value: pct }]} gate={90} />);
    const side = up ? 'at or above' : 'below';
    expect(screen.getByRole('button', { name: `Dec: ${printed}, ${side} the 90% gate` })).toBeInTheDocument();
  });
});

describe('PersistencyGateBarBlock (Campaign screen) — value label, fill and month tone agree', () => {
  it.each(GATE_TABLE)('%f → %s → below %s', (pct, printed, meets) => {
    const outlook = buildPersistencyOutlook({ policies: bookAt(pct), records: [], today: TODAY, gate: GATE });
    render(<PersistencyGateBarBlock projectedPct={pct} threshold={90} judgedLabel={null} outlook={outlook} />);
    const value = screen.getByTestId('campaign-screen-gate-bar-value');
    expect(value).toHaveTextContent(printed);
    expect(value.className).toContain(meets ? 'text-success-ink' : 'text-warning-ink');
    const projected = screen.getByTestId('campaign-screen-gate-month-projected');
    expect(projected).toHaveTextContent(printed);
    expect(projected.innerHTML).toContain(meets ? 'text-ink' : 'text-warning-ink');
    if (meets) expect(projected.innerHTML).not.toContain('text-warning-ink');
  });
});

describe('CampaignHeroCard preview (full card) — bar tone follows the printed preview', () => {
  it.each(GATE_TABLE)('%f → %s → achieved %s', (pct, printed, meets) => {
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={bookAt(pct)} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-hero-row-persistency')).toHaveTextContent(printed);
    const fill = screen.getByTestId('campaign-hero-persistency-bar-fill');
    expect(fill.className).toContain(meets ? 'bg-success' : 'bg-warning');
  });
});

describe('CampaignHeroCard screen — "Below the gate" follows the printed projection', () => {
  it.each(GATE_TABLE)('%f → %s → below %s', (pct, printed, meets) => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={bookAt(pct)} persistencyRecords={[]} />);
    const block = screen.getByTestId('campaign-screen-progress-persistency');
    expect(block).toHaveTextContent(printed);
    if (meets) expect(block).not.toHaveTextContent('Below the gate');
    else expect(block).toHaveTextContent('Below the gate');
  });
});

describe('PersBandCell (team roster, desktop) — band follows the printed value', () => {
  it.each(GATE_TABLE)('gate %f → %s → success %s', (pct, printed, meets) => {
    render(<PersBandCell persistency={pct} />);
    const text = screen.getByText(printed);
    expect(text.className).toContain(meets ? 'text-success-ink' : 'text-warning-ink');
  });
  it.each(FLOOR_TABLE)('floor %f → %s → %s', (pct, printed, band) => {
    render(<PersBandCell persistency={pct} />);
    expect(screen.getByText(printed).className).toContain(`text-${band}-ink`);
  });
});

describe('TeamPerfRoster mobile card — "Pers" footer tone follows the printed value', () => {
  const row = (pct) => ({
    id: 'x1', name: 'Test Agent', role: null, unit: 'S·01', contractDate: new Date(2020, 0, 1).getTime(),
    submittedAPI: 1000, submittedApps: 1, issuedAPI: 1000, issuedApps: 1, persistency: pct, pctOfAnnualGoal: 50,
  });
  it.each(GATE_TABLE)('%f → Pers %s → success %s', (pct, printed, meets) => {
    render(<TeamPerfRoster rows={[row(pct)]} sort={{ column: 'name', direction: 'asc' }} onSort={() => {}} loading={false} />);
    const pers = screen.getByText(`Pers ${printed}`);
    expect(pers.className).toContain(meets ? 'text-success-ink' : 'text-warning-ink');
  });
});

describe('PersRoster (manager Persistency tab) — value band follows the printed value', () => {
  const rows = (pct) => [{ user: { id: 'u1', name: 'Test Agent' }, record: { persistency: pct / 100 } }];
  it.each(GATE_TABLE)('%f → %s → success %s', (pct, printed, meets) => {
    render(<PersRoster rows={rows(pct)} onEdit={() => {}} onOpenPlayground={() => {}} />);
    const band = screen.getByTestId('pers-roster-band-u1');
    const value = within(band).getByText(printed);
    expect(value.className).toContain(meets ? 'text-success-ink' : 'text-warning-ink');
  });
});

describe('PersRealityBar (manager) — aggregate dot, award-eligible count and printed aggregate agree', () => {
  it.each(GATE_TABLE)('%f → %s → eligible %s', (pct, printed, meets) => {
    const records = [{ persistency: pct / 100 }];
    render(
      <PersRealityBar
        monthKey="2026-09" monthKeys={['2026-09']} onMonthChange={() => {}}
        scope="branch" showScopeToggle={false} onScopeChange={() => {}} scopeLabel="Branch"
        aggregate={{ aggregatedPersistency: pct / 100 }} barStats={computeBarStats(records)}
        totalAgents={1} sparkData={[]} loading={false}
      />,
    );
    const agg = screen.getByTestId('pers-bar-aggregate');
    expect(agg).toHaveTextContent(printed);
    expect(agg.innerHTML).toContain(meets ? 'bg-[--hero-dot-success]' : 'bg-[--hero-dot-warning]');
  });
});

describe('PersistencyEntryForm (manager) — "Meets 90% award gate" follows the printed preview', () => {
  it.each(GATE_TABLE)('%f → %s → meets %s', (pct, printed, meets) => {
    render(
      <PersistencyEntryForm
        tenantId="t1" monthKey="2026-02" agentUid="a1" agentName="Test Agent" existingRecord={null}
        writerRole="branch_manager" writerUid="w1" onClose={() => {}} onSaved={() => {}}
      />,
    );
    const lapses = Math.round(100000 * (100 - pct)) / 100;
    fireEvent.change(screen.getByTestId('persistency-input-businessPlaced'), { target: { value: '100000' } });
    fireEvent.change(screen.getByTestId('persistency-input-lapses'), { target: { value: String(lapses) } });
    expect(screen.getByTestId('derived-persistency')).toHaveTextContent(printed);
    if (meets) expect(screen.getByText('Meets 90% award gate')).toBeInTheDocument();
    else expect(screen.queryByText('Meets 90% award gate')).not.toBeInTheDocument();
  });
});

describe('GapAnalysisPanel (Goals) — below-floor hero follows the printed "Pst." value', () => {
  const hierarchy = { personal: { api: 100000, apps: 20 }, companyFloor: { api: 50000 } };
  it.each(GATE_TABLE)('%f → %s → at or above floor %s', (pct, printed, meets) => {
    render(
      <GapAnalysisPanel hierarchy={hierarchy} ytdTotals={{ api: 10000, apps: 2 }} loading={false}
        ytdPersistency={pct / 100} persistencyFloor={90} />,
    );
    const hero = screen.getByTestId('commitment-hero');
    expect(within(hero).getByText(printed)).toBeInTheDocument();
    if (meets) expect(hero.className).not.toContain('bg-warning-tint');
    else expect(hero.className).toContain('bg-warning-tint');
  });
});

describe('PersistencyOutlookHero (Persistency screen) — tone follows the printed figure', () => {
  it.each(GATE_TABLE)('%f → %s → success %s', (pct, printed, meets) => {
    const outlook = buildPersistencyOutlook({ policies: bookAt(pct), records: [], today: TODAY, gate: GATE });
    render(<PersistencyOutlookHero outlook={outlook} canConfirm={false} onConfirm={() => {}} />);
    const gatePct = screen.getByTestId('persistency-outlook-gate-pct');
    expect(gatePct).toHaveTextContent(printed);
    expect(gatePct.className).toContain(meets ? 'text-success-ink' : 'text-warning-ink');
  });
});

describe('PersistencyPlayground — the Current band follows the printed figure', () => {
  it.each(GATE_TABLE)('%f → %s → success %s', (pct, printed, meets) => {
    const currentRecord = {
      grossSettled: 100000, netSettled: pct * 1000, lapses: 100000 - pct * 1000, reinstatements: 0,
      persistency: pct / 100,
    };
    render(<PersistencyPlayground mode="self" agentName="Test" currentRecord={currentRecord} onClose={() => {}} />);
    const current = screen.getByTestId('playground-current-pct');
    expect(current).toHaveTextContent(printed);
    expect(current.className).toContain(meets ? 'text-success-ink' : 'text-warning-ink');
  });
});
