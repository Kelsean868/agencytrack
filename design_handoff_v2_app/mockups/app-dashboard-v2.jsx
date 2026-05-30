// Agent Dashboard v2 — 3-tier progressive-reveal model
//
//   Tier 1: Hero card (always visible) — one headline number + one action
//   Tier 2: Pulse strip (always visible, compact) — 6 status chips
//   Tier 3: Detail drawer (on demand) — slides from right on desktop,
//           bottom sheet on mobile. Triggered by tapping a Tier 2 chip.
//
// First-load animation:
//   • Backdrop blobs drift continuously (AmbientBg)
//   • Hero number + progress bar sweep on mount (a-progress-grow)
//   • Pulse chips fade-up cascade (a-fade-up + a-d-N)
//   • Action banner icon breathes (a-breathe)
//
// All values + tokens drawn from app-tokens.jsx + app-motion.jsx.

// ──────────────────────────────────────────────────────────────────────────
// SHARED ICONS — small, lucide-flavoured strokes
// ──────────────────────────────────────────────────────────────────────────
function PulseIcon({ kind, size = 16, color = 'currentColor' }) {
  const stroke = 1.9;
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'activity') return <svg {...props}><polyline points="3 12 7 12 10 4 14 20 17 12 21 12" /></svg>;
  if (kind === 'standard') return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>;
  if (kind === 'awards')   return <svg {...props}><path d="M6 4h12v3a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4z"/><path d="M9 16h6M12 11v5"/><path d="M4 6H2a2 2 0 0 0 2 4M20 6h2a2 2 0 0 1-2 4"/></svg>;
  if (kind === 'persist')  return <svg {...props}><path d="M3 12a9 9 0 1 0 3-6.5"/><polyline points="3 4 3 10 9 10"/></svg>;
  if (kind === 'streak')   return <svg {...props}><polygon points="13 2 4 14 11 14 10 22 19 10 12 10 13 2"/></svg>;
  if (kind === 'action')   return <svg {...props}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16" r="0.8" fill={color} stroke="none"/></svg>;
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// MINI VISUALIZATIONS — drawn / arc-revealed / bar-grown on mount
// ──────────────────────────────────────────────────────────────────────────
function MiniSparkline({ color, values, width = 56, height = 22 }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = (height - 4) - ((v - min) / (range)) * (height - 4) + 2;
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
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        className="a-line-draw"
        style={{ strokeDasharray: pathLength, strokeDashoffset: pathLength }} />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color}
        style={{ opacity: 0, animation: 'app-fade-in 400ms ease 1.6s forwards' }} />
    </svg>
  );
}

function MiniDonut({ color, percent, size = 30 }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeOpacity="0.18" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="a-arc-reveal"
        style={{ strokeDasharray: `${dash} ${c}`, strokeDashoffset: dash }}
      />
    </svg>
  );
}

function MiniBars({ color, values, width = 56, height = 22 }) {
  const max = Math.max(...values, 1);
  const barW = (width - (values.length - 1) * 2) / values.length;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        const x = i * (barW + 2);
        const y = height - h;
        return (
          <rect key={i} x={x} y={y} width={barW} height={h} fill={color} rx="1"
            className="a-bar-grow"
            style={{
              transformOrigin: `${x + barW / 2}px ${height}px`,
              animationDelay: `${0.3 + i * 0.05}s`,
            }}
          />
        );
      })}
    </svg>
  );
}

function PulseBadge({ color, count }) {
  return (
    <div className="a-pulse-badge" style={{
      width: 28, height: 28, borderRadius: '50%', background: color, color: '#fff',
      fontWeight: 800, fontSize: 14, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{count}</div>
  );
}

function PulseViz({ pulse, color, mobile = false }) {
  const v = pulse.viz;
  if (!v) return null;
  if (v.type === 'spark')  return <MiniSparkline color={color} values={v.values} width={mobile ? 42 : 56} height={mobile ? 18 : 22} />;
  if (v.type === 'donut')  return <MiniDonut    color={color} percent={v.percent} size={mobile ? 24 : 30} />;
  if (v.type === 'bars')   return <MiniBars     color={color} values={v.values} width={mobile ? 42 : 56} height={mobile ? 18 : 22} />;
  if (v.type === 'badge')  return <PulseBadge   color={color} count={v.count} />;
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// HERO CARD — Tier 1
// ──────────────────────────────────────────────────────────────────────────
function HeroCard({ t, onCTA }) {
  return (
    <div className="a-card a-rise" style={{
      position: 'relative',
      padding: '22px 26px',
      background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: 24,
    }}>
      {/* Backdrop glow */}
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -80, right: -80, width: 360, height: 360,
        background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }}></div>

      {/* Left — content */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
          color: t.teal, fontFamily: APP_FONT_MONO, textTransform: 'uppercase',
        }}>YTD · SETTLED API</div>
        <div style={{
          fontSize: 56, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.03em', lineHeight: 1, marginTop: 8,
          fontFamily: APP_FONT_DISPLAY,
        }}>TTD 487K</div>
        <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, lineHeight: 1.5 }}>
          81% of your TTD 600K goal · 5 weeks to year-end
          <span style={{ color: t.inkFaint, padding: '0 6px' }}>·</span>
          <span style={{ color: t.success, fontWeight: 600 }}>+18% vs LY</span>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 16, width: '100%', maxWidth: 480 }}>
          <div style={{ height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
            <div className="a-progress-grow" style={{
              width: '81%', height: 8,
              background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`,
              borderRadius: 999,
            }}></div>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6,
            fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em',
          }}>
            <span>TTD 0</span>
            <span style={{ color: t.warning }}>MDRT · TTD 500K</span>
            <span>Goal · TTD 600K</span>
          </div>
        </div>
      </div>

      {/* Right — CTA */}
      <div style={{ position: 'relative', flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: t.inkFaint, fontFamily: APP_FONT_MONO, marginBottom: 6 }}>
          NEXT STEP
        </div>
        <div style={{ fontSize: 14, color: t.ink, fontWeight: 600, marginBottom: 14, maxWidth: 220 }}>
          Two more apps puts you in L4 territory.
        </div>
        <div onClick={onCTA} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', background: t.teal, color: '#fff',
          borderRadius: 10, fontSize: 13.5, fontWeight: 700,
          boxShadow: `0 4px 12px ${t.teal}44`, cursor: 'pointer',
        }}>
          Submit weekly report <IconArrowR size={14} color="#fff" stroke={2.4} />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PULSE STRIP — Tier 2
// ──────────────────────────────────────────────────────────────────────────
const PULSES = [
  { key: 'activity', kind: 'activity', label: 'ACTIVITY',    status: 'On track',         tone: 'success',
    viz: { type: 'spark', values: [12, 16, 13, 19, 17, 22] } },
  { key: 'standard', kind: 'standard', label: 'STANDARD',    status: '6 of 10 met',      tone: 'warning',
    viz: { type: 'donut', percent: 60 } },
  { key: 'awards',   kind: 'awards',   label: 'AWARDS',      status: 'Close to MDRT',    tone: 'gold',
    viz: { type: 'donut', percent: 81 } },
  { key: 'persist',  kind: 'persist',  label: 'PERSISTENCY', status: '88% · trending ↑', tone: 'success',
    viz: { type: 'spark', values: [82, 84, 86, 85, 87, 88] } },
  { key: 'streak',   kind: 'streak',   label: 'STREAK',      status: '12 weeks',         tone: 'teal',
    viz: { type: 'bars', values: [3, 4, 3, 5, 4, 6] } },
  { key: 'action',   kind: 'action',   label: 'ACTION',      status: '1 thing today',    tone: 'danger',
    viz: { type: 'badge', count: 1 } },
];

function toneColors(t, tone) {
  switch (tone) {
    case 'success': return { fg: t.success, bg: t.successTint };
    case 'warning': return { fg: t.warning, bg: t.warningTint };
    case 'danger':  return { fg: t.danger,  bg: t.dangerTint };
    case 'gold':    return { fg: t.gold,    bg: t.goldTint };
    case 'teal':
    default:        return { fg: t.teal,    bg: t.tealTint };
  }
}

function PulseChip({ t, pulse, active, onClick, animClass }) {
  const { fg, bg } = toneColors(t, pulse.tone);
  return (
    <div onClick={onClick} className={`a-card ${animClass}`} style={{
      padding: '12px 14px',
      background: t.surface, border: `1px solid ${active ? fg + '88' : t.rule}`,
      borderRadius: 12, cursor: 'pointer',
      position: 'relative', overflow: 'hidden',
      boxShadow: active ? `0 0 0 1px ${fg}33` : 'none',
    }}>
      {/* Top row: icon (left) + mini-viz (right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 8, background: bg, color: fg, flexShrink: 0,
        }}>
          <PulseIcon kind={pulse.kind} size={15} color={fg} />
        </div>
        <PulseViz pulse={pulse} color={fg} />
      </div>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
        color: t.inkFaint, fontFamily: APP_FONT_MONO,
      }}>{pulse.label}</div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em',
        marginTop: 3,
      }}>{pulse.status}</div>
    </div>
  );
}

function PulseStrip({ t, openKey = 'standard' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
      {PULSES.map((p, i) => (
        <PulseChip key={p.key} t={t} pulse={p} active={p.key === openKey} animClass={`a-fade-up a-d-${i + 1}`} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DELIVERY STRIP — outstanding policies to deliver + 30-day clock
// Reads the CRO delivery data (cro-v2-shared). Guarded so the dashboard still
// renders anywhere that module isn't loaded.
// ──────────────────────────────────────────────────────────────────────────
function DeliveryStripCard({ t }) {
  if (typeof POLICIES === 'undefined') return null;
  const me = 'Marsha Singh';
  const mine = POLICIES.filter((p) => p.agent === me && DELIVERY_STATES[p.state].open);
  if (!mine.length) return null;
  const overdue = mine.filter((p) => deliveryClock(p).overdue);
  const accent = overdue.length ? t.danger : t.teal;
  const ordered = [...mine].sort((a, b) => deliveryClock(a).daysLeft - deliveryClock(b).daysLeft);
  return (
    <div className="a-card a-fade-up a-d-4" style={{ padding: '16px 18px', background: t.surface, border: `1px solid ${overdue.length ? t.danger + '44' : t.rule}`, borderRadius: 14, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow t={t} color={accent}>Policies to deliver</Eyebrow>
        {overdue.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_MONO, padding: '2px 8px', background: t.dangerTint, borderRadius: 999, letterSpacing: '0.06em' }}>{overdue.length} OVERDUE</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, marginTop: 10 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{mine.length}</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, paddingBottom: 3 }}>outstanding · protect your commission</div>
      </div>
      <div style={{ marginTop: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {ordered.slice(0, 2).map((p) => {
          const c = deliveryClock(p);
          const col = c.overdue ? t.danger : c.atRisk ? t.warning : t.teal;
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.owner}</div>
                <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{DELIVERY_STATES[p.state].short} · sent {p.sent}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: col, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{c.overdue ? `+${Math.abs(c.daysLeft)}` : c.daysLeft}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>{c.overdue ? 'DAYS OVER' : 'DAYS LEFT'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// RECENT PANEL — light context below pulses
// ──────────────────────────────────────────────────────────────────────────
function RecentPanel({ t }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, flex: 1, minHeight: 0 }}>
      {/* Recent activity */}
      <div className="a-card a-fade-up a-d-3" style={{
        padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`,
        borderRadius: 14, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow t={t}>Recent</Eyebrow>
          <div style={{ fontSize: 11, color: t.teal, fontWeight: 700, cursor: 'pointer' }}>View all</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
          {[
            { color: t.success,   Icon: IconCheck,  text: 'Weekly report submitted',     sub: 'Mon 24 Nov · TTD 21.8K · 3 apps' },
            { color: t.gold,      Icon: IconMedal,  text: 'Eagles Club milestone hit',   sub: '68% to goal · keep pushing' },
            { color: t.teal,      Icon: IconBolt,   text: '12-week submission streak',   sub: 'Longest of any agent in S·02' },
            { color: t.inkAccent, Icon: IconShield, text: 'Promoted to Senior Associate',sub: '14 Mar 2026' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: `${a.color}22`, color: a.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <a.Icon size={14} color={a.color} stroke={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.text}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column — deliveries + active campaign */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
      <DeliveryStripCard t={t} />
      {/* Active campaigns / recognition */}
      <div className="a-card a-fade-up a-d-4" style={{
        padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`,
        borderRadius: 14, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
      }}>
        <Eyebrow t={t} color={t.gold}>★ Active campaign</Eyebrow>
        <div style={{
          fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em',
          fontFamily: APP_FONT_DISPLAY, marginTop: 12, lineHeight: 1.2,
        }}>November Sprint</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 4 }}>
          Ends Sun 30 Nov · TTD 5,000 prize
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <div style={{ fontSize: 10.5, color: t.inkMute, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO }}>YOUR PROGRESS</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO }}>78%</div>
          </div>
          <div style={{ height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
            <div className="a-progress-grow" style={{
              width: '78%', height: 6,
              background: `linear-gradient(90deg, ${t.gold}, ${t.gold})`,
              borderRadius: 999,
            }}></div>
          </div>
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 6 }}>
            TTD 39K of TTD 50K · <span style={{ color: t.ink, fontWeight: 600 }}>TTD 11K to go</span>
          </div>
        </div>

        <div style={{ flex: 1 }}></div>

        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: t.goldTint, border: `1px solid ${t.gold}33`, borderRadius: 9,
          fontSize: 12, color: t.ink, lineHeight: 1.5,
        }}>
          You're <span style={{ color: t.gold, fontWeight: 700 }}>#3 in your branch</span>. 2 weeks left.
        </div>
      </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DETAIL DRAWER (desktop) — Weekly Standard 10-row example
// ──────────────────────────────────────────────────────────────────────────
const STANDARD_ROWS = [
  { label: 'Dials',          floor: 40,    actual: 49,   unit: '',     status: 'met' },
  { label: 'Tel Contacts',   floor: 10,    actual: 8,    unit: '',     status: 'below' },
  { label: 'F2F Approaches', floor: 5,     actual: 6,    unit: '',     status: 'met' },
  { label: 'FFIs Conducted', floor: 3,     actual: 3,    unit: '',     status: 'at' },
  { label: 'CIs Conducted',  floor: 2,     actual: 2,    unit: '',     status: 'at' },
  { label: 'Applications',   floor: 1,     actual: 3,    unit: '',     status: 'met' },
  { label: 'API',            floor: 4800,  actual: 21800, unit: 'TTD', status: 'met' },
  { label: 'Persistency',    floor: 80,    actual: 88,   unit: '%',    status: 'met' },
  { label: 'Quality Mix',    floor: 60,    actual: 55,   unit: '%',    status: 'below' },
  { label: 'Awards on Pace', floor: 1,     actual: 2,    unit: '',     status: 'met' },
];

function StandardRow({ t, row }) {
  const tone = row.status === 'met' ? 'success' : row.status === 'at' ? 'warning' : 'danger';
  const { fg, bg } = toneColors(t, tone);
  const pct = Math.min(140, Math.round((row.actual / row.floor) * 100));
  const fmt = (n) => row.unit === 'TTD' ? `TTD ${(n / 1000).toFixed(1)}K`
                  : row.unit === '%'   ? `${n}%`
                  : `${n}`;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 56px 56px 1fr 60px',
      alignItems: 'center', gap: 10, padding: '10px 16px',
      borderBottom: `1px solid ${t.rule}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{row.label}</div>
      <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO, textAlign: 'right' }}>{fmt(row.floor)}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, textAlign: 'right' }}>{fmt(row.actual)}</div>
      <div style={{ position: 'relative' }}>
        <div style={{ height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{
            width: `${Math.min(100, pct)}%`, height: 4, background: fg, borderRadius: 999,
          }}></div>
        </div>
        {pct > 100 && (
          <div style={{
            position: 'absolute', top: -1, right: 0, width: 6, height: 6,
            background: fg, borderRadius: '50%', boxShadow: `0 0 6px ${fg}`,
          }}></div>
        )}
      </div>
      <div style={{
        textAlign: 'right',
        fontSize: 10, fontWeight: 700, color: fg,
        padding: '2px 9px', background: bg, borderRadius: 999,
        letterSpacing: '0.08em', fontFamily: APP_FONT_MONO,
        display: 'inline-block', justifySelf: 'end',
      }}>{row.status === 'met' ? '✓ MET' : row.status === 'at' ? '~ AT' : 'BELOW'}</div>
    </div>
  );
}

function StandardDetail({ t }) {
  const summary = STANDARD_ROWS.reduce(
    (acc, r) => { if (r.status === 'met') acc.met++; else if (r.status === 'at') acc.at++; else acc.below++; return acc; },
    { met: 0, at: 0, below: 0 }
  );
  return (
    <>
      {/* Drawer header */}
      <div style={{
        padding: '20px 22px 16px',
        borderBottom: `1px solid ${t.rule}`,
      }}>
        <Eyebrow t={t} color={t.warning}>WEEK 48 · IN PROGRESS</Eyebrow>
        <div style={{
          fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em',
          fontFamily: APP_FONT_DISPLAY, marginTop: 6,
        }}>Weekly Standard</div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 4 }}>
          Expected vs Actual · the 10 floors that define a complete week.
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Pill t={t} color={t.success} bg={t.successTint}>{summary.met} MET</Pill>
          <Pill t={t} color={t.warning} bg={t.warningTint}>{summary.at} AT FLOOR</Pill>
          <Pill t={t} color={t.danger}  bg={t.dangerTint}>{summary.below} BELOW</Pill>
        </div>
      </div>

      {/* Column heads */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 56px 56px 1fr 60px',
        gap: 10, padding: '10px 16px',
        background: t.surfaceSoft,
        fontSize: 9.5, fontWeight: 700, color: t.inkMute,
        letterSpacing: '0.12em', fontFamily: APP_FONT_MONO,
        borderBottom: `1px solid ${t.ruleStrong}`,
      }}>
        <div>METRIC</div>
        <div style={{ textAlign: 'right' }}>FLOOR</div>
        <div style={{ textAlign: 'right' }}>ACTUAL</div>
        <div></div>
        <div style={{ textAlign: 'right' }}>STATUS</div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {STANDARD_ROWS.map((r, i) => <StandardRow key={i} t={t} row={r} />)}
      </div>

      {/* Footer action */}
      <div style={{
        padding: '14px 22px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.4 }}>
          Closes Sun 30 Nov · 3 days left to close the gaps
        </div>
        <div style={{
          padding: '9px 16px', background: t.teal, color: '#fff', borderRadius: 8,
          fontSize: 12.5, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          Open weekly report <IconArrowR size={13} color="#fff" stroke={2.4} />
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DESKTOP COMPOSED SCREEN
// ──────────────────────────────────────────────────────────────────────────
function AgentDashboardV2({ t, drawerOpen = false }) {
  return (
    <AppShell t={t} active="home" title="Dashboard" subtitle="Marsha Singh · Thursday 26 November · Week 48">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>

        {/* Needs action banner */}
        <div className="a-rise" style={{
          padding: '14px 16px', background: t.warningTint, borderRadius: 12,
          border: `1px solid ${t.warning}33`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div className="a-breathe" style={{
            width: 36, height: 36, borderRadius: '50%', background: t.surface,
            border: `1px solid ${t.warning}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <IconAlert size={16} color={t.warning} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>You haven't logged today yet</div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2 }}>30-second capture · rolls into your weekly report Sunday</div>
          </div>
          <div style={{
            padding: '8px 16px', background: t.warning, color: '#fff',
            borderRadius: 8, fontSize: 12, fontWeight: 700,
          }}>Log today</div>
        </div>

        {/* Hero */}
        <HeroCard t={t} />

        {/* Pulses */}
        <PulseStrip t={t} openKey={drawerOpen ? 'standard' : null} />

        {/* Recent panel */}
        <RecentPanel t={t} />

        {/* Detail drawer overlay */}
        {drawerOpen && (
          <>
            {/* Scrim */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.18)',
              backdropFilter: 'blur(2px)',
              animation: 'app-fade-in 280ms ease both',
              zIndex: 20,
            }}></div>
            {/* Drawer */}
            <div className="a-card" style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 460, background: t.surface, borderLeft: `1px solid ${t.rule}`,
              boxShadow: t.mode === 'light' ? '-12px 0 32px rgba(40,37,29,0.08)' : '-12px 0 32px rgba(0,0,0,0.5)',
              zIndex: 21, display: 'flex', flexDirection: 'column',
              animation: 'kiosk-slide-r 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            }}>
              {/* Close — labelled pill so the dismiss affordance is obvious */}
              <div style={{
                position: 'absolute', top: 16, right: 16, zIndex: 5,
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px 8px 10px',
                background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                borderRadius: 999, cursor: 'pointer',
                color: t.ink, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                fontFamily: APP_FONT_SANS,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Close
              </div>
              <StandardDetail t={t} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// Compact mobile twin of DeliveryStripCard.
function DeliveryStripMobile({ t }) {
  if (typeof POLICIES === 'undefined') return null;
  const mine = POLICIES.filter((p) => p.agent === 'Marsha Singh' && DELIVERY_STATES[p.state].open);
  if (!mine.length) return null;
  const overdue = mine.filter((p) => deliveryClock(p).overdue);
  const urgent = [...mine].sort((a, b) => deliveryClock(a).daysLeft - deliveryClock(b).daysLeft)[0];
  const uc = deliveryClock(urgent);
  const col = uc.overdue ? t.danger : uc.atRisk ? t.warning : t.teal;
  return (
    <div className="a-rise" style={{ padding: '12px 13px', background: t.surface, border: `1px solid ${overdue.length ? t.danger + '44' : t.rule}`, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: overdue.length ? t.dangerTint : t.tealTint, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconBook size={14} color={col} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>{mine.length} {mine.length === 1 ? 'policy' : 'policies'} to deliver</div>
        <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{overdue.length ? `${overdue.length} overdue · commission at risk` : `${urgent.owner.split(' ')[0]} · ${uc.daysLeft} days left`}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: col, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{uc.overdue ? `+${Math.abs(uc.daysLeft)}` : uc.daysLeft}</div>
        <div style={{ fontSize: 7.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>{uc.overdue ? 'DAYS OVER' : 'DAYS LEFT'}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE COMPOSED SCREEN
// ──────────────────────────────────────────────────────────────────────────
function AgentDashboardV2Mobile({ t, sheetOpen = false }) {
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Hi, Marsha" sub="THU · 26 NOV" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Needs action banner */}
          <div className="a-rise" style={{
            padding: '12px 13px', background: t.warningTint,
            border: `1px solid ${t.warning}33`, borderRadius: 11,
            display: 'flex', alignItems: 'center', gap: 11,
          }}>
            <div className="a-breathe" style={{
              width: 30, height: 30, borderRadius: '50%', background: t.surface,
              border: `1px solid ${t.warning}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <IconAlert size={14} color={t.warning} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>Log today</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>~30 sec capture</div>
            </div>
            <IconArrowR size={14} color={t.warning} stroke={2.4} />
          </div>

          {/* Policies to deliver */}
          <DeliveryStripMobile t={t} />

          {/* Hero — vertical */}
          <div className="a-card a-rise" style={{
            position: 'relative', padding: '18px 18px',
            background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div className="a-glow-soft" style={{
              position: 'absolute', top: -50, right: -50, width: 200, height: 200,
              background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`,
              pointerEvents: 'none',
            }}></div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
              color: t.teal, fontFamily: APP_FONT_MONO, position: 'relative',
            }}>YTD · SETTLED API</div>
            <div style={{
              fontSize: 44, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6,
              fontFamily: APP_FONT_DISPLAY, position: 'relative',
            }}>TTD 487K</div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 6, lineHeight: 1.5, position: 'relative' }}>
              81% of TTD 600K · 5 weeks left
            </div>
            <div style={{ marginTop: 12, position: 'relative' }}>
              <div style={{ height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                <div className="a-progress-grow" style={{ width: '81%', height: 6, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
              </div>
            </div>
            <div style={{
              marginTop: 14, padding: '10px 14px', background: t.teal, color: '#fff',
              borderRadius: 9, fontSize: 12.5, fontWeight: 700, textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: `0 3px 10px ${t.teal}44`, position: 'relative',
            }}>
              Submit weekly report <IconArrowR size={13} color="#fff" stroke={2.4} />
            </div>
          </div>

          {/* Pulses — 2 rows × 3 chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {PULSES.map((p, i) => {
              const { fg, bg } = toneColors(t, p.tone);
              const active = sheetOpen && p.key === 'standard';
              return (
                <div key={p.key} className={`a-fade-up a-d-${i + 1}`} style={{
                  padding: '10px 11px',
                  background: t.surface, border: `1px solid ${active ? fg + '88' : t.rule}`,
                  borderRadius: 10, position: 'relative',
                }}>
                  {/* Top row — icon + small viz */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 7,
                      background: bg, color: fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <PulseIcon kind={p.kind} size={13} color={fg} />
                    </div>
                    <PulseViz pulse={p} color={fg} mobile />
                  </div>
                  <div style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
                    color: t.inkFaint, fontFamily: APP_FONT_MONO,
                  }}>{p.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.ink, marginTop: 2 }}>{p.status}</div>
                </div>
              );
            })}
          </div>

          {/* Recent */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>Recent</div>
            {[
              { color: t.success, Icon: IconCheck, text: 'Weekly report submitted', sub: 'Mon · TTD 21.8K' },
              { color: t.gold,    Icon: IconMedal, text: 'Eagles Club milestone',   sub: '68% to goal' },
            ].map((a, i) => (
              <div key={i} className={`a-fade-up a-d-${i + 4}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${a.color}22`, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <a.Icon size={13} color={a.color} stroke={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.text}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </MContent>
      <MNav t={t} active="home" />

      {/* Bottom sheet */}
      {sheetOpen && (
        <>
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)',
            zIndex: 25, animation: 'app-fade-in 240ms ease both',
          }}></div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 560, background: t.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderTop: `1px solid ${t.rule}`,
            boxShadow: '0 -12px 32px rgba(0,0,0,0.25)',
            zIndex: 26, display: 'flex', flexDirection: 'column',
            animation: 'kiosk-rise 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            overflow: 'hidden',
          }}>
            {/* Handle bar + explicit Close X on the right */}
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
            <StandardDetail t={t} />
          </div>
        </>
      )}
    </MFrame>
  );
}

Object.assign(window, { AgentDashboardV2, AgentDashboardV2Mobile });
