import React from 'react';
import PeriodLeaderboardsPanel from './PeriodLeaderboardsPanel';

export default function MTDLeaderboardsPanel(props) {
  return <PeriodLeaderboardsPanel {...props} period="mtd" periodLabel="MTD" />;
}
