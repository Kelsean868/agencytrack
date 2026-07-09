import React from 'react';
import RankedLeaderboardPanel from './RankedLeaderboardPanel';

export default function MTDLeaderboardsPanel(props) {
  return <RankedLeaderboardPanel {...props} period="mtd" />;
}
