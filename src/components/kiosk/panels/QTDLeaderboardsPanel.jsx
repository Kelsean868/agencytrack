import React from 'react';
import PeriodLeaderboardsPanel from './PeriodLeaderboardsPanel';

export default function QTDLeaderboardsPanel(props) {
  return <PeriodLeaderboardsPanel {...props} period="quarter" periodLabel="QTD" />;
}
