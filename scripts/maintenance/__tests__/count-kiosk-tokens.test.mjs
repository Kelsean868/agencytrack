import { describe, it, expect } from 'vitest';
import { classifyToken, summarize, formatSummary, parseArgs } from '../count-kiosk-tokens.mjs';

// P2e (SEC-04) — the read-only kiosk-token count Kyron runs around the deploy.

const NOW = new Date('2026-09-27T12:00:00Z');
const at = (days) => ({ toDate: () => new Date(NOW.getTime() + days * 86400000) });

describe('classifyToken', () => {
  it('buckets each state', () => {
    expect(classifyToken({ expiresAt: at(10), rolling: true, deviceSecretHash: 'h' }, NOW))
      .toMatchObject({ live: true, paired: true, rolling: true, legacy: false, expired: false, revoked: false });
    expect(classifyToken({ expiresAt: at(200) }, NOW))
      .toMatchObject({ live: true, unpaired: true, legacy: true });
    expect(classifyToken({ expiresAt: at(-1) }, NOW)).toMatchObject({ live: false, expired: true });
    expect(classifyToken({}, NOW)).toMatchObject({ live: false, expired: true }); // no expiry = expired (SEC-03)
    expect(classifyToken({ expiresAt: at(10), revokedAt: at(-1) }, NOW))
      .toMatchObject({ live: false, revoked: true, expired: false });
  });
});

describe('summarize / formatSummary', () => {
  it('counts per tenant / branch and in total', () => {
    const s = summarize([
      { tenantId: 't1', data: { branchId: 'b1', expiresAt: at(10), rolling: true } },
      { tenantId: 't1', data: { branchId: 'b1', expiresAt: at(-3) } },
      { tenantId: 't1', data: { branchId: 'b2', expiresAt: at(10), deviceSecretHash: 'h' } },
    ], NOW);
    expect(s.total).toMatchObject({ all: 3, live: 2, expired: 1, paired: 1, unpaired: 1, rolling: 1, legacy: 1 });
    expect(s.byScope['t1 / b1']).toMatchObject({ all: 2, live: 1, expired: 1 });
    expect(formatSummary(s)).toContain('TOTAL');
  });
});

describe('parseArgs', () => {
  it('takes --tenant only; there is no --apply', () => {
    expect(parseArgs([])).toEqual({ tenant: null });
    expect(parseArgs(['--tenant', 't1'])).toEqual({ tenant: 't1' });
    expect(() => parseArgs(['--apply'])).toThrow(/read-only/);
  });
});
