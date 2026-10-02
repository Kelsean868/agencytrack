/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useMemo } from 'react';
import FrTrophyRoomView from '../../compete/FrTrophyRoomView';
import FrCampaignView from '../../compete/FrCampaignView';
import CareerTrophiesCardView from '../../compete/CareerTrophiesCardView';
import CampaignPolicyList from '../../../campaigns/CampaignPolicyList';
import { derivePolicyLens } from '../../../../lib/policyCampaignLens';
import { buildCampaignPolicyGroups } from '../../../../lib/campaignPolicyGroups';
import { FrArenaHeaderView, FrMeHeaderView } from '../../compete/FrCompeteHeaderViews';
import { trophyRoom, arenaStanding, meTiles, awardTrophies, ARENA_PERIODS } from '../../../../lib/fr/competeModel';
import { awardInputs, agentAwardsView } from '../../../../lib/awards/agentAwardModel';
import { DEFAULT_RULESET_2026 } from '../../../../config/awardsRuleset/2026';
import FrLeaderboardView from '../../compete/FrLeaderboardView';
import useMinWidth from '../../../../hooks/useMinWidth';
import { LEADERBOARD_PERIODS } from '../../../../hooks/useProductionLeaderboard';
import { championsModel, boardView } from '../../../../lib/fr/leaderboardModel';
import { BOARD_ORDER, DEFAULT_BOARD, LEADERBOARD_BOARDS } from '../../../../lib/fr/leaderboardBoards';

/**
 * FR-5 harness scenes (SAMPLE data through the real competeModel). The engine
 * doc stands in for `leaderboard/{uid}`; variant B = more points and one more
 * report week (same badges, so no badge re-enters and every bar glides).
 * FR-5b: award trophies from the real award model (D9). `trophy-room` carries
 * sample A's awards in BOTH variants, so its A/B change stays a pure glide (the
 * walk compares elements index by index; swapping award sets re-lays the page).
 * `trophy-awards` shows both award samples side by side — A some qualified, B a
 * rookie with none qualified — so both states are rendered and walked.
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
    <ScenePage className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      {children}
    </ScenePage>
  );
}

// FR-5b award fixtures through the REAL award model (awardInputs →
// agentAwardsView → awardTrophies) and the 2026 default ruleset. A: tenured,
// a strong Q3 (Quarterly API qualified, Advisor of the Month API qualified).
// B: a rookie with a quiet year — nothing qualified; Rookie of the Year and
// New Business appear because the engine creates them for a rookie.
const AWARD_NOW = new Date('2026-09-15T16:00:00Z');
const spol = (n, dateIssued, api) => ({ id: n, status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', dateIssued, proposedAPI: api });
const AWARD_SAMPLE = {
  A: {
    profile: { uid: 'sample', monthsInIndustry: 60, monthsAtTatil: 60 },
    ledger: [spol('S-1', '2026-07-08', 36000), spol('S-2', '2026-08-11', 27500), spol('S-3', '2026-09-02', 52000), spol('S-4', '2026-09-09', 14000)],
    settlements: ['2026-07', '2026-08', '2026-09'].map((periodKey) => ({ periodKey, persistency: 92 })),
  },
  B: {
    profile: { uid: 'sample', monthsInIndustry: 6, monthsAtTatil: 6 },
    ledger: [spol('S-5', '2026-08-20', 9000), spol('S-6', '2026-09-03', 6000)],
    settlements: ['2026-08', '2026-09'].map((periodKey) => ({ periodKey, persistency: 88 })),
  },
};

function sampleAwards(variant) {
  const s = AWARD_SAMPLE[variant] ?? AWARD_SAMPLE.A;
  const { rows } = awardInputs({ ledgerPolicies: s.ledger, confirmedSettlements: s.settlements, usesPolicyLedger: false });
  return awardTrophies(agentAwardsView({
    rows, submissions: [], agentProfile: s.profile, now: AWARD_NOW, ruleset: DEFAULT_RULESET_2026, activeCampaigns: [],
  }), AWARD_NOW);
}

function TrophiesScene({ variant }) {
  const room = useMemo(() => trophyRoom(ENTRY[variant] ?? ENTRY.A, sampleAwards('A')), [variant]);
  return <Frame><FrTrophyRoomView room={room} /></Frame>;
}

function AwardSamplesScene() {
  const rooms = useMemo(() => ({
    A: trophyRoom(ENTRY.A, sampleAwards('A')),
    B: trophyRoom({ badges: ['first_submission'], points: 320, weeklyStreak: 2 }, sampleAwards('B')),
  }), []);
  return (
    <Frame>
      <div className="flex flex-col gap-10">
        <section aria-label="Sample A — tenured, some awards qualified" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">Sample A · tenured · some qualified</p>
          <FrTrophyRoomView room={rooms.A} />
        </section>
        <section aria-label="Sample B — rookie, no award qualified" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">Sample B · rookie · none qualified</p>
          <FrTrophyRoomView room={rooms.B} />
        </section>
      </div>
    </Frame>
  );
}

// R2-5: the Career card that replaced the badge grid (R-c) — the engine count
// (badges + levels) and the way into the Trophy room; loading and error states too.
function CareerCardScene({ variant }) {
  const room = useMemo(() => trophyRoom(ENTRY[variant] ?? ENTRY.A), [variant]);
  return (
    <Frame>
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <CareerTrophiesCardView room={room} onOpen={() => {}} />
        <CareerTrophiesCardView loading onOpen={() => {}} />
        <CareerTrophiesCardView error onRetry={() => {}} onOpen={() => {}} />
      </div>
    </Frame>
  );
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

// R2-4 — "Policies in this campaign" through the REAL lens (derivePolicyLens →
// buildCampaignPolicyGroups). A Rule 7 campaign, so every group and two credit
// cases show: a Platinum Edge (an app, no API) and a head-office Pending that
// the ledger still lets the agent move. Placeholder clients, never real ones.
const R24_CAMPAIGN = {
  id: 'c1', name: '[Christmas Campaign 2026]', startDate: '2026-07-01', endDate: '2026-12-31',
  structure: 'qualify', credit: {},
  tiers: [{ level: 1, name: 'Champion', api: 275000, apps: 35, cash: 7000 }],
};
const HO = { statusSource: 'oipa_import', exportDate: '2026-09-15' };
const R24_POLICIES = [
  { id: 's1', ownerName: '[Client A]', policyNumber: '10020031', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 73946.28, dateIssued: '2026-08-15', ...HO },
  { id: 's2', ownerName: '[Client B with a much longer name than fits on a phone row]', policyNumber: '10020187', status: 'settled', productLine: 'life', newBusinessType: 'platinum_edge', settledAPI: 12000, dateIssued: '2026-09-01', statusSource: 'agent' },
  { id: 'w1', ownerName: '[Client C]', status: 'submitted', productLine: 'life', newBusinessType: 'nb_ordinary', proposedAPI: 18500, dateWritten: '2026-09-10', dateSubmitted: '2026-09-12', statusSource: 'agent' },
  { id: 'w2', ownerName: '[Client D]', policyNumber: '10020244', status: 'submitted', productLine: 'life', newBusinessType: 'nb_ordinary', proposedAPI: 9600, dateWritten: '2026-08-28', ...HO },
  { id: 'x1', ownerName: '[Client E]', policyNumber: '10019902', status: 'lapsed', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 8400, dateIssued: '2025-11-02', ...HO },
  { id: 'x2', ownerName: '[Client F]', policyNumber: '10019655', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 15200, dateIssued: '2026-03-10', ...HO },
  { id: 'x3', ownerName: '[Client G]', policyNumber: '10020300', status: 'settled', productLine: 'life', isSelfOrFamily: true, newBusinessType: 'nb_ordinary', settledAPI: 6000, dateIssued: '2026-08-02', statusSource: 'agent' },
];

function CampaignPoliciesScene() {
  const groups = useMemo(() => {
    const lens = derivePolicyLens(R24_POLICIES, R24_CAMPAIGN, { now: new Date('2026-09-26T12:00:00Z') });
    return buildCampaignPolicyGroups(lens, R24_POLICIES);
  }, []);
  return (
    <Frame>
      <FrCampaignView
        campaigns={[R24_CAMPAIGN]}
        renderCampaign={() => (
          <CampaignPolicyList groups={groups} exportDate="2026-09-15" onOpenPolicy={() => {}} showNotCounting />
        )}
      />
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

// ── R2-11 / L-2: FR Leaderboard (canvas D3-Leaderboard / M3-Leaderboard v43) ─
// SAMPLE branch of 12 through the SAME boardView() the screen uses (board
// ranking, scope, around-me, standing); the View is pure. Each board ranks a
// different order: the viewer ("[You]") is #11 on API (around-me cluster and
// "+N agents" gap row), #2 on Activity (podium) and #9 on Apps (cluster, an
// apps tie broken by API). Variant B keeps every board's order (and ties) with
// different ratios so the bars glide on each board. Names are placeholders.
const LB_NAMES = ['[Agent A]', '[Agent B]', '[Agent C]', '[Agent D]', '[Agent E]', '[Agent F]', '[Agent G]', '[Agent H]', '[Agent I]', '[Agent J]', '[You]', '[Agent L]'];
const LB_BASE = [812400, 640150, 522900, 410300, 355000, 301200, 262750, 214000, 190500, 150200, 128600, 90400];
// Same order, different ratios, so the bars (share of the leader, to pass) move.
const LB_BASE_B = [850000, 700000, 610000, 300000, 260000, 225000, 200000, 150000, 130000, 115000, 108000, 95000];
const LB_POINTS = [5200, 6100, 4300, 7400, 2800, 8100, 3100, 6900, 4600, 1900, 7900, 2400];
const LB_APPS = [9, 7, 8, 5, 6, 4, 6, 3, 5, 2, 4, 1];
// Variant B for the other two boards: same order and the same ties, different ratios.
const LB_POINTS_B = [2600, 2800, 1800, 3000, 600, 9000, 1000, 2900, 2000, 300, 8800, 400];
const LB_APPS_B = [12, 9, 10, 6, 8, 5, 8, 4, 6, 3, 5, 2];
const LB_A = { api: LB_BASE, points: LB_POINTS, apps: LB_APPS };
const LB_B = { api: LB_BASE_B, points: LB_POINTS_B, apps: LB_APPS_B };
// Per-period scale: [API, points, apps].
const LB_SCALE = { week: [0.02, 0.04, 0.25], mtd: [0.1, 0.15, 0.4], qtd: [0.3, 0.4, 0.7], ytd: [1, 1, 1] };
function lbRanking(period, data) {
  const [api, pts, apps] = LB_SCALE[period];
  return LB_NAMES.map((name, i) => ({
    agentId: name === '[You]' ? 'me' : `a${i}`,
    name,
    unitId: i % 2 ? 'u2' : 'u1',
    unitName: i % 2 ? 'Coastal Unit' : 'South Unit',
    periodApi: Math.round(data.api[i] * api),
    apps: Math.round(data.apps[i] * apps),
    points: Math.round(data.points[i] * pts),
    previousRanks: period === 'week'
      ? (name === '[You]' ? { activity: 4, api: 12, apps: 10 } : { activity: i + 1, api: i + 1, apps: i + 1 })
      : null,
  }));
}
const LB_CHAMPS = {
  weekStarting: '2026-09-20',
  topAPI: { agentId: 'a0', agentName: '[Agent A]', value: 45250 },
  topApps: { agentId: 'a2', agentName: '[Agent C]', value: 4 },
  topActivity: { agentId: 'me', agentName: '[You]', value: 312 },
};
const LB_BOARDS = BOARD_ORDER.map((id) => ({ id, label: LEADERBOARD_BOARDS[id].label }));

function LeaderboardScene({ variant, status = 'ready', initialBoard = DEFAULT_BOARD }) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
  const [period, setPeriod] = React.useState('YTD');
  const [board, setBoard] = React.useState(initialBoard);
  const data = variant === 'B' ? LB_B : LB_A;
  const byPeriod = useMemo(() => ({
    week: lbRanking('week', data),
    mtd: lbRanking('mtd', data),
    qtd: lbRanking('qtd', data),
    ytd: lbRanking('ytd', data),
  }), [data]);
  const field = LEADERBOARD_PERIODS.find((p) => p.k === period).field;
  const view = boardView({ byPeriod, activeField: field, board, scope: 'branch', targetUnitId: null, viewerUid: 'me', phone: layout === 'phone' });
  const periodWord = (ARENA_PERIODS.find((p) => p.id === field)?.label ?? 'this year').toLowerCase();
  return (
    <ScenePage className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 p-4 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">L-2 · Leaderboard · {view.config.label} · SAMPLE</p>
      <FrLeaderboardView
        layout={layout}
        status={status}
        errorCode={status === 'error' ? 'unavailable' : undefined}
        onRetry={() => {}}
        boards={LB_BOARDS}
        board={board}
        onBoard={setBoard}
        boardConfig={view.config}
        periods={LEADERBOARD_PERIODS}
        period={period}
        onPeriod={setPeriod}
        scopeControl={null}
        scopeLine={`South · ${period} · ${view.count} agents`}
        title={view.config.title(periodWord)}
        periodWord={periodWord}
        champions={championsModel(LB_CHAMPS)}
        podium={view.podium}
        rows={view.rows}
        viewerUid="me"
        you={view.you}
        toPass={view.toPass}
        rankCols={view.rankCols}
        share={view.share}
        scope="branch"
        updated="Sep 30, 5:10 AM"
        mobileYouBar={null}
        onOpenTrophies={() => {}}
      />
    </ScenePage>
  );
}
const LeaderboardApiScene = (props) => <LeaderboardScene {...props} initialBoard="api" />;
const LeaderboardAppsScene = (props) => <LeaderboardScene {...props} initialBoard="apps" />;
// Loading and error, then each board's empty state (D11 copy).
function LeaderboardStatesScene() {
  return (
    <div className="flex flex-col">
      <LeaderboardScene status="loading" />
      <LeaderboardScene status="error" />
      {BOARD_ORDER.map((id) => <LeaderboardScene key={id} status="empty" initialBoard={id} />)}
    </div>
  );
}

export const COMPETE_SCENES = [
  { id: 'trophy-room', title: 'Compete · Trophy room', slice: 'FR-5', viewport: 'desktop,phone', hasVariants: true, render: TrophiesScene },
  { id: 'trophy-awards', title: 'Compete · Trophy room award samples (A · B)', slice: 'FR-5', viewport: 'desktop,phone', render: AwardSamplesScene },
  { id: 'career-trophies', title: 'Career · Your badges and trophies card', slice: 'FR-5', viewport: 'desktop,phone', render: CareerCardScene },
  { id: 'campaign', title: 'Compete · Campaign', slice: 'FR-5', viewport: 'desktop,phone', render: CampaignScene },
  { id: 'campaign-policies', title: 'Compete · Campaign — policies in this campaign', slice: 'R2-4', viewport: 'desktop,tablet,phone', render: CampaignPoliciesScene },
  { id: 'leaderboard', title: 'Compete · Leaderboard · Activity board', slice: 'L-2', viewport: 'desktop,tablet,phone', hasVariants: true, render: LeaderboardScene },
  { id: 'leaderboard-api', title: 'Compete · Leaderboard · API board', slice: 'L-2', viewport: 'desktop,tablet,phone', hasVariants: true, render: LeaderboardApiScene },
  { id: 'leaderboard-apps', title: 'Compete · Leaderboard · Apps board', slice: 'L-2', viewport: 'desktop,tablet,phone', hasVariants: true, render: LeaderboardAppsScene },
  { id: 'leaderboard-states', title: 'Compete · Leaderboard (loading · error · each board empty)', slice: 'L-2', viewport: 'desktop,tablet,phone', render: LeaderboardStatesScene },
  { id: 'compete-headers', title: 'Arena + Me headers', slice: 'FR-5', viewport: 'desktop,phone', hasVariants: true, render: HeadersScene },
];
