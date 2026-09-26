import { describe, it, expect } from 'vitest';
import {
  FULL_COLUMNS,
  HO_CHECK_COLUMNS,
  buildLedgerExportTable,
  buildHoCheckExportTable,
} from '../ledgerExportRows';
import { buildCsvContent, escapeCsvField } from '../csvExport';

function row(overrides = {}) {
  return {
    policy: {
      ownerName: 'Alice Client',
      policyNumber: '2381',
      policyClass: 'whole_life',
      proposedFrequency: 'M',
      status: 'settled',
      statusSource: 'oipa_import',
      dateSubmitted: '2026-08-02',
      dateIssued: '2026-08-12',
      settledAPI: 24600,
      ...overrides.policy,
    },
    group: 'counting',
    credit: { api: 24600, apps: 1 },
    hoFlag: false,
    ...overrides,
  };
}

describe('buildLedgerExportTable (Excel/CSV shared shape)', () => {
  it('shapes headers exactly per FULL_COLUMNS', () => {
    const { headers } = buildLedgerExportTable([row()]);
    expect(headers).toEqual(FULL_COLUMNS);
  });

  it('formats dates DD-MM-YYYY and money as raw numbers (not currency strings)', () => {
    const { rows } = buildLedgerExportTable([row()]);
    const [, , , , , , submitted, issued, api] = rows[0];
    expect(submitted).toBe('02-08-2026');
    expect(issued).toBe('12-08-2026');
    expect(api).toBe(24600);
    expect(typeof api).toBe('number');
  });

  it('labels source from statusSource, and humanizes policyClass/frequency', () => {
    const { rows } = buildLedgerExportTable([row()]);
    const [, , product, freq, , source] = rows[0];
    expect(product).toBe('Whole Life');
    expect(freq).toBe('Monthly');
    expect(source).toBe('Head office');
  });

  it('a self-confirmed row reads "Self-confirmed"', () => {
    const { rows } = buildLedgerExportTable([row({ policy: { statusSource: 'agent' } })]);
    expect(rows[0][5]).toBe('Self-confirmed');
  });

  it('carries the flag column from row.hoFlag, never re-derived', () => {
    const { rows } = buildLedgerExportTable([row({ hoFlag: true })]);
    expect(rows[0][10]).toBe('Not on head-office list yet');
    const { rows: rows2 } = buildLedgerExportTable([row({ hoFlag: false })]);
    expect(rows2[0][10]).toBe('');
  });

  it('an empty filtered set produces zero data rows', () => {
    expect(buildLedgerExportTable([]).rows).toEqual([]);
  });
});

describe('buildHoCheckExportTable (PDF head-office check sheet — reduced columns)', () => {
  it('uses the reduced HO_CHECK_COLUMNS set', () => {
    const { headers } = buildHoCheckExportTable([row()]);
    expect(headers).toEqual(HO_CHECK_COLUMNS);
    expect(headers).not.toContain('Frequency');
    expect(headers).not.toContain('Submitted');
  });

  it('shapes one row per policy with numeric API', () => {
    const { rows } = buildHoCheckExportTable([row()]);
    expect(rows[0]).toEqual(['Alice Client', '2381', 'Settled', 'Head office', '12-08-2026', 24600, '']);
  });
});

describe('CSV formula-injection safety (SEC-15) on export rows', () => {
  it('a client name starting with "=" is neutralized by the existing helper', () => {
    const { rows } = buildLedgerExportTable([row({ policy: { ownerName: '=SUM(A1:A9)' } })]);
    expect(escapeCsvField(rows[0][0])).toBe("'=SUM(A1:A9)");
  });

  it('names starting with "+", "-", "@" are neutralized; a real negative number is not', () => {
    const table = buildLedgerExportTable([
      row({ policy: { ownerName: '+1234 Corp' } }),
      row({ policy: { ownerName: '-Danger' } }),
      row({ policy: { ownerName: '@mention' } }),
    ]);
    expect(escapeCsvField(table.rows[0][0])).toBe("'+1234 Corp");
    expect(escapeCsvField(table.rows[1][0])).toBe("'-Danger");
    expect(escapeCsvField(table.rows[2][0])).toBe("'@mention");
    // A genuine numeric API value beginning with '-' must NOT be neutralized.
    expect(escapeCsvField(-5000.5)).toBe('-5000.5');
  });

  it('buildCsvContent renders a full table without throwing and neutralizes in place', () => {
    const table = buildLedgerExportTable([row({ policy: { ownerName: '=cmd' } })]);
    const csv = buildCsvContent([table.headers, ...table.rows]);
    expect(csv).toContain("'=cmd");
  });
});
