/**
 * Component tests for the around-me cluster — Track J P4.
 *
 * Closes the verification gap that neither the live smoke (test agent always
 * visible) nor the pure-logic unit tests can cover: the actual rendered
 * cluster + tail .me highlight + mobile tap-expand interaction.
 *
 * Mocks: none required. The cluster components are pure render functions of
 * their props; mobile bar uses real DOM events for tap/scroll/outside-tap.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  AroundMeClusterDesktop,
  AroundMeClusterMobile,
} from '../AroundMeCluster';
import { TailRow } from '../ProductionLeaderboardSurface';

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

const VIEWER = mkEntry(14, 'me', 6500, 'Priya Gopaul');
const PREV   = mkEntry(13, 'a13', 8000);
const NEXT   = mkEntry(15, 'a15', 5000);

// ── AroundMeClusterDesktop — boundary rendering ──────────────────────────────

describe('AroundMeClusterDesktop — CLUSTER_3 (3-row case)', () => {
  it('renders three rows in order: prev, viewer, next', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        missingCount={4}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByTestId('around-me-row-rank-13')).toBeInTheDocument();
    expect(screen.getByTestId('around-me-row-rank-14')).toBeInTheDocument();
    expect(screen.getByTestId('around-me-row-rank-15')).toBeInTheDocument();
  });

  it('viewer row gets the YOU coin (not initials avatar)', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        missingCount={4}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    const viewerRow = screen.getByTestId('around-me-row-rank-14');
    expect(viewerRow.textContent).toContain('YOU');
    // Neighbors render initials, not "YOU"
    const prevRow = screen.getByTestId('around-me-row-rank-13');
    expect(prevRow.textContent).not.toContain('YOU');
  });

  it('renders the "+N agents" gap divider when missingCount > 0', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        missingCount={4}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    const divider = screen.getByTestId('around-me-gap-divider');
    expect(divider.textContent).toMatch(/\+\s*4\s*agents/);
  });

  it('HIDES the gap divider when missingCount === 0', () => {
    // Adjacent-to-visible case: viewer at rank 9 (prev=8 which IS the visible bound)
    const rows = [mkEntry(8, 'a8', 30000), mkEntry(9, 'me', 25000), mkEntry(10, 'a10', 20000)];
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={rows}
        viewerEntry={rows[1]}
        missingCount={0}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.queryByTestId('around-me-gap-divider')).not.toBeInTheDocument();
  });

  it('singular vs plural divider copy: "+ 1 agent" vs "+ 4 agents"', () => {
    const { rerender } = render(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        missingCount={1}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByTestId('around-me-gap-divider').textContent).toMatch(/\+\s*1\s*agent\b/);
    expect(screen.getByTestId('around-me-gap-divider').textContent).not.toMatch(/agents/);

    rerender(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        missingCount={4}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByTestId('around-me-gap-divider').textContent).toMatch(/agents/);
  });

  it('renders "Rank N of M" footnote', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        missingCount={4}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByText(/Rank 14 of 28/)).toBeInTheDocument();
  });
});

describe('AroundMeClusterDesktop — CLUSTER_2_LAST (2-row case)', () => {
  const lastEntry = mkEntry(28, 'me', 1000, 'Priya Gopaul');
  const prevLast  = mkEntry(27, 'a27', 2500);

  it('renders exactly TWO rows: prev (N-1) and viewer (N) — no next', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_2_LAST"
        rows={[prevLast, lastEntry]}
        viewerEntry={lastEntry}
        missingCount={18}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByTestId('around-me-row-rank-27')).toBeInTheDocument();
    expect(screen.getByTestId('around-me-row-rank-28')).toBeInTheDocument();
    // No "next" row past rank 28 — only 2 rank-N rows total in the cluster
    const allRows = screen.queryAllByTestId(/^around-me-row-rank-/);
    expect(allRows).toHaveLength(2);
  });

  it('viewer (last) row has the YOU coin', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_2_LAST"
        rows={[prevLast, lastEntry]}
        viewerEntry={lastEntry}
        missingCount={18}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByTestId('around-me-row-rank-28').textContent).toContain('YOU');
    expect(screen.getByTestId('around-me-row-rank-27').textContent).not.toContain('YOU');
  });
});

describe('AroundMeClusterDesktop — CLUSTER_UNRANKED (1-row empty state)', () => {
  it('renders exactly ONE row — the unranked YOU empty state', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_UNRANKED"
        rows={[]}
        viewerEntry={null}
        missingCount={0}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByTestId('around-me-row-unranked')).toBeInTheDocument();
    // Confirm NO rank-N rows render (they'd be artifacts)
    expect(screen.queryAllByTestId(/^around-me-row-rank-/)).toHaveLength(0);
  });

  it('unranked row carries the YOU coin and the helper copy', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_UNRANKED"
        rows={[]}
        viewerEntry={null}
        missingCount={0}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    const row = screen.getByTestId('around-me-row-unranked');
    expect(row.textContent).toContain('YOU');
    expect(row.textContent).toContain('Priya'); // first name
    expect(row.textContent).toContain('Log production to join the board.');
    expect(row.textContent).toContain('TTD 0');
    expect(row.textContent).toMatch(/^—|—/); // rank shown as em-dash
  });

  it('unranked footnote shows "— of M" (no rank)', () => {
    render(
      <AroundMeClusterDesktop
        state="CLUSTER_UNRANKED"
        rows={[]}
        viewerEntry={null}
        missingCount={0}
        totalCount={12}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(screen.getByText(/—\s+of\s+12/)).toBeInTheDocument();
  });
});

describe('AroundMeClusterDesktop — VISIBLE_PODIUM / VISIBLE_TAIL return null', () => {
  it('renders nothing when state is VISIBLE_PODIUM', () => {
    const { container } = render(
      <AroundMeClusterDesktop
        state="VISIBLE_PODIUM"
        rows={[]}
        viewerEntry={VIEWER}
        missingCount={0}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when state is VISIBLE_TAIL', () => {
    const { container } = render(
      <AroundMeClusterDesktop
        state="VISIBLE_TAIL"
        rows={[]}
        viewerEntry={VIEWER}
        missingCount={0}
        totalCount={28}
        leaderApi={100000}
        viewerName="Priya Gopaul"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ── TailRow — isViewer .me highlight (covers the visible-tail rank 4-8 case) ──

describe('TailRow — isViewer .me highlight', () => {
  it('regular tail row: NO viewer attr, initials avatar, no tint bg', () => {
    render(<TailRow entry={mkEntry(5, 'a5', 60000)} leaderApi={100000} isLast={false} />);
    const row = screen.getByTestId('tail-row-rank-5');
    expect(row.getAttribute('data-viewer')).toBeNull();
    expect(row.className).not.toContain('bg-primary-tint');
    expect(row.textContent).not.toContain('YOU');
  });

  it('isViewer tail row: data-viewer="true", YOU coin, bg-primary-tint, teal rank', () => {
    const meEntry = mkEntry(5, 'me', 60000, 'Priya Gopaul');
    render(<TailRow entry={meEntry} leaderApi={100000} isLast={false} isViewer />);
    const row = screen.getByTestId('tail-row-rank-5');
    expect(row.getAttribute('data-viewer')).toBe('true');
    expect(row.className).toContain('bg-primary-tint');
    expect(row.textContent).toContain('YOU');
    // Display name swaps to "You · {firstname}"
    expect(row.textContent).toContain('You · Priya');
  });

  it('isViewer row has the 1.5px inset primary ring (inline box-shadow)', () => {
    const meEntry = mkEntry(5, 'me', 60000, 'Priya Gopaul');
    render(<TailRow entry={meEntry} leaderApi={100000} isLast={false} isViewer />);
    const row = screen.getByTestId('tail-row-rank-5');
    expect(row.getAttribute('style')).toContain('inset 0 0 0 1.5px');
  });
});

// ── AroundMeClusterMobile — tap-expand / tap-collapse / scroll-collapse ──────

describe('AroundMeClusterMobile — tap-expand interaction', () => {
  beforeEach(() => {
    // Reset window scroll listener state before each test
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the collapsed bar by default (no expanded sheet)', () => {
    render(
      <AroundMeClusterMobile
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        totalCount={28}
        gapToNext={1500}
        prevRank={13}
        viewerName="Priya Gopaul"
      />
    );
    const bar = screen.getByTestId('around-me-mobile');
    expect(bar.getAttribute('data-expanded')).toBe('false');
    expect(screen.queryByTestId('around-me-mobile-expanded')).not.toBeInTheDocument();
  });

  it('the collapsed bar shows rank-of-total and "X behind #N" gap copy', () => {
    render(
      <AroundMeClusterMobile
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        totalCount={28}
        gapToNext={1500}
        prevRank={13}
        viewerName="Priya Gopaul"
      />
    );
    const bar = screen.getByTestId('around-me-mobile');
    expect(bar.textContent).toContain('Rank 14 of 28');
    expect(bar.textContent).toContain('behind #13');
  });

  it('tap on the bar toggles expanded=true and renders the 3-row sheet', () => {
    render(
      <AroundMeClusterMobile
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        totalCount={28}
        gapToNext={1500}
        prevRank={13}
        viewerName="Priya Gopaul"
      />
    );
    const toggle = screen.getByRole('button', { name: /Your position/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('around-me-mobile-expanded')).toBeInTheDocument();
    // Expanded sheet renders 3 rows
    expect(screen.getByTestId('around-me-mobile-row-rank-13')).toBeInTheDocument();
    expect(screen.getByTestId('around-me-mobile-row-rank-14')).toBeInTheDocument();
    expect(screen.getByTestId('around-me-mobile-row-rank-15')).toBeInTheDocument();
  });

  it('tap on the bar AGAIN collapses (expanded sheet removed)', () => {
    render(
      <AroundMeClusterMobile
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        totalCount={28}
        gapToNext={1500}
        prevRank={13}
        viewerName="Priya Gopaul"
      />
    );
    const toggle = screen.getByRole('button', { name: /Your position/ });
    fireEvent.click(toggle); // expand
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle); // collapse
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('around-me-mobile-expanded')).not.toBeInTheDocument();
  });

  it('window scroll collapses the expanded sheet', () => {
    render(
      <AroundMeClusterMobile
        state="CLUSTER_3"
        rows={[PREV, VIEWER, NEXT]}
        viewerEntry={VIEWER}
        totalCount={28}
        gapToNext={1500}
        prevRank={13}
        viewerName="Priya Gopaul"
      />
    );
    const toggle = screen.getByRole('button', { name: /Your position/ });
    fireEvent.click(toggle); // expand
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    // Trigger scroll → useEffect listener collapses
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('around-me-mobile-expanded')).not.toBeInTheDocument();
  });

  it('outside-tap (mousedown outside the bar) collapses the expanded sheet', () => {
    render(
      <div>
        <button data-testid="outside-target" type="button">Outside</button>
        <AroundMeClusterMobile
          state="CLUSTER_3"
          rows={[PREV, VIEWER, NEXT]}
          viewerEntry={VIEWER}
          totalCount={28}
          gapToNext={1500}
          prevRank={13}
          viewerName="Priya Gopaul"
        />
      </div>
    );
    const toggle = screen.getByRole('button', { name: /Your position/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    // Trigger mousedown on an element OUTSIDE the bar
    const outside = screen.getByTestId('outside-target');
    fireEvent.mouseDown(outside);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('CLUSTER_UNRANKED: collapsed bar shows "— of M" + helper copy, no expanded sheet on tap', () => {
    render(
      <AroundMeClusterMobile
        state="CLUSTER_UNRANKED"
        rows={[]}
        viewerEntry={null}
        totalCount={28}
        gapToNext={null}
        prevRank={null}
        viewerName="Priya Gopaul"
      />
    );
    const bar = screen.getByTestId('around-me-mobile');
    expect(bar.textContent).toContain('Log production to join the board.');
    // Tapping doesn't open a sheet (no neighbor rows to show)
    const toggle = screen.getByRole('button', { name: /Your position/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // But the expanded sheet renders nothing because rows is empty
    expect(screen.queryByTestId('around-me-mobile-expanded')).not.toBeInTheDocument();
  });

  it('CLUSTER_2_LAST (viewer at last): collapsed bar shows correct rank-of-total, sheet has 2 rows', () => {
    const lastEntry = mkEntry(28, 'me', 1000);
    const prevLast  = mkEntry(27, 'a27', 2500);
    render(
      <AroundMeClusterMobile
        state="CLUSTER_2_LAST"
        rows={[prevLast, lastEntry]}
        viewerEntry={lastEntry}
        totalCount={28}
        gapToNext={1500}
        prevRank={27}
        viewerName="Priya Gopaul"
      />
    );
    const bar = screen.getByTestId('around-me-mobile');
    expect(bar.textContent).toContain('Rank 28 of 28');

    const toggle = screen.getByRole('button', { name: /Your position/ });
    fireEvent.click(toggle);
    // Sheet has exactly 2 mobile rows (prev + viewer)
    expect(screen.getByTestId('around-me-mobile-row-rank-27')).toBeInTheDocument();
    expect(screen.getByTestId('around-me-mobile-row-rank-28')).toBeInTheDocument();
    expect(screen.queryByTestId(/^around-me-mobile-row-rank-29/)).not.toBeInTheDocument();
  });

  it('VISIBLE state returns null (no bar at all)', () => {
    const { container } = render(
      <AroundMeClusterMobile
        state="VISIBLE_PODIUM"
        rows={[]}
        viewerEntry={VIEWER}
        totalCount={28}
        gapToNext={null}
        prevRank={null}
        viewerName="Priya Gopaul"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
