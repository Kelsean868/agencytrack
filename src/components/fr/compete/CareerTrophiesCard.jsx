import React, { useMemo } from 'react';
import { trophyRoom } from '../../../lib/fr/competeModel';
import useMyLeaderboardEntry from './useMyLeaderboardEntry';
import CareerTrophiesCardView from './CareerTrophiesCardView';

/**
 * Container for the Career "Your badges and trophies" card (R2-5, ruling R-c).
 * The count is `trophyRoom(entry)` over the SAME engine doc the Trophy room
 * reads (`leaderboard/{uid}`) — never the client `computeEarnedBadges`.
 */

export default function CareerTrophiesCard({ tenantId, uid, onOpen }) {
  const { loading, error, entry, retry } = useMyLeaderboardEntry(tenantId, uid);
  const room = useMemo(() => (loading || error ? null : trophyRoom(entry)), [loading, error, entry]);
  return <CareerTrophiesCardView room={room} loading={loading} error={error} onRetry={retry} onOpen={onOpen} />;
}
