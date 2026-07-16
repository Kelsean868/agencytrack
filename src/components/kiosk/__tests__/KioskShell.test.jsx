import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import KioskShell from '../KioskShell';
import {
  getKioskYTDSubmissions,
  getKioskTenantUsers,
  getKioskAgentOfMonth,
  getKioskCampaigns,
  getKioskDisabledPanels,
} from '../../../lib/kiosk/kioskServices';
import { deriveKioskCelebrations } from '../../../lib/kiosk/kioskCelebrations';
import { POLL_INTERVAL_MS } from '../../../lib/kiosk/kioskConfig';

// Mock all panel components to simple identifiable divs
vi.mock('../panels/WelcomePanel',            () => ({ default: () => <div data-panel="welcome" /> }));
vi.mock('../panels/AgentOfMonthPanel',       () => ({ default: () => <div data-panel="agentOfMonth" /> }));
vi.mock('../panels/BranchOverviewPanel',     () => ({ default: () => <div data-panel="branchOverview" /> }));
vi.mock('../panels/RunningTotalsPanel',      () => ({ default: () => <div data-panel="branchRunningTotals" /> }));
vi.mock('../panels/UnitLeaderboardPanel',    () => ({ default: () => <div data-panel="unitLeaderboard" /> }));
vi.mock('../panels/LastWeekRecapPanel',      () => ({ default: () => <div data-panel="lastWeekRecap" /> }));
vi.mock('../panels/YTDLeaderboardsPanel',    () => ({ default: () => <div data-panel="ytdLeaderboards" /> }));
vi.mock('../panels/QTDLeaderboardsPanel',    () => ({ default: () => <div data-panel="qtdLeaderboards" /> }));
vi.mock('../panels/MTDLeaderboardsPanel',    () => ({ default: () => <div data-panel="mtdLeaderboards" /> }));
vi.mock('../panels/WeekLeaderboardsPanel',   () => ({ default: () => <div data-panel="weekLeaderboards" /> }));
vi.mock('../panels/WeeklyActivityPanel',     () => ({ default: () => <div data-panel="weeklyActivity" /> }));
vi.mock('../panels/AwardsWatchPanel',        () => ({ default: () => <div data-panel="awardsWatch" /> }));
vi.mock('../panels/CompliancePanel',         () => ({ default: () => <div data-panel="compliance" /> }));
vi.mock('../panels/CampaignLeaderboardPanel', () => ({ default: ({ campaign }) => <div data-panel="campaignLeaderboards" data-campaign={campaign?.id ?? ''} /> }));
vi.mock('../panels/CelebrationsPanel',       () => ({ default: () => <div data-panel="celebrations" /> }));
vi.mock('../FullscreenButton',               () => ({ default: () => <button data-testid="fullscreen-btn" /> }));

vi.mock('../../../lib/kiosk/kioskServices', () => ({
  getKioskYTDSubmissions: vi.fn(),
  getKioskTenantUsers: vi.fn(),
  getKioskAgentOfMonth: vi.fn(),
  getKioskCampaigns: vi.fn(),
  getKioskDisabledPanels: vi.fn(),
}));

vi.mock('../../../lib/kiosk/kioskCelebrations', () => ({
  deriveKioskCelebrations: vi.fn(() => []),
}));

const THIS_YEAR = new Date().getFullYear();
const SUBS = [
  { id: 's1', agentId: 'a1', weekStarting: `${THIS_YEAR}-01-07`, status: 'submitted', newBusiness: { api: 90000, apps: 5 }, version: 2 },
];
const USERS = [{ id: 'a1', role: 'agent', name: 'Alice' }];
const AOM = { api: { agentUid: 'a1', agentName: 'Alice', achievementValue: 90000 } };

function setData({ subs = [], users = [], aom = null, campaigns = [], celebrations = [], disabledPanels = [] } = {}) {
  getKioskYTDSubmissions.mockResolvedValue(subs);
  getKioskTenantUsers.mockResolvedValue(users);
  getKioskAgentOfMonth.mockResolvedValue(aom);
  getKioskCampaigns.mockResolvedValue(campaigns);
  getKioskDisabledPanels.mockResolvedValue(disabledPanels);
  deriveKioskCelebrations.mockReturnValue(celebrations);
}

async function mountShell() {
  await act(async () => {
    render(<KioskShell tenantId="t1" branchId="b1" />);
    await vi.runOnlyPendingTimersAsync();
  });
}

// Advance one rotation step (60s exceeds the max panel duration of 45s so
// exactly one panel-advance fires per pulse), collecting the visible panel.
async function collectRotation(steps) {
  const seen = [];
  for (let i = 0; i < steps; i += 1) {
    const el = document.querySelector('[data-panel]');
    seen.push(el?.getAttribute('data-panel'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  }
  return seen;
}

describe('KioskShell — dynamic rotation (3.6)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('renders the theatrical stage + overlay chrome', async () => {
    setData({ subs: SUBS, users: USERS, aom: AOM });
    await mountShell();
    expect(document.querySelector('[data-kiosk="true"].kiosk-stage')).not.toBeNull();
    expect(document.querySelector('.kiosk-backdrop')).not.toBeNull();
    expect(screen.getByTestId('kiosk-chapter-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('kiosk-progress-dots')).toBeInTheDocument();
    expect(screen.getByTestId('fullscreen-btn')).toBeInTheDocument();
  });

  it('with full data (no campaigns/celebrations) rotates through the 13 base panels', async () => {
    setData({ subs: SUBS, users: USERS, aom: AOM });
    await mountShell();
    const seen = new Set(await collectRotation(16));
    expect(seen).toContain('welcome');
    expect(seen).toContain('agentOfMonth');
    expect(seen).toContain('ytdLeaderboards');
    expect(seen).toContain('compliance');
    expect(seen).not.toContain('campaignLeaderboards');
    expect(seen).not.toContain('celebrations');
  });

  it('empty data collapses the rotation to the welcome slide (empty-skip)', async () => {
    setData({ subs: [], users: [], aom: null });
    await mountShell();
    const seen = await collectRotation(5);
    // No submissions + no AOM winner → every data panel dropped; only welcome.
    expect(new Set(seen)).toEqual(new Set(['welcome']));
  });

  it('inserts a campaign panel per flagged campaign when data is present', async () => {
    setData({
      subs: SUBS,
      users: USERS,
      aom: AOM,
      campaigns: [{ id: 'c1', name: 'Xmas', status: 'active', kiosk: true, scope: { type: 'branch' } }],
    });
    await mountShell();
    const seen = new Set(await collectRotation(18));
    expect(seen).toContain('campaignLeaderboards');
  });

  it('inserts the celebrations panel when there are celebrations', async () => {
    setData({
      subs: SUBS,
      users: USERS,
      aom: AOM,
      celebrations: [{ id: 'a1', name: 'Alice', years: 5, dateLabel: '01-08', initials: 'A' }],
    });
    await mountShell();
    const seen = new Set(await collectRotation(18));
    expect(seen).toContain('celebrations');
  });

  // Tier-3 #15: manager per-branch panel enable/disable.
  it('honors kioskConfig.disabledPanels — disabled base panels are excluded from the rotation', async () => {
    setData({
      subs: SUBS,
      users: USERS,
      aom: AOM,
      disabledPanels: ['agentOfMonth', 'compliance'],
    });
    await mountShell();
    const seen = new Set(await collectRotation(16));
    expect(seen).not.toContain('agentOfMonth');
    expect(seen).not.toContain('compliance');
    // Non-disabled panels still rotate.
    expect(seen).toContain('ytdLeaderboards');
    expect(seen).toContain('welcome');
  });

  it('degrades to all-enabled when the disabledPanels read fails (fail-open)', async () => {
    setData({ subs: SUBS, users: USERS, aom: AOM });
    getKioskDisabledPanels.mockRejectedValueOnce(new Error('permission-denied'));
    await mountShell();
    const seen = new Set(await collectRotation(16));
    // A denied config read must NOT blank the wall — full rotation persists.
    expect(seen).toContain('agentOfMonth');
    expect(seen).toContain('compliance');
    expect(seen).toContain('welcome');
  });
});

describe('KioskShell — initial-load reconnecting indicator (A3)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('initial fetch failure (no last-good data yet) shows the quiet reconnecting indicator, not a panel', async () => {
    getKioskYTDSubmissions.mockRejectedValueOnce(new Error('network down'));
    getKioskTenantUsers.mockResolvedValue([]);
    getKioskAgentOfMonth.mockResolvedValue(null);
    getKioskCampaigns.mockResolvedValue([]);
    getKioskDisabledPanels.mockResolvedValue([]);
    deriveKioskCelebrations.mockReturnValue([]);

    await mountShell();

    expect(screen.getByTestId('kiosk-reconnecting')).toBeInTheDocument();
    expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();
    // Not a full error card, not any content panel, and no Retry control.
    expect(document.querySelector('[data-panel]')).toBeNull();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('a subsequent successful poll clears the indicator and renders content (retry loop honored)', async () => {
    getKioskYTDSubmissions.mockRejectedValueOnce(new Error('network down'));
    getKioskTenantUsers.mockResolvedValue([]);
    getKioskAgentOfMonth.mockResolvedValue(null);
    getKioskCampaigns.mockResolvedValue([]);
    getKioskDisabledPanels.mockResolvedValue([]);
    deriveKioskCelebrations.mockReturnValue([]);

    await mountShell();
    expect(screen.getByTestId('kiosk-reconnecting')).toBeInTheDocument();

    // Same 5-minute poll cadence retries the initial-load failure — next
    // poll succeeds with real data.
    setData({ subs: SUBS, users: USERS, aom: AOM });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(screen.queryByTestId('kiosk-reconnecting')).toBeNull();
    expect(document.querySelector('[data-panel]')).not.toBeNull();
    expect(getKioskYTDSubmissions).toHaveBeenCalledTimes(2);
  });

  it('a refresh failure after success stays silent — no indicator, last-good content persists', async () => {
    setData({ subs: SUBS, users: USERS, aom: AOM });
    await mountShell();
    expect(screen.queryByTestId('kiosk-reconnecting')).toBeNull();
    expect(document.querySelector('[data-panel]')).not.toBeNull();

    // Next poll fails outright — this is a REFRESH failure (last-good data
    // already on screen), which must stay completely silent.
    getKioskYTDSubmissions.mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(screen.queryByTestId('kiosk-reconnecting')).toBeNull();
    expect(document.querySelector('[data-panel]')).not.toBeNull();
  });
});
