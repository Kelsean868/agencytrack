/**
 * FrToday (container) — renders with the HomeV2 prop set, passes the ledger's
 * figures through the model to the view, and maps view actions onto the same
 * handlers HomeV2 uses. Heavy / Firebase-reading children are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

vi.mock('../../../gamification/MyPointsCard', () => ({
  default: () => React.createElement('div', { 'data-testid': 'my-points-mock' }),
}));
vi.mock('../../../campaigns/CampaignHeroCard', () => ({
  default: ({ campaign, loading }) => React.createElement('div', {
    'data-testid': 'campaign-card-mock', 'data-campaign': campaign?.id ?? '', 'data-loading': String(Boolean(loading)),
  }),
}));
vi.mock('../../../dashboard/HomeV2/FilingStreakCelebration', () => ({
  default: () => React.createElement('div', { 'data-testid': 'filing-streak-mock' }),
}));
vi.mock('../../../dashboard/HomeV2/StandardDetail', () => ({
  default: ({ onClose }) => React.createElement('button', { type: 'button', 'data-testid': 'standard-detail-mock', onClick: onClose }, 'drawer'),
}));

import FrToday from '../FrToday';
import { deriveYearProduction } from '../../../../lib/ledgerProduction';
import { buildPersistencyOutlook, formatOutlookPct } from '../../../../lib/persistency/persistencyOutlook';
import { formatPersistencyPct } from '../../../../lib/persistency/persistencyRounding';
import { PersistencyGateBarBlock } from '../../../campaigns/CampaignScreenBlocks';

const imported = (over) => ({ importSource: 'oipa_import', newBusinessType: 'nb_ordinary', productLine: 'life', settledAPI: null, ...over });
const POLICIES_ALL = [
  imported({ id: 'p1', status: 'settled', dateIssued: '2026-02-10', proposedAPI: 6000 }),
  imported({ id: 'p2', status: 'settled', dateIssued: '2026-09-03', proposedAPI: 30000, statusSource: 'oipa_import' }),
  imported({ id: 'p3', status: 'settled', dateIssued: '2019-08-15', proposedAPI: 55555 }),
  imported({ id: 'p4', status: 'submitted', dateSubmitted: '2026-09-20', proposedAPI: 36000 }),
];

// A book whose persistency is known to the outlook: the Kyron-shaped fixture
// persistencyOutlook.test.js pins (export 15 Sep 2026 → Aug derived 89.6 %,
// Sep estimate 86.6 % at one decimal; 86.63 % at the ruled two). Synthetic, no client data. Issue dates are 2024–25,
// so the 2026 production figures are untouched by it.
const EXPORT = '2026-09-15';
const oipa = (policyNumber, dateIssued, status, api) => ({
  policyNumber, dateIssued, status, proposedAPI: api, isWritingAgent: true, importSource: 'oipa', exportDate: EXPORT,
});
const PERSISTENCY_BOOK = [
  oipa('P-A1', '2024-09-10', 'settled', 82800.00),
  oipa('P-A2', '2024-09-12', 'lapsed', 2682.00),
  oipa('P-B1', '2024-11-10', 'settled', 21197.16),
  oipa('P-B2', '2024-11-12', 'lapsed', 1182.36),
  oipa('P-C1', '2025-06-10', 'settled', 161581.20),
  oipa('P-C2', '2025-06-12', 'lapsed', 27014.52),
];
// The newest SAVED record: July 2026 on the 12-month model, 56.5 % — what
// Today wrongly showed on production before this fix.
const JULY_RECORD = [{ monthKey: '2026-07', year: 2026, month: 7, persistency: 0.565, grossSettled: 100000 }];

function props(over = {}) {
  return {
    ledgerProduction: deriveYearProduction(POLICIES_ALL, { year: 2026, weekStarting: '2026-09-27', submissions: [] }),
    ledgerPending: false,
    ledgerError: false,
    onRetryLedger: vi.fn(),
    onOpenLedgerCreate: vi.fn(),
    personalGoalAPI: null,
    allSubmissions: [{ id: 's1', status: 'submitted', weekStarting: '2026-09-20' }],
    resolvedMinimums: null,
    currentWeekSub: null,
    persistency: [{ monthKey: '2026-08', persistency: 0.866, grossSettled: 100 }],
    activityEvents: [],
    activeCampaigns: [],
    campaignsLoading: false,
    campaignPolicies: POLICIES_ALL,
    agentUid: 'agent1',
    agentProfile: { name: 'Kyron Marchan' },
    policies: [],
    committedPlan: null,
    weekDailyDocs: [],
    weekStart: '2026-09-27',
    showDailyCTA: true,
    todayDailyChecked: true,
    todayDailyEntry: null,
    submissionsError: null,
    onSubmit: vi.fn(),
    onLogToday: vi.fn(),
    onOpenTab: vi.fn(),
    onOpenLedgerFilter: vi.fn(),
    ...over,
  };
}

/** Stub matchMedia so useMinWidth(768) reads `width` (jsdom has no matchMedia). */
function setViewportWidth(width) {
  window.matchMedia = vi.fn((q) => ({
    media: q,
    matches: width >= Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-27T13:00:00Z')); // 09:00 in Trinidad
  setViewportWidth(1440);
});
afterEach(() => {
  vi.useRealTimers();
  delete window.matchMedia;
});

const desktop = () => screen.getByTestId('fr-today-desktop');

describe('FrToday container', () => {
  it('renders the view with the ledger figures (settled excludes other years)', () => {
    render(<FrToday {...props()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Morning, Kyron' })).toBeInTheDocument();
    expect(within(desktop()).getByTestId('today-tile-settled-value')).toHaveTextContent('TTD 36,000');
    expect(within(desktop()).getByTestId('today-tile-waiting-value')).toHaveTextContent('TTD 36,000');
    // This book has nothing the outlook can count → no persistency figure at all.
    expect(within(desktop()).queryByTestId('today-tile-persistency')).toBeNull();
    // Monthly split from the unfiltered list, same credit list as the hero.
    expect(within(desktop()).getByRole('heading', { name: 'September is your best month so far' })).toBeInTheDocument();
  });

  it('keeps the existing Home pieces mounted: nudge, points, recent, streak celebration', () => {
    render(<FrToday {...props()} />);
    expect(screen.getByText("You haven't logged today yet")).toBeInTheDocument();
    expect(within(desktop()).getByTestId('my-points-mock')).toBeInTheDocument();
    expect(within(desktop()).getByRole('heading', { name: 'Recent' })).toBeInTheDocument();
    expect(screen.getAllByTestId('filing-streak-mock')).toHaveLength(1);
    expect(within(desktop()).getByTestId('ledger-reconciliation')).toBeInTheDocument();
  });

  it('campaign slot uses the same filter as HomeV2 (tiered + qualify only)', () => {
    const activeCampaigns = [
      { id: 'xmas', structure: 'qualify', tiers: [{ name: 'Champion', apiTarget: 1, appsTarget: 1 }] },
      { id: 'flat', structure: 'flat' },
    ];
    render(<FrToday {...props({ activeCampaigns })} />);
    const cards = within(desktop()).queryAllByTestId('campaign-card-mock');
    expect(cards.map((c) => c.getAttribute('data-campaign'))).toEqual(['xmas']);
  });

  it('maps view actions onto the HomeV2 handlers', () => {
    const p = props({ campaignPolicies: PERSISTENCY_BOOK, persistency: JULY_RECORD });
    render(<FrToday {...p} />);
    fireEvent.click(within(desktop()).getByTestId('today-waiting-submit'));
    expect(p.onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(within(desktop()).getByRole('button', { name: /Log a policy/ }));
    expect(p.onOpenLedgerCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(within(desktop()).getByRole('button', { name: 'See persistency' }));
    expect(p.onOpenTab).toHaveBeenCalledWith('persistency');
    fireEvent.click(within(desktop()).getByRole('button', { name: 'Open game plan' }));
    expect(p.onOpenTab).toHaveBeenCalledWith('game-plan');
    fireEvent.click(within(desktop()).getByTestId('today-tile-goal'));
    expect(p.onOpenTab).toHaveBeenCalledWith('goals');
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: /Log today/ }));
    expect(p.onLogToday).toHaveBeenCalledTimes(1);
  });

  it('Details opens the StandardDetail drawer, which closes again', () => {
    render(<FrToday {...props()} />);
    expect(screen.queryByTestId('standard-detail-mock')).toBeNull();
    fireEvent.click(within(desktop()).getByRole('button', { name: 'Details' }));
    fireEvent.click(screen.getByTestId('standard-detail-mock'));
    expect(screen.queryByTestId('standard-detail-mock')).toBeNull();
  });

  it('ledger loading → no figures, never a TTD 0', () => {
    render(<FrToday {...props({ ledgerProduction: null, ledgerPending: true, campaignPolicies: null, persistency: JULY_RECORD })} />);
    expect(within(desktop()).getByTestId('today-hero-loading')).toBeInTheDocument();
    expect(desktop().textContent).not.toMatch(/TTD 0\b/);
    // Persistency waits for the ledger too — a skeleton, not the saved July record.
    expect(within(desktop()).getByTestId('today-tile-persistency')).toBeInTheDocument();
    expect(within(desktop()).getByTestId('today-tile-persistency-loading')).toBeInTheDocument();
    expect(within(desktop()).queryByTestId('today-tile-persistency-value')).toBeNull();
    expect(desktop().textContent).not.toMatch(/56\.5/);
  });

  it('ledger error → no persistency tile and no persistency coach line', () => {
    render(<FrToday {...props({ ledgerProduction: null, ledgerError: true, campaignPolicies: null, persistency: JULY_RECORD })} />);
    expect(within(desktop()).queryByTestId('today-tile-persistency')).toBeNull();
    expect(within(desktop()).queryByRole('button', { name: 'See persistency' })).toBeNull();
  });

  it('ledger error → Retry calls onRetryLedger', () => {
    const p = props({ ledgerProduction: null, ledgerError: true, campaignPolicies: null });
    render(<FrToday {...p} />);
    fireEvent.click(within(within(desktop()).getByTestId('today-hero-error')).getByRole('button', { name: 'Retry' }));
    expect(p.onRetryLedger).toHaveBeenCalledTimes(1);
  });

  it('below 768px: the phone swipe pages only, and each slot mounts once', () => {
    setViewportWidth(390);
    render(<FrToday {...props()} />);
    expect(screen.queryByTestId('fr-today-desktop')).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Today pages' })).toBeInTheDocument();
    expect(screen.getAllByTestId('my-points-mock')).toHaveLength(1);
    expect(screen.getAllByTestId('filing-streak-mock')).toHaveLength(1);
  });

  it('wide: each slot mounts once (no duplicate listeners or ids)', () => {
    render(<FrToday {...props()} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getAllByTestId('my-points-mock')).toHaveLength(1);
    expect(document.querySelectorAll('#recent-compact-heading')).toHaveLength(1);
  });

  it('persistency: this month\'s estimate (Sep 86.63 %), not the newest saved record (Jul 56.5 %)', () => {
    render(<FrToday {...props({ campaignPolicies: PERSISTENCY_BOOK, persistency: JULY_RECORD })} />);
    const t = within(desktop()).getByTestId('today-tile-persistency');
    expect(within(t).getByTestId('today-tile-persistency-value')).toHaveTextContent('86.63%');
    expect(t).toHaveTextContent('Sep 2026 estimate · below the 90% gate');
    expect(within(desktop()).getByText('Persistency 86.63% (Sep 2026 estimate) — below the 90% gate')).toBeInTheDocument();
    expect(desktop().textContent).not.toMatch(/56\.5/);
  });

  // Parity of SOURCE: Today and the Persistency screen's estimate column read
  // the same outlook value for the same month. Their precision differs until
  // the screen adopts the 2-dp rule too (Kyron ruling 28-09-2026; FOLLOW_UPS
  // § One rounding rule for every agent-facing persistency figure).
  it('parity: the Today tile and the Persistency screen\'s estimate column read the same outlook value', () => {
    render(<FrToday {...props({ campaignPolicies: PERSISTENCY_BOOK, persistency: JULY_RECORD })} />);
    // The tile's final value (the visible digits count up; the sr-only text is the settled figure).
    const today = within(desktop()).getByTestId('today-tile-persistency-value').querySelector('.sr-only').textContent;
    // The same real outlook the Persistency/Campaign screen builds for these inputs.
    const outlook = buildPersistencyOutlook({ policies: PERSISTENCY_BOOK, records: JULY_RECORD, today: '2026-09-27' });
    render(<PersistencyGateBarBlock projectedPct={null} threshold={90} judgedLabel={null} outlook={outlook} />);
    const col = screen.getByTestId('campaign-screen-gate-month-estimate');
    const source = outlook.estimateToday;
    expect(source.monthKey).toBe('2026-09');
    expect(col).toHaveTextContent('Sep');
    expect(col).toHaveTextContent(formatOutlookPct(source.persistency)); // 86.6% (1 dp, until the FU)
    expect(today).toBe(formatPersistencyPct(source.persistency * 100));  // same value, 2 dp
    expect(today).toBe('86.63%');
  });

  it('a submissions error shows the same alert copy as HomeV2', () => {
    render(<FrToday {...props({ submissionsError: 'permission-denied' })} />);
    expect(screen.getByText(/permission denied/)).toBeInTheDocument();
  });
});
