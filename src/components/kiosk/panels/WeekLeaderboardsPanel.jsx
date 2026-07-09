import React from 'react';
import RankedLeaderboardPanel from './RankedLeaderboardPanel';

export default function WeekLeaderboardsPanel(props) {
  return <RankedLeaderboardPanel {...props} period="week" />;
}
