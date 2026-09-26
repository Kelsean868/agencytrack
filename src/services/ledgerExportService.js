/**
 * ledgerExportService.js — L2 export side effects (docs/briefs/ledger-lens-build.md
 * § L2 item 4). CSV/PDF libraries are LAZY-LOADED here, on demand, so neither
 * ships in the app's main bundle (verified in the build gate: `npm run build`
 * output chunk map).
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
 * Row shaping lives in `src/lib/ledgerExportRows.js` (pure, unit-tested); this
 * file only wires that data into each library's write API and triggers the
 * browser download. Not unit-tested directly — the row builders it calls are.
 */
import { buildLedgerExportTable, buildHoCheckExportTable } from '../lib/ledgerExportRows';
import { buildCsvContent, downloadCsv, slugifyForFilename } from '../lib/csvExport';

/** CSV — reuses the S2 formula-injection-safe helper, full column set. */
export function exportLedgerCsv(rows, label) {
  const { headers, rows: body } = buildLedgerExportTable(rows);
  downloadCsv(`policy-ledger-${slugifyForFilename(label)}.csv`, buildCsvContent([headers, ...body]));
}

/** PDF "head-office check sheet" — reduced column set, one page to compare
 * against HO records. */
export async function exportLedgerPdf(rows, label) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const { headers, rows: body } = buildHoCheckExportTable(rows);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(12);
  doc.text('Policy ledger — head-office check sheet', 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [headers],
    body,
    styles: { fontSize: 8 },
  });
  doc.save(`policy-ledger-ho-check-${slugifyForFilename(label)}.pdf`);
}
