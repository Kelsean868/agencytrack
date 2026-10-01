import React, { useMemo, useState } from 'react';
import useMinWidth from '../../../hooks/useMinWidth';
import useProductionLeaderboard, { LEADERBOARD_PERIODS, formatComputedAt } from '../../../hooks/useProductionLeaderboard';
import LeaderboardScopeControl from '../../leaderboard/LeaderboardScopeControl';
import { AroundMeClusterMobile } from '../../leaderboard/AroundMeCluster';
import { ARENA_PERIODS } from '../../../lib/fr/competeModel';
import { championsModel, boardView } from '../../../lib/fr/leaderboardModel';
import { BOARD_ORDER, DEFAULT_BOARD, LEADERBOARD_BOARDS } from '../../../lib/fr/leaderboardBoards';
import FrLeaderboardView from './FrLeaderboardView';

/**
 * FrLeaderboard — the FR Leaderboard container (R2-11; three boards in FR
 * Leaderboard L-2). Runs the SAME state source as the Nexus surface
 * (useProductionLeaderboard) for the period, scope, aggregate and champions;
 * the board view (ranks, podium, rows, standing, share) is derived for the
 * chosen board by src/lib/fr/leaderboardModel.js `boardView`. No new reads,
 * no writes. Layout by width: phone < 768 ≤ tablet < 1280 ≤ desktop.
 *
 * The board opens on Activity every visit and is NOT persisted (brief D10).
 *
 * @param {{ onOpenTrophies?: Function }} props
 */
const BOARDS = BOARD_ORDER.map((id) => ({ id, label: LEADERBOARD_BOARDS[id].label }));

export default function FrLeaderboard({ onOpenTrophies }) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
  const [board, setBoard] = useState(DEFAULT_BOARD);
  const lb = useProductionLeaderboard();
  const {
    period, choosePeriod, loading, error, byPeriod, doc, reload, champions,
    role, viewerUid, viewerName, activeField, unitOptions,
    scope, targetUnitId, selectBranch, selectUnit, scopeLabel,
  } = lb;

  const view = useMemo(
    () => boardView({ byPeriod, activeField, board, scope, targetUnitId, viewerUid, phone: layout === 'phone' }),
    [byPeriod, activeField, board, scope, targetUnitId, viewerUid, layout],
  );
  const { config } = view;
  const status = loading ? 'loading' : error ? 'error' : view.isEmpty ? 'empty' : 'ready';
  const periodWord = (ARENA_PERIODS.find((p) => p.id === activeField)?.label ?? 'this year').toLowerCase();

  let updated = doc?.computedAt ? formatComputedAt(doc.computedAt) : null;
  if (updated && config.showsSkippedReports && doc?.skippedNoBranch?.count > 0) {
    const n = doc.skippedNoBranch.count;
    updated = `${updated} · ${n} submission${n === 1 ? '' : 's'} skipped (no branch)`;
  }

  return (
    <FrLeaderboardView
      layout={layout}
      status={status}
      errorCode={error?.code}
      onRetry={reload}
      boards={BOARDS}
      board={board}
      onBoard={setBoard}
      boardConfig={config}
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
      scopeLine={`${scopeLabel} · ${period} · ${view.count} agent${view.count === 1 ? '' : 's'}`}
      title={config.title(periodWord)}
      periodWord={periodWord}
      champions={championsModel(champions)}
      podium={view.podium}
      rows={view.rows}
      viewerUid={viewerUid}
      you={view.you}
      toPass={view.toPass}
      rankCols={view.rankCols}
      share={view.share}
      scope={scope}
      updated={updated}
      mobileYouBar={(
        <AroundMeClusterMobile
          state={view.aroundMeMobile.state}
          rows={view.aroundMeMobile.rows}
          viewerEntry={view.aroundMeMobile.viewerEntry}
          totalCount={view.aroundMeMobile.totalCount}
          gapToNext={view.aroundMeMobile.gapToNext}
          prevRank={view.aroundMeMobile.prevRank}
          viewerName={viewerName}
          valueFor={(e) => e?.[config.metric] ?? 0}
          formatValue={config.format}
        />
      )}
      onOpenTrophies={onOpenTrophies}
      // The standing comes from arenaStanding (branch-wide); say so when the
      // board shows a unit (CodeRabbit on #1025).
      branchWide={scope === 'unit'}
    />
  );
}
