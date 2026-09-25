import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  escapeCsvField, buildCsvContent, slugifyForFilename, downloadCsv, neutralizeCsvFormula,
} from '../csvExport';

// SEC-15 — CSV formula injection neutralization.
describe('neutralizeCsvFormula', () => {
  it.each([
    ['=', '=SUM(A1:A9)', "'=SUM(A1:A9)"],
    ['+', '+1+1', "'+1+1"],
    ['-', '-2+3', "'-2+3"],
    ['@', '@SUM(1+1)', "'@SUM(1+1)"],
    ['tab', '\tmalicious', "'\tmalicious"],
    ['CR', '\rmalicious', "'\rmalicious"],
  ])('prefixes a cell starting with %s with a leading apostrophe', (_label, input, expected) => {
    expect(neutralizeCsvFormula(input)).toBe(expected);
  });

  it('leaves a plain value unchanged (same value, not stringified)', () => {
    expect(neutralizeCsvFormula('Cheryl Gonzales')).toBe('Cheryl Gonzales');
    expect(neutralizeCsvFormula(7200)).toBe(7200);
  });

  it('leaves null/undefined unchanged', () => {
    expect(neutralizeCsvFormula(null)).toBe(null);
    expect(neutralizeCsvFormula(undefined)).toBe(undefined);
  });

  it('does not mistake a mid-string trigger character for a leading one', () => {
    expect(neutralizeCsvFormula('a=b')).toBe('a=b');
  });

  // In-PR extension (dispatcher, PR #974) — real numbers and numeric-looking
  // strings must NOT be prefixed, even though they start with a trigger
  // character (a leading '-' or '+' is legitimate sign notation).
  describe('numeric preservation (in-PR extension)', () => {
    it('leaves a genuine negative number unchanged', () => {
      expect(neutralizeCsvFormula(-5000)).toBe(-5000);
    });

    it('leaves a numeric string with a decimal portion unchanged', () => {
      expect(neutralizeCsvFormula('-5000.00')).toBe('-5000.00');
    });

    it('leaves a numeric string with thousands separators unchanged', () => {
      expect(neutralizeCsvFormula('-5,000.00')).toBe('-5,000.00');
      expect(neutralizeCsvFormula('1,234.56')).toBe('1,234.56');
    });

    it('leaves a plain unsigned or plus-signed numeric string unchanged', () => {
      expect(neutralizeCsvFormula('5000')).toBe('5000');
      expect(neutralizeCsvFormula('+250')).toBe('+250');
    });

    it('still prefixes a genuine formula despite looking number-adjacent', () => {
      expect(neutralizeCsvFormula('=SUM(A1)')).toBe("'=SUM(A1)");
    });

    it('still prefixes text that starts with a trigger character but is not purely numeric', () => {
      expect(neutralizeCsvFormula('-cmd')).toBe("'-cmd");
    });
  });
});

describe('escapeCsvField', () => {
  it('neutralizes a formula-injection cell before quote-escaping (SEC-15)', () => {
    expect(escapeCsvField('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    // Neutralized value has no comma/quote/newline, so it is NOT quote-wrapped.
    expect(escapeCsvField('+1+1,2')).toBe('"\'+1+1,2"');
  });

  it('leaves plain values unchanged', () => {
    expect(escapeCsvField('Cheryl Gonzales')).toBe('Cheryl Gonzales');
    expect(escapeCsvField(7200)).toBe('7200');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quote-wraps a value containing a comma', () => {
    expect(escapeCsvField('Gonzales, Cheryl')).toBe('"Gonzales, Cheryl"');
  });

  it('quote-wraps and doubles embedded quotes', () => {
    expect(escapeCsvField('5\' 10" tall')).toBe('"5\' 10"" tall"');
  });

  it('quote-wraps a value containing a newline or carriage return', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\rline2')).toBe('"line1\rline2"');
  });
});

describe('buildCsvContent', () => {
  it('joins rows with CRLF and cells with commas', () => {
    const content = buildCsvContent([
      ['Owner', 'API (TTD)'],
      ['A. Gopaul', 21600],
    ]);
    expect(content).toBe('Owner,API (TTD)\r\nA. Gopaul,21600');
  });

  it('escapes cells needing quoting inside a full table', () => {
    const content = buildCsvContent([
      ['Owner', 'Note'],
      ['R, Mohammed', 'contains "quotes"'],
    ]);
    expect(content).toBe('Owner,Note\r\n"R, Mohammed","contains ""quotes"""');
  });

  it('handles ragged rows (e.g. a 2-column meta row before a wider table)', () => {
    const content = buildCsvContent([
      ['Campaign', 'November Sprint'],
      [],
      ['Owner', 'Plan', 'State', 'API (TTD)'],
    ]);
    expect(content).toBe('Campaign,November Sprint\r\n\r\nOwner,Plan,State,API (TTD)');
  });

  it('returns empty string for empty/undefined input', () => {
    expect(buildCsvContent([])).toBe('');
    expect(buildCsvContent(undefined)).toBe('');
  });
});

describe('slugifyForFilename', () => {
  it('lowercases and replaces non-alphanumeric runs with a single dash', () => {
    expect(slugifyForFilename('November Sprint')).toBe('november-sprint');
    expect(slugifyForFilename('Staging Sprint — Qualify')).toBe('staging-sprint-qualify');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugifyForFilename('  !!Bonus Round!!  ')).toBe('bonus-round');
  });

  it('falls back to "export" for empty/undefined/symbol-only input', () => {
    expect(slugifyForFilename('')).toBe('export');
    expect(slugifyForFilename(undefined)).toBe('export');
    expect(slugifyForFilename('***')).toBe('export');
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Blob, an anchor with the right filename, clicks it, and revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    downloadCsv('campaign-proof-november-sprint-2026-07-15.csv', 'a,b\r\n1,2');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    const anchor = appendSpy.mock.calls[0][0];
    expect(anchor.tagName).toBe('A');
    expect(anchor.download).toBe('campaign-proof-november-sprint-2026-07-15.csv');
    expect(anchor.href).toBe('blob:mock-url');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
