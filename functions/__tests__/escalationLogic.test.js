'use strict';

const {
  resolveStandards,
  computeMissed,
  resolveUplineRecipients,
} = require('../war/escalationLogic');

// ── resolveStandards ──────────────────────────────────────────────────────────

describe('resolveStandards', () => {
  const orgDefault = {
    unit_manager:   { jfwCount: 2, oneOnOnesConducted: 4, unitMeetingHeld: true },
    branch_manager: { jfwCount: 3, unitMeetingHeld: true },
    sales_manager:  { jfwCount: 1 },
  };

  test('returns org-default values when no override', () => {
    const result = resolveStandards(orgDefault, null, 'unit_manager');
    expect(result.jfwCount).toBe(2);
    expect(result.oneOnOnesConducted).toBe(4);
    expect(result.unitMeetingHeld).toBe(true);
  });

  test('override values take precedence over org-default', () => {
    const override = { jfwCount: 5 };
    const result = resolveStandards(orgDefault, override, 'unit_manager');
    expect(result.jfwCount).toBe(5);
    expect(result.oneOnOnesConducted).toBe(4); // falls back to org-default
  });

  test('ignores metadata fields on override doc (tenantId, managerId, etc.)', () => {
    const override = { jfwCount: 5, tenantId: 'tatillife_south', managerId: 'mgr1' };
    const result = resolveStandards(orgDefault, override, 'unit_manager');
    expect(result.jfwCount).toBe(5);
    expect(result.tenantId).toBeUndefined();
    expect(result.managerId).toBeUndefined();
  });

  test('returns empty object when orgDefault has no entry for role', () => {
    const result = resolveStandards({}, null, 'unit_manager');
    expect(result).toEqual({});
  });

  test('returns empty object when orgDefault is null', () => {
    const result = resolveStandards(null, null, 'unit_manager');
    expect(result).toEqual({});
  });
});

// ── computeMissed ─────────────────────────────────────────────────────────────

describe('computeMissed', () => {
  test('flags numeric activity below target', () => {
    const war      = { jfwCount: 1, oneOnOnesConducted: 0 };
    const resolved = { jfwCount: 3, oneOnOnesConducted: 2 };
    const missed   = computeMissed(war, resolved);
    expect(missed).toHaveLength(2);
    expect(missed[0]).toMatchObject({ key: 'jfwCount', actual: 1, target: 3, type: 'numeric' });
    expect(missed[1]).toMatchObject({ key: 'oneOnOnesConducted', actual: 0, target: 2, type: 'numeric' });
  });

  test('does not flag numeric activity when actual >= target (met)', () => {
    const war      = { jfwCount: 3, oneOnOnesConducted: 5 };
    const resolved = { jfwCount: 3, oneOnOnesConducted: 4 };
    expect(computeMissed(war, resolved)).toHaveLength(0);
  });

  test('does not flag numeric activity when no target set (0 or missing)', () => {
    const war      = { jfwCount: 0 };
    const resolved = { jfwCount: 0 };    // zero = no target
    expect(computeMissed(war, resolved)).toHaveLength(0);
  });

  test('treats missing war field as 0 for numeric', () => {
    const war      = {};                  // jfwCount absent
    const resolved = { jfwCount: 2 };
    const missed   = computeMissed(war, resolved);
    expect(missed).toHaveLength(1);
    expect(missed[0].actual).toBe(0);
  });

  test('flags boolean expectation when not met', () => {
    const war      = { unitMeetingHeld: false };
    const resolved = { unitMeetingHeld: true };
    const missed   = computeMissed(war, resolved);
    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({ key: 'unitMeetingHeld', actual: false, target: true, type: 'boolean' });
  });

  test('does not flag boolean when expectation not set', () => {
    const war      = { unitMeetingHeld: false };
    const resolved = {};                  // no boolean expectation
    expect(computeMissed(war, resolved)).toHaveLength(0);
  });

  test('returns empty for null war or null resolved', () => {
    expect(computeMissed(null, {})).toHaveLength(0);
    expect(computeMissed({}, null)).toHaveLength(0);
  });
});

// ── resolveUplineRecipients ───────────────────────────────────────────────────

describe('resolveUplineRecipients', () => {
  const users = [
    { id: 'bm1', role: 'branch_manager', branchId: 'south' },
    { id: 'bm2', role: 'branch_manager', branchId: 'south' },
    { id: 'bm3', role: 'branch_manager', branchId: 'north' },
    { id: 'sm1', role: 'sales_manager' },
    { id: 'sm2', role: 'sales_manager' },
    { id: 'um1', role: 'unit_manager',   branchId: 'south' },
  ];

  test('unit_manager → all branch_managers in the same branchId (multiple)', () => {
    const result = resolveUplineRecipients({ role: 'unit_manager', branchId: 'south', users });
    expect(result.map(u => u.id)).toEqual(['bm1', 'bm2']);
  });

  test('unit_manager → excludes branch_managers in other branches', () => {
    const result = resolveUplineRecipients({ role: 'unit_manager', branchId: 'south', users });
    expect(result.find(u => u.id === 'bm3')).toBeUndefined();
  });

  test('branch_manager → all sales_managers in the tenant (notify ALL)', () => {
    const result = resolveUplineRecipients({ role: 'branch_manager', branchId: 'south', users });
    expect(result.map(u => u.id)).toEqual(['sm1', 'sm2']);
  });

  test('branch_manager (BM-as-offender) → SMs only, not other BMs or UMs', () => {
    const result = resolveUplineRecipients({ role: 'branch_manager', users });
    const ids = result.map(u => u.id);
    expect(ids).toContain('sm1');
    expect(ids).toContain('sm2');
    expect(ids).not.toContain('bm1');
    expect(ids).not.toContain('um1');
  });

  test('sales_manager → [] (chain stops)', () => {
    const result = resolveUplineRecipients({ role: 'sales_manager', users });
    expect(result).toHaveLength(0);
  });

  test('returns [] when users list is empty', () => {
    const result = resolveUplineRecipients({ role: 'unit_manager', branchId: 'south', users: [] });
    expect(result).toHaveLength(0);
  });
});
