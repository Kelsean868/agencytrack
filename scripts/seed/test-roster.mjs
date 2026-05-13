/**
 * PR-F Test Roster — single source of truth for the 10 test users.
 *
 * Shared by all seeders (generate-users-csv, generate-goals-csv,
 * seed-test-submissions, seed-test-persistency, seed-test-campaign)
 * and both cleanup scripts (preview-test-data-sweep, wipe-test-data-sweep).
 *
 * All emails match *@agencytrack.test — the canonical Auth-side filter for cleanup.
 *
 * Agent distribution (locked in PR-F discovery, 4+3 split):
 *   Unit UM_001 (um-001): agents 001–004
 *   Unit UM_002 (um-002): agents 005–007
 *
 * unitKey is a logical key resolved to a real Firebase UID at seed time.
 * The UID of a unit_manager is their own unitId (per project schema).
 */

export const TENANT_ID  = 'tatillife_south';
export const BRANCH_ID  = 'ljbBHP1g7lbZXvHlpcDn'; // Cyril Murray Branch (confirmed Phase 1)
export const BRANCH_NAME = 'Cyril Murray Branch';

export const EMAIL_SUFFIX = '@agencytrack.test';

export const BRANCH_MANAGER = {
  email:             'bm-001@agencytrack.test',
  name:              'Test BM 001',
  role:              'branch_manager',
  agentNumber:       '',
  contractStartDate: '2026-01-01',
};

export const UNIT_MANAGERS = [
  {
    email:             'um-001@agencytrack.test',
    name:              'Test UM 001',
    role:              'unit_manager',
    agentNumber:       '',
    contractStartDate: '2026-01-01',
    unitKey:           'UM_001',
  },
  {
    email:             'um-002@agencytrack.test',
    name:              'Test UM 002',
    role:              'unit_manager',
    agentNumber:       '',
    contractStartDate: '2026-01-01',
    unitKey:           'UM_002',
  },
];

export const AGENTS = [
  { email: 'agent-001@agencytrack.test', name: 'Test Agent 001', role: 'agent', agentNumber: 'TEST-001', contractStartDate: '2026-01-01', unitKey: 'UM_001' },
  { email: 'agent-002@agencytrack.test', name: 'Test Agent 002', role: 'agent', agentNumber: 'TEST-002', contractStartDate: '2026-01-01', unitKey: 'UM_001' },
  { email: 'agent-003@agencytrack.test', name: 'Test Agent 003', role: 'agent', agentNumber: 'TEST-003', contractStartDate: '2026-01-01', unitKey: 'UM_001' },
  { email: 'agent-004@agencytrack.test', name: 'Test Agent 004', role: 'agent', agentNumber: 'TEST-004', contractStartDate: '2026-01-01', unitKey: 'UM_001' },
  { email: 'agent-005@agencytrack.test', name: 'Test Agent 005', role: 'agent', agentNumber: 'TEST-005', contractStartDate: '2026-01-01', unitKey: 'UM_002' },
  { email: 'agent-006@agencytrack.test', name: 'Test Agent 006', role: 'agent', agentNumber: 'TEST-006', contractStartDate: '2026-01-01', unitKey: 'UM_002' },
  { email: 'agent-007@agencytrack.test', name: 'Test Agent 007', role: 'agent', agentNumber: 'TEST-007', contractStartDate: '2026-01-01', unitKey: 'UM_002' },
];

export const ALL_USERS = [BRANCH_MANAGER, ...UNIT_MANAGERS, ...AGENTS];

// Annual production targets for all 7 test agents.
// Both values are above the tatillife_south company minimums (200 000 API / 42 apps).
export const AGENT_GOALS = {
  annualApiTarget:  250000,
  annualAppsTarget: 52,
};

// Commission rate used when computing estimatedCommissions on seeded submissions.
export const COMMISSION_RATE_PCT = 35; // 35%
