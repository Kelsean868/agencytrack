export const PANEL_DURATIONS = {
  branchOverview:   30, // seconds
  unitLeaderboard:  35,
  agentLeaderboard: 50, // longer — all agents
  runningTotals:    35,
  lastWeekRecap:    30,
  awardsWatch:      30,
  compliance:       25,
  welcome:          15, // shortest — resting state
};

// Total cycle: 250s ≈ 4.2 minutes
export const PANEL_ORDER = [
  'branchOverview',
  'unitLeaderboard',
  'agentLeaderboard',
  'runningTotals',
  'lastWeekRecap',
  'awardsWatch',
  'compliance',
  'welcome',
];

export const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// HTTP endpoint for token validation — reads from environment, falls back to
// the deployed project's CF URL.
export const VALIDATE_TOKEN_URL =
  import.meta.env.VITE_VALIDATE_KIOSK_TOKEN_URL ||
  'https://us-central1-agencytrack-2a610.cloudfunctions.net/validateKioskToken';
