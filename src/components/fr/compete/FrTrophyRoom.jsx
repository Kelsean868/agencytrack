import React, { useMemo } from 'react';
import { trophyRoom } from '../../../lib/fr/competeModel';
import useMyLeaderboardEntry from './useMyLeaderboardEntry';
import FrTrophyRoomView from './FrTrophyRoomView';

/** CONTAINER for the Trophy room (FR-5): the engine doc → trophyRoom → view. No writes. */
export default function FrTrophyRoom({ tenantId, uid }) {
  const { loading, error, entry, retry } = useMyLeaderboardEntry(tenantId, uid);
  const room = useMemo(() => (loading || error ? null : trophyRoom(entry)), [loading, error, entry]);
  return <FrTrophyRoomView room={room} loading={loading} error={error} onRetry={retry} />;
}
