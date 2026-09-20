'use strict';

/**
 * Ruling 2 — IDENTITY FROM AUTH ONLY.
 *
 * Every case here is a permission boundary, not a formatting preference: each one
 * is a way for an upload to end up filed under the wrong agent, and a policy filed
 * under the wrong agent looks exactly like a correct one in the ledger.
 */

const { createFakeDb } = require('../testHelpers/fakeFirestore');

// The factory may not close over anything but a `mock`-prefixed binding, so the
// fake is built inside it and the HttpsError class is read back after the mock
// is installed.
jest.mock('firebase-functions/v1', () => require('../testHelpers/fakeFirestore').createFakeFunctions());

const {
  resolveCaller,
  partitionByServicingAgent,
  FORBIDDEN_BODY_FIELDS,
  IMPORT_ROLES,
} = require('../portfolioImport/identity');

const TENANT = 'tatillife_south';
const UID = 'uid-kyron';

function dbWithUser(extra = {}) {
  const db = createFakeDb();
  db._seed(`tenants/${TENANT}/users/${UID}`, {
    agentNumber: '011B94', unitId: 'unit-1', branchId: 'branch-1', name: 'Kyron', ...extra,
  });
  return db;
}
const ctx = (over = {}) => ({
  auth: { uid: UID, token: { role: 'agent', tenantId: TENANT, ...over } },
});

async function code(fn) {
  try { await fn(); return null; } catch (e) { return e.code; }
}

describe('resolveCaller — ruling 2', () => {
  it('resolves identity from the token, never from the body', async () => {
    const caller = await resolveCaller({ fileBase64: 'x' }, ctx(), dbWithUser());
    expect(caller).toMatchObject({
      uid: UID, tenantId: TENANT, agentNumber: '011B94', role: 'agent',
    });
  });

  it.each(FORBIDDEN_BODY_FIELDS)('rejects a body carrying %s with invalid-argument', async (field) => {
    // invalid-argument is what a callable maps to HTTP 400.
    expect(await code(() => resolveCaller({ [field]: 'anything' }, ctx(), dbWithUser())))
      .toBe('invalid-argument');
  });

  it('names every offending field, so a caller fixes them in one go', async () => {
    try {
      await resolveCaller({ uid: 'a', tenantId: 'b' }, ctx(), dbWithUser());
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.message).toContain('uid');
      expect(e.message).toContain('tenantId');
    }
  });

  it('rejects a body field even when it matches the caller', async () => {
    // Honouring a matching value would make the field look supported, and the
    // next caller would send a non-matching one.
    expect(await code(() => resolveCaller({ uid: UID }, ctx(), dbWithUser())))
      .toBe('invalid-argument');
  });

  it('refuses an unsigned caller', async () => {
    expect(await code(() => resolveCaller({}, {}, dbWithUser()))).toBe('unauthenticated');
  });

  it.each(['sales_manager', 'tenant_admin', 'platform_admin', 'kiosk', undefined])(
    'refuses role %s — only an agent or producing manager imports', async (role) => {
      expect(await code(() => resolveCaller({}, ctx({ role }), dbWithUser())))
        .toBe('permission-denied');
    },
  );

  it.each(IMPORT_ROLES)('allows role %s', async (role) => {
    const caller = await resolveCaller({}, ctx({ role }), dbWithUser());
    expect(caller.role).toBe(role);
  });

  it('refuses when the profile has no agent number', async () => {
    // Without it, every policy in the file would look like this agent's.
    const db = createFakeDb();
    db._seed(`tenants/${TENANT}/users/${UID}`, { name: 'Kyron' });
    expect(await code(() => resolveCaller({}, ctx(), db))).toBe('failed-precondition');
  });

  it('refuses when the token carries no tenant', async () => {
    expect(await code(() => resolveCaller({}, ctx({ tenantId: undefined }), dbWithUser())))
      .toBe('failed-precondition');
  });

  it('refuses when the user doc is missing', async () => {
    expect(await code(() => resolveCaller({}, ctx(), createFakeDb()))).toBe('not-found');
  });
});

describe('partitionByServicingAgent — ruling 2', () => {
  const doc = (policyNumber, servicingAgentNumber) => ({ policyNumber, servicingAgentNumber });

  it('keeps only the policies this agent services', () => {
    const r = partitionByServicingAgent(
      [doc('A1', '011B94'), doc('B1', '099Z00'), doc('C1', '011B94')],
      '011B94',
    );
    expect(r.mine.map((d) => d.policyNumber)).toEqual(['A1', 'C1']);
    expect(r.skippedNotYours).toBe(1);
    expect(r.skippedNotYoursNumbers).toEqual(['B1']);
  });

  it('skips a policy with no servicing number rather than claiming it', () => {
    const r = partitionByServicingAgent([doc('A1', null)], '011B94');
    expect(r.mine).toEqual([]);
    expect(r.skippedNotYours).toBe(1);
  });

  it('matches exactly — no case folding, no trimming', () => {
    // OIPA agent numbers are exact identifiers. A fuzzy match here would let
    // ' 011b94 ' claim another agent's book.
    const r = partitionByServicingAgent(
      [doc('A1', '011b94'), doc('B1', ' 011B94'), doc('C1', '011B94')],
      '011B94',
    );
    expect(r.mine.map((d) => d.policyNumber)).toEqual(['C1']);
    expect(r.skippedNotYours).toBe(2);
  });

  it('reports numbers only, never the names on another agent clients', () => {
    const r = partitionByServicingAgent(
      [{ policyNumber: 'B1', servicingAgentNumber: '099Z00', ownerName: 'SOMEONE ELSE' }],
      '011B94',
    );
    expect(JSON.stringify(r.skippedNotYoursNumbers)).not.toContain('SOMEONE');
  });
});
