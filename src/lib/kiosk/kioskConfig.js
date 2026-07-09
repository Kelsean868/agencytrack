export const PANEL_DURATIONS = {
  welcome:           15,
  agentOfMonth:      45,
  branchOverview:    30,
  branchRunningTotals: 30,
  unitLeaderboard:   30,
  lastWeekRecap:     30,
  ytdLeaderboards:   35,
  qtdLeaderboards:   35,
  mtdLeaderboards:   35,
  weekLeaderboards:  35,
  weeklyActivity:    35,
  awardsWatch:       30,
  compliance:        25,
  // Dynamic panels (3.6) — spliced into the rotation only when they have data.
  campaignLeaderboards: 35,
  celebrations:      30,
};
// Total cycle: 410s ≈ 6.8 minutes (base); dynamic panels extend it.

// Short labels for the rotation position/chapter overlay + the (read-only)
// KioskModeTab panel-config surface.
export const PANEL_LABELS = {
  welcome:             'Welcome',
  agentOfMonth:        'Agent of the Month',
  branchOverview:      'Branch Overview',
  branchRunningTotals: 'Running Totals',
  unitLeaderboard:     'Unit Leaderboard',
  lastWeekRecap:       'Last Week Recap',
  ytdLeaderboards:     'YTD Leaderboard',
  qtdLeaderboards:     'Quarter to Date',
  mtdLeaderboards:     'Month to Date',
  weekLeaderboards:    'This Week',
  weeklyActivity:      'Weekly Activity',
  awardsWatch:         'Awards Watch',
  compliance:          'Compliance',
  campaignLeaderboards: 'Campaign',
  celebrations:        'Celebrations',
};

export const PANEL_ORDER = [
  'welcome',
  'agentOfMonth',
  'branchOverview',
  'branchRunningTotals',
  'unitLeaderboard',
  'lastWeekRecap',
  'ytdLeaderboards',
  'qtdLeaderboards',
  'mtdLeaderboards',
  'weekLeaderboards',
  'weeklyActivity',
  'awardsWatch',
  'compliance',
];

export const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// HTTP endpoint for token validation — reads from environment, falls back to
// the deployed project's CF URL.
export const VALIDATE_TOKEN_URL =
  import.meta.env.VITE_VALIDATE_KIOSK_TOKEN_URL ||
  'https://us-central1-agencytrack-2a610.cloudfunctions.net/validateKioskToken';
