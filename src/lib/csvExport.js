/**
 * csvExport.js — small reusable CSV escaping + Blob-download helpers.
 *
 * Mirrors the escaping rules already used by exportService.exportBranchCSV
 * (RFC4180-ish: wrap in quotes and double-escape embedded quotes whenever a
 * field contains a comma, quote, or newline) so every CSV export in the app
 * behaves the same way. Escaping/row-building is pure and exported
 * separately from the download side effect so callers can unit-test CSV
 * content without touching the DOM.
 */

// SEC-15 — CSV formula injection. A cell opened in Excel/Sheets/LibreOffice
// that starts with one of these characters is interpreted as a formula (or,
// for tab/CR, can smuggle a second logical cell) rather than literal text —
// the classic CSV-injection vector for exports containing user-controlled
// values (names, notes, imported free text). Prefixing with a leading `'`
// forces the cell to render as text in every major spreadsheet app while
// leaving the underlying value intact.
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

// In-PR extension (dispatcher, PR #974) — a cell that is a REAL number
// (typeof number) or a plain numeric STRING (optionally signed, optionally
// thousands-separated, optionally with a decimal portion — "-5",
// "-5000.00", "1,234.56", "+250") is not a formula-injection risk even
// though its first character is in FORMULA_TRIGGER_CHARS. Only text that
// starts with a trigger character AND is not purely numeric gets prefixed —
// "-cmd" and "=SUM(A1)" still do; "-5,000.00" no longer does.
const NUMERIC_STRING_RE = /^[+-]?(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/;

/**
 * Neutralize a single cell value against CSV formula injection (SEC-15).
 * Purely additive — values that don't start with a trigger character, or
 * that are numbers/numeric-looking strings, are returned unchanged (same
 * type, not stringified). This is the ONE helper every CSV export site in
 * the app runs cell values through, either directly or via `escapeCsvField`
 * below.
 */
export function neutralizeCsvFormula(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'number') return val;
  const str = String(val);
  if (str.length === 0 || !FORMULA_TRIGGER_CHARS.has(str[0])) return val;
  if (NUMERIC_STRING_RE.test(str)) return val;
  return `'${str}`;
}

/** Escape a single CSV field per RFC4180 (quote-wrap on comma/quote/newline). */
export function escapeCsvField(val) {
  const safe = neutralizeCsvFormula(val);
  if (safe === null || safe === undefined) return '';
  const str = String(safe);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build CSV text (CRLF line endings) from an array of rows, where each row
 * is an array of cell values. Rows may be ragged (e.g. a 2-column meta row
 * followed by a wider data table) — each row is escaped/joined independently.
 */
export function buildCsvContent(rows) {
  return (rows ?? []).map((row) => (row ?? []).map(escapeCsvField).join(',')).join('\r\n');
}

/** Slugify a label for safe use inside a filename (lowercase, dashes, alnum only). */
export function slugifyForFilename(label) {
  const slug = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'export';
}

/** Trigger a browser download of `content` as a CSV file named `filename`. */
export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
