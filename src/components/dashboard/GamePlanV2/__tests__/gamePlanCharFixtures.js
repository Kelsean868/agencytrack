/**
 * Shared fixtures for the Game plan characterization suite (R2-8) and the FR
 * parity suite that follows it. Kept in their own module so BOTH suites read
 * the exact same inputs: the characterization suite pins today's outputs, the
 * FR suite proves the FR look shows the same figures and makes the same calls.
 *
 * All figures are SAMPLE values chosen so each derivation is non-trivial
 * (a disabled line, an uneven month split, a ratio history of 10 weeks).
 */

export const TENANT = 'test-tenant';
export const UID = 'agent-1';
export const YEAR = 2026;
// Wednesday 23-09-2026 (currentMonthIndex 8); this week's Sunday is 20-09-2026.
export const NOW = new Date(2026, 8, 23, 10, 0, 0);
export const WEEK_START = '2026-09-20';

// Money Needs worksheet — commission need = 225,280 − 25,280 = 200,000.
export const WORKSHEET = {
  totalAnnualAfterTax: 191460,
  totalAnnualPreTax: 225280,
  estimatedRenewalIncome: { total: 25280 },
};

// Year plan — General is disabled, so the planned total is Life + A&H only.
export const YEAR_PLAN = {
  lines: {
    life: { enabled: true, targetAPI: 400000 },
    ah: { enabled: true, targetAPI: 150000 },
    general: { enabled: false, targetAPI: 50000 },
  },
};

// Monthly plan — Σ targets === anchorAPI (550,000), uneven shape.
export const MONTHLY_TARGETS = [
  30000, 30000, 35000, 40000, 45000, 45000, 45000, 50000, 55000, 60000, 60000, 55000,
];
export const MONTHLY_DRAFT = { anchorAPI: 550000, targets: MONTHLY_TARGETS, status: 'draft' };
export const MONTHLY_COMMITTED = {
  anchorAPI: 550000,
  targets: MONTHLY_TARGETS,
  status: 'committed',
  committedAt: new Date(Date.UTC(2026, 8, 1, 16, 0, 0)), // 01-09-2026 12:00 TT
};

// Ten submitted weeks in 2026 (≥ 8 → ratios derive from history).
// Σ CI = 30, Σ apps = 10 → CI:sale 3; Σ dials = 600 → dials:CI 20.
export const SUBMISSIONS = [
  '2026-07-12', '2026-07-19', '2026-07-26', '2026-08-02', '2026-08-09',
  '2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06', '2026-09-13',
].map((weekStarting, i) => ({
  id: `sub-${i}`,
  status: 'submitted',
  weekStarting,
  ciConducted: 3,
  applicationsSold: 1,
  referralCalls: 20,
  coldCalls: 40,
  totalProductionCredit: 10000 + i * 1000,
}));

// Three submitted weeks only — below the 8-week history bar → floor mode.
export const THIN_SUBMISSIONS = SUBMISSIONS.slice(0, 3);

export const FLOORS = {
  callsMade: 40,
  telContacts: 40,
  factFindsCompleted: 10,
  closingInterviewsKept: 10,
  applicationsSubmitted: 1,
};

export const COMMITTED_WEEKLY_PLAN = {
  targets: {
    callsMade: 80,
    telContacts: 40,
    factFindsCompleted: 10,
    closingInterviewsKept: 12,
    applicationsSubmitted: 3,
  },
  provenance: {
    callsMade: 'derived',
    telContacts: 'floor',
    factFindsCompleted: 'floor',
    closingInterviewsKept: 'derived',
    applicationsSubmitted: 'agent',
  },
  anchorAPIAtCommit: 550000,
  committedAt: { toDate: () => new Date(2026, 8, 20, 9, 0, 0) },
};

export const SUGGESTIONS = [
  {
    id: 'sg-1',
    status: 'open',
    note: 'Try a few more whole life reviews this quarter.',
    raisedByName: 'Unit Manager A',
    raisedByRole: 'unit_manager',
    createdAt: { toDate: () => new Date(2026, 8, 18, 9, 0, 0) },
  },
  {
    id: 'sg-2',
    status: 'seen',
    note: 'Good split across the lines.',
    raisedByName: 'Branch Manager B',
    raisedByRole: 'branch_manager',
    createdAt: { toDate: () => new Date(2026, 7, 30, 9, 0, 0) },
  },
];

/** The hub props AgentDashboard passes, for the in-progress fixture. */
export function hubProps(overrides = {}) {
  return {
    committedAnnualAPI: 550000,
    avgPolicyAPI: 15000,
    prospectRatio: 3,
    submissions: SUBMISSIONS,
    weeklyActivityFloors: FLOORS,
    dataLoading: false,
    dataError: false,
    ...overrides,
  };
}
