import { describe, it, expect } from 'vitest';
import {
  isConfirmed,
  needsManagerConfirmation,
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
      expect(policyRole({ status: 'written' })).toBe('in-flight');
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

  describe('needsManagerConfirmation', () => {
    it('is FALSE when the status came from the OIPA export', () => {
      // Head office is the authority for that status; no manager step exists
      // on that path, so nothing is awaiting one.
      expect(needsManagerConfirmation({ status: 'settled', statusSource: 'oipa_import' })).toBe(false);
    });

    it('is TRUE when a person set the status', () => {
      expect(needsManagerConfirmation({ status: 'settled', statusSource: 'agent' })).toBe(true);
      expect(needsManagerConfirmation({ status: 'settled', statusSource: 'manager' })).toBe(true);
    });

    it('is TRUE when there is no statusSource at all', () => {
      // Every policy written before status provenance existed. Defaulting these
      // to "no manager needed" would silence the hint for the whole ledger.
      expect(needsManagerConfirmation({ status: 'settled' })).toBe(true);
      expect(needsManagerConfirmation({ status: 'settled', statusSource: null })).toBe(true);
      expect(needsManagerConfirmation(null)).toBe(true);
      expect(needsManagerConfirmation(undefined)).toBe(true);
    });

    it('reads statusSource, NOT importSource', () => {
      // A policy that arrived by import but whose status a person later changed
      // still needs the manager. `importSource` records how the document
      // arrived; only `statusSource` records who set the status.
      expect(needsManagerConfirmation({
        status: 'settled', importSource: 'oipa_import', statusSource: 'agent',
      })).toBe(true);
      expect(needsManagerConfirmation({
        status: 'settled', importSource: 'oipa_import',
      })).toBe(true);
    });

    it('does not make an imported policy read as CONFIRMED', () => {
      // The gold `confirmed` role would claim a manager signed it off. Nobody did.
      const imported = { status: 'settled', statusSource: 'oipa_import', confirmedAt: null };
      expect(needsManagerConfirmation(imported)).toBe(false);
      expect(isConfirmed(imported)).toBe(false);
      expect(policyRole(imported)).toBe('settled');
    });
  });
});
