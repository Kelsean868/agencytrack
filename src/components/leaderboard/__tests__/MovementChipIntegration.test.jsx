// @vitest-environment jsdom
//
// Track J — MovementChip integration across the four viewer surfaces.
//
// Carries the ▲/▼ verification at the surface level (the unit tests in
// `ui/__tests__/MovementChip.test.jsx` carry the direction math; these
// tests carry the WIRING — that the chip appears on the viewer's row only
// AND that it picks up `entry.previousRank` + `entry.rank` from the data).
//
// Surfaces covered:
//   1. AroundMeClusterDesktop  — viewer row in CLUSTER_3 layout
//   2. AroundMeClusterMobile   — viewer row in the expanded sheet (and the collapsed bar)
//   3. TailRow                  — isViewer arm
//   4. WhereYouRankPanel        — viewer row in the always-on cluster
//
// Each surface is exercised at ▲ (climbed), ▼ (dropped), – (even), and null
// (no chip). Non-viewer rows are also checked — chip MUST NOT render there.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  AroundMeClusterDesktop,
  AroundMeClusterMobile,
} from '../AroundMeCluster';
import { TailRow, PodiumCard } from '../ProductionLeaderboardSurface';
import WhereYouRankPanel from '../../productionReport/WhereYouRankPanel';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function mkEntry({ rank, agentId, periodApi = 1000, previousRank, name }) {
  return {
    agentId,
    name:           name ?? `Agent ${agentId}`,
    unitName:       'S·02',
    rank,
    periodApi,
    apps:           rank,
    rankWithinUnit: 1,
    previousRank:   previousRank === undefined ? null : previousRank,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 1: AroundMeClusterDesktop — viewer row
// ─────────────────────────────────────────────────────────────────────────────

describe('AroundMeClusterDesktop — viewer movement chip', () => {
  function renderCluster({ viewerPrev, viewerRank = 5 }) {
    const prev   = mkEntry({ rank: viewerRank - 1, agentId: 'a-prev', previousRank: 3 });
    const viewer = mkEntry({ rank: viewerRank,     agentId: 'me', name: 'Priya Gopaul', previousRank: viewerPrev });
    const next   = mkEntry({ rank: viewerRank + 1, agentId: 'a-next', previousRank: 6 });
    return render(
      <AroundMeClusterDesktop
        state="CLUSTER_3"
        rows={[prev, viewer, next]}
        viewerEntry={viewer}
        missingCount={2}
        totalCount={28}
        leaderApi={50000}
        viewerName="Priya Gopaul"
      />
    );
  }

  it('▲ climbed — viewer previousRank > rank → chip shows up direction', () => {
    renderCluster({ viewerPrev: 8, viewerRank: 5 }); // delta = +3
    const viewerRow = screen.getByTestId('around-me-row-rank-5');
    const chip = within(viewerRow).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('up');
    expect(chip.getAttribute('data-delta')).toBe('3');
  });

  it('▼ dropped — viewer previousRank < rank → chip shows down direction', () => {
    renderCluster({ viewerPrev: 2, viewerRank: 5 }); // delta = -3
    const viewerRow = screen.getByTestId('around-me-row-rank-5');
    const chip = within(viewerRow).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('down');
    expect(chip.getAttribute('data-delta')).toBe('-3');
  });

  it('– even — viewer previousRank == rank → chip shows even direction', () => {
    renderCluster({ viewerPrev: 5, viewerRank: 5 });
    const viewerRow = screen.getByTestId('around-me-row-rank-5');
    const chip = within(viewerRow).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('even');
    expect(chip.getAttribute('data-delta')).toBe('0');
  });

  it('null previousRank → NO chip on viewer row', () => {
    renderCluster({ viewerPrev: null, viewerRank: 5 });
    const viewerRow = screen.getByTestId('around-me-row-rank-5');
    expect(within(viewerRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
  });

  it('NEIGHBOR rows NEVER carry a chip (viewer-only)', () => {
    renderCluster({ viewerPrev: 8, viewerRank: 5 });
    // Prev has previousRank=3, rank=4 — would be a +(-1)? No, previousRank=3, rank=4 → delta -1
    // The chip MUST NOT render on the prev row regardless of data
    const prevRow = screen.getByTestId('around-me-row-rank-4');
    expect(within(prevRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
    const nextRow = screen.getByTestId('around-me-row-rank-6');
    expect(within(nextRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface 2: AroundMeClusterMobile — viewer row + collapsed bar
// ─────────────────────────────────────────────────────────────────────────────

describe('AroundMeClusterMobile — viewer movement chip', () => {
  function renderMobile({ viewerPrev, viewerRank = 5 }) {
    const prev   = mkEntry({ rank: viewerRank - 1, agentId: 'a-prev', previousRank: 3 });
    const viewer = mkEntry({ rank: viewerRank,     agentId: 'me', name: 'Priya Gopaul', previousRank: viewerPrev });
    const next   = mkEntry({ rank: viewerRank + 1, agentId: 'a-next', previousRank: 6 });
    return render(
      <AroundMeClusterMobile
        state="CLUSTER_3"
        rows={[prev, viewer, next]}
        viewerEntry={viewer}
        totalCount={28}
        gapToNext={1000}
        prevRank={prev.rank}
        viewerName="Priya Gopaul"
      />
    );
  }

  it('collapsed bar — viewer chip is visible by default (▲ climbed)', () => {
    renderMobile({ viewerPrev: 8, viewerRank: 5 });
    const bar = screen.getByTestId('around-me-mobile');
    const chip = within(bar).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('up');
    expect(chip.getAttribute('data-delta')).toBe('3');
  });

  it('expanded sheet — tap to expand, viewer row carries chip; neighbors do NOT', () => {
    renderMobile({ viewerPrev: 2, viewerRank: 5 }); // ▼ dropped 3
    const bar = screen.getByTestId('around-me-mobile');
    // Tap the collapsed bar (the <button>) to expand the sheet.
    fireEvent.click(bar.querySelector('button'));

    const sheet      = screen.getByTestId('around-me-mobile-expanded');
    const viewerRow  = within(sheet).getByTestId('around-me-mobile-row-rank-5');
    const chip       = within(viewerRow).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('down');
    expect(chip.getAttribute('data-delta')).toBe('-3');

    const prevRow = within(sheet).getByTestId('around-me-mobile-row-rank-4');
    const nextRow = within(sheet).getByTestId('around-me-mobile-row-rank-6');
    expect(within(prevRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
    expect(within(nextRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
  });

  it('null previousRank → no chip on the collapsed bar OR the expanded row', () => {
    renderMobile({ viewerPrev: null, viewerRank: 5 });
    const bar = screen.getByTestId('around-me-mobile');
    expect(within(bar).queryByTestId('movement-chip')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface 3: TailRow — isViewer arm
// ─────────────────────────────────────────────────────────────────────────────

describe('TailRow — viewer movement chip', () => {
  it('▲ climbed — chip renders when isViewer + previousRank > rank', () => {
    const entry = mkEntry({ rank: 5, agentId: 'me', name: 'Priya Gopaul', previousRank: 8 });
    render(<TailRow entry={entry} leaderApi={50000} isLast={false} isViewer />);
    const row = screen.getByTestId('tail-row-rank-5');
    const chip = within(row).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('up');
    expect(chip.getAttribute('data-delta')).toBe('3');
  });

  it('▼ dropped — chip renders when isViewer + previousRank < rank', () => {
    const entry = mkEntry({ rank: 5, agentId: 'me', name: 'Priya Gopaul', previousRank: 2 });
    render(<TailRow entry={entry} leaderApi={50000} isLast={false} isViewer />);
    const chip = within(screen.getByTestId('tail-row-rank-5')).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('down');
    expect(chip.getAttribute('data-delta')).toBe('-3');
  });

  it('– even — chip renders when isViewer + previousRank == rank', () => {
    const entry = mkEntry({ rank: 5, agentId: 'me', name: 'Priya Gopaul', previousRank: 5 });
    render(<TailRow entry={entry} leaderApi={50000} isLast={false} isViewer />);
    const chip = within(screen.getByTestId('tail-row-rank-5')).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('even');
  });

  it('null previousRank → NO chip even when isViewer', () => {
    const entry = mkEntry({ rank: 5, agentId: 'me', name: 'Priya Gopaul', previousRank: null });
    render(<TailRow entry={entry} leaderApi={50000} isLast={false} isViewer />);
    expect(within(screen.getByTestId('tail-row-rank-5')).queryByTestId('movement-chip'))
      .not.toBeInTheDocument();
  });

  it('NON-viewer row → NO chip even when previousRank is set', () => {
    const entry = mkEntry({ rank: 5, agentId: 'a-other', previousRank: 8 });
    render(<TailRow entry={entry} leaderApi={50000} isLast={false} isViewer={false} />);
    expect(within(screen.getByTestId('tail-row-rank-5')).queryByTestId('movement-chip'))
      .not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface 3b: PodiumCard — isViewer arm
// ─────────────────────────────────────────────────────────────────────────────

describe('PodiumCard — viewer movement chip', () => {
  it('▲ climbed — chip renders on viewer\'s podium card', () => {
    const entry = mkEntry({ rank: 2, agentId: 'me', name: 'Priya Gopaul', previousRank: 5 });
    render(<PodiumCard entry={entry} label="Runner-up" isCenter={false} isViewer />);
    const card = screen.getByTestId('podium-card-rank-2');
    const chip = within(card).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('up');
    expect(chip.getAttribute('data-delta')).toBe('3');
  });

  it('▼ dropped — chip renders on viewer\'s podium card', () => {
    const entry = mkEntry({ rank: 2, agentId: 'me', name: 'Priya Gopaul', previousRank: 1 });
    render(<PodiumCard entry={entry} label="Runner-up" isViewer />);
    expect(
      within(screen.getByTestId('podium-card-rank-2')).getByTestId('movement-chip').getAttribute('data-direction')
    ).toBe('down');
  });

  it('– even — chip renders on viewer\'s podium card', () => {
    const entry = mkEntry({ rank: 2, agentId: 'me', name: 'Priya Gopaul', previousRank: 2 });
    render(<PodiumCard entry={entry} label="Runner-up" isViewer />);
    expect(
      within(screen.getByTestId('podium-card-rank-2')).getByTestId('movement-chip').getAttribute('data-direction')
    ).toBe('even');
  });

  it('null previousRank → NO chip even when isViewer', () => {
    const entry = mkEntry({ rank: 2, agentId: 'me', name: 'Priya Gopaul', previousRank: null });
    render(<PodiumCard entry={entry} label="Runner-up" isViewer />);
    expect(
      within(screen.getByTestId('podium-card-rank-2')).queryByTestId('movement-chip')
    ).not.toBeInTheDocument();
  });

  it('NON-viewer podium card → NO chip', () => {
    const entry = mkEntry({ rank: 1, agentId: 'a-champion', previousRank: 3 });
    render(<PodiumCard entry={entry} label="Champion" isChampion isCenter isViewer={false} />);
    expect(
      within(screen.getByTestId('podium-card-rank-1')).queryByTestId('movement-chip')
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface 4: WhereYouRankPanel — viewer row
// ─────────────────────────────────────────────────────────────────────────────

describe('WhereYouRankPanel — viewer movement chip', () => {
  function renderPanel({ viewerPrev, viewerRank = 5, totalAgents = 6 }) {
    const ranking = Array.from({ length: totalAgents }, (_, i) => {
      const rank = i + 1;
      const isViewer = rank === viewerRank;
      return mkEntry({
        rank,
        agentId:      isViewer ? 'me' : `a-${rank}`,
        name:         isViewer ? 'Priya Gopaul' : `Agent ${rank}`,
        previousRank: isViewer ? viewerPrev : rank, // neighbors have previousRank=rank (even)
      });
    });
    return render(
      <WhereYouRankPanel
        ranking={ranking}
        viewerUid="me"
        viewerName="Priya Gopaul"
        branchLabel="South Branch"
        periodLabel="week"
      />
    );
  }

  it('▲ climbed — chip renders on viewer row', () => {
    renderPanel({ viewerPrev: 8, viewerRank: 5 });
    const panel     = screen.getByTestId('where-you-rank-panel');
    const viewerRow = within(panel).getByTestId('where-you-rank-row-rank-5');
    const chip      = within(viewerRow).getByTestId('movement-chip');
    expect(chip.getAttribute('data-direction')).toBe('up');
    expect(chip.getAttribute('data-delta')).toBe('3');
  });

  it('▼ dropped — chip renders on viewer row', () => {
    renderPanel({ viewerPrev: 2, viewerRank: 5 });
    const viewerRow = within(screen.getByTestId('where-you-rank-panel'))
      .getByTestId('where-you-rank-row-rank-5');
    expect(within(viewerRow).getByTestId('movement-chip').getAttribute('data-direction')).toBe('down');
  });

  it('– even — chip renders on viewer row', () => {
    renderPanel({ viewerPrev: 5, viewerRank: 5 });
    const viewerRow = within(screen.getByTestId('where-you-rank-panel'))
      .getByTestId('where-you-rank-row-rank-5');
    expect(within(viewerRow).getByTestId('movement-chip').getAttribute('data-direction')).toBe('even');
  });

  it('null previousRank → NO chip on viewer row', () => {
    renderPanel({ viewerPrev: null, viewerRank: 5 });
    const viewerRow = within(screen.getByTestId('where-you-rank-panel'))
      .getByTestId('where-you-rank-row-rank-5');
    expect(within(viewerRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
  });

  it('NEIGHBOR rows NEVER carry a chip (viewer-only)', () => {
    renderPanel({ viewerPrev: 8, viewerRank: 5 });
    const panel = screen.getByTestId('where-you-rank-panel');
    // visibleMax=0 → cluster mode → 3 rows: rank-4, rank-5 (viewer), rank-6.
    const prevRow = within(panel).getByTestId('where-you-rank-row-rank-4');
    const nextRow = within(panel).getByTestId('where-you-rank-row-rank-6');
    expect(within(prevRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
    expect(within(nextRow).queryByTestId('movement-chip')).not.toBeInTheDocument();
  });
});
