// Agent Awards v2 — kiosk-grade medals + 3-tier model
//
//   Tier 1 (hero): the single award you're closest to qualifying for. Big
//                  gradient medal + glowing arc + countdown narrative.
//   Tier 2 (grid): medallions grouped by state — Qualified / Almost there /
//                  Making progress / Just starting.
//   Tier 3 (drawer): full criteria checklist + pace narrative + notes.
//
// Mock data lives at top. Real awards data comes from awardsEngine.

// ──────────────────────────────────────────────────────────────────────────
// State colour helpers — gold (qualified), teal (in contention), grey (locked)
// ──────────────────────────────────────────────────────────────────────────
function awardArcColor(state) {
  if (state === 'qualified')  return '#f59e0b';
  if (state === 'contention') return '#4ab5b8';
  return '#a89a85';
}
function awardGlowRgba(state) {
  if (state === 'qualified')  return 'rgba(245, 158, 11, 0.5)';
  if (state === 'contention') return 'rgba(74, 181, 184, 0.4)';
  return 'rgba(168, 154, 133, 0.18)';
}

// ──────────────────────────────────────────────────────────────────────────
// AwardDonut — clean animated donut with percent at the center
// ──────────────────────────────────────────────────────────────────────────
function AwardDonut({ state, percent, size = 100, strokeWidth = 10, withGlow = true }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  const ac = awardArcColor(state);
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {withGlow && state !== 'locked' && (
        <div className="a-glow-soft" style={{
          position: 'absolute', inset: -12,
          background: `radial-gradient(circle, ${awardGlowRgba(state)} 0%, transparent 65%)`,
          pointerEvents: 'none', borderRadius: '50%',
        }}></div>
      )}
      <svg width={size} height={size} style={{ position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ac} strokeOpacity="0.16" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ac} strokeWidth={strokeWidth} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          className="a-arc-reveal"
          style={{ strokeDasharray: `${dash} ${c}`, strokeDashoffset: dash }} />
      </svg>
      <div style={{
        fontSize: size * 0.27, fontWeight: 700, color: ac,
        letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1,
        position: 'relative',
      }}>{percent}%</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mock award data
// ──────────────────────────────────────────────────────────────────────────
const AWARDS_HERO = { id: 'mdrt', name: 'MDRT 2026', prize: 'Million Dollar Round Table membership', current: 487000, target: 500000, percent: 97, state: 'contention' };

const AWARDS_QUALIFIED = [
  { id: 'starter',  name: 'Starter Award',  prize: 'First-year milestone',     percent: 100, state: 'qualified', date: 'Earned 14 Mar 2026' },
];
const AWARDS_CLOSE = [
  { id: 'eagles',   name: 'Eagles Club',    prize: 'Bermuda incentive trip',    current: 304500, target: 350000,  unit: 'TTD',   percent: 87, state: 'contention' },
  { id: 'qchamp',   name: 'Q4 Champion',    prize: 'TTD 5,000 bonus',           current: 110000, target: 150000,  unit: 'TTD',   percent: 74, state: 'contention' },
];
const AWARDS_MID = [
  { id: 'monthly',  name: 'Performer · Nov', prize: 'Branch recognition',       current: 32000,  target: 50000,   unit: 'TTD',   percent: 64, state: 'contention' },
  { id: 'activity', name: 'Activity Producer', prize: 'Annual plaque',          current: 1040,   target: 2000,    unit: 'count', percent: 52, state: 'contention' },
  { id: 'inner',    name: 'Inner Circle',    prize: 'Top 10% recognition',      current: 487000, target: 1000000, unit: 'TTD',   percent: 49, state: 'contention' },
];
const AWARDS_LOCKED = [
  { id: 'diamond',  name: 'Diamond Club',    prize: 'TTD 25,000 bonus',         current: 487000, target: 2200000, unit: 'TTD',   percent: 22, state: 'locked' },
  { id: 'recruit',  name: 'Top Recruiter',   prize: 'Recruitment plaque',       current: 0,      target: 5,       unit: 'count', percent: 0,  state: 'locked' },
];

const RATIOS = [
  { label: 'CI → SALE',   value: '79%',       sub: '72%',       trend: 'up',   color: '#4ab5b8', values: [68, 70, 72, 71, 75, 78, 79] },
  { label: 'DIALS → CI',  value: '5.6%',      sub: '5.1%',      trend: 'up',   color: '#e8b73e', values: [4.8, 5.0, 5.2, 5.0, 5.3, 5.5, 5.6] },
  { label: 'AVG POLICY',  value: 'TTD 11.8K', sub: 'TTD 10.9K', trend: 'up',   color: '#01696F', values: [10.2, 10.5, 10.9, 11.0, 11.4, 11.6, 11.8] },
  { label: 'FFI → DIAL',  value: '7.2%',      sub: '7.6%',      trend: 'down', color: '#c0392b', values: [8.0, 7.8, 7.5, 7.6, 7.4, 7.3, 7.2] },
];

// ──────────────────────────────────────────────────────────────────────────
// Hero card — closest award (Tier 1)
// ──────────────────────────────────────────────────────────────────────────
function HeroAwardCard({ t, award }) {
  const gapTTD = award.target - award.current;
  return (
    <div className="a-card a-rise" style={{
      position: 'relative', padding: '22px 28px',
      background: t.surface, border: `1px solid ${awardArcColor('contention')}55`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: `0 8px 24px rgba(74, 181, 184, 0.18)`,
      display: 'flex', alignItems: 'center', gap: 26,
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -60, right: -100, width: 360, height: 360,
        background: `radial-gradient(circle, ${awardGlowRgba('contention')} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }}></div>

      <AwardDonut state="contention" percent={award.percent} size={140} strokeWidth={12} />

      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
          color: t.teal, fontFamily: APP_FONT_MONO,
        }}>★ ALMOST THERE</div>
        <div style={{
          fontSize: 32, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.022em', lineHeight: 1.05, marginTop: 6,
          fontFamily: APP_FONT_DISPLAY,
        }}>{award.name}</div>
        <div style={{ fontSize: 13, color: t.inkMute, marginTop: 6, lineHeight: 1.5 }}>{award.prize}</div>
        <div style={{
          marginTop: 14, display: 'inline-flex', alignItems: 'baseline', gap: 10,
          padding: '8px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9,
        }}>
          <div style={{ fontSize: 10.5, color: t.inkMute, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>TTD</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em' }}>
            {gapTTD.toLocaleString()}
          </div>
          <div style={{ fontSize: 11.5, color: t.inkMute }}>to qualify</div>
        </div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 8 }}>
          About <span style={{ color: t.ink, fontWeight: 600 }}>1 week</span> at your current pace · avg TTD 22K/week
        </div>

        {/* At-a-glance provenance — what fed this total, straight from the ledger */}
        <div style={{ marginTop: 14, maxWidth: 360 }}>
          <ContributionBar t={t} prov={AWARD_PROVENANCE.mdrt} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: t.inkMute }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: t.teal }}></span> Base production
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: t.inkMute }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: t.gold }}></span> Campaigns · incl. <span style={{ color: t.ink, fontWeight: 600 }}>TTD 284K</span> Christmas
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AwardCard — compact grid item with progress bar (Tier 2)
// ──────────────────────────────────────────────────────────────────────────
function formatGapShort(award) {
  const gap = award.target - award.current;
  const unit = award.unit || (award.target >= 5000 ? 'TTD' : 'count');
  if (unit === 'TTD') {
    return gap >= 1000 ? `TTD ${(gap / 1000).toFixed(0)}K to go` : `TTD ${gap} to go`;
  }
  return `${gap} to go`;
}
function formatProgressLine(award) {
  if (award.state === 'qualified') return award.date || 'Earned';
  const unit = award.unit || (award.target >= 5000 ? 'TTD' : 'count');
  if (unit === 'TTD') {
    const curK = award.current >= 1000 ? `TTD ${(award.current / 1000).toFixed(0)}K` : `TTD ${award.current}`;
    const tgtK = award.target  >= 1000 ? `TTD ${(award.target  / 1000).toFixed(0)}K` : `TTD ${award.target}`;
    return `${curK} of ${tgtK}`;
  }
  return `${award.current.toLocaleString()} of ${award.target.toLocaleString()}`;
}
function AwardCard({ t, award, animClass, mobile = false, onClick }) {
  const color = award.state === 'qualified' ? t.gold : award.state === 'contention' ? t.teal : t.inkFaint;
  const bg    = award.state === 'qualified' ? t.goldTint : award.state === 'contention' ? t.tealTint : t.surfaceMute;
  const stateText = award.state === 'qualified' ? 'QUALIFIED' : award.state === 'contention' ? `${award.percent}%` : 'LOCKED';
  return (
    <div onClick={onClick} className={`a-card ${animClass || ''}`} style={{
      padding: mobile ? '14px 14px 13px' : '16px 18px 14px',
      background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 12, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
    }}>
      {/* Name + state pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: mobile ? 13 : 14, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{award.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2, lineHeight: 1.4 }}>{award.prize}</div>
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color, padding: '3px 8px', background: bg, borderRadius: 999,
          fontFamily: APP_FONT_MONO, flexShrink: 0,
        }}>{stateText}</div>
      </div>

      {/* Big % + bar */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{
            fontSize: 24, fontWeight: 700, color,
            letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1,
          }}>{award.percent}<span style={{ fontSize: 14, color: t.inkMute, marginLeft: 2 }}>%</span></div>
          <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
            {award.state === 'qualified' ? (award.date || '') :
             award.state === 'contention' ? formatGapShort(award) :
             'Not started'}
          </div>
        </div>
        <div style={{ height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{
            width: `${Math.max(2, award.percent)}%`, height: 6,
            background: color, borderRadius: 999, transformOrigin: 'left center',
          }}></div>
        </div>
        {/* Quiet caption row: submitted-of-target beneath the bar */}
        {(award.current !== undefined && award.target !== undefined) && (
          <div style={{
            marginTop: 7, textAlign: 'center',
            fontSize: 10.5, color: t.inkFaint,
            fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
          }}>{formatProgressLine(award)}</div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Group header
// ──────────────────────────────────────────────────────────────────────────
function GroupHeader({ t, label, count, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
        color: accent, fontFamily: APP_FONT_MONO, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        padding: '2px 8px', borderRadius: 999,
        background: `${accent}22`, color: accent,
        fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO,
      }}>{count}</div>
      <div style={{ flex: 1, height: 1, background: t.rule, marginLeft: 4 }}></div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MiniSpark — local sparkline for ratio cards
// ──────────────────────────────────────────────────────────────────────────
function AwardMiniSpark({ color, values, width = 100, height = 24 }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = (height - 4) - ((v - min) / range) * (height - 4) + 2;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const pathLength = pts.reduce((sum, [x, y], i) => {
    if (i === 0) return 0;
    const [px, py] = pts[i - 1];
    return sum + Math.hypot(x - px, y - py);
  }, 0);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        className="a-line-draw"
        style={{ strokeDasharray: pathLength, strokeDashoffset: pathLength }} />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color}
        style={{ opacity: 0, animation: 'app-fade-in 400ms ease 1.6s forwards' }} />
    </svg>
  );
}

function RatioTrendCard({ t, label, value, sub, trend, color, values, animClass }) {
  const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
  const trendColor = trend === 'up' ? t.success : trend === 'down' ? t.danger : t.inkMute;
  return (
    <div className={`a-card ${animClass || ''}`} style={{
      padding: '14px 16px', background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 11, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: t.inkFaint, fontFamily: APP_FONT_MONO,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{
          fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em',
          fontFamily: APP_FONT_DISPLAY, lineHeight: 1,
        }}>{value}</div>
        <div style={{ fontSize: 15, color: trendColor, fontWeight: 700 }}>{trendIcon}</div>
      </div>
      <AwardMiniSpark color={color} values={values} width={140} height={26} />
      <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
        12W AVG · {sub}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PROVENANCE — the Policy Ledger is the single source of truth.
//
// Every award number is computed live from settled policies in the agent's
// Policy Ledger. Campaign production is the SAME ledger, sliced by the
// campaign window — so campaign earnings count toward annual awards unless a
// campaign is explicitly marked Standalone. These contribution figures
// reconcile to the campaigns surface (Marsha's Christmas Campaign settled API
// = TTD 284K, per XMAS_STANDINGS).
// ──────────────────────────────────────────────────────────────────────────
const AWARD_PROVENANCE = {
  mdrt: {
    settled: 487000, target: 500000, pending: 66200,
    segments: [
      { label: 'Base production', value: 162000, kind: 'base' },
      { label: 'Christmas Campaign 2025', value: 284000, kind: 'campaign', counts: true },
      { label: 'Back-to-School Drive', value: 41000, kind: 'campaign', counts: true },
    ],
    standalone: [{ label: "S·02 Closer's Cup", note: 'Unit placement race · apps only' }],
  },
  eagles: {
    settled: 304500, target: 350000, pending: 45000,
    segments: [
      { label: 'Base production', value: 20500, kind: 'base' },
      { label: 'Christmas Campaign 2025', value: 284000, kind: 'campaign', counts: true },
    ],
    standalone: [],
  },
};

// Small "live from the ledger" chip — makes the source of truth explicit.
function LedgerSourceChip({ t, synced = '9:12 AM' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
      background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999,
    }}>
      <span className="a-breathe" style={{ width: 7, height: 7, borderRadius: '50%', background: t.success, flexShrink: 0 }}></span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
        LIVE FROM POLICY LEDGER · SYNCED {synced}
      </span>
    </div>
  );
}

// Stacked contribution bar — what fed the award total.
function ContributionBar({ t, prov }) {
  const total = prov.target;
  const segColor = (s) => s.kind === 'campaign' ? t.gold : t.teal;
  return (
    <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: t.surfaceMute, border: `1px solid ${t.rule}` }}>
      {prov.segments.map((s, i) => (
        <div key={i} title={`${s.label} · TTD ${(s.value / 1000).toFixed(0)}K`} style={{
          width: `${(s.value / total) * 100}%`, height: '100%', background: segColor(s),
          borderRight: i < prov.segments.length - 1 ? `1.5px solid ${t.surface}` : 'none',
        }}></div>
      ))}
    </div>
  );
}

// Full provenance panel — the "how this is calculated" block in the drawer.
function AwardProvenancePanel({ t, prov }) {
  const k = (n) => n >= 1000 ? `TTD ${(n / 1000).toFixed(0)}K` : `TTD ${n}`;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Eyebrow t={t} color={t.inkMute}>How this is calculated</Eyebrow>
        <LedgerSourceChip t={t} />
      </div>

      <div style={{ padding: '14px 16px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: t.inkMute }}>Settled API, drawn from your ledger</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{k(prov.settled)} <span style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>/ {k(prov.target)}</span></span>
        </div>

        <ContributionBar t={t} prov={prov} />

        {/* Legend rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
          {prov.segments.map((s, i) => {
            const isCampaign = s.kind === 'campaign';
            const c = isCampaign ? t.gold : t.teal;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c, flexShrink: 0 }}></span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: isCampaign ? 700 : 600, color: t.ink, minWidth: 0 }}>{s.label}</span>
                {isCampaign && (
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', padding: '1px 6px', background: t.goldTint, borderRadius: 999 }}>✓ COUNTS</span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, width: 64, textAlign: 'right' }}>{k(s.value)}</span>
              </div>
            );
          })}
        </div>

        {/* Pending */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.rule}` }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: t.surfaceMute, border: `1.5px solid ${t.inkDim}`, flexShrink: 0 }}></span>
          <span style={{ flex: 1, fontSize: 12, color: t.inkMute }}>Pending settlement · not yet counted</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>+{k(prov.pending)}</span>
        </div>
      </div>

      {/* Standalone exclusions + the rule */}
      {prov.standalone.length > 0 && (
        <div style={{ marginTop: 10, padding: '11px 14px', background: t.surface, border: `1px dashed ${t.rule}`, borderRadius: 10 }}>
          {prov.standalone.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', padding: '1px 6px', background: t.surfaceMute, borderRadius: 999 }}>STANDALONE</span>
              <span style={{ flex: 1, fontSize: 11.5, color: t.inkMute }}>{s.label} <span style={{ color: t.inkFaint }}>· {s.note}</span></span>
              <span style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>excluded</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 10.5, color: t.inkMute, lineHeight: 1.55 }}>
        Campaign production counts toward annual awards unless a campaign is marked <span style={{ color: t.ink, fontWeight: 600 }}>Standalone</span>. Settled figures confirm once Tatil settlement files arrive (mid-month); pending is shown separately.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Drill drawer — MDRT criteria detail
// ──────────────────────────────────────────────────────────────────────────
function MdrtDrillDetail({ t }) {
  return (
    <>
      <div style={{ padding: '22px 22px 16px', borderBottom: `1px solid ${t.rule}` }}>
        <Eyebrow t={t} color={t.teal}>★ ALMOST THERE</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>
          MDRT 2026
        </div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 4, lineHeight: 1.5 }}>
          Million Dollar Round Table — recognised globally as the standard of excellence for insurance and financial advisors.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
          <AwardDonut state="contention" percent={97} size={68} strokeWidth={8} />
          <div>
            <div style={{ fontSize: 13, color: t.ink, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.005em' }}>TTD 487K / TTD 500K</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4, fontFamily: APP_FONT_MONO }}>Settled API target</div>
          </div>
          <div style={{ flex: 1 }}></div>
          <Pill t={t} color={t.warning} bg={t.warningTint}>ESTIMATED</Pill>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
        <Eyebrow t={t} color={t.inkMute}>Criteria</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {[
            { label: 'Settled API ≥ TTD 500,000',     current: 'TTD 487K', target: 'TTD 500K', pct: 97,  met: false },
            { label: 'Persistency ≥ 50%',              current: '88%',      target: '50%',      pct: 100, met: true },
            { label: 'Continuous submission ≥ 13 wk',  current: '12',       target: '13',       pct: 92,  met: false },
          ].map((c, i) => (
            <div key={i} style={{
              padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`,
              borderRadius: 9,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: c.met ? t.success : 'transparent',
                  border: c.met ? 'none' : `1.5px solid ${t.warning}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {c.met && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{c.label}</div>
                <div style={{ fontSize: 11, color: c.met ? t.success : t.warning, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{c.pct}%</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{c.current}</div>
                <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{c.target}</div>
              </div>
              <div style={{ height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                <div className="a-progress-grow" style={{ width: `${Math.min(c.pct, 100)}%`, height: 4, background: c.met ? t.success : t.warning, borderRadius: 999 }}></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 16, padding: '14px 14px',
          background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 10,
        }}>
          <Eyebrow t={t}>YOUR PACE</Eyebrow>
          <div style={{ fontSize: 13, color: t.ink, marginTop: 8, lineHeight: 1.55 }}>
            You're <span style={{ color: t.teal, fontWeight: 700 }}>TTD 13K</span> from qualifying.<br />
            At your avg pace of TTD 22K/week, you'll cross MDRT in <span style={{ color: t.teal, fontWeight: 700 }}>about 1 week</span>.
          </div>
        </div>

        {/* Provenance — the Policy Ledger is the source of truth; campaign
            production rolls up here unless a campaign is Standalone. */}
        <AwardProvenancePanel t={t} prov={AWARD_PROVENANCE.mdrt} />
      </div>

      <div style={{
        padding: '12px 22px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 11.5, color: t.inkMute }}>5 weeks left in qualifying period</div>
        <div style={{
          padding: '8px 14px', background: t.teal, color: '#fff', borderRadius: 8,
          fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          Open weekly report <IconArrowR size={12} color="#fff" stroke={2.4} />
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Desktop composed screen
// ──────────────────────────────────────────────────────────────────────────
function AgentAwardsV2({ t, drawerOpen = false }) {
  return (
    <AppShell t={t} active="awards" title="Awards" subtitle="Marsha Singh · YTD 2026 · 11 awards tracked">
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>

        <HeroAwardCard t={t} award={AWARDS_HERO} />

        {/* Category tabs + the ledger source-of-truth signal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
            {['All', 'Monthly', 'Quarterly', 'Annual', 'Club'].map((tab, i) => (
              <div key={tab} style={{
                padding: '7px 14px', borderRadius: 7,
                fontSize: 12, fontWeight: 700, letterSpacing: '0.005em',
                background: i === 0 ? t.surface : 'transparent',
                color: i === 0 ? t.ink : t.inkMute,
                boxShadow: i === 0 ? `0 1px 2px rgba(0,0,0,0.04)` : 'none',
                border: i === 0 ? `1px solid ${t.rule}` : 'none',
              }}>{tab}</div>
            ))}
          </div>
          <LedgerSourceChip t={t} />
        </div>

        {AWARDS_QUALIFIED.length > 0 && (
          <div>
            <GroupHeader t={t} label="✓ Qualified" count={AWARDS_QUALIFIED.length} accent={t.gold} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {AWARDS_QUALIFIED.map((a, i) => <AwardCard key={a.id} t={t} award={a} animClass={`a-fade-up a-d-${i+1}`} />)}
            </div>
          </div>
        )}

        <div>
          <GroupHeader t={t} label="★ Almost there · 70%+" count={AWARDS_CLOSE.length} accent={t.teal} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {AWARDS_CLOSE.map((a, i) => <AwardCard key={a.id} t={t} award={a} animClass={`a-fade-up a-d-${i+1}`} />)}
          </div>
        </div>

        <div>
          <GroupHeader t={t} label="↗ Making progress · 30–70%" count={AWARDS_MID.length} accent={t.tealLight} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {AWARDS_MID.map((a, i) => <AwardCard key={a.id} t={t} award={a} animClass={`a-fade-up a-d-${i+2}`} />)}
          </div>
        </div>

        <div>
          <GroupHeader t={t} label="◯ Just starting · under 30%" count={AWARDS_LOCKED.length} accent={t.inkFaint} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {AWARDS_LOCKED.map((a, i) => <AwardCard key={a.id} t={t} award={a} animClass={`a-fade-up a-d-${i+3}`} />)}
          </div>
        </div>

        <div>
          <Eyebrow t={t}>Activity ratio trends · last 12 weeks</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
            {RATIOS.map((r, i) => <RatioTrendCard key={r.label} t={t} {...r} animClass={`a-fade-up a-d-${i+1}`} />)}
          </div>
        </div>

        {drawerOpen && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)',
              animation: 'app-fade-in 280ms ease both', zIndex: 20,
            }}></div>
            <div className="a-card" style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 460, background: t.surface, borderLeft: `1px solid ${t.rule}`,
              boxShadow: t.mode === 'light' ? '-12px 0 32px rgba(40,37,29,0.08)' : '-12px 0 32px rgba(0,0,0,0.5)',
              zIndex: 21, display: 'flex', flexDirection: 'column',
              animation: 'kiosk-slide-r 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            }}>
              <div style={{
                position: 'absolute', top: 16, right: 16, zIndex: 5,
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px 8px 10px',
                background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                borderRadius: 999, cursor: 'pointer',
                color: t.ink, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Close
              </div>
              <MdrtDrillDetail t={t} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile composed screen
// ──────────────────────────────────────────────────────────────────────────
function AgentAwardsV2Mobile({ t, sheetOpen = false }) {
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Awards" sub="YTD 2026 · 11 TRACKED" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Hero */}
          <div className="a-card a-rise" style={{
            position: 'relative', padding: '18px 18px 16px',
            background: t.surface, border: `1px solid ${awardArcColor('contention')}55`, borderRadius: 14,
            overflow: 'hidden',
            boxShadow: `0 6px 20px ${awardGlowRgba('contention')}33`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <div className="a-glow-soft" style={{
              position: 'absolute', top: -60, right: -60, width: 240, height: 240,
              background: `radial-gradient(circle, ${awardGlowRgba('contention')} 0%, transparent 65%)`,
              pointerEvents: 'none',
            }}></div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
              color: t.teal, fontFamily: APP_FONT_MONO, position: 'relative',
            }}>★ ALMOST THERE</div>
            <div style={{
              marginTop: 6, fontSize: 22, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, position: 'relative',
            }}>MDRT 2026</div>
            <div style={{ marginTop: 18, position: 'relative' }}>
              <AwardDonut state="contention" percent={97} size={130} strokeWidth={11} />
            </div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 12, fontFamily: APP_FONT_MONO, position: 'relative' }}>
              TTD 487K / TTD 500K
            </div>
            <div style={{
              marginTop: 14, padding: '10px 14px', background: t.tealTint,
              border: `1px solid ${t.teal}33`, borderRadius: 9,
              fontSize: 12, color: t.ink, lineHeight: 1.5, position: 'relative',
            }}>
              <span style={{ color: t.teal, fontWeight: 700 }}>TTD 13K</span> to qualify · ~1 week at pace
            </div>
          </div>

          <div>
            <GroupHeader t={t} label="★ Almost there" count={AWARDS_CLOSE.length} accent={t.teal} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {AWARDS_CLOSE.map((a, i) => <AwardCard key={a.id} t={t} award={a} animClass={`a-fade-up a-d-${i+1}`} mobile />)}
            </div>
          </div>

          <div>
            <GroupHeader t={t} label="↗ Making progress" count={AWARDS_MID.length} accent={t.tealLight} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {AWARDS_MID.slice(0, 2).map((a, i) => <AwardCard key={a.id} t={t} award={a} animClass={`a-fade-up a-d-${i+2}`} mobile />)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>Activity trends · 12W</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {RATIOS.slice(0, 2).map((r, i) => (
                <div key={r.label} className={`a-fade-up a-d-${i+3}`} style={{
                  padding: '10px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10,
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{r.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', marginTop: 4 }}>{r.value}</div>
                  <AwardMiniSpark color={r.color} values={r.values} width={130} height={22} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </MContent>
      <MNav t={t} active="more" />

      {sheetOpen && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 25, animation: 'app-fade-in 240ms ease both' }}></div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 620, background: t.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderTop: `1px solid ${t.rule}`,
            boxShadow: '0 -12px 32px rgba(0,0,0,0.25)',
            zIndex: 26, display: 'flex', flexDirection: 'column',
            animation: 'kiosk-rise 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'relative', padding: '12px 16px 6px' }}>
              <div style={{ width: 40, height: 4, background: t.inkDim, borderRadius: 999, margin: '0 auto' }}></div>
              <div style={{
                position: 'absolute', top: 8, right: 12,
                width: 32, height: 32, borderRadius: '50%',
                background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.ink, cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
            <MdrtDrillDetail t={t} />
          </div>
        </>
      )}
    </MFrame>
  );
}

Object.assign(window, { AgentAwardsV2, AgentAwardsV2Mobile });
