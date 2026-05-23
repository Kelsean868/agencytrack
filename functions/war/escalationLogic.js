'use strict';

// Mirrors src/utils/accountabilityFlag.js — sync if either changes

const NUMERIC_STANDARDS = [
  'jfwCount',
  'oneOnOnesConducted',
  'namesSourced',
  'interviewsConducted',
  'recruitsInFirstWeeks',
  'trainingSessions',
];

const BOOLEAN_STANDARDS = ['unitMeetingHeld', 'dashboardReviewDone'];

const STANDARD_LABELS = {
  jfwCount:             'Joint Field Work (JFW)',
  oneOnOnesConducted:   'One-on-One Pipeline Reviews',
  namesSourced:         'Names Sourced',
  interviewsConducted:  'Initial Interviews Conducted',
  recruitsInFirstWeeks: 'New Recruits in First Weeks',
  trainingSessions:     'Training Sessions Delivered',
  unitMeetingHeld:      'Unit / Branch Meeting Held',
  dashboardReviewDone:  'Planning & Dashboard Review Done',
};

/**
 * Merge org-default + per-manager override into a flat resolved-standards map.
 *
 * @param {object|null} orgDefault  full config/managerActivityStandards doc
 *                                  ({ unit_manager: {...}, branch_manager: {...}, ... })
 * @param {object|null} override    managerActivityStandardOverrides/{managerId} doc data
 *                                  (flat activity-key map; may include metadata fields)
 * @param {string}      role        'unit_manager' | 'branch_manager' | 'sales_manager'
 * @returns {object}  flat map { activityKey: value }; override ?? orgDefault[role]
 */
function resolveStandards(orgDefault, override, role) {
  const base = (orgDefault && orgDefault[role]) ? { ...orgDefault[role] } : {};
  if (!override) return base;
  const allKeys = [...NUMERIC_STANDARDS, ...BOOLEAN_STANDARDS];
  for (const key of allKeys) {
    const val = override[key];
    if (val !== undefined && val !== null) {
      base[key] = val;
    }
  }
  return base;
}

function hasNumericTarget(target) {
  if (target == null) return false;
  const n = Number(target);
  return Number.isFinite(n) && n > 0;
}

/**
 * Compute the list of activities the WAR is under target on.
 * Port of computeMissedActivities in src/utils/accountabilityFlag.js.
 *
 * @param {object} war      WAR doc data at the root level
 * @param {object} resolved resolveStandards() output
 * @returns {Array<{ key, label, actual, target, type }>}
 */
function computeMissed(war, resolved) {
  if (!war || !resolved) return [];
  const missed = [];

  for (const key of NUMERIC_STANDARDS) {
    const target = resolved[key];
    if (!hasNumericTarget(target)) continue;
    const raw = war[key];
    const actual = raw == null ? 0 : Number(raw);
    if (!Number.isFinite(actual)) continue;
    if (actual < Number(target)) {
      missed.push({ key, label: STANDARD_LABELS[key] ?? key, actual, target: Number(target), type: 'numeric' });
    }
  }

  for (const key of BOOLEAN_STANDARDS) {
    const expected = resolved[key];
    if (expected !== true) continue;
    const actual = war[key] === true;
    if (!actual) {
      missed.push({ key, label: STANDARD_LABELS[key] ?? key, actual: false, target: true, type: 'boolean' });
    }
  }

  return missed;
}

/**
 * Pure upline-resolution: given a manager's role and the tenant's user list,
 * return the subset of users who should receive an escalation notification.
 *
 * Locked topology (uniform — no per-manager exceptions):
 *   unit_manager   → all branch_managers in the same branchId
 *   branch_manager → all sales_managers in the tenant
 *   sales_manager  → [] (chain stops)
 *
 * The CF handler mirrors this logic via Firestore queries; this export exists
 * for pure-unit testing without database calls.
 *
 * @param {object}   args
 * @param {string}   args.role       offending manager's role
 * @param {string}   [args.branchId] required when role === 'unit_manager'
 * @param {Array}    args.users      flat array of user objects with { role, branchId }
 * @returns {Array}  user objects who are the upline recipients
 */
function resolveUplineRecipients({ role, branchId, users }) {
  if (!users || users.length === 0) return [];
  if (role === 'unit_manager') {
    return users.filter(u => u.role === 'branch_manager' && u.branchId === branchId);
  }
  if (role === 'branch_manager') {
    return users.filter(u => u.role === 'sales_manager');
  }
  return []; // sales_manager → chain stops
}

module.exports = { resolveStandards, computeMissed, resolveUplineRecipients };
