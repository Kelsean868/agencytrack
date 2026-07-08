// @vitest-environment jsdom
//
// Track J P7 component tests — PRIMARY verification.
//
// The live smoke can only reach the test agent (rank 1 in the seeded data),
// so a smoke that confirms "pill renders '1'" is consistent with either
// (a) the fix working AND the agent happening to be rank 1, or (b) the OLD
// always-#1 bug. These component tests force the viewer to rank 14 (and 1)
// via a mock aggregate — proving the pill reflects the AGGREGATE, not a
// hardcoded or self-only ranking.
//
// We mock the whole hook layer to control the aggregate without touching
// Firebase. The unit-level math (computeAroundMe + useLeaderboard read path)
// is covered by its own unit tests; here we test the WIRING — that the
// pill, the panel, and the period-mapping all read from the aggregate.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ── Hoisted mocks (declared before any import of AgentProductionView) ────────

const hoisted = vi.hoisted(() => ({
  useAuth:           vi.fn(),
  useLeaderboard:    vi.fn(),
  getAgentSubmissions: vi.fn(),
  getTenantUsers:    vi.fn(),
  getAgentHistory:   vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));
vi.mock('../../../hooks/useLeaderboard', () => ({
  default: hoisted.useLeaderboard,
}));
vi.mock('../../../services/submissionService', () => ({
  getAgentSubmissions: hoisted.getAgentSubmissions,
}));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers: hoisted.getTenantUsers,
}));
vi.mock('../../../services/persistencyService', () => ({
  getAgentHistory: hoisted.getAgentHistory,
}));

// Load AFTER mocks
import AgentProductionView from '../AgentProductionView';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function mkEntry(rank, agentId, periodApi, name = `Agent ${agentId}`) {
  return {
    agentId, name,
    unitName: 'S·02',
    rank, periodApi,
    apps: rank,
    rankWithinUnit: 1,
  };
}

// 28-agent branch aggregate (matches the structure of the live P1b doc)
const RANKING_28 = Array.from({ length: 28 }, (_, i) =>
  mkEntry(i + 1, `a${i + 1}`, 500_000 - i * 15_000)
);

// Helper: build a mock `byPeriod` where the viewer-agentId is at the
// specified rank in YTD. Other periods share the same ordering so chip-switch
// flows work too.
function mockByPeriodWithViewerAt(viewerAgentId, rank, total = 28) {
  // Patch RANKING_28 with the viewer's agentId at the target rank.
  const ranking = Array.from({ length: total }, (_, i) => ({
    ...RANKING_28[i % RANKING_28.length],
    rank: i + 1,
    agentId: i === rank - 1 ? viewerAgentId : `a${i + 1}`,
    name:    i === rank - 1 ? 'Priya Gopaul' : `Agent ${i + 1}`,
  }));
  return { week: ranking, mtd: ranking, qtd: ranking, ytd: ranking };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({
    user:        { uid: 'me-viewer-uid' },
    userProfile: { name: 'Priya Gopaul', unitId: null, branchId: 'tatil_south' },
    tenantId:    'tatillife_south',
  });
  // Default: empty aggregate (overridden per-test).
  hoisted.useLeaderboard.mockReturnValue({
    loading: false, error: null, doc: null,
    byPeriod: { week: [], mtd: [], qtd: [], ytd: [] },
    branchId: 'tatil_south',
  });
  // AgentProductionView also calls these — return empty.
  hoisted.getAgentSubmissions.mockResolvedValue([]);
  hoisted.getTenantUsers.mockResolvedValue([]);
  hoisted.getAgentHistory.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PROOF — pill reflects the aggregate, not a hardcoded/self-only 1.
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentProductionView — rank pill reflects the aggregate', () => {
  it('VIEWER AT RANK 14 → pill renders "14" of "28" (proves always-#1 bug is gone)', async () => {
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: mockByPeriodWithViewerAt('me-viewer-uid', 14, 28),
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    // The hero pill carries data-rank for assertion-stability.
    const pill = await screen.findByTestId('agent-production-rank-pill');
    expect(pill.getAttribute('data-rank')).toBe('14');     // ← THE PROOF
    expect(pill.getAttribute('data-total')).toBe('28');
    expect(pill.textContent).toContain('14');              // visual rank
    expect(pill.textContent).toContain('/ 28');            // visual total
    expect(pill.textContent).toContain('Branch rank');     // eyebrow label
  });

  it('VIEWER AT RANK 1 → pill renders "1" of "M" (the test agent\'s real live case)', async () => {
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: mockByPeriodWithViewerAt('me-viewer-uid', 1, 6),
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    const pill = await screen.findByTestId('agent-production-rank-pill');
    expect(pill.getAttribute('data-rank')).toBe('1');
    expect(pill.getAttribute('data-total')).toBe('6');
    expect(pill.textContent).toContain('1');
    expect(pill.textContent).toContain('/ 6');
  });

  it('VIEWER NOT IN AGGREGATE (unranked) → pill renders "—" of "—"', async () => {
    // Aggregate has 5 other agents, viewer not among them
    const ranking = Array.from({ length: 5 }, (_, i) =>
      mkEntry(i + 1, `other-${i}`, 100000 - i * 10000)
    );
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: { week: ranking, mtd: ranking, qtd: ranking, ytd: ranking },
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    const pill = await screen.findByTestId('agent-production-rank-pill');
    expect(pill.getAttribute('data-rank')).toBe('unranked');
    expect(pill.getAttribute('data-total')).toBe('5');
    expect(pill.textContent).toContain('—');
  });

  it('AGGREGATE EMPTY (no doc yet) → pill renders "—" of "—"', async () => {
    hoisted.useLeaderboard.mockReturnValue({
      loading: true, error: null, doc: null,
      byPeriod: { week: [], mtd: [], qtd: [], ytd: [] },
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    const pill = await screen.findByTestId('agent-production-rank-pill');
    expect(pill.getAttribute('data-rank')).toBe('unranked');
    expect(pill.getAttribute('data-total')).toBe('0'); // React serializes the 0 → "0"
    // Visual fallback: total renders as "—" in the text via `branchTotal || '—'`
    expect(pill.textContent).toContain('—');
    expect(pill.textContent).toMatch(/—\s*\/\s*—/); // "— / —"
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Period mapping — viewer's rank reflects the active period
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentProductionView — period mapping (quarter → qtd)', () => {
  it('the active period chip drives which aggregate field the rank reads from', async () => {
    // Set up an aggregate where the viewer's rank DIFFERS per period.
    // - week: viewer at rank 14
    // - mtd:  viewer at rank 5
    // - qtd:  viewer at rank 9
    // - ytd:  viewer at rank 3
    const mk = (vRank, total = 28) => Array.from({ length: total }, (_, i) => ({
      ...RANKING_28[i % RANKING_28.length],
      rank: i + 1,
      agentId: i === vRank - 1 ? 'me-viewer-uid' : `a${i + 1}`,
      name:    i === vRank - 1 ? 'Priya Gopaul' : `Agent ${i + 1}`,
    }));
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: {
        week: mk(14),
        mtd:  mk(5),
        qtd:  mk(9),
        ytd:  mk(3),
      },
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    // Default period is 'week' per AgentProductionView's initial state.
    // Use role="tab" + name to disambiguate the chip from same-text labels
    // in the 4-window grid (which also shows "Week"/"Quarter"/etc).
    const pill = await screen.findByTestId('agent-production-rank-pill');
    await waitFor(() => expect(pill.getAttribute('data-rank')).toBe('14'));

    fireEvent.click(screen.getByRole('tab', { name: 'MTD' }));
    await waitFor(() => expect(pill.getAttribute('data-rank')).toBe('5'));

    // The critical case: chip says "Quarter" but maps to the aggregate's "qtd"
    fireEvent.click(screen.getByRole('tab', { name: 'Quarter' }));
    await waitFor(() => expect(pill.getAttribute('data-rank')).toBe('9'));

    fireEvent.click(screen.getByRole('tab', { name: 'YTD' }));
    await waitFor(() => expect(pill.getAttribute('data-rank')).toBe('3'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Where-you-rank panel — restored from PR 397, reads aggregate
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentProductionView — where-you-rank panel', () => {
  it('renders the panel with viewer + neighbors from the mock aggregate (rank 14)', async () => {
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: mockByPeriodWithViewerAt('me-viewer-uid', 14, 28),
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    const panel = await screen.findByTestId('where-you-rank-panel');
    expect(within(panel).getByText(/Where you rank/i)).toBeInTheDocument();

    // Viewer's row is rank 14; neighbors are rank 13 (chase) + rank 15 (defend)
    expect(within(panel).getByTestId('where-you-rank-row-rank-13')).toBeInTheDocument();
    expect(within(panel).getByTestId('where-you-rank-row-rank-14')).toBeInTheDocument();
    expect(within(panel).getByTestId('where-you-rank-row-rank-15')).toBeInTheDocument();

    // Viewer row carries data-viewer and has the YOU coin
    const viewerRow = within(panel).getByTestId('where-you-rank-row-rank-14');
    expect(viewerRow.getAttribute('data-viewer')).toBe('true');
    expect(viewerRow.textContent).toContain('YOU');
    expect(viewerRow.textContent).toContain('You · Priya');

    // Footer caption: ordinal + branch + period + gap-behind-next
    expect(panel.textContent).toMatch(/14th of 28/);
    expect(panel.textContent).toMatch(/this week/);
  });

  it('FIRST-PLACE BOUNDARY: viewer at rank 1 → exactly [You(1), next(2)], no phantom prev, no "behind" footer', async () => {
    // This is the LIVE path on prod (test agent IS rank 1 in the 6-agent
    // branch). aroundMeLogic has no dedicated FIRST_PLACE state — it falls
    // through to the cluster branch with prev=null. We verify the resolver
    // produces exactly 2 rows in the correct order (viewer first, next
    // second), the viewer marker is on rank 1, and the "behind the next
    // spot" footer suffix is absent (because gapToNext/prevRank are null).
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: mockByPeriodWithViewerAt('me-viewer-uid', 1, 6),
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    const panel = await screen.findByTestId('where-you-rank-panel');

    // (a) No phantom predecessor (rank 0 or any other) — rank-1 has none.
    expect(within(panel).queryByTestId('where-you-rank-row-rank-0')).not.toBeInTheDocument();

    // (b) Exactly TWO rendered rank rows — viewer (1) + successor (2).
    //     No off-by-one slipping in a third row, no missing successor.
    const rankRows = within(panel).getAllByTestId(/^where-you-rank-row-rank-\d+$/);
    expect(rankRows).toHaveLength(2);

    // (c) Order: viewer row is FIRST (rank 1), successor row is SECOND (rank 2).
    expect(rankRows[0].getAttribute('data-testid')).toBe('where-you-rank-row-rank-1');
    expect(rankRows[1].getAttribute('data-testid')).toBe('where-you-rank-row-rank-2');

    // (d) Viewer marker is on rank 1, NOT rank 2.
    expect(rankRows[0].getAttribute('data-viewer')).toBe('true');
    expect(rankRows[1].getAttribute('data-viewer')).not.toBe('true');
    expect(rankRows[0].textContent).toContain('YOU');
    expect(rankRows[1].textContent).not.toContain('YOU');

    // (e) Footer has the bare "1st of 6" ordinal; NO "behind the next spot"
    //     suffix (rank-1 has no predecessor → gapToNext + prevRank are null).
    expect(panel.textContent).toMatch(/1st of 6/);
    expect(panel.textContent).not.toMatch(/behind the next spot/i);
  });

  it('renders the panel with the viewer at LAST rank (no next neighbor)', async () => {
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: mockByPeriodWithViewerAt('me-viewer-uid', 28, 28),
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    const panel = await screen.findByTestId('where-you-rank-panel');
    expect(within(panel).getByTestId('where-you-rank-row-rank-27')).toBeInTheDocument();
    expect(within(panel).getByTestId('where-you-rank-row-rank-28')).toBeInTheDocument();
    expect(within(panel).queryByTestId('where-you-rank-row-rank-29')).not.toBeInTheDocument();

    expect(panel.textContent).toMatch(/28th of 28/);
  });

  it('UNRANKED viewer → panel renders the empty-state row + helper copy', async () => {
    const ranking = Array.from({ length: 5 }, (_, i) =>
      mkEntry(i + 1, `other-${i}`, 100000 - i * 10000)
    );
    hoisted.useLeaderboard.mockReturnValue({
      loading: false, error: null, doc: null,
      byPeriod: { week: ranking, mtd: ranking, qtd: ranking, ytd: ranking },
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    const panel = await screen.findByTestId('where-you-rank-panel');
    expect(within(panel).getByTestId('where-you-rank-row-unranked')).toBeInTheDocument();
    expect(panel.textContent).toContain('Log production to join the board.');
    expect(panel.textContent).toContain('YOU');
    expect(panel.textContent).toContain('Priya'); // first name from userProfile
  });

  it('LEADERBOARD ERROR → panel is hidden (graceful degradation)', async () => {
    hoisted.useLeaderboard.mockReturnValue({
      loading: false,
      error: { code: 'permission-denied', message: 'denied' },
      doc: null,
      byPeriod: { week: [], mtd: [], qtd: [], ytd: [] },
      branchId: 'tatil_south',
    });

    render(<AgentProductionView />);

    // Wait for the rest of the surface to settle so the absence is genuine
    await screen.findByTestId('agent-production-rank-pill');
    expect(screen.queryByTestId('where-you-rank-panel')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 states contract — both sub-fetches previously swallowed via
// `.catch(() => [])`, degrading silently to an empty-data render with only a
// console.error. Both failing now renders a blocking error card with Retry;
// one failing renders a partial-failure banner while the other's real data
// still shows.
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentProductionView — 0.1b loading skeleton', () => {
  it('renders a PanelSkeleton (aria-busy) while both sub-fetches are pending, never bare text', async () => {
    hoisted.getAgentSubmissions.mockReturnValue(new Promise(() => {}));
    hoisted.getTenantUsers.mockReturnValue(new Promise(() => {}));

    render(<AgentProductionView />);

    expect(screen.getByTestId('agent-production-loading')).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByText(/Loading production data…/i)).toBeNull();
  });
});

describe('AgentProductionView — §1 states contract (error / partial / retry)', () => {
  it('both sub-fetches failing renders a blocking error card with Retry', async () => {
    hoisted.getAgentSubmissions.mockRejectedValue(new Error('boom-subs'));
    hoisted.getTenantUsers.mockRejectedValue(new Error('boom-users'));

    render(<AgentProductionView />);

    await waitFor(() => expect(screen.getByTestId('agent-production-error')).toBeInTheDocument());
    expect(screen.getByTestId('agent-production-error')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Retry on full failure re-invokes both failed loaders and recovers', async () => {
    hoisted.getAgentSubmissions.mockRejectedValueOnce(new Error('boom-subs')).mockResolvedValueOnce([]);
    hoisted.getTenantUsers.mockRejectedValueOnce(new Error('boom-users')).mockResolvedValueOnce([]);

    render(<AgentProductionView />);
    await waitFor(() => expect(screen.getByTestId('agent-production-error')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.queryByTestId('agent-production-error')).toBeNull());
    expect(hoisted.getAgentSubmissions).toHaveBeenCalledTimes(2);
    expect(hoisted.getTenantUsers).toHaveBeenCalledTimes(2);
  });

  it('one of two sub-fetches failing renders a partial-failure banner while still showing available data', async () => {
    hoisted.getAgentSubmissions.mockRejectedValue(new Error('boom-subs'));
    hoisted.getTenantUsers.mockResolvedValue([]);

    render(<AgentProductionView />);

    await waitFor(() => expect(screen.getByTestId('agent-production-partial')).toBeInTheDocument());
    expect(screen.getByTestId('agent-production-partial')).toHaveTextContent('1 of 2 data sources failed to load');
    // The rest of the surface still renders (not blocked by the partial failure).
    expect(screen.getByTestId('agent-production-rank-pill')).toBeInTheDocument();
  });
});
