import React from 'react';
import RankedLeaderboardPanel from './RankedLeaderboardPanel';

export default function QTDLeaderboardsPanel(props) {
  return <RankedLeaderboardPanel {...props} period="quarter" />;
}
