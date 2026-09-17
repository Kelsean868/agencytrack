/**
 * readWorkbook.js — turns an uploaded .xlsx into the array-of-arrays the pure
 * parser wants, plus the title cell it reads the export date from.
 *
 * WHY exceljs AND NOT xlsx:
 * `xlsx@0.18.5` is the reader the P2 admin script uses, and it stays there —
 * it is a devDependency at the repo root and has never been in the app bundle.
 * It is not brought into the deployed function: the npm-published SheetJS line
 * stopped at 0.18.5 and the project moved distribution off npm, so the version
 * npm serves no longer receives fixes. A reader that parses a file an agent
 * uploaded is the last place to run an unmaintained parser, so the SERVER uses
 * exceljs, which is maintained. (Dispatcher ruling 1, 17 Sep 2026.)
 *
 * WHAT THIS DOES NOT DO:
 * it does not interpret anything. Cell → value, that is all. Every decision about
 * what a row MEANS belongs to the mirrored pure parser, so the function, the admin
 * script and the unit tests all reach the same verdict.
 */

const ExcelJS = require('exceljs');

/** Hard ceiling on an upload. Ruling 1: .xlsx only, 5 MB, never stored. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * The first four bytes of every .xlsx (it is a ZIP container: "PK\x03\x04").
 * Checked because the extension and the declared MIME type are both supplied by
 * the caller and neither says anything about the bytes.
 */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Reads one cell as a plain JS value.
 *
 * exceljs hands back rich objects for some cell types, and each one would reach
 * the parser as `[object Object]` if passed through:
 *   - a formula cell is `{ formula, result }` — the RESULT is the value
 *   - a hyperlink cell is `{ text, hyperlink }`
 *   - a rich-text cell is `{ richText: [{ text }, …] }`
 * Dates arrive as real `Date` objects, which is exactly what the parser's
 * `dateOnly()` expects, so they pass through untouched.
 */
function cellValue(cell) {
  const v = cell == null ? null : cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return v.result ?? null;
    if ('text' in v) return v.text;
    if ('error' in v) return null;
  }
  return v;
}

/**
 * @param {Buffer} buffer  the uploaded .xlsx bytes
 * @returns {Promise<{sheetName: string, matrix: Array<Array<*>>, titleCell: *}>}
 * @throws {Error} with a `code` of 'too-large' | 'not-xlsx' | 'empty-workbook'
 */
async function readWorkbook(buffer) {
  const fail = (code, message) => {
    const e = new Error(message);
    e.code = code;
    throw e;
  };

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    fail('not-xlsx', 'The upload was empty.');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    fail('too-large', `That file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`);
  }
  if (!buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    fail('not-xlsx', 'That file is not an .xlsx workbook.');
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    fail('not-xlsx', `That .xlsx could not be read (${err.message}).`);
  }

  const sheet = wb.worksheets[0];
  if (!sheet) fail('empty-workbook', 'That workbook has no sheets.');

  // `sheet.rowCount` / `actualColumnCount` can disagree with what eachRow yields on
  // a sparse sheet, so the matrix is built from what is actually there and padded
  // to a rectangle — `rowsFromSheetMatrix` indexes by column position.
  const rows = [];
  let width = 0;
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = cellValue(cell);
    });
    for (let i = 0; i < values.length; i += 1) if (values[i] === undefined) values[i] = null;
    width = Math.max(width, values.length);
    rows[rowNumber - 1] = values;
  });
  for (let r = 0; r < rows.length; r += 1) {
    if (!rows[r]) rows[r] = [];
    while (rows[r].length < width) rows[r].push(null);
  }

  return {
    sheetName: sheet.name,
    matrix: rows,
    titleCell: rows[0] ? rows[0].find((v) => v != null && String(v).trim() !== '') ?? null : null,
  };
}

module.exports = { readWorkbook, cellValue, MAX_FILE_BYTES };
