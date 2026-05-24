import { describe, it, expect } from 'vitest';
import { isProvisional, cbttEffectiveDeadline, cbttComplianceFlag } from '../cbttCompliance';

// ── isProvisional ─────────────────────────────────────────────────────────────

describe('isProvisional', () => {
  it('returns true when licenseStatus is "provisional"', () => {
    expect(isProvisional({ licenseStatus: 'provisional' })).toBe(true);
  });

  it('returns false when licenseStatus is "official"', () => {
    expect(isProvisional({ licenseStatus: 'official' })).toBe(false);
  });

  it('returns false when licenseStatus is missing (not tracked)', () => {
    expect(isProvisional({})).toBe(false);
    expect(isProvisional({ licenseStatus: undefined })).toBe(false);
  });

  it('returns false for null/undefined user', () => {
    expect(isProvisional(null)).toBe(false);
    expect(isProvisional(undefined)).toBe(false);
  });
});

// ── cbttEffectiveDeadline ─────────────────────────────────────────────────────

describe('cbttEffectiveDeadline', () => {
  it('returns null when contractStartDate is missing', () => {
    expect(cbttEffectiveDeadline({})).toBeNull();
    expect(cbttEffectiveDeadline({ contractStartDate: '' })).toBeNull();
    expect(cbttEffectiveDeadline(null)).toBeNull();
  });

  it('adds 12 months when cbttExtensionGranted is false/missing', () => {
    const deadline = cbttEffectiveDeadline({ contractStartDate: '2025-01-15' });
    expect(deadline).not.toBeNull();
    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(0); // January
    expect(deadline.getDate()).toBe(15);
  });

  it('adds 24 months when cbttExtensionGranted is true', () => {
    const deadline = cbttEffectiveDeadline({
      contractStartDate: '2025-01-15',
      cbttExtensionGranted: true,
    });
    expect(deadline).not.toBeNull();
    expect(deadline.getFullYear()).toBe(2027);
    expect(deadline.getMonth()).toBe(0); // January
    expect(deadline.getDate()).toBe(15);
  });

  it('clamps day correctly for end-of-month (Jan 31 + 1 month = Feb 28)', () => {
    const deadline = cbttEffectiveDeadline({ contractStartDate: '2025-01-31' });
    // Jan 31 + 12 months = Jan 31 2026 (same day, no overflow)
    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(0);
    expect(deadline.getDate()).toBe(31);
  });
});

// ── cbttComplianceFlag ────────────────────────────────────────────────────────

describe('cbttComplianceFlag', () => {
  it('returns null for official agents', () => {
    const user = { licenseStatus: 'official', contractStartDate: '2024-01-01' };
    expect(cbttComplianceFlag(user)).toBeNull();
  });

  it('returns null for agents without licenseStatus (not tracked)', () => {
    const user = { contractStartDate: '2024-01-01' };
    expect(cbttComplianceFlag(user)).toBeNull();
  });

  it('returns null when contractStartDate is missing (no deadline can be derived)', () => {
    const user = { licenseStatus: 'provisional' };
    expect(cbttComplianceFlag(user)).toBeNull();
  });

  it('returns flag with correct shape for tracked provisional agent', () => {
    // Contract start 6 months ago; 12-month window → 6 months remaining → not at-risk
    const today = new Date('2026-06-01');
    const user = { licenseStatus: 'provisional', contractStartDate: '2025-12-01' };
    const flag = cbttComplianceFlag(user, today);
    expect(flag).not.toBeNull();
    expect(flag.atRisk).toBe(false);
    expect(flag.extended).toBe(false);
    expect(flag.daysRemaining).toBeGreaterThan(90);
  });

  it('sets atRisk=true when daysRemaining <= 90', () => {
    // Deadline = contractStart + 12 months. Set today to 60 days before deadline.
    const contractStart = '2025-01-01';
    const deadline = new Date('2026-01-01T12:00:00'); // 12 months later
    const today = new Date(deadline);
    today.setDate(today.getDate() - 60); // 60 days before deadline
    const user = { licenseStatus: 'provisional', contractStartDate: contractStart };
    const flag = cbttComplianceFlag(user, today);
    expect(flag.atRisk).toBe(true);
    expect(flag.daysRemaining).toBeLessThanOrEqual(90);
  });

  it('sets atRisk=false when extension moves deadline beyond 90 days', () => {
    // Without extension: 60 days remaining → atRisk
    // With extension: adds 12 months → well beyond 90 days → not atRisk
    const contractStart = '2025-01-01';
    const deadline12 = new Date('2026-01-01T12:00:00');
    const today = new Date(deadline12);
    today.setDate(today.getDate() - 60);

    const userWithExtension = {
      licenseStatus: 'provisional',
      contractStartDate: contractStart,
      cbttExtensionGranted: true,
    };
    const flag = cbttComplianceFlag(userWithExtension, today);
    expect(flag.atRisk).toBe(false);
    expect(flag.extended).toBe(true);
    expect(flag.daysRemaining).toBeGreaterThan(90);
  });

  it('boundary: exactly 90 days remaining is at-risk', () => {
    const contractStart = '2025-01-01';
    const deadline = new Date('2026-01-01T12:00:00');
    const today = new Date(deadline);
    today.setDate(today.getDate() - 90);
    const user = { licenseStatus: 'provisional', contractStartDate: contractStart };
    const flag = cbttComplianceFlag(user, today);
    expect(flag.daysRemaining).toBe(90);
    expect(flag.atRisk).toBe(true);
  });

  it('boundary: 91 days remaining is not at-risk', () => {
    const contractStart = '2025-01-01';
    const deadline = new Date('2026-01-01T12:00:00');
    const today = new Date(deadline);
    today.setDate(today.getDate() - 91);
    const user = { licenseStatus: 'provisional', contractStartDate: contractStart };
    const flag = cbttComplianceFlag(user, today);
    expect(flag.daysRemaining).toBe(91);
    expect(flag.atRisk).toBe(false);
  });
});
