import { describe, it, expect } from 'vitest';

import {
  buildLedgerPrefill,
  manualGate,
  manualConfirmationFields,
  importProvenanceLabel,
  MANUAL_BLOCK_MESSAGE,
} from '../ledgerPrefill';
import { LEDGER_MANUAL_INPUTS, LEDGER_DERIVED_INPUTS } from '../deriveFromLedger';

const EXPORT_DATE = '2026-09-15';
const OPTS = { monthKey: '2026-09', exportDate: EXPORT_DATE };

/** A placed, in-window, writing-agent policy. SYNTHETIC. */
function doc(overrides = {}) {
  return {
    policyNumber: 'TST0000001',
    status: 'settled',
    oipaSubStatus: 'Premium Paying',
    policyClass: 'whole_life',
    proposedAPI: 1000,
    totalPremiumPaid: null,
    dateIssued: '2026-01-15',
    paidToDate: '2026-10-01',
    isWritingAgent: true,
    ...overrides,
  };
}

describe('importProvenanceLabel', () => {
  it('formats the export date the way the tab shows it', () => {
    expect(importProvenanceLabel('2026-09-15')).toBe('From portfolio import, 15 Sep 2026');
  });

  it('returns null rather than a half-built label for a bad date', () => {
    expect(importProvenanceLabel(null)).toBeNull();
    expect(importProvenanceLabel('')).toBeNull();
    expect(importProvenanceLabel('15/09/2026')).toBeNull();
  });
});

describe('buildLedgerPrefill — the derived three', () => {
  it('prefills businessPlaced, notTakens and lapses from the ledger', () => {
    const p = buildLedgerPrefill([
      doc({ policyNumber: 'A1', proposedAPI: 5000 }),
      doc({ policyNumber: 'A2', status: 'lapsed', proposedAPI: 2000, totalPremiumPaid: null }),
    ], OPTS);

    expect(p.values.businessPlaced).toBe('7000');
    expect(p.values.lapses).toBe('2000');
    expect(p.values.notTakens).toBe('0');
    expect(p.derivedFields).toEqual([...LEDGER_DERIVED_INPUTS]);
  });

  it('carries the provenance tag when a ledger exists', () => {
    const p = buildLedgerPrefill([doc()], OPTS);
    expect(p.hasLedger).toBe(true);
    expect(p.provenance).toBe('From portfolio import, 15 Sep 2026');
  });

  it('gives no ledger and no provenance when nothing is in the window', () => {
    // An agent with no in-window policies gets the plain manual form rather
    // than a screen full of confident zeros.
    const p = buildLedgerPrefill([doc({ dateIssued: '2020-01-01' })], OPTS);
    expect(p.hasLedger).toBe(false);
    expect(p.provenance).toBeNull();
    expect(p.values.businessPlaced).toBe('');
    expect(p.values.lapses).toBe('');
  });

  it('passes the annuity rule through to the derivation', () => {
    const docs = [
      doc({ policyNumber: 'ANN1', policyClass: 'annuity', status: 'settled', paidToDate: '2026-01-01', proposedAPI: 3000 }),
    ];
    const ignore = buildLedgerPrefill(docs, { ...OPTS, annuityMissedPremiumRule: 'ignore' });
    const lapse = buildLedgerPrefill(docs, { ...OPTS, annuityMissedPremiumRule: 'lapse' });

    expect(ignore.values.lapses).toBe('0');
    expect(lapse.values.lapses).toBe('3000');
    // The denominator is untouched by the switch.
    expect(ignore.values.businessPlaced).toBe(lapse.values.businessPlaced);
  });

  it('passes windowMonths through, so the CRO question is a parameter', () => {
    // Sep 2024 is OUTSIDE the default 24-month window on a 2026-09 report and
    // INSIDE a 25-month one — brief open question 2, answered by a parameter.
    const docs = [doc({ policyNumber: 'EDGE1', dateIssued: '2024-09-15', proposedAPI: 900 })];

    // At 24 months nothing is in the window, so there is no ledger for this
    // month at all and the form falls back to blank rather than a confident 0.
    const at24 = buildLedgerPrefill(docs, OPTS);
    expect(at24.hasLedger).toBe(false);
    expect(at24.values.businessPlaced).toBe('');

    const at25 = buildLedgerPrefill(docs, { ...OPTS, windowMonths: 25 });
    expect(at25.hasLedger).toBe(true);
    expect(at25.values.businessPlaced).toBe('900');
  });
});

describe('buildLedgerPrefill — the manual four are EMPTY, never 0', () => {
  it('leaves all four blank and blocks the save', () => {
    // A 0 that was never entered is indistinguishable, on the saved doc and on
    // every later report, from a 0 somebody checked and meant.
    const p = buildLedgerPrefill([doc()], OPTS);

    for (const id of LEDGER_MANUAL_INPUTS) {
      expect(p.values[id]).toBe('');
      expect(p.values[id]).not.toBe('0');
      expect(p.values[id]).not.toBe(0);
    }
    expect(p.unanswered.sort()).toEqual(['decreases', 'incPPPs', 'lumpsums100', 'reinstatements']);
    expect(p.canSave).toBe(false);
    expect(p.blockMessage).toBe(MANUAL_BLOCK_MESSAGE);
  });

  it('says exactly what the form must show', () => {
    expect(MANUAL_BLOCK_MESSAGE).toBe('Enter the 4 figures the export does not have.');
  });

  it('still blocks when only some of the four are answered', () => {
    const p = buildLedgerPrefill([doc()], {
      ...OPTS,
      existingRecord: { decreases: 0, incPPPs: 100 },
    });
    expect(p.unanswered.sort()).toEqual(['lumpsums100', 'reinstatements']);
    expect(p.canSave).toBe(false);
  });
});

describe('buildLedgerPrefill — an existing manual entry WINS', () => {
  it('uses the saved figures rather than the ledger derivation', () => {
    // A human who entered a figure outranks a derivation.
    const p = buildLedgerPrefill([doc({ proposedAPI: 5000 })], {
      ...OPTS,
      existingRecord: {
        businessPlaced: 999, notTakens: 11, lapses: 22,
        decreases: 1, incPPPs: 2, lumpsums100: 3, reinstatements: 4,
      },
    });

    expect(p.values.businessPlaced).toBe('999');
    expect(p.values.notTakens).toBe('11');
    expect(p.values.lapses).toBe('22');
    expect(p.canSave).toBe(true);
    expect(p.blockMessage).toBeNull();
  });

  it('a saved 0 is a real answer and unblocks the field', () => {
    const p = buildLedgerPrefill([doc()], {
      ...OPTS,
      existingRecord: { decreases: 0, incPPPs: 0, lumpsums100: 0, reinstatements: 0 },
    });
    expect(p.canSave).toBe(true);
    expect(p.values.decreases).toBe('0');
  });

  it('falls back to the ledger for a derived field the saved record lacks', () => {
    const p = buildLedgerPrefill([doc({ proposedAPI: 4000 })], {
      ...OPTS,
      existingRecord: { lapses: 50 },
    });
    expect(p.values.businessPlaced).toBe('4000'); // from the ledger
    expect(p.values.lapses).toBe('50');           // from the human
  });
});

describe('manualGate — re-checked on every keystroke', () => {
  const answered = { decreases: '0', incPPPs: '1', lumpsums100: '2', reinstatements: '3' };

  it('passes when all four are answered', () => {
    expect(manualGate(answered)).toEqual({ unanswered: [], canSave: true, blockMessage: null });
  });

  it('a typed 0 answers the field', () => {
    expect(manualGate({ ...answered, decreases: '0' }).canSave).toBe(true);
  });

  it('a blank or whitespace-only value does NOT', () => {
    expect(manualGate({ ...answered, decreases: '' }).canSave).toBe(false);
    expect(manualGate({ ...answered, decreases: '   ' }).canSave).toBe(false);
    expect(manualGate({ ...answered, decreases: null }).canSave).toBe(false);
    expect(manualGate({ ...answered, decreases: undefined }).canSave).toBe(false);
  });

  it('names every unanswered field', () => {
    expect(manualGate({}).unanswered.sort()).toEqual(['decreases', 'incPPPs', 'lumpsums100', 'reinstatements']);
  });

  it('handles a missing values object', () => {
    expect(manualGate(undefined).canSave).toBe(false);
  });

  it('ignores the derived three — they are not the gate', () => {
    expect(manualGate({ ...answered, businessPlaced: '', lapses: '' }).canSave).toBe(true);
  });
});

describe('manualConfirmationFields', () => {
  it('returns the two provenance fields the save writes', () => {
    expect(manualConfirmationFields({ uid: 'uid-1', now: 'T' }))
      .toEqual({ manualConfirmedBy: 'uid-1', manualConfirmedAt: 'T' });
  });

  it('refuses to invent a uid or a clock', () => {
    expect(() => manualConfirmationFields({ now: 'T' })).toThrow(/uid is required/);
    expect(() => manualConfirmationFields({ uid: 'u' })).toThrow(/now is required/);
  });
});

describe('buildLedgerPrefill — the ledger evidence reaches the drawer', () => {
  it('exposes the counted policy numbers and the at-risk sections', () => {
    const p = buildLedgerPrefill([
      doc({ policyNumber: 'C1', proposedAPI: 1000 }),
      doc({ policyNumber: 'ANN1', policyClass: 'annuity', status: 'settled', paidToDate: '2026-01-01', proposedAPI: 3000 }),
      doc({ policyNumber: 'DC1', status: 'settled', terminalReason: 'deceased', claimStatus: 'pending', proposedAPI: 6000 }),
    ], OPTS);

    expect(p.ledger.counted).toBe(3);
    expect(p.ledger.evidence.businessPlaced.sort()).toEqual(['ANN1', 'C1', 'DC1']);
    expect(p.ledger.atRisk.annuities.map((a) => a.policyNumber)).toEqual(['ANN1']);
    expect(p.ledger.atRisk.pendingDeathClaims.map((c) => c.policyNumber)).toEqual(['DC1']);
  });
});
