/**
 * ManagerReportDocument — refined Branch + Unit Performance Report PDFs
 * (@react-pdf/renderer). One parameterized document renders both scopes; the
 * thin BranchReportDocument / UnitReportDocument exports set `scope`.
 *
 * Replaces the raw 15-column CSV (exportBranchCSV, kept intact for its own
 * export path) with a shareable, narrative PDF per docs/design-system/
 * screens-v2/pdf-{branch,unit}.jsx.
 *
 * NUMBERS: every figure is passed in already-derived by the calling view
 * (Unit/BranchManagerProductionView), which computes them through the SAME
 * lib/productionReport/computations utils the live surfaces use
 * (computeAgentTotals / computeUnitAggregates / computeBranchAggregates /
 * rankAgentsByApi / computeComplianceStats). This document does NO fetching and
 * introduces NO second math path — buildManagerReportModel only normalizes the
 * passed rows for layout.
 *
 * HEX-ONLY: @react-pdf/renderer cannot resolve CSS custom properties. This
 * palette mirrors the light-mode Nexus v2 tokens; this file is EXEMPT from the
 * app token rules by design (see CLAUDE.md § UI rules), same as
 * AgentReportDocument.jsx.
 *
 * SKIP-LOG (no source in the view's loaded data — read-light rule):
 *  - Persistency column on the roster + persistency-based at-risk flags: the
 *    production-report views do not load persistency records.
 *  - CI→App conversion column: computeAgentTotals carries production totals, not
 *    the ratio chain, so per-agent conversion is not available to the roster.
 *  - Coaching-note / recommended-action prose (unit report §03): no coaching
 *    source is loaded.
 *  Rendered honestly with what the view supplies: totals, unit rollup, ranked
 *  roster (API + apps + bar), weekly compliance, and top performers.
 */
import React from 'react';
import {
  Document, Page, View, Text, StyleSheet, Svg, Circle, Rect,
} from '@react-pdf/renderer';
import { formatCurrency } from '../../utils/formatters';
import { BRAND_NAME, CONTACT_EMAIL } from '../../constants/brand';
import { buildManagerReportModel } from './managerReportModel';

const COLORS = {
  teal: '#01696f', tealDark: '#014e52', tealMid: '#02838a', tealTint: '#e6f4f4',
  paper: '#ffffff', paperCream: '#fbfaf6', paperPanel: '#f9f7f2', surfaceRaised: '#fafaf8',
  text: '#28251d', textMuted: '#6b6560', inkFaint: '#7a7264',
  border: '#e5e2db', ruleStrong: '#cfcbc2',
  gold: '#b07d1a', goldInk: '#8a6011',
  success: '#2d7a4f', successBg: '#e8f5ee', successInk: '#1f6c41',
  warning: '#b45309', warningBg: '#fef3e2', warningInk: '#a24100',
  danger: '#c0392b', dangerBg: '#fde8e7', dangerInk: '#b22b1d',
  white: '#ffffff',
};

const PAGE_PAD = 40;

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.paper, fontFamily: 'Helvetica', color: COLORS.text, fontSize: 10, paddingTop: 46, paddingBottom: 40 },
  coverPage: { backgroundColor: COLORS.paperCream, fontFamily: 'Helvetica', color: COLORS.text, fontSize: 10, position: 'relative' },
  section: { paddingHorizontal: PAGE_PAD, marginTop: 18 },
  runHeader: { position: 'absolute', top: 16, left: PAGE_PAD, right: PAGE_PAD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  runHeaderMeta: { fontSize: 8.5, color: COLORS.textMuted },
  footerBand: { position: 'absolute', bottom: 14, left: PAGE_PAD, right: PAGE_PAD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: COLORS.inkFaint, letterSpacing: 0.4 },
  sectionMarkWrap: { marginBottom: 10 },
  sectionMarkTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sectionMarkNum: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.teal, letterSpacing: 1.8 },
  sectionMarkRule: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: 12 },
  sectionMarkTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: -0.2 },
  sectionMarkSub: { fontSize: 8.5, color: COLORS.textMuted, marginTop: 3, lineHeight: 1.4 },
  card: { backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14 },
});

// ── Chrome ───────────────────────────────────────────────────────────────────
function BrandGlyph({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Rect x={0} y={0} width={200} height={200} rx={44} fill={COLORS.tealDark} />
      <Rect x={72} y={127} width={11} height={18} rx={2.5} fill="#ffffff" fillOpacity={0.35} />
      <Rect x={87} y={117} width={11} height={28} rx={2.5} fill="#ffffff" fillOpacity={0.55} />
      <Rect x={102} y={105} width={11} height={40} rx={2.5} fill="#ffffff" fillOpacity={0.78} />
      <Rect x={117} y={93} width={11} height={52} rx={2.5} fill="#ffffff" />
      <Circle cx={122.5} cy={86} r={4.5} fill="#4ecdc4" />
    </Svg>
  );
}

function RunningHeader({ label }) {
  return (
    <View style={styles.runHeader} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <BrandGlyph size={16} />
        <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginLeft: 6 }}>{BRAND_NAME}</Text>
        <Text style={{ fontSize: 8.5, color: COLORS.inkFaint, marginHorizontal: 6 }}>·</Text>
        <Text style={styles.runHeaderMeta}>Performance Report</Text>
      </View>
      <Text style={styles.runHeaderMeta}>{label} · YTD {new Date().getFullYear()}</Text>
    </View>
  );
}

function PageFooter({ pageNumber, totalPages }) {
  return (
    <View style={styles.footerBand} fixed>
      <Text style={styles.footerText}>{`${BRAND_NAME}  ·  ${CONTACT_EMAIL}  ·  Confidential  ·  TTD`}</Text>
      <Text style={styles.footerText}>{`Page ${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`}</Text>
    </View>
  );
}

function SectionMark({ n, title, subtitle }) {
  return (
    <View style={styles.sectionMarkWrap}>
      <View style={styles.sectionMarkTop}>
        <Text style={styles.sectionMarkNum}>{n}</Text>
        <View style={styles.sectionMarkRule} />
      </View>
      <Text style={styles.sectionMarkTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionMarkSub}>{subtitle}</Text> : null}
    </View>
  );
}

function Medal({ rank, size = 16 }) {
  const bg = rank === 1 ? COLORS.gold : rank === 2 ? '#94a3b8' : '#c08d6b';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: COLORS.white, fontSize: size * 0.5, fontFamily: 'Helvetica-Bold' }}>{rank}</Text>
    </View>
  );
}

// ── Core report ──────────────────────────────────────────────────────────────
function ManagerReport(props) {
  const m = buildManagerReportModel(props);
  const TOTAL = 3;
  const scopeWord = m.scope === 'branch' ? 'Branch' : 'Unit';
  const rosterUnitLabel = m.scope === 'branch' ? 'AGENT · UNIT' : 'AGENT';

  const tiles = m.scope === 'branch'
    ? [
        { eyebrow: `${m.periodLabel.toUpperCase()} · API`, value: formatCurrency(m.totals.totalApi) },
        { eyebrow: 'APPLICATIONS', value: String(m.totals.totalApps) },
        { eyebrow: 'ACTIVE AGENTS', value: String(m.totals.agentCount) },
        { eyebrow: 'UNITS', value: String(m.totals.unitCount ?? m.units.length) },
      ]
    : [
        { eyebrow: `${m.periodLabel.toUpperCase()} · API`, value: formatCurrency(m.totals.totalApi) },
        { eyebrow: 'APPLICATIONS', value: String(m.totals.totalApps) },
        { eyebrow: 'ACTIVE AGENTS', value: String(m.totals.agentCount) },
        { eyebrow: 'AVG API / AGENT', value: formatCurrency(m.totals.avgApiPerAgent) },
      ];

  return (
    <Document>
      {/* ═══ COVER ═══════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.coverPage}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: COLORS.teal }} />
        <View style={{ position: 'absolute', top: 38, left: 56, right: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BrandGlyph size={26} />
            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{BRAND_NAME}</Text>
              <Text style={{ fontSize: 8.5, color: COLORS.textMuted, marginTop: 1 }}>Tatil Life · Trinidad & Tobago</Text>
            </View>
          </View>
          <Text style={{ fontSize: 8.5, color: COLORS.textMuted, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold' }}>CONFIDENTIAL</Text>
        </View>

        <View style={{ position: 'absolute', top: 190, left: 56, right: 56 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 9, color: COLORS.teal, fontFamily: 'Helvetica-Bold', letterSpacing: 1.8 }}>{m.year} · YTD</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.ruleStrong, marginHorizontal: 10 }} />
            <Text style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6 }}>{scopeWord.toUpperCase()} PERFORMANCE REPORT</Text>
          </View>
          <Text style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 14 }}>{m.orgLabel.toUpperCase()}</Text>
          <Text style={{ fontSize: 38, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: -1, lineHeight: 1.02 }}>
            {m.totals.agentCount} {m.totals.agentCount === 1 ? 'agent' : 'agents'}.
          </Text>
          <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 16, lineHeight: 1.5 }}>
            {[m.managerName, `${scopeWord} Manager`, m.periodLabel].filter(Boolean).join('   ·   ')}
          </Text>
        </View>

        <View style={{
          position: 'absolute', bottom: 120, left: 56, right: 56,
          padding: 22, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
        }}>
          <Text style={{ fontSize: 8.5, color: COLORS.teal, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6, marginBottom: 6 }}>
            {scopeWord.toUpperCase()} · {m.periodLabel.toUpperCase()} API
          </Text>
          <Text style={{ fontSize: 34, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: -0.8 }}>{formatCurrency(m.totals.totalApi)}</Text>
          <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8, lineHeight: 1.5 }}>
            {`${m.totals.totalApps} applications · ${formatCurrency(m.totals.avgApiPerAgent)} avg per agent`}
          </Text>
        </View>

        <View style={{
          position: 'absolute', bottom: 40, left: 56, right: 56, flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border,
        }}>
          <View>
            <Text style={{ fontSize: 8, color: COLORS.inkFaint, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>REPORTING PERIOD</Text>
            <Text style={{ fontSize: 10, color: COLORS.text, fontFamily: 'Helvetica-Bold' }}>{m.periodLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: COLORS.inkFaint, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>ISSUED</Text>
            <Text style={{ fontSize: 10, color: COLORS.text, fontFamily: 'Helvetica-Bold' }}>{m.issuedDate}</Text>
          </View>
        </View>
      </Page>

      {/* ═══ PAGE 2 — Totals + rollup + roster ═══════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <RunningHeader label={m.orgLabel} />

        <View style={styles.section}>
          <SectionMark n="01" title={`The ${scopeWord.toLowerCase()}, in numbers`} subtitle={`${m.periodLabel} headline figures across ${m.totals.agentCount} agents${m.scope === 'branch' ? ` and ${m.totals.unitCount ?? m.units.length} units` : ''}.`} />
          <View style={{ flexDirection: 'row' }}>
            {tiles.map((t, i) => (
              <View key={t.eyebrow} style={{ flex: 1, marginRight: i < 3 ? 10 : 0, padding: 12, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 }}>
                <Text style={{ fontSize: 7.5, color: COLORS.teal, fontFamily: 'Helvetica-Bold', letterSpacing: 0.9 }}>{t.eyebrow}</Text>
                <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginTop: 6, letterSpacing: -0.3 }}>{t.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {m.scope === 'branch' && m.units.length > 0 && (
          <View style={styles.section} wrap={false}>
            <SectionMark n="02" title="Performance by unit" subtitle="Average API per agent, and each unit's headcount." />
            {m.units.map((u, i) => {
              const pct = Math.max(2, Math.min(100, (u.avgApiPerAgent / m.unitTotalApiMax) * 100));
              return (
                <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < m.units.length - 1 ? 1 : 0, borderBottomColor: COLORS.border }}>
                  <View style={{ width: 150 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{u.name}</Text>
                    <Text style={{ fontSize: 8, color: COLORS.inkFaint, marginTop: 1 }}>{u.agentCount} agents</Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <View style={{ height: 6, backgroundColor: COLORS.border, borderRadius: 3 }}>
                      <View style={{ width: `${pct}%`, height: 6, backgroundColor: COLORS.teal, borderRadius: 3 }} />
                    </View>
                  </View>
                  <Text style={{ width: 100, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{formatCurrency(u.avgApiPerAgent)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Roster */}
        <View style={styles.section}>
          <SectionMark
            n={m.scope === 'branch' ? '03' : '02'}
            title="Agent roster"
            subtitle={`Ranked by ${m.periodLabel.toLowerCase()} API. Bars scale to the top producer.${m.hiddenCount > 0 ? ` Top ${m.visibleRoster.length} of ${m.roster.length} shown.` : ''}`}
          />
          {m.roster.length === 0 ? (
            <Text style={{ fontSize: 9, color: COLORS.textMuted, paddingVertical: 8 }}>No production recorded for this period.</Text>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.ruleStrong }}>
                <Text style={{ width: 20, fontSize: 7.5, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold' }}>#</Text>
                <Text style={{ width: 150, fontSize: 7.5, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold' }}>{rosterUnitLabel}</Text>
                <Text style={{ flex: 1, fontSize: 7.5, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold' }}>API · TTD</Text>
                <Text style={{ width: 40, textAlign: 'right', fontSize: 7.5, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold' }}>APPS</Text>
              </View>
              {m.visibleRoster.map((a, i) => {
                const pct = Math.max(2, Math.min(100, (a.totalApi / m.maxApi) * 100));
                return (
                  <View key={`${a.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i < m.visibleRoster.length - 1 ? 0.5 : 0, borderBottomColor: COLORS.border }}>
                    <View style={{ width: 20 }}>
                      {a.rank <= 3 ? <Medal rank={a.rank} size={15} /> : <Text style={{ fontSize: 9, color: COLORS.inkFaint }}>{a.rank}</Text>}
                    </View>
                    <View style={{ width: 150 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{a.name}</Text>
                      {a.unit ? <Text style={{ fontSize: 8, color: COLORS.inkFaint, marginTop: 1 }}>{a.unit}</Text> : null}
                    </View>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginBottom: 3 }}>{formatCurrency(a.totalApi)}</Text>
                      <View style={{ height: 5, backgroundColor: COLORS.border, borderRadius: 3 }}>
                        <View style={{ width: `${pct}%`, height: 5, backgroundColor: COLORS.teal, borderRadius: 3 }} />
                      </View>
                    </View>
                    <Text style={{ width: 40, textAlign: 'right', fontSize: 9.5, color: COLORS.text }}>{a.totalApps}</Text>
                  </View>
                );
              })}
              {m.hiddenCount > 0 && (
                <View style={{ marginTop: 8, padding: 8, backgroundColor: COLORS.paperPanel, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
                    <Text style={{ color: COLORS.text, fontFamily: 'Helvetica-Bold' }}>{m.hiddenCount} more {m.hiddenCount === 1 ? 'agent' : 'agents'}</Text> not shown. Full roster available in the Master Sheet / CSV export.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <PageFooter pageNumber={2} totalPages={TOTAL} />
      </Page>

      {/* ═══ PAGE 3 — Compliance + Top performers ════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <RunningHeader label={m.orgLabel} />

        {m.compliance && (
          <View style={styles.section}>
            <SectionMark n={m.scope === 'branch' ? '04' : '03'} title="Weekly compliance" subtitle="On-time submission rate for the current week." />
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.paperCream, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 }}>
              <ComplianceDonut percent={m.compliance.percent} />
              <View style={{ flex: 1, marginLeft: 24 }}>
                <Text style={{ fontSize: 8.5, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold', letterSpacing: 1 }}>SUBMITTED THIS WEEK</Text>
                <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: m.compliance.percent >= 80 ? COLORS.successInk : m.compliance.percent >= 60 ? COLORS.warningInk : COLORS.dangerInk, marginTop: 4 }}>
                  {m.compliance.submitted} / {m.compliance.total}
                </Text>
                <Text style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 4 }}>agents submitted their weekly report on time.</Text>
              </View>
            </View>
          </View>
        )}

        {m.topPerformers.length > 0 && (
          <View style={styles.section}>
            <SectionMark n={m.scope === 'branch' ? '05' : '04'} title={`Top performers · ${m.periodLabel.toLowerCase()}`} />
            <View style={{ flexDirection: 'row' }}>
              {m.topPerformers.map((p, i) => (
                <View key={`${p.name}-${i}`} style={{ flex: 1, marginRight: i < m.topPerformers.length - 1 ? 12 : 0, padding: 14, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 }}>
                  <Medal rank={p.rank} size={32} />
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginTop: 10 }}>{p.name}</Text>
                  {p.unit ? <Text style={{ fontSize: 8, color: COLORS.inkFaint, marginTop: 1 }}>{p.unit}</Text> : null}
                  <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginTop: 8, letterSpacing: -0.3 }}>{formatCurrency(p.totalApi)}</Text>
                  <Text style={{ fontSize: 8.5, color: COLORS.textMuted, marginTop: 4 }}>{p.totalApps} applications</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {m.scope === 'unit' && m.unitRank != null && (
          <View style={styles.section}>
            <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 10, color: COLORS.textMuted }}>Unit rank in branch</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>#{m.unitRank} of {m.unitCount}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={{ backgroundColor: COLORS.teal, borderRadius: 12, padding: 14 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.white, opacity: 0.75, fontFamily: 'Helvetica-Bold', letterSpacing: 1.4, marginBottom: 6 }}>
              {scopeWord.toUpperCase()} FOCUS · {m.periodLabel.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.white, lineHeight: 1.35 }}>
              {formatCurrency(m.totals.totalApi)} across {m.totals.agentCount} {m.totals.agentCount === 1 ? 'agent' : 'agents'}
              {m.compliance ? ` · ${m.compliance.percent}% weekly compliance` : ''}.
            </Text>
          </View>
        </View>

        <PageFooter pageNumber={3} totalPages={TOTAL} />
      </Page>
    </Document>
  );
}

function ComplianceDonut({ percent }) {
  const size = 92, stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  const dash = (pct / 100) * c;
  const cx = size / 2;
  const ring = pct >= 80 ? COLORS.success : pct >= 60 ? COLORS.warning : COLORS.danger;
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={ring} strokeWidth={stroke}
          strokeDasharray={`${dash.toFixed(2)} ${(c - dash).toFixed(2)}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{pct}%</Text>
        <Text style={{ fontSize: 7, color: COLORS.textMuted, marginTop: 2, letterSpacing: 0.6 }}>ON TIME</Text>
      </View>
    </View>
  );
}

// ── Thin scope wrappers ──────────────────────────────────────────────────────
export function BranchReportDocument(props) {
  return <ManagerReport {...props} scope="branch" />;
}

export function UnitReportDocument(props) {
  return <ManagerReport {...props} scope="unit" />;
}

export default ManagerReport;
