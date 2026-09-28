/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import React, { useMemo } from 'react';
import FrTrophyRoomView from '../../compete/FrTrophyRoomView';
import FrCampaignView from '../../compete/FrCampaignView';
import { FrArenaHeaderView, FrMeHeaderView } from '../../compete/FrCompeteHeaderViews';
import { trophyRoom, arenaStanding, meTiles } from '../../../../lib/fr/competeModel';

/**
 * FR-5 harness scenes (SAMPLE data through the real competeModel). The engine
 * doc stands in for `leaderboard/{uid}`; variant B = more points and one more
 * report week (same badges, so no trophy re-enters and every bar glides).
 * Names are placeholders, never real agents.
 */

const ENTRY = {
  A: { badges: ['first_submission', 'streak_4', 'big_week'], points: 2100, weeklyStreak: 6 },
  B: { badges: ['first_submission', 'streak_4', 'big_week'], points: 2500, weeklyStreak: 7 },
};
const BOARD = (variant) => {
  const me = variant === 'B' ? 98200 : 74500;
  const ytd = [
    { agentId: 'a1', name: '[Agent A]', rank: 1, periodApi: 120000, apps: 6 },
    { agentId: 'a2', name: '[Agent B]', rank: 2, periodApi: 90000, apps: 4 },
    { agentId: 'me', name: '[You]', rank: 3, periodApi: me, apps: 3, previousRank: 5 },
    { agentId: 'a4', name: '[Agent D]', rank: 4, periodApi: 20000, apps: 1 },
  ];
  if (variant === 'B') { ytd[1].rank = 3; ytd[2].rank = 2; }
  return { week: [{ agentId: 'me', rank: 2, periodApi: 6000 }], mtd: [], qtd: ytd.slice(0, 3), ytd };
};

function Frame({ children }) {
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      {children}
    </main>
  );
}

function TrophiesScene({ variant }) {
  const room = useMemo(() => trophyRoom(ENTRY[variant] ?? ENTRY.A), [variant]);
  return <Frame><FrTrophyRoomView room={room} /></Frame>;
}

function CampaignScene() {
  const slot = (c) => (
    <section className="rounded-[18px] border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">Existing screen</p>
      <p className="mt-1 font-display text-[20px] font-bold text-ink">{c.name}</p>
      <p className="mt-2 max-w-prose text-[14px] text-ink-muted">The existing campaign screen (tiers, target tier, policies that count) renders here in the app, unchanged.</p>
    </section>
  );
  return (
    <Frame>
      <div className="flex flex-col gap-10">
        <FrCampaignView campaigns={[{ id: 'c1', name: '[Christmas Campaign 2026]' }]} renderCampaign={slot} />
        <FrCampaignView campaigns={[]} renderCampaign={slot} onOpenAwards={() => {}} />
      </div>
    </Frame>
  );
}

function HeadersScene({ variant }) {
  const standing = useMemo(() => arenaStanding(BOARD(variant), 'me'), [variant]);
  const tiles = useMemo(() => meTiles(trophyRoom(ENTRY[variant] ?? ENTRY.A)), [variant]);
  return (
    <Frame>
      <FrArenaHeaderView standing={standing} />
      <FrMeHeaderView tiles={tiles} onOpenTrophies={() => {}} />
    </Frame>
  );
}

export const COMPETE_SCENES = [
  { id: 'trophy-room', title: 'Compete · Trophy room', slice: 'FR-5', viewport: 'desktop,phone', hasVariants: true, render: TrophiesScene },
  { id: 'campaign', title: 'Compete · Campaign', slice: 'FR-5', viewport: 'desktop,phone', render: CampaignScene },
  { id: 'compete-headers', title: 'Arena + Me headers', slice: 'FR-5', viewport: 'desktop,phone', hasVariants: true, render: HeadersScene },
];
