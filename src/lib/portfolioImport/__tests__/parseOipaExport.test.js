import { describe, it, expect } from 'vitest';

import {
  parseOipaExport,
  mapOipaStatus,
  resolvePlan,
  parseExportDateFromTitle,
  rowsFromSheetMatrix,
} from '../parseOipaExport';
import { OIPA_COLUMNS_EXCLUDED } from '../oipaImportConfig';

/**
 * Every row below is SYNTHETIC. Names are placeholders and the policy numbers are
 * either invented or the specific ones the brief names as config (overrides, test
 * records, self/family) — which are Kyron's own or already public in the brief.
 * The real export holds client names and must never be committed or copied here.
 *
 * The real-file counts live in the PR description as a paste-back, produced by a
 * scratchpad script run against the local workbook.
 */

const OPTS = { exportDate: '2026-09-15', agentId: 'uid-kyron', agentNumber: '011B94' };

/** Builds one OIPA row. Only the fields a test cares about need to be passed. */
function row(overrides = {}) {
  return {
    'Policy Number': 'TST0000001',
    'Policy Status': 'Active',
    'Policy Sub Status': 'Premium Paying',
    'Policy Owner': 'Alpha Owner',
    Insured: 'ALPHA OWNER',
    'Payment Mode': 'Monthly',
    API: 1200,
    Plan: 'RAE996',
    'Status Date': null,
    'Issue Date': new Date(2026, 7, 7), // 7 Aug 2026, local midnight
    'Paid To Date': new Date(2026, 9, 6),
    'Total Premium Paid Issue To Date': 200,
    'Modal Premium': 100,
    'Sum Insured': 31957.77,
    'Writing Agent Number': '011B94',
    'Writing Agent Name': 'KYRON MARCHAN',
    'Servicing Agent Number': '011B94',
    ...overrides,
  };
}

describe('parseOipaExport — required options', () => {
  it('throws when exportDate is missing', () => {
    expect(() => parseOipaExport([row()], { ...OPTS, exportDate: null }))
      .toThrow(/exportDate is required/);
  });

  it('throws when agentId is missing', () => {
    expect(() => parseOipaExport([row()], { ...OPTS, agentId: '' }))
      .toThrow(/agentId is required/);
  });

  it('throws when agentNumber is missing', () => {
    expect(() => parseOipaExport([row()], { ...OPTS, agentNumber: undefined }))
      .toThrow(/agentNumber is required/);
  });
});

describe('parseOipaExport — shadow rows (brief rule 1)', () => {
  it('drops a Pending Issue row and keeps its real twin', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'AAA0000001', 'Policy Status': 'Approved', 'Policy Sub Status': 'Pending Issue' }),
      row({ 'Policy Number': 'AAA0000001' }),
    ], OPTS);

    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe('settled');
    expect(report.shadowsPendingIssue).toBe(1);
    expect(report.shadows).toBe(1);
  });

  it('drops an AFR row when the un-prefixed number is also present', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'AFRAAA0000002', 'Policy Sub Status': 'Lapsed', 'Policy Status': 'Terminated' }),
      row({ 'Policy Number': 'AAA0000002' }),
    ], OPTS);

    expect(docs.map((d) => d.policyNumber)).toEqual(['AAA0000002']);
    expect(report.shadowsAfrTwins).toBe(1);
    expect(report.afrWithoutTwin).toEqual([]);
  });

  it('KEEPS an AFR row that has no twin, and reports it', () => {
    // An untwinned AFR row is the only record of that policy. Dropping it would
    // lose a policy; keeping it silently would hide that the export changed shape.
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'AFRBBB0000003' }),
    ], OPTS);

    expect(docs.map((d) => d.policyNumber)).toEqual(['AFRBBB0000003']);
    expect(report.afrWithoutTwin).toEqual(['AFRBBB0000003']);
    expect(report.shadowsAfrTwins).toBe(0);
  });

  it('counts a row that is both AFR and Pending Issue exactly once', () => {
    const { report } = parseOipaExport([
      row({ 'Policy Number': 'AFRAAA0000004', 'Policy Sub Status': 'Pending Issue' }),
      row({ 'Policy Number': 'AAA0000004' }),
    ], OPTS);

    expect(report.shadows).toBe(1);
    expect(report.shadowsPendingIssue).toBe(1);
    expect(report.shadowsAfrTwins).toBe(0);
    expect(report.rowsAccountedFor).toBe(true);
  });
});

describe('parseOipaExport — test records (brief rule 2)', () => {
  it('skips every configured test policy number', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'SPI2500081', Plan: 'IMASL1' }),
      row({ 'Policy Number': 'SPI2500082', Plan: 'IMASL1' }),
      row({ 'Policy Number': 'SPI2500083', Plan: 'IMUSL1' }),
      row({ 'Policy Number': 'SPI2500084', Plan: 'IMASL1' }),
      row({ 'Policy Number': 'FNE2500067', Plan: 'RAE996' }),
      row({ 'Policy Number': 'KEEP000001' }),
    ], OPTS);

    expect(docs.map((d) => d.policyNumber)).toEqual(['KEEP000001']);
    expect(report.testRecords).toBe(5);
    expect(report.testRecordNumbers).toHaveLength(5);
  });
});

describe('parseOipaExport — one doc per policy number (brief rule 3)', () => {
  it('collapses a duplicate number, reports it, and keeps the latest Status Date', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'DUP0000001', 'Status Date': '2026-01-01', API: 111 }),
      row({ 'Policy Number': 'DUP0000001', 'Status Date': '2026-06-01', API: 222 }),
    ], OPTS);

    expect(docs).toHaveLength(1);
    expect(docs[0].proposedAPI).toBe(222);
    expect(report.duplicatePolicyNumbers).toEqual(['DUP0000001']);
    expect(report.rowsAccountedFor).toBe(true);
  });

  it('reports a row with no policy number instead of building a doc for it', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': null }),
      row({ 'Policy Number': 'OK00000001' }),
    ], OPTS);

    expect(docs).toHaveLength(1);
    expect(report.missingPolicyNumber).toBe(1);
    expect(report.rowsAccountedFor).toBe(true);
  });
});

describe('mapOipaStatus — the status map (brief rule 4)', () => {
  it('maps Active and Grace to settled', () => {
    expect(mapOipaStatus('Active', 'Premium Paying').status).toBe('settled');
    expect(mapOipaStatus('Grace', 'Grace').status).toBe('settled');
  });

  it('maps Terminated/Lapsed to lapsed', () => {
    expect(mapOipaStatus('Terminated', 'Lapsed').status).toBe('lapsed');
  });

  it('lets the sub status beat Terminated, so a Terminated NTU is not a lapse', () => {
    expect(mapOipaStatus('Terminated', 'Not Taken').status).toBe('ntu');
    expect(mapOipaStatus('Terminated', 'Cancelled').status).toBe('ntu');
    expect(mapOipaStatus('Closed', 'Withdrawn').status).toBe('ntu');
    expect(mapOipaStatus('Closed', 'Insufficient Premium').status).toBe('ntu');
  });

  it('maps Pending to submitted', () => {
    expect(mapOipaStatus('Pending', 'Pending').status).toBe('submitted');
  });

  it('maps the terminal sub statuses to settled plus a terminalReason', () => {
    expect(mapOipaStatus('Terminated', 'Surrendered')).toMatchObject({ status: 'settled', terminalReason: 'surrendered' });
    expect(mapOipaStatus('Terminated', 'Deceased')).toMatchObject({ status: 'settled', terminalReason: 'deceased' });
    expect(mapOipaStatus('Terminated', 'Commutation')).toMatchObject({ status: 'settled', terminalReason: 'commutation' });
    expect(mapOipaStatus('Terminated', 'Claim Paid')).toMatchObject({ status: 'settled', terminalReason: 'claim_paid' });
  });

  it('PRECEDENCE: Declined beats the NL sub status, so Declined/NL is denied', () => {
    // NL is listed under both rules in the brief. The brief's own expected counts
    // (denied 3 AND settled-plus-terminal 18) are only both true if status wins.
    const mapped = mapOipaStatus('Declined', 'NL');
    expect(mapped.status).toBe('denied');
    expect(mapped.via).toBe('status');
    expect(mapped.terminalReason).toBeUndefined();
  });

  it('still maps a bare NL sub status to settled plus terminal when the status is not Declined', () => {
    expect(mapOipaStatus('Terminated', 'NL')).toMatchObject({ status: 'settled', terminalReason: 'nl' });
  });

  it('returns null for a pair no rule covers', () => {
    expect(mapOipaStatus('Reinstated', 'Something New')).toBeNull();
  });
});

describe('parseOipaExport — an unmapped status is reported, never guessed', () => {
  it('drops the row and names it in the report', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'ODD0000001', 'Policy Status': 'Reinstated', 'Policy Sub Status': 'Brand New' }),
      row({ 'Policy Number': 'OK00000002' }),
    ], OPTS);

    expect(docs.map((d) => d.policyNumber)).toEqual(['OK00000002']);
    expect(report.unmappedStatus).toEqual([
      { policyNumber: 'ODD0000001', oipaStatus: 'Reinstated', oipaSubStatus: 'Brand New' },
    ]);
    expect(report.rowsAccountedFor).toBe(true);
  });
});

describe('parseOipaExport — overrides (brief rule 5)', () => {
  it('DAN2602390 imports as ntu with replacedBy, beating the export Pending', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'DAN2602390', 'Policy Status': 'Pending', 'Policy Sub Status': 'Pending', Plan: 'DNUXXA' }),
    ], OPTS);

    expect(docs[0].status).toBe('ntu');
    expect(docs[0].replacedBy).toBe('DAN2602403');
    expect(report.overridesApplied[0]).toMatchObject({
      policyNumber: 'DAN2602390',
      from: { mappedStatus: 'submitted' },
      to: { status: 'ntu' },
    });
  });

  it('FNE2500031 is a settled death claim, NOT a lapse', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'FNE2500031', 'Policy Status': 'Terminated', 'Policy Sub Status': 'Lapsed', Plan: 'RAE996' }),
    ], OPTS);

    expect(docs[0].status).toBe('settled');
    expect(docs[0].status).not.toBe('lapsed');
    expect(docs[0].terminalReason).toBe('deceased');
    expect(docs[0].claimStatus).toBe('pending');
  });

  it('TRM2501670 stays lapsed and carries no reinstatement link', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'TRM2501670', 'Policy Status': 'Terminated', 'Policy Sub Status': 'Lapsed', Plan: 'LCT707' }),
    ], OPTS);

    expect(docs[0].status).toBe('lapsed');
    expect(docs[0].replacedBy).toBeUndefined();
    expect(docs[0].terminalReason).toBeUndefined();
  });

  it('does not leave a stale terminalReason when an override changes the status', () => {
    // Mapped from Surrendered it would be settled+surrendered; the override makes it
    // ntu, and a terminal reason must not survive that.
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'DAN2602390', 'Policy Status': 'Terminated', 'Policy Sub Status': 'Surrendered', Plan: 'DNUXXA' }),
    ], OPTS);

    expect(docs[0].status).toBe('ntu');
    expect(docs[0].terminalReason).toBeUndefined();
  });

  it('does not write the config note onto the doc', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'TRM2501670', 'Policy Status': 'Terminated', 'Policy Sub Status': 'Lapsed' }),
    ], OPTS);

    expect(docs[0].note).toBeUndefined();
  });
});

describe('resolvePlan — plan prefixes (brief rule 6)', () => {
  it('resolves the confirmed prefixes', () => {
    expect(resolvePlan('RAE996')).toMatchObject({ policyClass: 'whole_life', sourceSystem: 'INGENIUM', planName: 'Rest Assured I' });
    expect(resolvePlan('LCT657')).toMatchObject({ policyClass: 'term', sourceSystem: 'INGENIUM' });
    expect(resolvePlan('CBUXXD')).toMatchObject({ policyClass: 'annuity', sourceSystem: 'INGENIUM' });
    expect(resolvePlan('CBAXXD')).toMatchObject({ policyClass: 'annuity', sourceSystem: 'INGENIUM' });
    expect(resolvePlan('CIB702')).toMatchObject({ policyClass: 'critical_illness', sourceSystem: 'INGENIUM' });
    expect(resolvePlan('DNUXXA')).toMatchObject({ policyClass: 'annuity', sourceSystem: 'OIPA' });
    expect(resolvePlan('DNAXXA')).toMatchObject({ policyClass: 'annuity', sourceSystem: 'OIPA' });
  });

  it('flags ULG and ULI as universal_life but not confirmed', () => {
    expect(resolvePlan('ULGPO9')).toMatchObject({ policyClass: 'universal_life', classUnconfirmed: true });
    expect(resolvePlan('ULIFE5')).toMatchObject({ policyClass: 'universal_life', classUnconfirmed: true });
  });

  it('leaves PSU pending rather than inventing a class', () => {
    expect(resolvePlan('PSUXX5')).toMatchObject({ policyClass: null, planName: null, planClassPending: true, known: true });
  });

  it('an UNKNOWN prefix is pending, not a failure', () => {
    const r = resolvePlan('ZZZ123');
    expect(r.planClassPending).toBe(true);
    expect(r.known).toBe(false);
    expect(r.policyClass).toBeNull();
    expect(r.prefix).toBe('ZZZ');
  });

  it('handles a missing plan code without throwing', () => {
    expect(resolvePlan(null)).toMatchObject({ prefix: null, planClassPending: true, known: false });
  });
});

describe('parseOipaExport — an unknown prefix never fails the import', () => {
  it('still builds the doc and reports the prefix', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'NEW0000001', Plan: 'ZZZ123' }),
    ], OPTS);

    expect(docs).toHaveLength(1);
    expect(docs[0].planClassPending).toBe(true);
    expect(docs[0].policyClass).toBeNull();
    expect(docs[0].planId).toBe('ZZZ123');
    expect(report.unknownPlanPrefixes).toEqual({ ZZZ: 1 });
    expect(report.planClassPending).toEqual(['NEW0000001']);
  });

  it('lists ULG in classUnconfirmed so it gets reviewed', () => {
    const { report } = parseOipaExport([
      row({ 'Policy Number': 'U00167603', Plan: 'ULGPO9' }),
    ], OPTS);

    expect(report.classUnconfirmed).toEqual(['U00167603']);
  });
});

describe('parseOipaExport — doc fields (brief rule 7)', () => {
  it('maps every imported field off the right column', () => {
    const { docs } = parseOipaExport([row({ 'Policy Number': 'FLD0000001', 'Status Date': '2026-05-04' })], OPTS);
    const d = docs[0];

    expect(d).toMatchObject({
      policyNumber:         'FLD0000001',
      ownerName:            'Alpha Owner',
      insuredName:          'ALPHA OWNER',
      planId:               'RAE996',
      planName:             'Rest Assured I',
      policyClass:          'whole_life',
      sourceSystem:         'INGENIUM',
      proposedAPI:          1200,
      proposedPremium:      100,
      proposedFrequency:    'M',
      proposedCoverage:     31957.77,
      dateIssued:           '2026-08-07',
      paidToDate:           '2026-10-06',
      totalPremiumPaid:     200,
      writingAgentNumber:   '011B94',
      writingAgentName:     'KYRON MARCHAN',
      servicingAgentNumber: '011B94',
      oipaStatus:           'Active',
      oipaSubStatus:        'Premium Paying',
      oipaStatusDate:       '2026-05-04',
      exportDate:           '2026-09-15',
      agentId:              'uid-kyron',
      newBusinessType:      'nb_ordinary',
      sourceOfProspect:     'portfolio_import',
    });
  });

  it('carries importedAt from the caller and never invents one', () => {
    const { docs } = parseOipaExport([row()], OPTS);
    expect(docs[0].importedAt).toBeNull();

    const stamped = parseOipaExport([row()], { ...OPTS, importedAt: '2026-09-16' });
    expect(stamped.docs[0].importedAt).toBe('2026-09-16');
  });

  it('imports NONE of the excluded personal-data columns', () => {
    const withPii = row({
      'Date Of Birth': new Date(1985, 5, 6),
      Email: 'nobody@example.com',
      'Mobile Phone': '0000000',
      'Address Line1': 'Somewhere',
      'Annual Income': 84000,
      Occupation: 'Clerical',
      Gender: 'Male',
    });
    const { docs } = parseOipaExport([withPii], OPTS);
    const serialised = JSON.stringify(docs[0]);

    for (const column of OIPA_COLUMNS_EXCLUDED) {
      expect(Object.keys(docs[0])).not.toContain(column);
    }
    expect(serialised).not.toContain('nobody@example.com');
    expect(serialised).not.toContain('0000000');
    expect(serialised).not.toContain('Somewhere');
    expect(serialised).not.toContain('1985');
    expect(serialised).not.toContain('84000');
  });

  it('sets isWritingAgent by comparing the writing agent number to the profile', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'OWN0000001', 'Writing Agent Number': '011B94' }),
      row({ 'Policy Number': 'ORP0000001', 'Writing Agent Number': '011A66' }),
    ], OPTS);

    expect(docs.find((d) => d.policyNumber === 'OWN0000001').isWritingAgent).toBe(true);
    expect(docs.find((d) => d.policyNumber === 'ORP0000001').isWritingAgent).toBe(false);
    expect(report.writingAgentPolicies).toBe(1);
    expect(report.orphanPolicies).toBe(1);
  });

  it('maps every payment mode to its frequency letter and reports an unknown one', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'FRQ0000001', 'Payment Mode': 'Monthly' }),
      row({ 'Policy Number': 'FRQ0000002', 'Payment Mode': 'Annual' }),
      row({ 'Policy Number': 'FRQ0000003', 'Payment Mode': 'Semi-Annual' }),
      row({ 'Policy Number': 'FRQ0000004', 'Payment Mode': 'Quarterly' }),
      row({ 'Policy Number': 'FRQ0000005', 'Payment Mode': 'Fortnightly' }),
    ], OPTS);

    const freq = (n) => docs.find((d) => d.policyNumber === n).proposedFrequency;
    expect(freq('FRQ0000001')).toBe('M');
    expect(freq('FRQ0000002')).toBe('A');
    expect(freq('FRQ0000003')).toBe('S');
    expect(freq('FRQ0000004')).toBe('Q');
    expect(freq('FRQ0000005')).toBeNull();
    expect(report.unknownPaymentModes).toEqual({ Fortnightly: 1 });
  });
});

describe('parseOipaExport — self and family (brief rule 8)', () => {
  it('flags the configured self/family policies and nothing else', () => {
    const { docs, report } = parseOipaExport([
      row({ 'Policy Number': 'FNE2600720' }),
      row({ 'Policy Number': 'TRM2501755', Plan: 'LCT657' }),
      row({ 'Policy Number': 'TRM2602866', Plan: 'LCT657' }),
      row({ 'Policy Number': 'OTH0000001' }),
    ], OPTS);

    const flag = (n) => docs.find((d) => d.policyNumber === n).isSelfOrFamily;
    expect(flag('FNE2600720')).toBe(true);
    expect(flag('TRM2501755')).toBe(true);
    expect(flag('TRM2602866')).toBe(false);
    expect(flag('OTH0000001')).toBe(false);
    expect(report.selfOrFamily.sort()).toEqual(['FNE2600720', 'TRM2501755']);
  });
});

describe('parseOipaExport — money normalisation', () => {
  it('keeps a MISSING money value as null, never 0', () => {
    // Load-bearing: persistency rule 5 keeps a lapse in when totalPremiumPaid is
    // missing. A 0 here would compare against 2 x API and drop the lapse instead.
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'MON0000001', 'Total Premium Paid Issue To Date': null, 'Sum Insured': null }),
    ], OPTS);

    expect(docs[0].totalPremiumPaid).toBeNull();
    expect(docs[0].proposedCoverage).toBeNull();
    expect(docs[0].totalPremiumPaid).not.toBe(0);
  });

  it('keeps a real 0 as 0', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'MON0000002', 'Total Premium Paid Issue To Date': 0 }),
    ], OPTS);

    expect(docs[0].totalPremiumPaid).toBe(0);
  });

  it('parses a money value that came back as formatted text', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'MON0000003', API: '$11,996.64', 'Modal Premium': ' 1,000.00 ' }),
    ], OPTS);

    expect(docs[0].proposedAPI).toBeCloseTo(11996.64, 2);
    expect(docs[0].proposedPremium).toBe(1000);
  });

  it('returns null for unparseable money rather than NaN', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'MON0000004', API: 'n/a' }),
    ], OPTS);

    expect(docs[0].proposedAPI).toBeNull();
  });
});

describe('parseOipaExport — date normalisation', () => {
  it('reads a Date cell by its LOCAL parts, so the calendar day never shifts', () => {
    // A spreadsheet reader builds the cell as LOCAL midnight. Using UTC parts would
    // move the day backwards on any machine east of UTC and could push a policy out
    // of the 24-month persistency window.
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'DTE0000001', 'Issue Date': new Date(2024, 9, 1) }), // 1 Oct 2024
    ], OPTS);

    expect(docs[0].dateIssued).toBe('2024-10-01');
  });

  it('passes a YYYY-MM-DD string straight through', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'DTE0000002', 'Issue Date': '2025-01-31' }),
    ], OPTS);

    expect(docs[0].dateIssued).toBe('2025-01-31');
  });

  it('takes the date part of an ISO timestamp without re-zoning it', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'DTE0000003', 'Issue Date': '2026-08-07T04:00:00.000Z' }),
    ], OPTS);

    expect(docs[0].dateIssued).toBe('2026-08-07');
  });

  it('returns null for a missing or invalid date', () => {
    const { docs } = parseOipaExport([
      row({ 'Policy Number': 'DTE0000004', 'Paid To Date': null, 'Status Date': 'not a date' }),
    ], OPTS);

    expect(docs[0].paidToDate).toBeNull();
    expect(docs[0].oipaStatusDate).toBeNull();
  });
});

describe('parseOipaExport — report totals', () => {
  it('separates the settled bucket from the settled-plus-terminal one', () => {
    const { report } = parseOipaExport([
      row({ 'Policy Number': 'RPT0000001', 'Policy Status': 'Active', 'Policy Sub Status': 'Premium Paying' }),
      row({ 'Policy Number': 'RPT0000002', 'Policy Status': 'Grace', 'Policy Sub Status': 'Grace' }),
      row({ 'Policy Number': 'RPT0000003', 'Policy Status': 'Terminated', 'Policy Sub Status': 'Surrendered' }),
      row({ 'Policy Number': 'RPT0000004', 'Policy Status': 'Terminated', 'Policy Sub Status': 'Lapsed' }),
      row({ 'Policy Number': 'RPT0000005', 'Policy Status': 'Terminated', 'Policy Sub Status': 'Not Taken' }),
      row({ 'Policy Number': 'RPT0000006', 'Policy Status': 'Declined', 'Policy Sub Status': 'NL' }),
    ], OPTS);

    expect(report.docs).toBe(6);
    expect(report.statusCounts).toEqual({ settled: 3, lapsed: 1, ntu: 1, denied: 1 });
    expect(report.settledWithTerminal).toBe(1);
    expect(report.settledWithoutTerminal).toBe(2);
    expect(report.terminalReasonCounts).toEqual({ surrendered: 1 });
    expect(report.rowsAccountedFor).toBe(true);
  });

  it('accounts for every input row', () => {
    const { report } = parseOipaExport([
      row({ 'Policy Number': 'ACC0000001' }),
      row({ 'Policy Number': 'ACC0000001', 'Policy Sub Status': 'Pending Issue', 'Policy Status': 'Approved' }),
      row({ 'Policy Number': 'SPI2500081' }),
      row({ 'Policy Number': null }),
      row({ 'Policy Number': 'ACC0000002', 'Policy Status': 'Nonsense', 'Policy Sub Status': 'Nonsense' }),
    ], OPTS);

    expect(report.rows).toBe(5);
    expect(report.docs).toBe(1);
    expect(report.rowsAccountedFor).toBe(true);
  });

  it('handles an empty sheet without throwing', () => {
    const { docs, report } = parseOipaExport([], OPTS);
    expect(docs).toEqual([]);
    expect(report.rows).toBe(0);
    expect(report.docs).toBe(0);
    expect(report.rowsAccountedFor).toBe(true);
  });
});

describe('parseExportDateFromTitle', () => {
  it('reads DD.MM.YY out of the real title shape', () => {
    expect(parseExportDateFromTitle('OIPA Agent Portfolio (Some Agent) @ 15.09.26')).toBe('2026-09-15');
  });

  it('returns null rather than guessing when the title does not carry a date', () => {
    expect(parseExportDateFromTitle('OIPA Agent Portfolio')).toBeNull();
    expect(parseExportDateFromTitle(null)).toBeNull();
    expect(parseExportDateFromTitle('')).toBeNull();
  });

  it('rejects an impossible day or month', () => {
    expect(parseExportDateFromTitle('Portfolio @ 15.13.26')).toBeNull();
    expect(parseExportDateFromTitle('Portfolio @ 00.09.26')).toBeNull();
  });
});

describe('rowsFromSheetMatrix', () => {
  it('reads headers from row 3 and drops blank rows', () => {
    const matrix = [
      ['OIPA Agent Portfolio (Some Agent) @ 15.09.26', null],
      [null, null],
      ['Policy Number', 'Policy Status'],
      ['AAA0000001', 'Active'],
      [null, null],
      ['', '   '],
      ['AAA0000002', 'Terminated'],
    ];

    expect(rowsFromSheetMatrix(matrix)).toEqual([
      { 'Policy Number': 'AAA0000001', 'Policy Status': 'Active' },
      { 'Policy Number': 'AAA0000002', 'Policy Status': 'Terminated' },
    ]);
  });

  it('names an unlabelled column instead of collapsing it onto another', () => {
    const matrix = [
      ['title'], [null],
      ['Policy Number', null, 'Policy Status'],
      ['AAA0000003', 'stray', 'Active'],
    ];

    expect(rowsFromSheetMatrix(matrix)[0]).toEqual({
      'Policy Number': 'AAA0000003',
      __col1: 'stray',
      'Policy Status': 'Active',
    });
  });

  it('returns an empty array for a sheet with no data rows', () => {
    expect(rowsFromSheetMatrix([])).toEqual([]);
    expect(rowsFromSheetMatrix([['t'], [null], ['Policy Number']])).toEqual([]);
  });
});
