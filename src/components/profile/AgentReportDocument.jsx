/**
 * AgentReportDocument
 * Built with @react-pdf/renderer — generates a true PDF document, not a
 * screenshot of an HTML element. Vertical alignment is handled by the
 * react-pdf flex implementation, which (unlike html2canvas) does not
 * suffer from baseline drift.
 *
 * Used by exportService.generateAgentPDF() — built directly from props,
 * no DOM mount required.
 */
import {
  Document, Page, View, Text, StyleSheet,
  Svg, Rect, Line, Path,
} from '@react-pdf/renderer';
import { extractFields } from '../../utils/extractFields';
import { computeAgentAwards } from '../../utils/awardsEngine';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';

// ── Design tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  primary:       '#01696f',
  primaryDark:   '#014e52',
  primaryLight:  '#d6ebec',
  bg:            '#f7f6f2',
  surface:       '#ffffff',
  text:          '#28251d',
  textMuted:     '#6b6560',
  success:       '#2d7a4f',
  successBg:     '#e3f1e9',
  warning:       '#b45309',
  warningBg:     '#fef3e7',
  danger:        '#c0392b',
  dangerBg:      '#fadedb',
  border:        '#e5e2db',
  surfaceRaised: '#f9f8f5',
  white:         '#ffffff',
  focusBg:       '#f0fafa',
  achievedBg:    '#d1fae5',
  achievedFg:    '#065f46',
  inProgressBg:  '#e0f5f5',
  notStartedBg:  '#f1f0ee',
};

// ── Career levels ─────────────────────────────────────────────────────────────
const CAREER_LEVELS = [
  { level: 1, name: 'Salesperson',        minAPI: 0,       minApps: 0   },
  { level: 2, name: 'Senior Salesperson', minAPI: 120000,  minApps: 20  },
  { level: 3, name: 'Associate',          minAPI: 240000,  minApps: 35  },
  { level: 4, name: 'Senior Associate',   minAPI: 360000,  minApps: 50  },
  { level: 5, name: 'Manager',            minAPI: 500000,  minApps: 65  },
  { level: 6, name: 'Senior Manager',     minAPI: 700000,  minApps: 80  },
  { level: 7, name: 'Executive',          minAPI: 1000000, minApps: 100 },
];

const MDRT_THRESHOLD    = 500000;
const COMPANY_FLOOR     = 250000;
const FUNNEL_BENCHMARKS = [20, 40, 50, 60, 70];

// A4 page geometry (points)
const PAGE_W    = 595.28;
const PAGE_PAD  = 32;
const CONTENT_W = PAGE_W - PAGE_PAD * 2; // ≈ 531.28

// ── Pure helpers ──────────────────────────────────────────────────────────────
function safeRate(num, den) {
  if (!den || den === 0) return null;
  return Math.round((num / den) * 100);
}

function weekLabel(weekStarting) {
  if (!weekStarting) return '';
  return formatDateDisplay(weekStarting);
}

function buildSparklinePath(values, width, height) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function latestPersistencyPercent(persistencyMap) {
  if (!persistencyMap || typeof persistencyMap !== 'object') return null;
  const entries = Object.values(persistencyMap);
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => {
    const ka = `${a.year}-${String(a.month).padStart(2, '0')}`;
    const kb = `${b.year}-${String(b.month).padStart(2, '0')}`;
    return kb.localeCompare(ka);
  });
  const v = parseFloat(sorted[0]?.persistency);
  return Number.isFinite(v) ? v : null;
}

function periodLabel(periodKey) {
  if (!periodKey) return '—';
  const qm = String(periodKey).match(/^(\d{4})-Q(\d)$/);
  if (qm) return `Q${qm[2]} ${qm[1]}`;
  const mm = String(periodKey).match(/^(\d{4})-(\d{2})$/);
  if (mm) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const idx = parseInt(mm[2], 10) - 1;
    return `${months[idx] ?? mm[2]} ${mm[1]}`;
  }
  return periodKey;
}

function formatConfirmedDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (Number.isNaN(d?.getTime?.())) return '—';
  return d.toLocaleDateString('en-TT', { year: '2-digit', month: 'short', day: 'numeric' });
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.surface,
    fontFamily: 'Helvetica',
    color: COLORS.text,
    fontSize: 10,
    paddingBottom: 36, // leave space so footer band sits cleanly
  },

  // Header band
  headerBand: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: PAGE_PAD,
    paddingVertical: 22,
    borderBottomWidth: 4,
    borderBottomColor: COLORS.primaryDark,
  },
  headerEyebrow: {
    color: COLORS.white,
    fontSize: 8,
    letterSpacing: 0.8,
    opacity: 0.65,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  headerName: {
    color: COLORS.white,
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  headerMeta: {
    color: COLORS.white,
    fontSize: 9,
    opacity: 0.85,
  },

  // Sections
  section: {
    paddingHorizontal: PAGE_PAD,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
    paddingBottom: 4,
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },

  // Pills (centered text, used for badges / status)
  pillBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    minHeight: 22,
  },
  pillText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1,
  },

  // Generic row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Table
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: COLORS.white,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },

  // Footer
  footerBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PAD,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceRaised,
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
    marginTop: 18,
  },
  footerText: {
    fontSize: 8,
    color: COLORS.textMuted,
  },
});

// ── Sparkline component ───────────────────────────────────────────────────────
function Sparkline({ values, width, height, color }) {
  const d = buildSparklinePath(values, width, height);
  if (!d) {
    return (
      <Svg width={width} height={height}>
        <Line
          x1={0} y1={height / 2}
          x2={width} y2={height / 2}
          stroke={COLORS.border} strokeWidth={1}
        />
      </Svg>
    );
  }
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

// ── Activity Trend chart (raw SVG primitives — Recharts not supported) ────────
function ActivityTrendChart({ data, width, height }) {
  const ML = 28, MR = 8, MT = 10, MB = 8;
  const PW = width - ML - MR;
  const PH = height - MT - MB;

  const lines = [
    { key: 'dials',    color: COLORS.primary },
    { key: 'contacts', color: COLORS.success },
    { key: 'f2f',      color: COLORS.warning },
    { key: 'apps',     color: COLORS.danger  },
  ];

  const allVals = data.flatMap((d) => lines.map((ln) => d[ln.key] || 0));
  const max = Math.max(...allVals, 1);

  const xFor = (i) => ML + (data.length === 1 ? PW / 2 : (i / (data.length - 1)) * PW);
  const yFor = (v) => MT + PH - (v / max) * PH;

  const linePath = (key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d[key] || 0).toFixed(1)}`).join(' ');

  // Horizontal gridlines
  const gridFractions = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Svg width={width} height={height}>
      {gridFractions.map((p, i) => {
        const y = MT + p * PH;
        return (
          <Line
            key={`g-${i}`}
            x1={ML} y1={y} x2={ML + PW} y2={y}
            stroke={COLORS.border} strokeWidth={0.5}
          />
        );
      })}
      <Line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke={COLORS.textMuted} strokeWidth={0.5} />
      <Line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke={COLORS.textMuted} strokeWidth={0.5} />
      {lines.map((ln) => (
        <Path
          key={ln.key}
          d={linePath(ln.key)}
          stroke={ln.color}
          strokeWidth={1.5}
          fill="none"
        />
      ))}
    </Svg>
  );
}

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ label, bg, fg, width, minHeight }) {
  return (
    <View style={[
      styles.pillBase,
      { backgroundColor: bg },
      width !== undefined ? { width } : null,
      minHeight !== undefined ? { minHeight } : null,
    ]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ── AwardRow ──────────────────────────────────────────────────────────────────
function AwardRow({ name, requirement, progress, status }) {
  const pct = Math.min(100, Math.round(progress ?? 0));
  const badge =
    status === 'achieved'    ? { bg: COLORS.achievedBg,    fg: COLORS.achievedFg, label: 'Achieved'    } :
    status === 'in-progress' ? { bg: COLORS.inProgressBg,  fg: COLORS.primary,    label: 'In Progress' } :
                               { bg: COLORS.notStartedBg,  fg: COLORS.textMuted,  label: 'Not Started' };

  return (
    <View
      wrap={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.border,
      }}
    >
      <View style={{ width: 140, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{name}</Text>
      </View>
      <View style={{ width: 210, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
        <Text style={{ fontSize: 8, color: COLORS.textMuted }}>{requirement}</Text>
      </View>
      <View style={{ width: 140, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
        <View style={{
          flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3,
        }}>
          <View style={{
            width: `${pct}%`, height: 6,
            backgroundColor: COLORS.primary, borderRadius: 3,
          }} />
        </View>
      </View>
      <View style={{ width: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 8, color: COLORS.textMuted }}>{pct}%</Text>
      </View>
      <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Pill label={badge.label} bg={badge.bg} fg={badge.fg} width={88} minHeight={20} />
      </View>
    </View>
  );
}

// ── Main report component (named export — used by exportService) ──────────────
export function AgentReportDocument({
  agentInfo, submissions, goals, weekRange,
  confirmedSettlements, agentProfile, persistency,
}) {
  const now     = new Date();
  const year    = now.getFullYear();
  const dateStr = now.toLocaleDateString('en-TT', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Filter & sort ──────────────────────────────────────────────────────────
  const allSubmitted = (submissions ?? []).filter((s) => s.status === 'submitted');
  const sorted = [...allSubmitted].sort((a, b) =>
    (b.weekStarting ?? '').localeCompare(a.weekStarting ?? '')
  );

  let rangeLabel, selectedSubs;
  if (weekRange === 'year') {
    selectedSubs = sorted.filter((s) => (s.weekStarting ?? '').startsWith(String(year))).reverse();
    rangeLabel = `Full Year ${year}`;
  } else {
    selectedSubs = sorted.slice(0, Number(weekRange)).reverse();
    rangeLabel = `Last ${weekRange} Weeks`;
  }

  const fieldsList = selectedSubs.map((s) => extractFields(s));
  const n = fieldsList.length || 1;

  // ── YTD totals ─────────────────────────────────────────────────────────────
  const yearSubs = allSubmitted.filter((s) => (s.weekStarting ?? '').startsWith(String(year)));
  const ytdAPI   = yearSubs.reduce((sum, s) => sum + (parseFloat(s.apiSold)          || 0), 0);
  const ytdApps  = yearSubs.reduce((sum, s) => sum + (parseFloat(s.applicationsSold) || 0), 0);
  const ytdAPIGoal = parseFloat(goals?.annualAPI ?? goals?.personalCommitment?.annualAPI) || 0;
  const weeksSubmittedYTD = yearSubs.length;
  const avgAPIperApp      = ytdApps > 0 ? Math.round(ytdAPI / ytdApps) : 0;

  // ── Settled YTD (from confirmed settlements) ──────────────────────────────
  const settledYTD = (confirmedSettlements ?? [])
    .filter((s) => String(s.periodKey ?? '').startsWith(String(year)))
    .reduce((sum, s) => sum + (parseFloat(s.settledAPI) || 0), 0);

  const settledAppsYTD = (confirmedSettlements ?? [])
    .filter((s) => String(s.periodKey ?? '').startsWith(String(year)))
    .reduce((sum, s) => sum + (parseFloat(s.settledApps) || 0), 0);

  const hasSettlements = (confirmedSettlements ?? []).length > 0;
  const heroPrimaryAPI = hasSettlements ? settledYTD : ytdAPI;
  const heroEyebrow = hasSettlements ? 'YTD API · Settled' : 'YTD API · Submitted';
  const heroAppsValue = hasSettlements ? settledAppsYTD : ytdApps;

  // ── Sparklines (last 4 weeks) ─────────────────────────────────────────────
  const last4 = sorted.slice(0, 4).reverse().map((s) => extractFields(s));
  const apiSpark   = last4.map((f) => f.apiSold);
  const appsSpark  = last4.map((f) => f.applicationsSold);
  const avgSpark   = last4.map((f) => (f.applicationsSold > 0 ? Math.round(f.apiSold / f.applicationsSold) : 0));
  const weeksSpark = last4.map((_, i) => i + 1);

  // ── Activity trend chart ──────────────────────────────────────────────────
  const chartData = selectedSubs.map((s, i) => ({
    week:     weekLabel(s.weekStarting),
    dials:    fieldsList[i].totalTelAttempts,
    contacts: fieldsList[i].telContacts,
    f2f:      fieldsList[i].f2fAttempts,
    apps:     fieldsList[i].applicationsSold,
  }));

  // ── Funnel ────────────────────────────────────────────────────────────────
  const avg = (key) => fieldsList.reduce((sum, f) => sum + f[key], 0) / n;
  const funnelStages = [
    { label: 'Dials',        value: avg('totalTelAttempts') },
    { label: 'Tel Contacts', value: avg('telContacts')      },
    { label: 'F2F',          value: avg('f2fAttempts')      },
    { label: 'FFI',          value: avg('ffiConducted')     },
    { label: 'CI',           value: avg('ciConducted')      },
    { label: 'Apps',         value: avg('applicationsSold') },
  ];
  const funnelMax = funnelStages[0].value || 1;

  // ── Aggregate ratios ──────────────────────────────────────────────────────
  const tot = fieldsList.reduce((acc, f) => ({
    dials:    acc.dials    + f.totalTelAttempts,
    contacts: acc.contacts + f.telContacts,
    f2f:      acc.f2f      + f.f2fAttempts,
    ffi:      acc.ffi      + f.ffiConducted,
    ci:       acc.ci       + f.ciConducted,
    apps:     acc.apps     + f.applicationsSold,
    api:      acc.api      + f.apiSold,
  }), { dials: 0, contacts: 0, f2f: 0, ffi: 0, ci: 0, apps: 0, api: 0 });

  const ratioRows = [
    { label: 'Dial → Contact', value: safeRate(tot.contacts, tot.dials),    benchmark: 20,   isCurrency: false },
    { label: 'Contact → F2F',  value: safeRate(tot.f2f, tot.contacts),      benchmark: 40,   isCurrency: false },
    { label: 'F2F → FFI',      value: safeRate(tot.ffi, tot.f2f),           benchmark: 50,   isCurrency: false },
    { label: 'FFI → CI',       value: safeRate(tot.ci, tot.ffi),            benchmark: 60,   isCurrency: false },
    { label: 'CI → App',       value: safeRate(tot.apps, tot.ci),           benchmark: 70,   isCurrency: false },
    { label: 'Avg API / App',  value: tot.apps > 0 ? Math.round(tot.api / tot.apps) : null, benchmark: 8000, isCurrency: true },
  ];

  // ── Focus This Week bullets ───────────────────────────────────────────────
  const focusBullets = [];
  if (ratioRows[0].value !== null && ratioRows[0].value < 20)
    focusBullets.push(`Your dial-to-contact rate is ${ratioRows[0].value}% — try calling during peak hours (10am–12pm, 3pm–5pm).`);
  if (ratioRows[2].value !== null && ratioRows[2].value < 50)
    focusBullets.push(`Only ${ratioRows[2].value}% of your F2F approaches lead to an FFI — focus on qualifying prospects before the meeting.`);
  if (ratioRows[3].value !== null && ratioRows[3].value < 60)
    focusBullets.push(`Your FFI-to-CI conversion is ${ratioRows[3].value}% — review your closing approach with your manager.`);
  if (ratioRows[4].value !== null && ratioRows[4].value < 70)
    focusBullets.push(`You're closing ${ratioRows[4].value}% of CIs — ensure all paperwork is ready before the closing interview.`);
  if (focusBullets.length === 0)
    focusBullets.push('Great work — all your ratios are on track. Focus on increasing your dial volume to grow production.');
  const displayBullets = focusBullets.slice(0, 3);

  // ── API progress bar geometry ─────────────────────────────────────────────
  const barMax      = Math.max(ytdAPIGoal || MDRT_THRESHOLD, MDRT_THRESHOLD, ytdAPI * 1.05, 300000);
  const barWidth    = CONTENT_W;
  const barHeight   = 22;
  const fillWidth   = Math.max(0, Math.min(barWidth, (ytdAPI / barMax) * barWidth));
  const floorX      = (COMPANY_FLOOR  / barMax) * barWidth;
  const mdrtX       = (MDRT_THRESHOLD / barMax) * barWidth;
  const goalX       = ytdAPIGoal > 0 ? (ytdAPIGoal / barMax) * barWidth : null;
  const achievedPct = Math.round(Math.min(100, (ytdAPI / barMax) * 100));

  // ── Career level ──────────────────────────────────────────────────────────
  const qualifiedLevels = CAREER_LEVELS.filter((l) => ytdAPI >= l.minAPI && ytdApps >= l.minApps);
  const currentLevel    = qualifiedLevels.length > 0 ? qualifiedLevels[qualifiedLevels.length - 1] : CAREER_LEVELS[0];
  const nextLevel       = currentLevel.level < 7 ? CAREER_LEVELS.find((l) => l.level === currentLevel.level + 1) : null;
  const isMaxLevel      = currentLevel.level === 7;
  const levelProgressPct = nextLevel ? Math.min(99, (ytdAPI / nextLevel.minAPI) * 100) : 100;
  const appsNeeded       = nextLevel ? Math.max(0, nextLevel.minApps - ytdApps) : 0;

  // ── Awards ────────────────────────────────────────────────────────────────
  const awardsObj = computeAgentAwards(
    confirmedSettlements ?? [],
    submissions ?? [],
    agentProfile ?? {},
    now
  );
  const awardList = Object.values(awardsObj);
  const inProgressAwards = awardList.filter((a) => (a.progressPercent ?? 0) > 0 && (a.progressPercent ?? 0) < 100);
  const achievedAwards   = awardList.filter((a) => (a.progressPercent ?? 0) >= 100);
  const notStartedAwards = awardList.filter((a) => (a.progressPercent ?? 0) === 0);

  const awardReqStr = (award) => {
    const c = award.criteria?.[0];
    if (!c) return '';
    return `${c.label}: ${c.unit === 'TTD' ? formatCurrency(c.target) : `${c.target} ${c.unit}`}`;
  };

  // ──────────────────────────────────────────────────────────────────────────
  const summaryCards = [
    {
      label: hasSettlements ? 'YTD Apps · Settled' : 'YTD Apps',
      value: String(heroAppsValue),
      spark: appsSpark,
    },
    { label: 'Weeks Submitted', value: String(weeksSubmittedYTD),                              spark: weeksSpark },
    { label: 'Avg API / App',   value: avgAPIperApp > 0 ? formatCurrency(avgAPIperApp) : '—', spark: avgSpark   },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ═══ Header band ═══════════════════════════════════════════════════ */}
        <View style={styles.headerBand}>
          <Text style={styles.headerEyebrow}>AGENCYTRACK</Text>
          <Text style={styles.headerName}>{agentInfo?.displayName ?? 'Agent'}</Text>
          <Text style={styles.headerMeta}>
            {[agentInfo?.role, `Generated ${dateStr}`, rangeLabel].filter(Boolean).join('  ·  ')}
          </Text>
          <Text style={[styles.headerMeta, { marginTop: 2 }]}>
            {[
              agentProfile?.agentNumber ? `Agent #${agentProfile.agentNumber}` : null,
              (() => {
                const m = parseFloat(agentProfile?.monthsInIndustry ?? agentProfile?.monthsAtTatil);
                return Number.isFinite(m) && m > 0 ? `${Math.round(m)} months in service` : null;
              })(),
              (() => {
                const p = latestPersistencyPercent(persistency);
                return p !== null ? `Persistency ${p.toFixed(0)}%` : null;
              })(),
            ].filter(Boolean).join('  ·  ') || '—'}
          </Text>
        </View>

        {/* ═══ Executive summary ════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
            {/* Hero card */}
            <View style={{
              width: CONTENT_W * 0.58 - 7,
              backgroundColor: COLORS.primary,
              borderRadius: 10,
              padding: 16,
              marginRight: 14,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: COLORS.white, fontSize: 8, opacity: 0.7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 }}>
                  {heroEyebrow.toUpperCase()}
                </Text>
                {!hasSettlements && (
                  <Pill
                    label="ESTIMATED"
                    bg={COLORS.warningBg}
                    fg={COLORS.warning}
                    minHeight={14}
                  />
                )}
              </View>
              <Text style={{ color: COLORS.white, fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
                {formatCurrency(heroPrimaryAPI)}
              </Text>
              {hasSettlements && (
                <Text style={{ color: COLORS.white, fontSize: 8, opacity: 0.75, marginBottom: 2 }}>
                  Submitted: {formatCurrency(ytdAPI)}
                </Text>
              )}
              <Text style={{ color: COLORS.white, fontSize: 8, opacity: 0.85, marginBottom: 10 }}>
                {ytdAPIGoal > 0
                  ? `Goal: ${formatCurrency(ytdAPIGoal)}  |  ${formatCurrency(Math.max(0, ytdAPIGoal - heroPrimaryAPI))} remaining`
                  : 'No goal set'}
              </Text>
              <Sparkline values={apiSpark} width={180} height={36} color={COLORS.white} />
            </View>

            {/* 3 stacked cards */}
            <View style={{ flex: 1, flexDirection: 'column' }}>
              {summaryCards.map((card, i) => (
                <View
                  key={card.label}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: COLORS.surfaceRaised,
                    borderRadius: 8,
                    borderWidth: 0.5,
                    borderColor: COLORS.border,
                    padding: 10,
                    marginBottom: i < summaryCards.length - 1 ? 6 : 0,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 7, color: COLORS.textMuted, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, marginBottom: 2 }}>
                      {card.label.toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>
                      {card.value}
                    </Text>
                  </View>
                  <Sparkline values={card.spark} width={90} height={24} color={COLORS.primary} />
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ Career Level Progress ════════════════════════════════════════ */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Career Level Progress</Text>
          {isMaxLevel ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: COLORS.primaryLight, padding: 12, borderRadius: 8,
            }}>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.primary }}>
                Maximum Level Achieved — Executive
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Badge */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: COLORS.primary,
                paddingVertical: 6, paddingHorizontal: 14,
                borderRadius: 999, minHeight: 26,
                marginRight: 12,
              }}>
                <Text style={{ color: COLORS.white, fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                  Level {currentLevel.level} — {currentLevel.name}
                </Text>
              </View>

              {/* Progress column */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
                    Progress to Level {nextLevel?.level} — {nextLevel?.name}
                  </Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.primary }}>
                    {Math.round(levelProgressPct)}%
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: COLORS.border, borderRadius: 3 }}>
                  <View style={{ width: `${levelProgressPct}%`, height: 6, backgroundColor: COLORS.primary, borderRadius: 3 }} />
                </View>
                {nextLevel && (
                  <Text style={{ marginTop: 4, fontSize: 8, color: COLORS.textMuted }}>
                    {`${formatCurrency(ytdAPI)} of ${formatCurrency(nextLevel.minAPI)} needed for Level ${nextLevel.level}${appsNeeded > 0 ? ` — ${appsNeeded} more apps required` : ''}`}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ═══ YTD API vs Targets ═══════════════════════════════════════════ */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>YTD API vs Targets</Text>

          {/* Bar drawn with SVG primitives */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Svg width={barWidth - 36} height={barHeight}>
              <Rect x={0} y={0} width={barWidth - 36} height={barHeight} rx={11} ry={11} fill={COLORS.border} />
              {fillWidth > 0 && (
                <Rect
                  x={0} y={0}
                  width={Math.max(0, Math.min(fillWidth * (barWidth - 36) / barWidth, barWidth - 36))}
                  height={barHeight}
                  rx={11} ry={11}
                  fill={COLORS.primary}
                />
              )}
              <Line
                x1={floorX * (barWidth - 36) / barWidth} y1={0}
                x2={floorX * (barWidth - 36) / barWidth} y2={barHeight}
                stroke={COLORS.text} strokeWidth={1.2}
              />
              {goalX !== null && (
                <Line
                  x1={goalX * (barWidth - 36) / barWidth} y1={0}
                  x2={goalX * (barWidth - 36) / barWidth} y2={barHeight}
                  stroke={COLORS.success} strokeWidth={1.2}
                />
              )}
              <Line
                x1={mdrtX * (barWidth - 36) / barWidth} y1={0}
                x2={mdrtX * (barWidth - 36) / barWidth} y2={barHeight}
                stroke={COLORS.warning} strokeWidth={1.2}
              />
            </Svg>
            <View style={{ width: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.text }}>
                {achievedPct}%
              </Text>
            </View>
          </View>

          {/* Marker legend */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Text style={{ fontSize: 7, color: COLORS.text, marginRight: 12 }}>
              Floor: {formatCurrency(COMPANY_FLOOR)}
            </Text>
            {ytdAPIGoal > 0 && (
              <Text style={{ fontSize: 7, color: COLORS.success, marginRight: 12 }}>
                Goal: {formatCurrency(ytdAPIGoal)}
              </Text>
            )}
            <Text style={{ fontSize: 7, color: COLORS.warning }}>
              MDRT: {formatCurrency(MDRT_THRESHOLD)}
            </Text>
          </View>

          <Text style={{ marginTop: 6, fontSize: 9, color: COLORS.textMuted }}>
            <Text style={{ color: COLORS.primary, fontFamily: 'Helvetica-Bold' }}>{formatCurrency(ytdAPI)}</Text>
            {' achieved'}
            {ytdAPIGoal > 0 && ` · ${Math.round((ytdAPI / ytdAPIGoal) * 100)}% of goal · ${formatCurrency(Math.max(0, ytdAPIGoal - ytdAPI))} remaining`}
          </Text>
        </View>

        {/* ═══ Weekly Activity Trend ═══════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Activity Trend — {rangeLabel}</Text>
          {chartData.length >= 2 ? (
            <View>
              <ActivityTrendChart data={chartData} width={CONTENT_W} height={170} />
              {/* X-axis labels */}
              <View style={{ flexDirection: 'row', marginLeft: 28, marginTop: 2 }}>
                {chartData.map((d, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, color: COLORS.textMuted }}>{d.week}</Text>
                  </View>
                ))}
              </View>
              {/* Legend */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                {[
                  { color: COLORS.primary, label: 'Dials' },
                  { color: COLORS.success, label: 'Tel Contacts' },
                  { color: COLORS.warning, label: 'F2F' },
                  { color: COLORS.danger,  label: 'Apps' },
                ].map((ln) => (
                  <View key={ln.label} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ln.color, marginRight: 4 }} />
                    <Text style={{ fontSize: 8, color: COLORS.textMuted }}>{ln.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginBottom: 4 }}>
                Your trend chart will appear here
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.textMuted, textAlign: 'center' }}>
                Submit at least 2 weekly reports to see your activity trend over time.
              </Text>
            </View>
          )}
        </View>

        {/* ═══ Activity Funnel ══════════════════════════════════════════════ */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Activity Funnel (Avg per Week)</Text>
          {funnelStages.map((stage, i) => {
            const next      = funnelStages[i + 1];
            const convRate  = next ? safeRate(next.value, stage.value) : null;
            const bench     = FUNNEL_BENCHMARKS[i] ?? 0;
            const onTrack   = convRate !== null && convRate >= bench;
            const barColor  = i === 0 || onTrack ? COLORS.primary : COLORS.border;
            const barPct    = Math.max(2, (stage.value / funnelMax) * 100);

            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ width: 80, textAlign: 'right', fontSize: 9, color: COLORS.textMuted, paddingRight: 8 }}>
                  {stage.label}
                </Text>
                <View style={{ flex: 1, height: 14, backgroundColor: COLORS.surfaceRaised, borderRadius: 4 }}>
                  <View style={{ width: `${barPct}%`, height: 14, backgroundColor: barColor, borderRadius: 4 }} />
                </View>
                <View style={{ width: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 8 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                    {stage.value.toFixed(1)}
                  </Text>
                </View>
                {convRate !== null ? (
                  <Pill
                    label={`${convRate}%`}
                    bg={onTrack ? COLORS.successBg : COLORS.dangerBg}
                    fg={onTrack ? COLORS.success   : COLORS.danger}
                    width={56}
                    minHeight={20}
                  />
                ) : (
                  <View style={{ width: 56 }} />
                )}
              </View>
            );
          })}
          <Text style={{ marginTop: 4, fontSize: 8, color: COLORS.textMuted, fontStyle: 'italic' }}>
            Gray bars indicate the conversion rate from the previous stage is below the Tatil Life benchmark.
          </Text>
        </View>

        {/* ═══ Conversion Ratio Scorecard ═══════════════════════════════════ */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Conversion Ratio Scorecard</Text>

          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Ratio</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Your Rate</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Benchmark</Text>
            <View style={{ width: 100 }}>
              <Text style={styles.tableHeaderCell}>Status</Text>
            </View>
          </View>

          {ratioRows.map((row, i) => {
            const onTrack    = row.value !== null && row.value >= row.benchmark;
            const displayVal = row.value === null ? '—' : (row.isCurrency ? formatCurrency(row.value) : `${row.value}%`);
            const benchStr   = row.isCurrency ? formatCurrency(row.benchmark) + '+' : `${row.benchmark}%+`;
            return (
              <View
                key={i}
                style={[
                  styles.tableRow,
                  { backgroundColor: i % 2 === 0 ? COLORS.surfaceRaised : COLORS.surface },
                ]}
              >
                <Text style={{ flex: 2, fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{row.label}</Text>
                <Text style={{
                  flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold',
                  color: row.value === null ? COLORS.textMuted : (onTrack ? COLORS.success : COLORS.danger),
                }}>
                  {displayVal}
                </Text>
                <Text style={{ flex: 1, fontSize: 9, color: COLORS.textMuted }}>{benchStr}</Text>
                <View style={{ width: 100, flexDirection: 'row', alignItems: 'center' }}>
                  {row.value !== null && (
                    <Pill
                      label={onTrack ? 'On Track' : 'Below'}
                      bg={onTrack ? COLORS.successBg : COLORS.dangerBg}
                      fg={onTrack ? COLORS.success   : COLORS.danger}
                      width={88}
                      minHeight={20}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* ═══ Focus This Week ══════════════════════════════════════════════ */}
        <View style={styles.section} wrap={false}>
          <View style={{
            borderWidth: 1.5, borderColor: COLORS.primary,
            borderRadius: 8, padding: 14, backgroundColor: COLORS.focusBg,
          }}>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.primary, marginBottom: 8 }}>
              Focus This Week
            </Text>
            {displayBullets.map((bullet, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: i < displayBullets.length - 1 ? 4 : 0 }}>
                <Text style={{ width: 12, fontSize: 9, color: COLORS.primary, fontFamily: 'Helvetica-Bold' }}>•</Text>
                <Text style={{ flex: 1, fontSize: 9, color: COLORS.text, lineHeight: 1.4 }}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══ Award Progress ═══════════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Award Progress</Text>

          {achievedAwards.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.achievedFg, marginBottom: 4 }}>
                Achieved
              </Text>
              {achievedAwards.map((a, i) => (
                <AwardRow
                  key={a.id ?? i}
                  name={a.name}
                  requirement={awardReqStr(a)}
                  progress={a.progressPercent ?? 0}
                  status="achieved"
                />
              ))}
            </View>
          )}

          {inProgressAwards.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.primary, marginBottom: 4 }}>
                In Progress
              </Text>
              {inProgressAwards.map((a, i) => (
                <AwardRow
                  key={a.id ?? i}
                  name={a.name}
                  requirement={awardReqStr(a)}
                  progress={a.progressPercent ?? 0}
                  status="in-progress"
                />
              ))}
            </View>
          )}

          {notStartedAwards.length > 0 && (
            <View style={{
              padding: 10, backgroundColor: COLORS.surfaceRaised,
              borderRadius: 6, borderWidth: 0.5, borderColor: COLORS.border,
            }}>
              <Text style={{ fontSize: 9, color: COLORS.textMuted, fontStyle: 'italic' }}>
                {notStartedAwards.length} award{notStartedAwards.length !== 1 ? 's' : ''} not yet started — keep building your production to unlock them.
              </Text>
            </View>
          )}

          {awardList.length === 0 && (
            <Text style={{ fontSize: 9, color: COLORS.textMuted, fontStyle: 'italic' }}>
              No award data available yet.
            </Text>
          )}
        </View>

        {/* ═══ Settlement History ═══════════════════════════════════════════ */}
        {(() => {
          const settlementRows = (confirmedSettlements ?? [])
            .filter((s) => String(s.periodKey ?? '').startsWith(String(year)))
            .sort((a, b) => String(b.periodKey ?? '').localeCompare(String(a.periodKey ?? '')));

          const COL = {
            period: 100,
            api:    115,
            apps:    70,
            pers:    80,
            by:     100,
            date:    66,
          };

          return (
            <View style={styles.section} wrap={settlementRows.length > 8}>
              <Text style={styles.sectionTitle}>Settlement History — {year}</Text>

              {settlementRows.length === 0 ? (
                <Text style={{ fontSize: 9, color: COLORS.textMuted, paddingVertical: 8 }}>
                  No confirmed settlements yet for {year}.
                </Text>
              ) : (
                <View>
                  {/* Header row */}
                  <View style={styles.tableHeaderRow}>
                    <View style={{ width: COL.period }}>
                      <Text style={styles.tableHeaderCell}>Period</Text>
                    </View>
                    <View style={{ width: COL.api, flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Settled API</Text>
                    </View>
                    <View style={{ width: COL.apps, flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Settled Apps</Text>
                    </View>
                    <View style={{ width: COL.pers, flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Persistency</Text>
                    </View>
                    <View style={{ width: COL.by }}>
                      <Text style={styles.tableHeaderCell}>Confirmed By</Text>
                    </View>
                    <View style={{ width: COL.date }}>
                      <Text style={styles.tableHeaderCell}>Date</Text>
                    </View>
                  </View>

                  {/* Body rows */}
                  {settlementRows.map((s, i) => {
                    const persVal = parseFloat(s.persistency);
                    const persStr = Number.isFinite(persVal) && persVal > 0 ? `${persVal.toFixed(0)}%` : '—';
                    return (
                      <View
                        key={s.id ?? `${s.periodKey}-${i}`}
                        style={[
                          styles.tableRow,
                          { backgroundColor: i % 2 === 0 ? COLORS.surfaceRaised : COLORS.surface },
                        ]}
                      >
                        <View style={{ width: COL.period }}>
                          <Text style={{ fontSize: 9 }}>{periodLabel(s.periodKey)}</Text>
                        </View>
                        <View style={{ width: COL.api, flexDirection: 'row', justifyContent: 'flex-end' }}>
                          <Text style={{ fontSize: 9, textAlign: 'right' }}>
                            {formatCurrency(parseFloat(s.settledAPI) || 0)}
                          </Text>
                        </View>
                        <View style={{ width: COL.apps, flexDirection: 'row', justifyContent: 'flex-end' }}>
                          <Text style={{ fontSize: 9, textAlign: 'right' }}>
                            {String(parseFloat(s.settledApps) || 0)}
                          </Text>
                        </View>
                        <View style={{ width: COL.pers, flexDirection: 'row', justifyContent: 'flex-end' }}>
                          <Text style={{ fontSize: 9, textAlign: 'right' }}>{persStr}</Text>
                        </View>
                        <View style={{ width: COL.by }}>
                          <Text style={{ fontSize: 9 }}>{s.confirmedByName ?? '—'}</Text>
                        </View>
                        <View style={{ width: COL.date }}>
                          <Text style={{ fontSize: 9 }}>{formatConfirmedDate(s.confirmedAt)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* ═══ Footer band ══════════════════════════════════════════════════ */}
        <View style={styles.footerBand} fixed>
          <Text style={styles.footerText}>
            Generated by AgencyTrack  |  Confidential  |  TTD currency
          </Text>
          <Text style={styles.footerText}>
            {agentInfo?.email ?? ''}
          </Text>
        </View>

      </Page>
    </Document>
  );
}

