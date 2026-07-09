import React from 'react';
import RankedLeaderboardPanel from './RankedLeaderboardPanel';

export default function YTDLeaderboardsPanel(props) {
  return <RankedLeaderboardPanel {...props} period="ytd" />;
}
