/**
 * ledgerExportRows.js — L2 export row-shaping (docs/briefs/ledger-lens-build.md
 * § L2 item 4). Pure data-shaping only: no DOM, no Blob, no `xlsx`/`jspdf`
 * import — those libraries are lazy-loaded by the caller (LedgerExportMenu)
 * only when an export actually fires, and the shape returned here is what
 * every format (Excel, CSV, PDF) is built from, so the three exports can
 * never disagree about which filtered rows or which values they show.
 *
 * `rows` here is the FILTERED `deriveAwardLens` row set — `{ policy, group,
 * credit, reason, hoFlag }` — never the unfiltered ledger (brief § L2 item 4:
 * "Export the filtered rows").
 *
 * NO Excel builder here — see `src/services/ledgerExportService.js` header for
 * why the brief's `.xlsx` export was dropped (Ruling 1's client-bundle guard).
 * `buildLedgerExportTable`'s full column set is shared by CSV only for now.
 */
import { toDisplayDate, FREQ_LABELS, humanizeToken } from './ledgerFilters';
import { toDateStr } from './policyCampaignLens';
import { policyValue } from './policyLedgerDerivation';
import { POLICY_STATUS_LABELS } from '../constants/policyLifecycle';
import { STATUS_SOURCE_IMPORT } from './portfolioImport/oipaImportConfig';

function sourceLabel(policy) {
  return policy?.statusSource === STATUS_SOURCE_IMPORT ? 'Head office' : 'Self-confirmed';
}

function flagLabel(row) {
  return row.hoFlag ? 'Not on head-office list yet' : '';
}

/** The full-column row set — CSV uses this (see file header re: no Excel builder). */
export const FULL_COLUMNS = [
  'Client', 'Policy', 'Product', 'Frequency', 'Status', 'Source',
  'Submitted', 'Issued', 'API (TTD)', 'Counts toward', 'Flag',
];

export function buildFullExportRow(row) {
  const p = row.policy ?? {};
  return [
    p.ownerName ?? '',
    p.policyNumber ?? '',
    humanizeToken(p.policyClass),
    FREQ_LABELS[p.proposedFrequency] ?? (p.proposedFrequency ?? ''),
    POLICY_STATUS_LABELS[p.status] ?? p.status ?? '',
    sourceLabel(p),
    toDisplayDate(toDateStr(p.dateSubmitted) ?? toDateStr(p.dateWritten)),
    toDisplayDate(toDateStr(p.dateIssued)),
    policyValue(p),
    row.credit?.api ?? 0,
    flagLabel(row),
  ];
}

/**
 * buildLedgerExportTable(rows) -> { headers, rows } — the Excel/CSV table for
 * the currently filtered row set.
 */
export function buildLedgerExportTable(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    headers: FULL_COLUMNS,
    rows: list.map(buildFullExportRow),
  };
}

// ── PDF "head-office check sheet" — a REDUCED column set (brief § L2 item 4):
// one page to compare against HO records, so only the columns HO can actually
// verify a policy against are kept.
export const HO_CHECK_COLUMNS = ['Client', 'Policy', 'Status', 'Source', 'Issued', 'API (TTD)', 'Flag'];

export function buildHoCheckExportRow(row) {
  const p = row.policy ?? {};
  return [
    p.ownerName ?? '',
    p.policyNumber ?? '',
    POLICY_STATUS_LABELS[p.status] ?? p.status ?? '',
    sourceLabel(p),
    toDisplayDate(toDateStr(p.dateIssued)),
    policyValue(p),
    flagLabel(row),
  ];
}

export function buildHoCheckExportTable(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    headers: HO_CHECK_COLUMNS,
    rows: list.map(buildHoCheckExportRow),
  };
}
