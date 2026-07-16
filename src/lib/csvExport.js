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

/** Escape a single CSV field per RFC4180 (quote-wrap on comma/quote/newline). */
export function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
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
