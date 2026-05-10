import React from 'react';
import PeriodLeaderboardsPanel from './PeriodLeaderboardsPanel';

export default function YTDLeaderboardsPanel(props) {
  return <PeriodLeaderboardsPanel {...props} period="ytd" periodLabel="YTD" />;
}
