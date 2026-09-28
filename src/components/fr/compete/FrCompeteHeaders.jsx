import React, { useMemo } from 'react';
import useLeaderboard from '../../../hooks/useLeaderboard';
import { arenaStanding, meTiles, trophyRoom } from '../../../lib/fr/competeModel';
import useMyLeaderboardEntry from './useMyLeaderboardEntry';
import { FrArenaHeaderView, FrMeHeaderView } from './FrCompeteHeaderViews';

/**
 * CONTAINERS for the Arena and Me FR headers (FR-5). Reads only what the
 * screens below already read: the branch board aggregate (useLeaderboard, as
 * the Leaderboard screen) and the agent's own points doc (as MyPointsCard).
 * No writes.
 */
export function FrArenaHeader({ uid }) {
  const { loading, error, byPeriod, doc } = useLeaderboard();
  const standing = useMemo(() => (doc ? arenaStanding(byPeriod, uid) : null), [doc, byPeriod, uid]);
  return <FrArenaHeaderView standing={standing} loading={loading} error={Boolean(error)} />;
}

export function FrMeHeader({ tenantId, uid, onOpenTrophies }) {
  const { loading, error, entry } = useMyLeaderboardEntry(tenantId, uid);
  const tiles = useMemo(() => {
    if (loading || error) return meTiles(trophyRoom(null)).map((t) => ({ ...t, value: null, note: null }));
    return meTiles(trophyRoom(entry));
  }, [loading, error, entry]);
  return <FrMeHeaderView tiles={tiles} loading={loading} error={error} onOpenTrophies={onOpenTrophies} />;
}
