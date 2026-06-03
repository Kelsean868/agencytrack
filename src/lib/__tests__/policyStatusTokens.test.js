import { describe, it, expect } from 'vitest';
import {
  isConfirmed,
  policyRole,
  statusToken,
  policyToken,
  policyPillLabel,
} from '../policyStatusTokens';

describe('policyStatusTokens', () => {
  describe('isConfirmed', () => {
    it('true only when confirmedAt is present', () => {
      expect(isConfirmed({ confirmedAt: { toDate: () => new Date() } })).toBe(true);
      expect(isConfirmed({ confirmedAt: null })).toBe(false);
      expect(isConfirmed({})).toBe(false);
      expect(isConfirmed(null)).toBe(false);
    });
  });

  describe('policyRole', () => {
    it('confirmed (derived) wins over the underlying settled status', () => {
      expect(policyRole({ status: 'settled', confirmedAt: {} })).toBe('confirmed');
    });
    it('maps each status to its semantic role', () => {
      expect(policyRole({ status: 'submitted' })).toBe('in-flight');
      expect(policyRole({ status: 'rated' })).toBe('in-flight');
      expect(policyRole({ status: 'settled' })).toBe('settled');
      expect(policyRole({ status: 'postponed' })).toBe('soft');
      expect(policyRole({ status: 'ntu' })).toBe('hard');
      expect(policyRole({ status: 'denied' })).toBe('hard');
      expect(policyRole({ status: 'lapsed' })).toBe('closed');
    });
  });

  describe('statusToken', () => {
    it('returns canonical Nexus utilities — never raw palette', () => {
      const all = ['in-flight', 'settled', 'confirmed', 'soft', 'hard', 'closed'].map(statusToken);
      for (const t of all) {
        expect(t).toHaveProperty('text');
        expect(t).toHaveProperty('tint');
        expect(t).toHaveProperty('solid');
        const joined = `${t.text} ${t.tint} ${t.solid}`;
        // No raw Tailwind palette colors (e.g. bg-blue-50, text-red-700).
        expect(joined).not.toMatch(/\b(?:bg|text|border)-(?:red|blue|green|emerald|amber|yellow|orange|gray|slate)-\d/);
      }
    });
    it('maps roles to the expected families', () => {
      expect(statusToken('confirmed').text).toBe('text-gold');
      expect(statusToken('settled').solid).toBe('bg-success');
      expect(statusToken('hard').tint).toBe('bg-danger-tint');
      expect(statusToken('closed').tint).toBe('bg-surface-muted');
    });
    it('falls back to in-flight for an unknown role', () => {
      expect(statusToken('nonsense')).toEqual(statusToken('in-flight'));
    });
  });

  describe('policyToken / policyPillLabel', () => {
    it('policyToken resolves straight from a policy', () => {
      expect(policyToken({ status: 'settled', confirmedAt: {} })).toEqual(statusToken('confirmed'));
    });
    it('confirmed policy pill reads "Confirmed"', () => {
      expect(policyPillLabel({ status: 'settled', confirmedAt: {} })).toBe('Confirmed');
    });
    it('unconfirmed pill uses the canonical status label', () => {
      expect(policyPillLabel({ status: 'submitted' })).toBe('Submitted');
      expect(policyPillLabel({ status: 'rated' })).toBe('Rated');
    });
  });
});
