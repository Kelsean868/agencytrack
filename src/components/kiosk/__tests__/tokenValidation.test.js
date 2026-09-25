import { describe, it, expect } from 'vitest';
import { validateTokenData } from '../../../lib/kiosk/utils.js';

const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 1000);

function makeToken(overrides = {}) {
  return {
    tokenId: 'abc'.repeat(21).slice(0, 64),
    tenantId: 'tenant_a',
    branchId: 'branch_south',
    revokedAt: null,
    expiresAt: { toDate: () => FUTURE },
    ...overrides,
  };
}

describe('validateTokenData', () => {
  it('returns valid for a good token', () => {
    const result = validateTokenData(makeToken(), 'tenant_a');
    expect(result.valid).toBe(true);
    expect(result.tenantId).toBe('tenant_a');
    expect(result.branchId).toBe('branch_south');
  });

  it('returns invalid when data is null (token not found)', () => {
    const result = validateTokenData(null, 'tenant_a');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid');
  });

  it('cross-tenant: token for tenant_a rejected when queried as tenant_b', () => {
    const result = validateTokenData(makeToken({ tenantId: 'tenant_a' }), 'tenant_b');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid');
  });

  it('returns revoked when revokedAt is set', () => {
    const result = validateTokenData(makeToken({ revokedAt: new Date() }), 'tenant_a');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('revoked');
  });

  it('returns expired when expiresAt is in the past', () => {
    const result = validateTokenData(
      makeToken({ expiresAt: { toDate: () => PAST } }),
      'tenant_a',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('expired check works with plain Date expiresAt (non-Firestore Timestamp)', () => {
    const result = validateTokenData(
      makeToken({ expiresAt: PAST }),
      'tenant_a',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  // SEC-03 (audit 2026-09-24): a token with no expiresAt used to be valid
  // forever. It is now invalid and must be re-minted.
  it('returns expired when expiresAt is missing', () => {
    const { expiresAt: _expiresAt, ...noExpiry } = makeToken();
    const result = validateTokenData(noExpiry, 'tenant_a');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('returns expired when expiresAt is unparseable', () => {
    const result = validateTokenData(makeToken({ expiresAt: 'not a date' }), 'tenant_a');
    expect(result.valid).toBe(false);
  });

  it('accepts injectable `now` for deterministic expiry testing', () => {
    const expiresAt = new Date('2026-06-01T00:00:00Z');
    const token = makeToken({ expiresAt: { toDate: () => expiresAt } });
    // Just before expiry → valid
    expect(validateTokenData(token, 'tenant_a', new Date('2026-05-31T23:59:59Z')).valid).toBe(true);
    // At expiry → invalid
    expect(validateTokenData(token, 'tenant_a', new Date('2026-06-01T00:00:01Z')).valid).toBe(false);
  });
});
