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
import { trophyRoom, arenaStanding, meTiles, awardTrophies } from '../../../../lib/fr/competeModel';
import { awardInputs, agentAwardsView } from '../../../../lib/awards/agentAwardModel';
import { DEFAULT_RULESET_2026 } from '../../../../config/awardsRuleset/2026';
import FrLeaderboardView from '../../compete/FrLeaderboardView';
import useMinWidth from '../../../../hooks/useMinWidth';
import { LEADERBOARD_PERIODS } from '../../../../hooks/useProductionLeaderboard';
import { applyScope } from '../../../../lib/leaderboard/scopeFilter';
import { computeAroundMe, VISIBLE_MAX_DESKTOP } from '../../../../lib/leaderboard/aroundMeLogic';
import { rankColumns, toPass, shareOfScope, championsModel, movedNote, boardRows } from '../../../../lib/fr/leaderboardModel';

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

// ── R2-11: FR Leaderboard (canvas D3-Leaderboard / M3-Leaderboard) ─────────
// SAMPLE branch of 12 through the REAL scope filter, around-me logic,
// arenaStanding and leaderboardModel; the View is pure. The viewer ("[You]")
// sits at #11 on the year board, so the around-me cluster and "+N agents"
// gap row render. Variant B keeps the order with different ratios so the
// bars glide. Names are placeholders.
const LB_NAMES = ['[Agent A]', '[Agent B]', '[Agent C]', '[Agent D]', '[Agent E]', '[Agent F]', '[Agent G]', '[Agent H]', '[Agent I]', '[Agent J]', '[You]', '[Agent L]'];
function lbRanking(scale, base) {
  return LB_NAMES.map((name, i) => ({
    agentId: name === '[You]' ? 'me' : `a${i}`,
    name,
    unitId: i % 2 ? 'u2' : 'u1',
    unitName: i % 2 ? 'Coastal Unit' : 'South Unit',
    periodApi: Math.round(base[i] * scale),
    apps: 12 - i,
    rank: i + 1,
    rankWithinUnit: Math.floor(i / 2) + 1,
    previousRank: name === '[You]' ? 12 : i + 1,
  }));
}
const LB_BASE = [812400, 640150, 522900, 410300, 355000, 301200, 262750, 214000, 190500, 150200, 128600, 90400];
// Same order, different ratios, so the bars (share of the leader, to pass) move.
const LB_BASE_B = [850000, 700000, 610000, 300000, 260000, 225000, 200000, 150000, 130000, 115000, 108000, 95000];
const LB_CHAMPS = {
  weekStarting: '2026-09-20',
  topAPI: { agentId: 'a0', agentName: '[Agent A]', value: 45250 },
  topApps: { agentId: 'a2', agentName: '[Agent C]', value: 4 },
  topActivity: null,
};

function LeaderboardScene({ variant, status = 'ready' }) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
  const [period, setPeriod] = React.useState('YTD');
  const scale = 1;
  const base = variant === 'B' ? LB_BASE_B : LB_BASE;
  const byPeriod = useMemo(() => ({
    week: lbRanking(scale * 0.02, base).map((e, i) => ({ ...e, rank: [3, 1, 2, 5, 4, 6, 7, 8, 9, 10, 11, 12][i] })),
    mtd: lbRanking(scale * 0.1, base),
    qtd: lbRanking(scale * 0.3, base),
    ytd: lbRanking(scale, base),
  }), [scale, base]);
  const field = LEADERBOARD_PERIODS.find((p) => p.k === period).field;
  const branch = byPeriod[field];
  const { displayedRanking, scopedLeaderApi, count } = applyScope({ ranking: branch, scope: 'branch', targetUnitId: null });
  const standing = arenaStanding(byPeriod, 'me');
  const aroundMe = computeAroundMe({ ranking: displayedRanking, viewerUid: 'me', visibleMax: VISIBLE_MAX_DESKTOP });
  const mine = standing[field];
  return (
    <ScenePage className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 p-4 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">R2-11 · Leaderboard · SAMPLE</p>
      <FrLeaderboardView
        layout={layout}
        status={status}
        errorCode={status === 'error' ? 'unavailable' : undefined}
        onRetry={() => {}}
        periods={LEADERBOARD_PERIODS}
        period={period}
        onPeriod={setPeriod}
        scopeControl={null}
        scopeLine={`South · ${period} · ${count} agents`}
        title="Who's leading the year."
        periodWord="this year"
        champions={championsModel(LB_CHAMPS)}
        podium={displayedRanking.slice(0, 3)}
        rows={boardRows({ tail: displayedRanking.slice(3, 8), aroundMe, leaderApi: scopedLeaderApi, viewerUid: 'me', phone: layout === 'phone' })}
        viewerUid="me"
        you={{ rank: mine.rank, of: mine.of, api: mine.api, movedNote: movedNote(mine) }}
        toPass={toPass(standing, field, branch)}
        rankCols={rankColumns(standing, field)}
        share={shareOfScope(displayedRanking, 'me', 'branch')}
        updated="Sep 30, 5:10 AM"
        mobileYouBar={null}
        onOpenTrophies={() => {}}
      />
    </ScenePage>
  );
}
function LeaderboardStatesScene() {
  return (
    <div className="flex flex-col">
      <LeaderboardScene status="loading" />
      <LeaderboardScene status="error" />
      <LeaderboardScene status="empty" />
    </div>
  );
}

export const COMPETE_SCENES = [
  { id: 'trophy-room', title: 'Compete · Trophy room', slice: 'FR-5', viewport: 'desktop,phone', hasVariants: true, render: TrophiesScene },
  { id: 'trophy-awards', title: 'Compete · Trophy room award samples (A · B)', slice: 'FR-5', viewport: 'desktop,phone', render: AwardSamplesScene },
  { id: 'career-trophies', title: 'Career · Your badges and trophies card', slice: 'FR-5', viewport: 'desktop,phone', render: CareerCardScene },
  { id: 'campaign', title: 'Compete · Campaign', slice: 'FR-5', viewport: 'desktop,phone', render: CampaignScene },
  { id: 'campaign-policies', title: 'Compete · Campaign — policies in this campaign', slice: 'R2-4', viewport: 'desktop,tablet,phone', render: CampaignPoliciesScene },
  { id: 'leaderboard', title: 'Compete · Leaderboard', slice: 'R2-11', viewport: 'desktop,tablet,phone', hasVariants: true, render: LeaderboardScene },
  { id: 'leaderboard-states', title: 'Compete · Leaderboard (loading · error · empty)', slice: 'R2-11', viewport: 'desktop,tablet,phone', render: LeaderboardStatesScene },
  { id: 'compete-headers', title: 'Arena + Me headers', slice: 'FR-5', viewport: 'desktop,phone', hasVariants: true, render: HeadersScene },
];
