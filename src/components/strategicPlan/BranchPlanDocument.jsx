import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency } from '../../utils/formatters';
import { BRAND_NAME } from '../../constants/brand';

// Track K — Strategic Plan · PDF document. Follows AgentReportDocument.jsx:
// @react-pdf/renderer CANNOT resolve CSS custom properties, so this palette is a
// manual hex mirror of the light-mode Nexus v2 tokens (src/index.css :root). The
// PDF is always paper → light theme. KEEP IN SYNC MANUALLY when a token changes.
// This file is EXEMPT from the app token rules by design (CLAUDE.md § UI rules).
//
// NUMBERS: every value comes from the useStrategicPlan model passed in — the SAME
// single math path as the dashboard + presentation mode. NO re-derivation here.
const C = {
  teal: '#01696f',
  bg: '#f7f6f2',
  paper: '#ffffff',
  text: '#28251d',
  textMuted: '#6b6560',
  inkFaint: '#7a7264',
  border: '#e5e2db',
  success: '#2d7a4f',
  danger: '#c0392b',
  white: '#ffffff',
};

const fmtTTD = (v) => (v == null ? '—' : formatCurrency(v));
const fmtNum = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-TT'));
const fmtPct = (v) => (v == null ? '—' : `${Math.round(v)}%`);
const fmtYears = (v) => (v == null ? '—' : `${v}y`);

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.text, fontFamily: 'Helvetica', fontSize: 9, paddingTop: 44, paddingBottom: 40, paddingHorizontal: 40 },
  coverPage: { backgroundColor: C.bg, color: C.text, fontFamily: 'Helvetica', padding: 48, justifyContent: 'center' },
  kicker: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.teal, letterSpacing: 1.6, textTransform: 'uppercase' },
  h1: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: C.text, marginTop: 10 },
  coverMeta: { fontSize: 11, color: C.textMuted, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 2 },
  sectionSub: { fontSize: 8.5, color: C.textMuted, marginBottom: 10 },
  sectionNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.teal, letterSpacing: 1.4, marginBottom: 2 },
  thead: { flexDirection: 'row', backgroundColor: C.teal, paddingVertical: 5, paddingHorizontal: 6 },
  th: { color: C.white, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },
  td: { fontSize: 8, color: C.text },
  tdMuted: { fontSize: 8, color: C.textMuted },
  right: { textAlign: 'right' },
  footer: { position: 'absolute', bottom: 16, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7.5, color: C.inkFaint },
});

function Footer({ meta }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{BRAND_NAME} · {meta?.branchName ?? ''}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionHead({ num, title, sub }) {
  return (
    <View>
      <Text style={s.sectionNum}>{num}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

export function BranchPlanDocument({ plan }) {
  const meta = plan?.meta;
  const agents = plan?.agents?.rows ?? [];
  const prod = plan?.production;
  const pm = plan?.periodMetrics;
  const org = plan?.orgStructure;
  const rec = plan?.recruitment;
  const periodLabel = meta?.period ? `${meta.period.year} · ${meta.period.granularity === 'half' ? 'Half-year' : 'Quarterly'} plan` : '';

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.kicker}>Agency Strategic Plan</Text>
        <Text style={s.h1}>{meta?.branchName ?? 'Branch'}</Text>
        <Text style={s.coverMeta}>{periodLabel}</Text>
        <Text style={s.coverMeta}>Agency Manager · {meta?.authorName ?? '—'}</Text>
        <Text style={[s.coverMeta, { fontSize: 9, color: C.inkFaint }]}>
          Generated {meta?.generatedAt ? new Date(meta.generatedAt).toLocaleDateString('en-TT') : ''}
        </Text>
      </Page>

      {/* Agent Tracker */}
      <Page size="A4" style={s.page}>
        <SectionHead num="01" title="Agent Performance Tracker" sub="Year-to-date net production vs annual objective" />
        <View style={s.thead}>
          <Text style={[s.th, { flex: 3 }]}>Advisor</Text>
          <Text style={[s.th, s.right, { flex: 1 }]}>Exp</Text>
          <Text style={[s.th, s.right, { flex: 1 }]}>Persist.</Text>
          <Text style={[s.th, s.right, { flex: 2 }]}>API Net</Text>
          <Text style={[s.th, s.right, { flex: 1 }]}>% Obj</Text>
        </View>
        {agents.map((r) => (
          <View style={s.tr} key={r.id} wrap={false}>
            <Text style={[s.td, { flex: 3 }]}>{r.name}{r.isUnitHead ? '  (unit head)' : ''}</Text>
            <Text style={[s.tdMuted, s.right, { flex: 1 }]}>{fmtYears(r.experienceYears)}</Text>
            <Text style={[s.td, s.right, { flex: 1 }]}>{fmtPct(r.persistencyPct)}</Text>
            <Text style={[s.td, s.right, { flex: 2 }]}>{fmtTTD(r.apiNetSettled)}</Text>
            <Text style={[s.td, s.right, { flex: 1, color: r.apiPctObj != null && r.apiPctObj < 50 ? C.danger : C.success }]}>{fmtPct(r.apiPctObj)}</Text>
          </View>
        ))}
        {agents.length === 0 && <Text style={[s.tdMuted, { marginTop: 8 }]}>No advisors in this branch.</Text>}
        <Footer meta={meta} />
      </Page>

      {/* Production Summary */}
      <Page size="A4" style={s.page}>
        <SectionHead num="02" title="Production Summary" sub="Annual quota, settled production, and run-rate projection" />
        {prod ? (
          <>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 2 }]}>Metric</Text>
              <Text style={[s.th, s.right, { flex: 2 }]}>Annual quota</Text>
              <Text style={[s.th, s.right, { flex: 2 }]}>Gross settled</Text>
              <Text style={[s.th, s.right, { flex: 2 }]}>Net settled</Text>
              <Text style={[s.th, s.right, { flex: 2 }]}>Projected EOY</Text>
            </View>
            <View style={s.tr}>
              <Text style={[s.td, { flex: 2 }]}>API</Text>
              <Text style={[s.tdMuted, s.right, { flex: 2 }]}>{fmtTTD(prod.annual.apiQuota)}</Text>
              <Text style={[s.td, s.right, { flex: 2 }]}>{fmtTTD(prod.annual.apiGrossSettled)}</Text>
              <Text style={[s.td, s.right, { flex: 2 }]}>{fmtTTD(prod.annual.apiNetSettled)}</Text>
              <Text style={[s.td, s.right, { flex: 2 }]}>{fmtTTD(prod.annual.projectedApi)}</Text>
            </View>
            <View style={s.tr}>
              <Text style={[s.td, { flex: 2 }]}>APP</Text>
              <Text style={[s.tdMuted, s.right, { flex: 2 }]}>{fmtNum(prod.annual.appQuota)}</Text>
              <Text style={[s.td, s.right, { flex: 2 }]}>{fmtNum(prod.annual.appGrossSettled)}</Text>
              <Text style={[s.td, s.right, { flex: 2 }]}>{fmtNum(prod.annual.appNetSettled)}</Text>
              <Text style={[s.td, s.right, { flex: 2 }]}>{fmtNum(prod.annual.projectedApp)}</Text>
            </View>
            <Text style={[s.tdMuted, { marginTop: 10 }]}>
              Monthly quota (prorated): {fmtTTD(prod.monthly.apiQuota)} · Avg monthly production: {fmtTTD(prod.monthly.avgMonthlyApi)}
            </Text>
            <Text style={[s.tdMuted, { marginTop: 4 }]}>Branch persistency (current): {fmtPct(prod.persistency.currentPct)}</Text>
          </>
        ) : <Text style={s.tdMuted}>No production data.</Text>}
        <Footer meta={meta} />
      </Page>

      {/* Period Metrics */}
      <Page size="A4" style={s.page}>
        <SectionHead num="03" title="Period Metrics" sub={pm ? (pm.granularity === 'half' ? 'Half-year goal vs actual' : 'Quarterly goal vs actual') : 'Goal vs actual'} />
        <View style={s.thead}>
          <Text style={[s.th, { flex: 2 }]}>Period</Text>
          <Text style={[s.th, s.right, { flex: 3 }]}>API goal</Text>
          <Text style={[s.th, s.right, { flex: 3 }]}>API actual</Text>
          <Text style={[s.th, s.right, { flex: 3 }]}>Variance</Text>
          <Text style={[s.th, s.right, { flex: 2 }]}>Manpower</Text>
        </View>
        {(pm?.rows ?? []).map((r) => (
          <View style={s.tr} key={r.key}>
            <Text style={[s.td, { flex: 2 }]}>{r.label}</Text>
            <Text style={[s.tdMuted, s.right, { flex: 3 }]}>{fmtTTD(r.apiGoal)}</Text>
            <Text style={[s.td, s.right, { flex: 3 }]}>{fmtTTD(r.apiActual)}</Text>
            <Text style={[s.td, s.right, { flex: 3, color: r.apiVariance != null && r.apiVariance < 0 ? C.danger : C.success }]}>
              {r.apiVariance == null ? '—' : `${r.apiVariance < 0 ? '-' : '+'}${formatCurrency(Math.abs(r.apiVariance))}`}
            </Text>
            <Text style={[s.td, s.right, { flex: 2 }]}>{fmtNum(r.manpowerActual)}</Text>
          </View>
        ))}
        <Footer meta={meta} />
      </Page>

      {/* Org Structure */}
      <Page size="A4" style={s.page}>
        <SectionHead num="04" title="Organisation Structure" sub={org ? `${org.unitCount} units · ${org.adminCount} admin` : 'Units & advisors'} />
        {(org?.units ?? []).map((u) => (
          <View key={u.unitId} style={{ marginBottom: 10 }} wrap={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text }}>
                {u.unitName}{u.headName ? `  ·  ${u.headName} (${u.headTitle})` : ''}
              </Text>
              <Text style={[s.td]}>{fmtTTD(u.ytdNetApi)} net</Text>
            </View>
            {u.advisors.map((a) => (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }} key={a.id}>
                <Text style={s.td}>{a.name}</Text>
                <Text style={s.tdMuted}>{a.title} · {fmtYears(a.experienceYears)}</Text>
              </View>
            ))}
          </View>
        ))}
        <Footer meta={meta} />
      </Page>

      {/* Recruitment */}
      <Page size="A4" style={s.page}>
        <SectionHead num="05" title="Recruitment Pipeline" sub={rec ? `${rec.total} active · ${rec.hired} licensed` : 'Candidate pipeline'} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {(rec?.byStage ?? []).map((st) => (
            <View key={st.key} style={{ width: 72, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingVertical: 6, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.text }}>{st.count}</Text>
              <Text style={{ fontSize: 6.5, color: C.textMuted, marginTop: 2 }}>{st.label}</Text>
            </View>
          ))}
        </View>
        <View style={s.thead}>
          <Text style={[s.th, { flex: 3 }]}>Candidate</Text>
          <Text style={[s.th, { flex: 2 }]}>Source</Text>
          <Text style={[s.th, { flex: 2 }]}>Stage</Text>
        </View>
        {(rec?.rows ?? []).map((c) => (
          <View style={s.tr} key={c.id} wrap={false}>
            <Text style={[s.td, { flex: 3 }]}>{c.name}</Text>
            <Text style={[s.tdMuted, { flex: 2 }]}>{c.source || '—'}</Text>
            <Text style={[s.td, { flex: 2 }]}>{c.hired ? 'Licensed' : c.stage}</Text>
          </View>
        ))}
        {(rec?.rows ?? []).length === 0 && <Text style={s.tdMuted}>No recruiting candidates.</Text>}
        <Footer meta={meta} />
      </Page>
    </Document>
  );
}
