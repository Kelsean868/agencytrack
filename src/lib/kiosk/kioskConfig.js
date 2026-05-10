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
};
// Total cycle: 410s ≈ 6.8 minutes

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
