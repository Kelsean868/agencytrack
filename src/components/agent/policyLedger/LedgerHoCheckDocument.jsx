/**
 * LedgerHoCheckDocument — "head-office check sheet" PDF (Policy Ledger L2,
 * docs/briefs/ledger-lens-build.md § L2 item 4). One landscape page listing
 * the FILTERED ledger rows, reduced to the columns head office can actually
 * verify a policy against.
 *
 * Built with @react-pdf/renderer — the same engine AgentReportDocument /
 * BranchPlanDocument / ManagerReportDocument already use, so it shares their
 * existing lazy `vendor-pdf` chunk (EFF-011, PR 802) with zero vite.config.js
 * change. Row data comes from `buildHoCheckExportTable` (src/lib/ledgerExportRows.js)
 * — the SAME pure builder the (never-shipped) jspdf path would have used —
 * so the CSV and this PDF can never disagree about which rows or values.
 *
 * HEX-ONLY: @react-pdf/renderer cannot resolve CSS custom properties. This is
 * a manual, one-way mirror of the light-mode Nexus v2 tokens, same as every
 * other react-pdf document in this app (see AgentReportDocument.jsx's own
 * header note) — EXEMPT from the app's no-raw-hex UI rule by the same
 * standing design (CLAUDE.md § UI rules: "AgentReportDocument.jsx is EXEMPT").
 */
import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { buildHoCheckExportTable } from '../../../lib/ledgerExportRows';

const C = {
  teal: '#01696f',
  ink: '#28251d',
  inkMuted: '#5c554a',
  inkFaint: '#7a7264',
  border: '#e5e2db',
  bg: '#f7f6f2',
};

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: C.ink, fontFamily: 'Helvetica' },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  meta: { fontSize: 8.5, color: C.inkMuted, marginBottom: 12 },
  thead: { flexDirection: 'row', backgroundColor: C.teal, paddingVertical: 5, paddingHorizontal: 6 },
  th: { color: '#ffffff', fontSize: 8, fontWeight: 700, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },
  trAlt: { backgroundColor: C.bg },
  td: { fontSize: 8.5, color: C.ink },
  right: { textAlign: 'right' },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7.5, color: C.inkFaint },
});

const FLEX = [3, 1.6, 1.4, 1.6, 1.4, 1.2, 2]; // Client, Policy, Status, Source, Issued, API, Flag

/**
 * @param {{ rows: object[], label: string, generatedOn: string }} props
 *   `rows` — the FILTERED `deriveAwardLens` row set (never re-filtered here).
 */
export function LedgerHoCheckDocument({ rows, label, generatedOn }) {
  const { headers, rows: body } = buildHoCheckExportTable(rows);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Policy ledger — head-office check sheet</Text>
        <Text style={s.meta}>{label ?? 'Filtered view'} · Generated {generatedOn}</Text>

        <View style={s.thead}>
          {headers.map((h, i) => (
            <Text key={h} style={[s.th, i === 5 ? s.right : null, { flex: FLEX[i] }]}>{h}</Text>
          ))}
        </View>
        {body.map((row, i) => (
          <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : null]} wrap={false}>
            {row.map((cell, j) => (
              <Text key={j} style={[s.td, j === 5 ? s.right : null, { flex: FLEX[j] }]}>
                {typeof cell === 'number' ? cell.toLocaleString('en-TT') : (cell || '—')}
              </Text>
            ))}
          </View>
        ))}
        {body.length === 0 && <Text style={[s.td, { marginTop: 8, color: C.inkMuted }]}>No policies match these filters.</Text>}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>AgencyTrack · Policy Ledger</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
