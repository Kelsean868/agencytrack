import React, { useMemo } from 'react';
import useMinWidth from '../../../hooks/useMinWidth';
import useProductionLeaderboard, { LEADERBOARD_PERIODS, formatComputedAt } from '../../../hooks/useProductionLeaderboard';
import LeaderboardScopeControl from '../../leaderboard/LeaderboardScopeControl';
import { AroundMeClusterMobile } from '../../leaderboard/AroundMeCluster';
import { arenaStanding, ARENA_PERIODS } from '../../../lib/fr/competeModel';
import {
  rankColumns, toPass, shareOfScope, championsModel, movedNote, boardRows,
} from '../../../lib/fr/leaderboardModel';
import FrLeaderboardView from './FrLeaderboardView';

/**
 * FrLeaderboard — the FR Leaderboard container (R2-11). Runs the SAME state
 * source as the Nexus surface (useProductionLeaderboard) plus arenaStanding
 * for the per-period ranks; everything new is derived at read time by
 * src/lib/fr/leaderboardModel.js. No new reads, no writes.
 * Layout by width: phone < 768 ≤ tablet < 1280 ≤ desktop.
 *
 * @param {{ onOpenTrophies?: Function }} props
 */
const TITLES = {
  WK: "Who's leading this week.",
  MTD: "Who's leading the month.",
  QTD: "Who's leading the quarter.",
  YTD: "Who's leading the year.",
};

export default function FrLeaderboard({ onOpenTrophies }) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
  const lb = useProductionLeaderboard();
  const {
    period, choosePeriod, loading, error, byPeriod, doc, reload, champions,
    role, viewerUid, viewerName, activeField, branchRanking, unitOptions,
    scope, targetUnitId, selectBranch, selectUnit, ranking, leaderApi, scopeCount,
    podium, tail, scopeLabel, aroundMeDesktop, aroundMeMobile, isSlowOrEmpty,
  } = lb;

  const standing = useMemo(() => (doc ? arenaStanding(byPeriod, viewerUid) : null), [doc, byPeriod, viewerUid]);
  const mine = standing?.[activeField] ?? null;
  const status = loading ? 'loading' : error ? 'error' : isSlowOrEmpty ? 'empty' : 'ready';
  const periodWord = (ARENA_PERIODS.find((p) => p.id === activeField)?.label ?? 'this year').toLowerCase();

  let updated = doc?.computedAt ? formatComputedAt(doc.computedAt) : null;
  if (updated && doc?.skippedNoBranch?.count > 0) {
    const n = doc.skippedNoBranch.count;
    updated = `${updated} · ${n} submission${n === 1 ? '' : 's'} skipped (no branch)`;
  }

  return (
    <FrLeaderboardView
      layout={layout}
      status={status}
      errorCode={error?.code}
      onRetry={reload}
      periods={LEADERBOARD_PERIODS}
      period={period}
      onPeriod={choosePeriod}
      scopeControl={(
        <LeaderboardScopeControl
          role={role}
          viewerUid={viewerUid}
          scope={scope}
          targetUnitId={targetUnitId}
          unitOptions={unitOptions}
          onSelectBranch={selectBranch}
          onSelectUnit={selectUnit}
        />
      )}
      scopeLine={`${scopeLabel} · ${period} · ${scopeCount} agent${scopeCount === 1 ? '' : 's'}`}
      title={TITLES[period]}
      periodWord={periodWord}
      champions={championsModel(champions)}
      podium={podium}
      rows={boardRows({ tail, aroundMe: aroundMeDesktop, leaderApi, viewerUid, phone: layout === 'phone' })}
      viewerUid={viewerUid}
      you={{ rank: mine?.rank ?? null, of: mine?.of ?? 0, api: mine?.api ?? 0, movedNote: movedNote(mine) }}
      toPass={toPass(standing, activeField, branchRanking)}
      rankCols={rankColumns(standing, activeField)}
      share={shareOfScope(ranking, viewerUid, scope)}
      updated={updated}
      mobileYouBar={(
        <AroundMeClusterMobile
          state={aroundMeMobile.state}
          rows={aroundMeMobile.rows}
          viewerEntry={aroundMeMobile.viewerEntry}
          totalCount={aroundMeMobile.totalCount}
          gapToNext={aroundMeMobile.gapToNext}
          prevRank={aroundMeMobile.prevRank}
          viewerName={viewerName}
        />
      )}
      onOpenTrophies={onOpenTrophies}
    />
  );
}
