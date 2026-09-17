/**
 * loadPortfolioImport.js — reaches the ESM parser from CommonJS.
 *
 * The parser modules under `./esm/` are byte-identical copies of
 * `src/lib/portfolioImport/` (see `scripts/build/sync-portfolio-import.mjs`, and
 * the CI drift gate in `src/lib/portfolioImport/__tests__/functionsMirror.test.js`).
 * They are ESM; this functions package is CommonJS. Node 20 bridges the two with a
 * dynamic `import()`, which is async — hence a loader rather than a plain require.
 *
 * The promise is cached at module scope, not the resolved value: two concurrent
 * invocations on the same warm instance would otherwise both start an import and
 * the second could observe a half-initialised cache. Caching the PROMISE makes the
 * second caller await the first one's work.
 */

let pending = null;

/**
 * @returns {Promise<{parseOipaExport: Function, rowsFromSheetMatrix: Function,
 *   parseExportDateFromTitle: Function, buildImportPlan: Function,
 *   normaliseImportConfig: Function, OIPA_IMPORT_SOURCE: string,
 *   OIPA_IMPORT_CONFIG_PREF_ID: string}>}
 */
function loadPortfolioImport() {
  if (!pending) {
    pending = Promise.all([
      import('./esm/parseOipaExport.js'),
      import('./esm/buildImportPlan.js'),
      import('./esm/oipaImportConfig.js'),
    ]).then(([parse, plan, config]) => ({
      parseOipaExport: parse.parseOipaExport,
      rowsFromSheetMatrix: parse.rowsFromSheetMatrix,
      parseExportDateFromTitle: parse.parseExportDateFromTitle,
      buildImportPlan: plan.buildImportPlan,
      normaliseImportConfig: config.normaliseImportConfig,
      OIPA_IMPORT_SOURCE: config.OIPA_IMPORT_SOURCE,
      OIPA_IMPORT_CONFIG_PREF_ID: config.OIPA_IMPORT_CONFIG_PREF_ID,
      OIPA_HEADER_ROW_INDEX: config.OIPA_HEADER_ROW_INDEX,
    })).catch((err) => {
      // A failed import must not poison every later invocation on this instance.
      pending = null;
      throw err;
    });
  }
  return pending;
}

module.exports = { loadPortfolioImport };
