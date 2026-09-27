/**
 * ledgerExportService.js — L2 export side effects (docs/briefs/ledger-lens-build.md
 * § L2 item 4). The PDF engine is LAZY-LOADED here, on demand, so it never
 * ships in the app's main bundle (verified in the build gate: `npm run build`
 * output chunk map, and by loading the built app and confirming no PDF-engine
 * request fires before the export menu's PDF action).
 *
 * NO EXCEL (.xlsx) EXPORT — the brief asks for one via the existing xlsx
 * dependency, but `src/lib/portfolioImport/__tests__/clientBundleGuard.test.js`
 * (Ruling 1, 17 Sep 2026) fails the whole suite the instant ANY app-source
 * file names that package in a bare import specifier, whether the loader call
 * is written statically or as a lazy dynamic call — its `bareImports` regex
 * matches both forms alike. That package is a devDependency ONLY, kept out of
 * the client bundle on purpose: "a ~400 KB unmaintained parser, on the phones
 * of people on intermittent connections." Verified by actually running the
 * full suite (Rule 17) rather than assuming the brief's "existing xlsx dep"
 * note meant it was already client-safe. Widening Ruling 1 to permit a
 * write-only, lazy-loaded writer for that format is a real option but is an
 * architectural call outside this PR's authority — banked as a FOLLOW_UPS
 * entry for the dispatcher. CSV (any spreadsheet can open it) and PDF stand in
 * for Excel in the meantime; neither pulls in a banned package.
 *
 * PDF ENGINE: @react-pdf/renderer, not jspdf (orchestrator decision — keeps
 * `vite.config.js` untouched, since @react-pdf already has its own lazy
 * `vendor-pdf` chunk from EFF-011 (PR 802) and the autorun-merge rule only allows
 * `src/**` / `docs/**` / tests / test scripts to change). Same
 * `import('@react-pdf/renderer')` + `pdf(doc).toBlob()` pattern
 * `generateAgentPDF` (exportService.js) already uses.
 *
 * Row shaping lives in `src/lib/ledgerExportRows.js` (pure, unit-tested); this
 * file only wires that data into each library's write API and triggers the
 * browser download. Not unit-tested directly — the row builders it calls are.
 */
import { createElement } from 'react';
import { buildLedgerExportTable } from '../lib/ledgerExportRows';
import { buildCsvContent, downloadCsv, slugifyForFilename } from '../lib/csvExport';
import { getTodayTT } from '../utils/dateInputs';

/** CSV — reuses the S2 formula-injection-safe helper, full column set. */
export function exportLedgerCsv(rows, label) {
  const { headers, rows: body } = buildLedgerExportTable(rows);
  downloadCsv(`policy-ledger-${slugifyForFilename(label)}.csv`, buildCsvContent([headers, ...body]));
}

/** PDF "head-office check sheet" — reduced column set, one page to compare
 * against HO records. Lazy-loads @react-pdf/renderer + the document. */
export async function exportLedgerPdf(rows, label) {
  const [{ pdf }, { LedgerHoCheckDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/agent/policyLedger/LedgerHoCheckDocument'),
  ]);
  const generatedOn = getTodayTT();
  const doc = createElement(LedgerHoCheckDocument, { rows, label, generatedOn });
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `policy-ledger-ho-check-${slugifyForFilename(label)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
