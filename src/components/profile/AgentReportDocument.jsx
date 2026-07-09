/**
 * AgentReportDocument — Refined Agent Performance Report (@react-pdf/renderer)
 *
 * Editorial multi-page PDF: Cover → Snapshot → Trajectory & ratios → Career,
 * awards & focus. Ports the design intent of docs/design-system/screens-v2/
 * pdf-refined-{cover,pages}.jsx toward the live in-app AgentReportView.
 *
 * NUMBERS: every production/activity/ratio/floor number flows through
 * {@link deriveAgentReportModel} — the SAME extractFields path AgentReportView
 * uses — via buildAgentReportModel() below. There is NO second math path. The
 * few things the shared model does not carry (production NB/PPP/LMPS breakdown,
 * award progress, career ladder, settled/pending YTD-vs-targets split,
 * settlement history) are derived here from the SAME sources the in-app
 * surfaces use (extractFields / computeAgentAwards / confirmed settlements).
 *
 * HEX-ONLY: @react-pdf/renderer CANNOT resolve CSS custom properties (var(--x)).
 * This palette is a manual, one-way MIRROR of the light-mode Nexus v2 tokens in
 * src/index.css (:root). The PDF is always drawn on paper → light theme only.
 * KEEP IN SYNC MANUALLY when a token changes. This file is EXEMPT from the app
 * token rules by design (see CLAUDE.md § UI rules).
 *
 * Entry: exportService.generateAgentPDF() builds this directly from props.
 * Prop signature is UNCHANGED from the prior 2-page version (may gain, not break).
 *
 * SKIP-LOG (no data source in this flow):
 *  - Coaching note (the mockup's manager quote) — no coaching-note collection is
 *    loaded in the agent PDF flow. Omitted; revisit when item 1.5's coaching
 *    drawer surfaces a note source.
 *  - The strict 8-KPI company-floor grid (Calls/Contacts/Appts/Interviews/Fact
 *    finds/Closing/Clients/Referrals vs fixed weekly floors) — the shared model
 *    carries the canonical activity set (dials/contacts/f2f/ffi/ci/apps/names)
 *    and coaching ratios, not the meeting-mode floor thresholds. Rendered as the
 *    honest activity + coaching-ratio + tenure-floor sections instead.
 */
import {
  Document, Page, View, Text, StyleSheet,
  Svg, Line, Path, Circle, Rect,
} from '@react-pdf/renderer';
import { formatCurrency } from '../../utils/formatters';
import { BRAND_NAME, CONTACT_EMAIL } from '../../constants/brand';
import {
  buildAgentReportModel, ratioValueStr, periodLabel, formatConfirmedDate,
} from './agentReportPdfModel';

// ── PDF PALETTE — mirrors Nexus v2 light tokens (src/index.css :root) ─────────
const COLORS = {
  teal:          '#01696f',
  tealDark:      '#014e52',
  tealMid:       '#02838a',
  tealTint:      '#e6f4f4',
  bg:            '#f7f6f2',
  paper:         '#ffffff',
  paperCream:    '#fbfaf6',
  paperPanel:    '#f9f7f2',
  surfaceRaised: '#fafaf8',
  text:          '#28251d',
  textMuted:     '#6b6560',
  inkFaint:      '#7a7264',   // Nexus v2 AA faint
  border:        '#e5e2db',
  ruleStrong:    '#cfcbc2',
  gold:          '#b07d1a',
  goldInk:       '#8a6011',
  goldTint:      '#faefd3',
  success:       '#2d7a4f',
  successBg:     '#e8f5ee',
  successInk:    '#1f6c41',
  warning:       '#b45309',
  warningBg:     '#fef3e2',
  warningInk:    '#a24100',
  danger:        '#c0392b',
  dangerBg:      '#fde8e7',
  dangerInk:     '#b22b1d',
  white:         '#ffffff',
};

// A4 page geometry (points)
const PAGE_W    = 595.28;
const PAGE_PAD  = 40;
const CONTENT_W = PAGE_W - PAGE_PAD * 2; // ≈ 515.28

// Canonical coaching-ratio display order + labels (mirrors AgentReportView).
const RATIO_DISPLAY = [
  { key: 'approachRate',  label: 'Approach → FFI' },
  { key: 'ffiConversion', label: 'FFI → CI' },
  { key: 'closingRatio',  label: 'CI → App' },
  { key: 'ciBookingRate', label: 'Closing ratio' },
];

const ACTIVITY_TILES = [
  { key: 'dials',    label: 'Dials' },
  { key: 'contacts', label: 'Tel Contacts' },
  { key: 'f2f',      label: 'F2F' },
  { key: 'ffi',      label: 'FFI' },
  { key: 'ci',       label: 'CI' },
  { key: 'apps',     label: 'Apps' },
  { key: 'names',    label: 'New Names' },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.paper,
    fontFamily: 'Helvetica',
    color: COLORS.text,
    fontSize: 10,
    paddingTop: 46,
    paddingBottom: 40,
  },
  coverPage: {
    backgroundColor: COLORS.paperCream,
    fontFamily: 'Helvetica',
    color: COLORS.text,
    fontSize: 10,
    position: 'relative',
  },
  section: { paddingHorizontal: PAGE_PAD, marginTop: 18 },

  // Running header (fixed)
  runHeader: {
    position: 'absolute', top: 16, left: PAGE_PAD, right: PAGE_PAD,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  runHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  runHeaderBrand: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.text },
  runHeaderMeta:  { fontSize: 8.5, color: COLORS.textMuted },

  // Footer (fixed)
  footerBand: {
    position: 'absolute', bottom: 14, left: PAGE_PAD, right: PAGE_PAD,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerText: { fontSize: 8, color: COLORS.inkFaint, letterSpacing: 0.4 },

  // SectionMark
  sectionMarkWrap: { marginBottom: 10 },
  sectionMarkTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sectionMarkNum: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.teal, letterSpacing: 1.8 },
  sectionMarkRule: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: 12 },
  sectionMarkTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: -0.2 },
  sectionMarkSub: { fontSize: 8.5, color: COLORS.textMuted, marginTop: 3, lineHeight: 1.4 },

  // Cards / tiles
  card: {
    backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 14,
  },
  pillBase: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999,
  },
  pillText: { fontSize: 8, fontFamily: 'Helvetica-Bold', lineHeight: 1 },

  tableHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.teal, paddingVertical: 6, paddingHorizontal: 8,
  },
  tableHeaderCell: { color: COLORS.white, fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
});

// ── Shared chrome ─────────────────────────────────────────────────────────────
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

function RunningHeader({ name }) {
  return (
    <View style={styles.runHeader} fixed>
      <View style={styles.runHeaderLeft}>
        <BrandGlyph size={16} />
        <Text style={[styles.runHeaderBrand, { marginLeft: 6 }]}>{BRAND_NAME}</Text>
        <Text style={{ fontSize: 8.5, color: COLORS.inkFaint, marginHorizontal: 6 }}>·</Text>
        <Text style={styles.runHeaderMeta}>Performance Report</Text>
      </View>
      <Text style={styles.runHeaderMeta}>{name} · YTD {new Date().getFullYear()}</Text>
    </View>
  );
}

function PageFooter({ pageNumber, totalPages }) {
  return (
    <View style={styles.footerBand} fixed>
      <Text style={styles.footerText}>
        {`${BRAND_NAME}  ·  ${CONTACT_EMAIL}  ·  Confidential  ·  TTD`}
      </Text>
      <Text style={styles.footerText}>
        {`Page ${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`}
      </Text>
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

function Pill({ label, bg, fg, width, minHeight = 18 }) {
  return (
    <View style={[styles.pillBase, { backgroundColor: bg, minHeight }, width !== undefined ? { width } : null]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// Donut ring drawn with react-pdf Svg circles.
function Donut({ percent, size = 130, stroke = 11, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  const dash = (pct / 100) * c;
  const cx = size / 2;
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
        <Circle
          cx={cx} cy={cx} r={r}
          fill="none" stroke={COLORS.teal} strokeWidth={stroke}
          strokeDasharray={`${dash.toFixed(2)} ${(c - dash).toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.2, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 7.5, color: COLORS.textMuted, marginTop: 3, letterSpacing: 0.6 }}>{sub.toUpperCase()}</Text> : null}
      </View>
    </View>
  );
}

// Multi-series activity trend (raw SVG primitives — Recharts unsupported).
function ActivityTrendChart({ data, width, height }) {
  const ML = 28, MR = 8, MT = 10, MB = 8;
  const PW = width - ML - MR;
  const PH = height - MT - MB;
  const lines = [
    { key: 'dials',    color: COLORS.teal },
    { key: 'contacts', color: COLORS.success },
    { key: 'f2f',      color: COLORS.warning },
    { key: 'apps',     color: COLORS.danger },
  ];
  const allVals = data.flatMap((d) => lines.map((ln) => d[ln.key] || 0));
  const max = Math.max(...allVals, 1);
  const xFor = (i) => ML + (data.length === 1 ? PW / 2 : (i / (data.length - 1)) * PW);
  const yFor = (v) => MT + PH - (v / max) * PH;
  const linePath = (key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d[key] || 0).toFixed(1)}`).join(' ');
  const gridFractions = [0, 0.25, 0.5, 0.75, 1];
  return (
    <Svg width={width} height={height}>
      {gridFractions.map((p, i) => {
        const y = MT + p * PH;
        return <Line key={`g-${i}`} x1={ML} y1={y} x2={ML + PW} y2={y} stroke={COLORS.border} strokeWidth={0.5} />;
      })}
      <Line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke={COLORS.textMuted} strokeWidth={0.5} />
      <Line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke={COLORS.textMuted} strokeWidth={0.5} />
      {lines.map((ln) => (
        <Path key={ln.key} d={linePath(ln.key)} stroke={ln.color} strokeWidth={1.5} fill="none" />
      ))}
    </Svg>
  );
}

// 6-week trajectory area spark.
function TrajectorySpark({ values, width, height }) {
  if (!values || values.length < 2) {
    return (
      <Svg width={width} height={height}>
        <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={COLORS.border} strokeWidth={1} />
      </Svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return [x, y];
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={COLORS.teal} strokeWidth={2} fill="none" />
      <Circle cx={last[0]} cy={last[1]} r={3} fill={COLORS.teal} />
    </Svg>
  );
}

function AwardRow({ name, requirement, progress, status }) {
  const pct = Math.min(100, Math.round(progress ?? 0));
  const badge =
    status === 'achieved'    ? { bg: COLORS.successBg, fg: COLORS.successInk, label: 'Achieved' } :
    status === 'in-progress' ? { bg: COLORS.tealTint,  fg: COLORS.teal,      label: 'In Progress' } :
                               { bg: COLORS.paperPanel, fg: COLORS.textMuted, label: 'Not Started' };
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: badge.fg, marginRight: 10 }} />
      <View style={{ width: 168 }}>
        <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>{name}</Text>
        <Text style={{ fontSize: 8, color: COLORS.inkFaint, marginTop: 1 }}>{requirement}</Text>
      </View>
      <View style={{ flex: 1, height: 5, backgroundColor: COLORS.border, borderRadius: 3, marginHorizontal: 8 }}>
        <View style={{ width: `${pct}%`, height: 5, backgroundColor: badge.fg, borderRadius: 3 }} />
      </View>
      <Text style={{ width: 30, textAlign: 'right', fontSize: 8.5, color: COLORS.textMuted }}>{pct}%</Text>
      <View style={{ width: 90, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pill label={badge.label} bg={badge.bg} fg={badge.fg} width={82} minHeight={18} />
      </View>
    </View>
  );
}

function HeroStat({ eyebrow, value, sub, color }) {
  return (
    <View>
      <Text style={{ fontSize: 7.5, color: COLORS.inkFaint, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 }}>{eyebrow}</Text>
      <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: color ?? COLORS.text, marginTop: 4, letterSpacing: -0.4 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 3 }}>{sub}</Text> : null}
    </View>
  );
}

// ── Main component (named export — used by exportService) ─────────────────────
export function AgentReportDocument(props) {
  const m = buildAgentReportModel(props);
  const { model } = m;
  const TOTAL = 4;

  return (
    <Document>

      {/* ═══ PAGE 1 — COVER ═══════════════════════════════════════════════ */}
      <Page size="A4" style={styles.coverPage}>
        {/* Left accent stripe */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: COLORS.teal }} />

        {/* Top lockup */}
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

        {/* Eyebrow + name */}
        <View style={{ position: 'absolute', top: 190, left: 56, right: 56 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 9, color: COLORS.teal, fontFamily: 'Helvetica-Bold', letterSpacing: 1.8 }}>{m.year} · YTD</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.ruleStrong, marginHorizontal: 10 }} />
            <Text style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6 }}>PERFORMANCE REPORT</Text>
          </View>
          <Text style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: 1.4, fontFamily: 'Helvetica-Bold', marginBottom: 14 }}>PREPARED FOR</Text>
          <Text style={{ fontSize: 40, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: -1, lineHeight: 1.05 }}>{m.displayName}</Text>
          <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 16, lineHeight: 1.5 }}>
            {[m.roleLabel, m.monthsInService ? `${m.monthsInService} months in service` : null, m.agentNumber ? `Agent #${m.agentNumber}` : null]
              .filter(Boolean).join('   ·   ') || '—'}
          </Text>
        </View>

        {/* Hero stat block — settled API + donut */}
        <View style={{
          position: 'absolute', bottom: 120, left: 56, right: 56,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: 22, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.teal, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6, marginBottom: 6 }}>
              {m.heroEyebrow.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 34, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: -0.8 }}>
              {formatCurrency(m.heroPrimaryAPI)}
            </Text>
            <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8, lineHeight: 1.5 }}>
              {m.ytdAPIGoal > 0
                ? `${m.goalPct}% of your ${formatCurrency(m.ytdAPIGoal)} annual goal.`
                : 'No annual goal set.'}
              {'\n'}
              <Text style={{ color: COLORS.inkFaint }}>
                {m.ytdAPIGoal > 0
                  ? `${formatCurrency(Math.max(0, m.ytdAPIGoal - m.heroPrimaryAPI))} remaining`
                  : `MDRT target ${formatCurrency(m.mdrtTarget)}`}
              </Text>
            </Text>
          </View>
          {m.goalPct !== null && (
            <View style={{ paddingLeft: 20 }}>
              <Donut percent={m.goalPct} size={120} stroke={11} label={`${m.goalPct}%`} sub="of goal" />
            </View>
          )}
        </View>

        {/* Footer meta */}
        <View style={{
          position: 'absolute', bottom: 40, left: 56, right: 56,
          flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
          paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border,
        }}>
          <View>
            <Text style={{ fontSize: 8, color: COLORS.inkFaint, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>REPORTING PERIOD</Text>
            <Text style={{ fontSize: 10, color: COLORS.text, fontFamily: 'Helvetica-Bold' }}>{m.rangeLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, color: COLORS.inkFaint, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>ISSUED</Text>
            <Text style={{ fontSize: 10, color: COLORS.text, fontFamily: 'Helvetica-Bold' }}>{m.issuedDate}</Text>
          </View>
        </View>
      </Page>

      {/* ═══ PAGE 2 — SNAPSHOT ════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <RunningHeader name={m.displayName} />

        <View style={styles.section}>
          <SectionMark n="01" title="The year so far" subtitle="Year-to-date production, and the four time windows behind it." />
          {/* Hero stats */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 }}>
            <HeroStat eyebrow={m.heroEyebrow.toUpperCase()} value={formatCurrency(m.heroPrimaryAPI)} />
            <View style={{ width: 22 }} />
            <HeroStat eyebrow={m.hasSettlements ? 'APPS · SETTLED' : 'APPS · SUBMITTED'} value={String(m.heroApps)} />
            <View style={{ flex: 1 }} />
            <HeroStat
              eyebrow="PERSISTENCY"
              value={m.persPct !== null ? `${m.persPct.toFixed(0)}%` : '—'}
              color={m.persPct !== null && m.persPct >= 90 ? COLORS.success : m.persPct !== null && m.persPct < 80 ? COLORS.warningInk : COLORS.text}
            />
            <View style={{ width: 22 }} />
            <HeroStat eyebrow="CLOSING RATIO" value={ratioValueStr(m.closingRatio)} sub="CI → App"
              color={m.closingRatio >= 50 ? COLORS.success : COLORS.text} />
          </View>

          {/* Four time windows */}
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            {[
              { id: 'week', label: 'This week' },
              { id: 'mtd', label: 'This month' },
              { id: 'quarter', label: 'This quarter' },
              { id: 'ytd', label: 'This year' },
            ].map((w, i) => {
              const t = model.windows[w.id];
              const active = w.id === 'ytd';
              return (
                <View key={w.id} style={{
                  flex: 1, marginRight: i < 3 ? 10 : 0,
                  padding: 11, borderRadius: 10,
                  backgroundColor: active ? COLORS.tealTint : COLORS.paper,
                  borderWidth: 1, borderColor: active ? COLORS.teal : COLORS.border,
                }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: active ? COLORS.teal : COLORS.inkFaint, letterSpacing: 0.6 }}>
                    {w.label.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginTop: 4 }}>{formatCurrency(t.totalApi)}</Text>
                  <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 2 }}>{t.totalApps} apps</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Production breakdown */}
        <View style={styles.section} wrap={false}>
          <SectionMark n="02" title="Production breakdown" subtitle="New Business, Persistency Premium Plus and Lumpsum credits — this week, month and year." />
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.ruleStrong, paddingBottom: 4, marginBottom: 4 }}>
            <Text style={{ width: 70, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.textMuted }}>PERIOD</Text>
            <Text style={{ flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.textMuted, textAlign: 'right' }}>NB APPS</Text>
            <Text style={{ flex: 2, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.textMuted, textAlign: 'right' }}>NB API</Text>
            {m.hasPppAny && <Text style={{ flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.textMuted, textAlign: 'right' }}>PPP APPS</Text>}
            {m.hasPppAny && <Text style={{ flex: 2, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.textMuted, textAlign: 'right' }}>PPP INC.</Text>}
            {m.hasLmpsAny && <Text style={{ flex: 2, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.textMuted, textAlign: 'right' }}>LMPS (10%)</Text>}
            <Text style={{ flex: 2, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.teal, textAlign: 'right' }}>TOTAL API</Text>
          </View>
          {m.bdRows.map((row, i) => (
            <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: i % 2 === 0 ? COLORS.paperPanel : COLORS.paper, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 4 }}>
              <Text style={{ width: 70, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{row.label}</Text>
              <Text style={{ flex: 1, fontSize: 8.5, color: COLORS.text, textAlign: 'right' }}>{row.nbApps}</Text>
              <Text style={{ flex: 2, fontSize: 8.5, color: COLORS.text, textAlign: 'right' }}>{formatCurrency(row.nbApi)}</Text>
              {m.hasPppAny && <Text style={{ flex: 1, fontSize: 8.5, color: COLORS.text, textAlign: 'right' }}>{row.pppApps}</Text>}
              {m.hasPppAny && <Text style={{ flex: 2, fontSize: 8.5, color: COLORS.text, textAlign: 'right' }}>{formatCurrency(row.pppInc)}</Text>}
              {m.hasLmpsAny && <Text style={{ flex: 2, fontSize: 8.5, color: COLORS.text, textAlign: 'right' }}>{formatCurrency(row.lmpsCredit)}</Text>}
              <Text style={{ flex: 2, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.teal, textAlign: 'right' }}>{formatCurrency(row.total)}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 8, color: COLORS.inkFaint, marginTop: 8, fontStyle: 'italic' }}>
            All values in TTD. Lumpsum credits applied at 10% per Tatil Life production policy.
          </Text>
        </View>

        {/* YTD vs targets */}
        <View style={styles.section} wrap={false}>
          <SectionMark n="03" title="Year-to-date vs targets" subtitle="Settled and pending settlement, against the company floor, MDRT and your annual goal." />
          <YtdTargetsBar m={m} />
        </View>

        <PageFooter pageNumber={2} totalPages={TOTAL} />
      </Page>

      {/* ═══ PAGE 3 — TRAJECTORY, ACTIVITY & RATIOS ═══════════════════════ */}
      <Page size="A4" style={styles.page}>
        <RunningHeader name={m.displayName} />

        <View style={styles.section}>
          <SectionMark n="04" title="Trajectory & coaching ratios" subtitle="Weekly New API over the last six weeks, and the conversion ratios behind it." />
          <View style={{ flexDirection: 'row' }}>
            <View style={[styles.card, { flex: 1.05, marginRight: 12 }]}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.inkFaint, letterSpacing: 1.2, marginBottom: 8 }}>6-WEEK API TRAJECTORY</Text>
              <TrajectorySpark values={model.trajectory} width={CONTENT_W * 0.46} height={60} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ fontSize: 8, color: COLORS.inkFaint }}>6 wks ago</Text>
                <Text style={{ fontSize: 8, color: COLORS.inkFaint }}>
                  {model.trajectory.length ? formatCurrency(model.trajectory[model.trajectory.length - 1]) : '—'} this wk
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {RATIO_DISPLAY.map((rt, i) => {
                  const val = model.ratios?.[rt.key];
                  return (
                    <View key={rt.key} style={{
                      width: '50%', paddingRight: i % 2 === 0 ? 5 : 0, paddingLeft: i % 2 === 1 ? 5 : 0,
                      marginBottom: 9,
                    }}>
                      <View style={{ backgroundColor: COLORS.paperPanel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, padding: 9 }}>
                        <Text style={{ fontSize: 8, color: COLORS.textMuted }}>{rt.label}</Text>
                        <Text style={{ fontSize: 17, fontFamily: 'Helvetica-Bold', color: COLORS.teal, marginTop: 3 }}>{ratioValueStr(val)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Activity (canonical set) */}
        <View style={styles.section} wrap={false}>
          <SectionMark n="05" title="Activity — year to date" subtitle="The canonical weekly-report activity metrics, summed across the year." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {ACTIVITY_TILES.map((tile, i) => (
              <View key={tile.key} style={{ width: '25%', paddingRight: (i % 4) < 3 ? 8 : 0, marginBottom: 8 }}>
                <View style={{ backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: COLORS.textMuted, letterSpacing: 0.6 }}>{tile.label.toUpperCase()}</Text>
                  <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginTop: 4 }}>{model.activity[tile.key] ?? 0}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Tenure floor */}
        <View style={styles.section} wrap={false}>
          <SectionMark n="06" title="Year-to-date vs tenure floor" subtitle="Each career tenure band carries a YTD API floor. Yours is shown against year-to-date submitted API." />
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.inkFaint, letterSpacing: 1 }}>YTD API VS TENURE FLOOR</Text>
              <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{formatCurrency(model.ytdAPI)} / {formatCurrency(model.ytdFloor)}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: COLORS.border, borderRadius: 999 }}>
              <View style={{ width: `${model.floorPct}%`, height: 8, backgroundColor: model.aboveFloor ? COLORS.teal : COLORS.warning, borderRadius: 999 }} />
            </View>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: model.aboveFloor ? COLORS.successInk : COLORS.warningInk, marginTop: 8 }}>
              {model.aboveFloor ? `${model.floorPct}% — above floor` : `${model.floorPct}% — keep pushing to clear floor`}
            </Text>
          </View>
        </View>

        {/* Weekly activity trend chart */}
        <View style={styles.section}>
          <SectionMark n="07" title={`Weekly activity trend — ${m.rangeLabelTrend}`} />
          {m.chartData.length >= 2 ? (
            <View>
              <ActivityTrendChart data={m.chartData} width={CONTENT_W} height={150} />
              <View style={{ flexDirection: 'row', marginLeft: 28, marginTop: 2 }}>
                {m.chartData.map((d, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, color: COLORS.textMuted }}>{d.week}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                {[
                  { color: COLORS.teal, label: 'Dials' },
                  { color: COLORS.success, label: 'Tel Contacts' },
                  { color: COLORS.warning, label: 'F2F' },
                  { color: COLORS.danger, label: 'Apps' },
                ].map((ln) => (
                  <View key={ln.label} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ln.color, marginRight: 4 }} />
                    <Text style={{ fontSize: 8, color: COLORS.textMuted }}>{ln.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: COLORS.textMuted, textAlign: 'center' }}>
                Submit at least 2 weekly reports to see your activity trend over time.
              </Text>
            </View>
          )}
        </View>

        <PageFooter pageNumber={3} totalPages={TOTAL} />
      </Page>

      {/* ═══ PAGE 4 — CAREER, AWARDS & FOCUS ══════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <RunningHeader name={m.displayName} />

        {/* Career level */}
        <View style={styles.section}>
          <SectionMark n="08" title="Career level" subtitle="The Tatil Life career ladder is based on YTD API and applications." />
          {m.isMaxLevel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.tealTint, padding: 14, borderRadius: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.teal }}>Maximum level achieved — Executive</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.paperCream, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16 }}>
              <View style={{
                width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.gold,
                alignItems: 'center', justifyContent: 'center', marginRight: 16,
              }}>
                <Text style={{ color: COLORS.white, fontSize: 13, fontFamily: 'Helvetica-Bold' }}>L{m.currentLevel.level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, color: COLORS.goldInk, fontFamily: 'Helvetica-Bold', letterSpacing: 1 }}>CURRENT LEVEL</Text>
                <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginTop: 2 }}>{m.currentLevel.name} · L{m.currentLevel.level}</Text>
                <Text style={{ fontSize: 8.5, color: COLORS.textMuted, marginTop: 3 }}>
                  {formatCurrency(m.effectiveYTD_API)} YTD API · {m.effectiveYTD_Apps ?? ''} apps
                </Text>
              </View>
              {m.nextLevel && (
                <View style={{ width: 200 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontSize: 8.5, color: COLORS.textMuted }}>To L{m.nextLevel.level} · {m.nextLevel.name}</Text>
                    <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.teal }}>{Math.round(m.levelProgressPct)}%</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: COLORS.border, borderRadius: 3 }}>
                    <View style={{ width: `${m.levelProgressPct}%`, height: 6, backgroundColor: COLORS.teal, borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 7.5, color: COLORS.inkFaint, marginTop: 5 }}>
                    {formatCurrency(Math.max(0, m.nextLevel.minAPI - m.effectiveYTD_API))}
                    {m.appsNeeded > 0 ? ` & ${m.appsNeeded} apps` : ''} from the next rung
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Award progress */}
        <View style={styles.section}>
          <SectionMark n="09" title="Award progress" subtitle="Tatil Life recognition programmes, as tracked in AgencyTrack." />
          {m.achievedAwards.length > 0 && (
            <View style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.successInk, marginBottom: 4 }}>Achieved</Text>
              {m.achievedAwards.map((a, i) => (
                <AwardRow key={a.id ?? i} name={a.name} requirement={m.awardReqStr(a)} progress={a.progressPercent ?? 0} status="achieved" />
              ))}
            </View>
          )}
          {m.inProgressAwards.length > 0 && (
            <View style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.teal, marginBottom: 4 }}>In Progress</Text>
              {m.inProgressAwards.map((a, i) => (
                <AwardRow key={a.id ?? i} name={a.name} requirement={m.awardReqStr(a)} progress={a.progressPercent ?? 0} status="in-progress" />
              ))}
            </View>
          )}
          {m.notStartedAwards.length > 0 && (
            <View style={{ padding: 10, backgroundColor: COLORS.paperPanel, borderRadius: 6, borderWidth: 0.5, borderColor: COLORS.border }}>
              <Text style={{ fontSize: 9, color: COLORS.textMuted, fontStyle: 'italic' }}>
                {m.notStartedAwards.length} award{m.notStartedAwards.length !== 1 ? 's' : ''} not yet started — keep building your production to unlock them.
              </Text>
            </View>
          )}
          {m.awardList.length === 0 && (
            <Text style={{ fontSize: 9, color: COLORS.textMuted, fontStyle: 'italic' }}>No award data available yet.</Text>
          )}
        </View>

        {/* Focus callout */}
        <View style={styles.section} wrap={false}>
          <View style={{ backgroundColor: COLORS.teal, borderRadius: 12, padding: 14 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.white, opacity: 0.75, fontFamily: 'Helvetica-Bold', letterSpacing: 1.4, marginBottom: 8 }}>
              FOCUS · {m.year}
            </Text>
            {m.displayBullets.map((bullet, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: i < m.displayBullets.length - 1 ? 5 : 0 }}>
                <Text style={{ width: 12, fontSize: 10, color: COLORS.white, fontFamily: 'Helvetica-Bold' }}>•</Text>
                <Text style={{ flex: 1, fontSize: 10, color: COLORS.white, lineHeight: 1.4 }}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Settlement history */}
        <View style={styles.section} wrap={m.settlementRows.length > 8}>
          <SectionMark n="10" title={`Settlement history — ${m.year}`} />
          {m.settlementRows.length === 0 ? (
            <Text style={{ fontSize: 9, color: COLORS.textMuted, paddingVertical: 8 }}>No confirmed settlements yet for {m.year}.</Text>
          ) : (
            <View>
              <View style={styles.tableHeaderRow}>
                <View style={{ width: 100 }}><Text style={styles.tableHeaderCell}>Period</Text></View>
                <View style={{ width: 115, flexDirection: 'row', justifyContent: 'flex-end' }}><Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Settled API</Text></View>
                <View style={{ width: 70, flexDirection: 'row', justifyContent: 'flex-end' }}><Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Settled Apps</Text></View>
                <View style={{ width: 80, flexDirection: 'row', justifyContent: 'flex-end' }}><Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Persistency</Text></View>
                <View style={{ width: 100 }}><Text style={styles.tableHeaderCell}>Confirmed By</Text></View>
                <View style={{ width: 66 }}><Text style={styles.tableHeaderCell}>Date</Text></View>
              </View>
              {m.settlementRows.map((s, i) => {
                const persVal = parseFloat(s.persistency);
                const persStr = Number.isFinite(persVal) && persVal > 0 ? `${persVal.toFixed(0)}%` : '—';
                return (
                  <View key={s.id ?? `${s.periodKey}-${i}`} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? COLORS.paperPanel : COLORS.paper }]}>
                    <View style={{ width: 100 }}><Text style={{ fontSize: 9 }}>{periodLabel(s.periodKey)}</Text></View>
                    <View style={{ width: 115, flexDirection: 'row', justifyContent: 'flex-end' }}><Text style={{ fontSize: 9, textAlign: 'right' }}>{formatCurrency(parseFloat(s.settledAPI) || 0)}</Text></View>
                    <View style={{ width: 70, flexDirection: 'row', justifyContent: 'flex-end' }}><Text style={{ fontSize: 9, textAlign: 'right' }}>{String(parseFloat(s.settledApps) || 0)}</Text></View>
                    <View style={{ width: 80, flexDirection: 'row', justifyContent: 'flex-end' }}><Text style={{ fontSize: 9, textAlign: 'right' }}>{persStr}</Text></View>
                    <View style={{ width: 100 }}><Text style={{ fontSize: 9 }}>{s.confirmedByName ?? '—'}</Text></View>
                    <View style={{ width: 66 }}><Text style={{ fontSize: 9 }}>{formatConfirmedDate(s.confirmedAt)}</Text></View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <PageFooter pageNumber={4} totalPages={TOTAL} />
      </Page>
    </Document>
  );
}

// ── YTD-vs-targets stacked bar (extracted for readability) ────────────────────
function YtdTargetsBar({ m }) {
  const trackW = CONTENT_W - 36;
  const barH = 22;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: trackW, height: barH, position: 'relative' }}>
          <View style={{ position: 'absolute', left: 0, top: 0, width: trackW, height: barH, backgroundColor: COLORS.border, borderRadius: 4 }} />
          {m.settledFrac > 0 && (
            <View style={{
              position: 'absolute', left: 0, top: 0, width: m.settledFrac * trackW, height: barH,
              backgroundColor: COLORS.teal,
              borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
              borderTopRightRadius: m.pendingFrac === 0 ? 4 : 0, borderBottomRightRadius: m.pendingFrac === 0 ? 4 : 0,
            }} />
          )}
          {m.pendingFrac > 0 && (
            <View style={{
              position: 'absolute', left: m.settledFrac * trackW, top: 0, width: m.pendingFrac * trackW, height: barH,
              backgroundColor: COLORS.tealMid, opacity: 0.5,
              borderTopRightRadius: 4, borderBottomRightRadius: 4,
              borderTopLeftRadius: m.settledFrac === 0 ? 4 : 0, borderBottomLeftRadius: m.settledFrac === 0 ? 4 : 0,
            }} />
          )}
          <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={trackW} height={barH}>
            <Line x1={m.floorFrac * trackW} y1={0} x2={m.floorFrac * trackW} y2={barH} stroke={COLORS.text} strokeWidth={1.2} />
            {m.goalFrac !== null && <Line x1={m.goalFrac * trackW} y1={0} x2={m.goalFrac * trackW} y2={barH} stroke={COLORS.success} strokeWidth={1.2} />}
            <Line x1={m.mdrtFrac * trackW} y1={0} x2={m.mdrtFrac * trackW} y2={barH} stroke={COLORS.warning} strokeWidth={1.2} />
          </Svg>
        </View>
        <View style={{ width: 36, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>{m.achievedPct}%</Text>
        </View>
      </View>

      {/* Marker legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Text style={{ fontSize: 7, color: COLORS.text, marginRight: 12 }}>Floor: {formatCurrency(m.companyFloor)}</Text>
        {m.goalFrac !== null && <Text style={{ fontSize: 7, color: COLORS.successInk, marginRight: 12 }}>Goal: {formatCurrency(m.ytdAPIGoal)}</Text>}
        <Text style={{ fontSize: 7, color: COLORS.warningInk }}>MDRT: {formatCurrency(m.mdrtTarget)}</Text>
      </View>

      {/* Settled/pending caption */}
      {m.hasSettlementsForYear && m.pendingYTD_API > 0 ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 12,
          backgroundColor: COLORS.paperPanel, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLORS.teal, marginRight: 4 }} />
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Settled · {formatCurrency(m.settledYTD_API)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLORS.tealMid, opacity: 0.5, marginRight: 4 }} />
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Pending · {formatCurrency(m.pendingYTD_API)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 9, color: COLORS.text }}>
            <Text style={{ color: COLORS.teal, fontFamily: 'Helvetica-Bold' }}>{formatCurrency(m.effectiveYTD_API)}</Text> achieved
          </Text>
        </View>
      ) : (
        <Text style={{ marginTop: 8, fontSize: 9, color: COLORS.textMuted }}>
          <Text style={{ color: COLORS.teal, fontFamily: 'Helvetica-Bold' }}>{formatCurrency(m.effectiveYTD_API)}</Text>
          {m.hasSettlementsForYear ? ' achieved (settled)' : ' achieved (estimated)'}
          {m.ytdAPIGoal > 0 ? ` · ${Math.round((m.effectiveYTD_API / m.ytdAPIGoal) * 100)}% of goal · ${formatCurrency(Math.max(0, m.ytdAPIGoal - m.effectiveYTD_API))} remaining` : ''}
        </Text>
      )}
    </View>
  );
}
