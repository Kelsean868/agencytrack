import React from 'react';
import PeriodLeaderboardsPanel from './PeriodLeaderboardsPanel';

export default function WeekLeaderboardsPanel(props) {
  return <PeriodLeaderboardsPanel {...props} period="week" periodLabel="This Week" />;
}
