// Planner & Scheduler — MANAGER tier: shared data + primitives.
// The coaching / visibility surfaces a Unit/Branch Manager uses. SAME product,
// SAME design system as the agent side — reuses app-tokens, app-motion,
// app-shell, app-mobile, and planner-shared (actStyle, ActChip, STATUS,
// CounterBar, DayStripCell). Loads after those.
//
// ⛔ TRUST CONSTRAINTS baked into these primitives:
//  1. Stalled-pipeline ratio is AGGREGATE ONLY — never a named drill-down.
//  2. Ratio / individual data is private manager↔agent — never public/kiosk.
//  3. A named prospect appears ONLY via an agent's explicit escalation (opt-in).
//  4. Tone is coaching ("help this agent win"), never surveillance.

// ──────────────────────────────────────────────────────────────────────────
// Tiny inline sparkline (data viz — simple polyline + endpoint dot)
// ──────────────────────────────────────────────────────────────────────────
function Spark({ t, data, w = 60, h = 20, color, fill = true }) {
  const max = Math.max(...data), min = Math.min(...data), rng = (max - min) || 1;
  const x = (i) => (i / (data.length - 1)) * w;
  const y = (v) => h - 2 - ((v - min) / rng) * (h - 4);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const c = color || t.teal;
  const lastX = x(data.length - 1), lastY = y(data[data.length - 1]);
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`${c}1f`} stroke="none" />}
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.4" fill={c} />
    </svg>
  );
}

// Trend caret — unicode, tone-aware. For stalled ratio: down = good (green).
function Trend({ t, dir, good, size = 11 }) {
  const color = good ? t.success : dir === 'flat' ? t.inkFaint : t.danger;
  const glyph = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▬';
  return <span style={{ fontSize: size - 1, color, fontWeight: 700, lineHeight: 1 }}>{glyph}</span>;
}

// Initials avatar
function Ava({ t, name, size = 34, bg, fg }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg || t.tealTint, color: fg || t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.36, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>
      {name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// StalledRatio — AGGREGATE ONLY. Always carries a privacy marker so it can
// never be mistaken for a drillable list. (Constraint #1 + #2.)
// ──────────────────────────────────────────────────────────────────────────
function StalledRatio({ t, pct, trend, big, showLabel = true }) {
  const good = trend === 'down';
  const tone = pct >= 32 ? t.warning : pct >= 25 ? t.gold : t.inkMute;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: big ? 8 : 6 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: big ? '6px 11px' : '3px 9px', borderRadius: 999, background: t.surfaceSoft, border: `1px solid ${t.rule}` }}>
        <IconShield size={big ? 14 : 11} color={t.inkFaint} stroke={2} />
        <span style={{ fontSize: big ? 17 : 12.5, fontWeight: 700, color: tone, fontFamily: APP_FONT_DISPLAY }}>{pct}%</span>
        <Trend t={t} dir={trend} good={good} size={big ? 12 : 10} />
      </div>
      {showLabel && <span style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>AGG · PRIVATE</span>}
    </div>
  );
}

// Kept-rate mini (rate + sparkline)
function KeptRate({ t, pct, spark }) {
  const color = pct >= 85 ? t.success : pct >= 78 ? t.ink : t.warning;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: APP_FONT_DISPLAY, minWidth: 34 }}>{pct}%</div>
      <Spark t={t} data={spark} color={color} w={52} h={18} />
    </div>
  );
}

// Soft-week coaching flag — opportunity framing, not a failure flag (#4).
function SoftWeek({ t, reason }) {
  if (!reason) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 8, background: t.tealTint, border: `1px solid ${t.teal}2e` }}>
      <IconBolt size={12} color={t.teal} stroke={2.2} />
      <span style={{ fontSize: 11, fontWeight: 600, color: t.teal }}>{reason}</span>
    </div>
  );
}

// Escalation "ask" pill — what help the agent requested.
const ASK = {
  advice:    { label: 'Wants advice',    Icon: IconBolt,   tone: 'accent' },
  'joint-ci':{ label: 'Joint CI',        Icon: IconUsers,  tone: 'teal' },
  'take-call':{ label: 'You take the call', Icon: IconShield, tone: 'gold' },
};
function AskPill({ t, ask }) {
  const a = ASK[ask] || ASK.advice;
  const c = a.tone === 'gold' ? { fg: t.gold, bg: t.goldTint } : a.tone === 'accent' ? { fg: t.inkAccent, bg: t.inkAccentTint } : { fg: t.teal, bg: t.tealTint };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.fg, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap', flexShrink: 0 }}>
      <a.Icon size={12} color={c.fg} stroke={2.2} />{a.label}
    </span>
  );
}

// Win chip — something to celebrate in the 1-on-1 (#4 coaching tone).
function WinChip({ t, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: t.successTint, border: `1px solid ${t.success}26`, borderRadius: 10 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconTrophy size={12} color={t.success} stroke={2} /></div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.ink, lineHeight: 1.35 }}>{children}</div>
    </div>
  );
}

// Booked-vs-minimum micro readout (uses the agent activity codes).
function BookedVsMin({ t, booked, min, compact }) {
  const order = ['CI', 'FFI', 'AI', 'SC'];
  return (
    <div style={{ display: 'flex', gap: compact ? 8 : 12 }}>
      {order.map((code) => {
        const b = booked[code], m = min[code], short = b < m;
        return (
          <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
            <ActChip t={t} type={code} size="s" />
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO, color: short ? t.warning : t.success }}>
              {b}<span style={{ color: t.inkFaint, fontWeight: 600 }}>/{m}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Manager bottom nav — Team · Coaching · [Schedule FAB] · Escalations · More
// ──────────────────────────────────────────────────────────────────────────
function ManagerNav({ t, active = 'team', badge = 3 }) {
  const tabs = [
    { key: 'team', label: 'Team', Icon: IconUsers },
    { key: 'coaching', label: 'Coaching', Icon: IconTarget },
    { key: 'schedule', label: 'Schedule', Icon: IconPlus, fab: true },
    { key: 'escal', label: 'Escalations', Icon: IconArrowR, badge },
    { key: 'more', label: 'More', Icon: IconGrid },
  ];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 24, background: t.surface, borderTop: `1px solid ${t.rule}`, boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)', zIndex: 15 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 8px 10px' }}>
        {tabs.map((tab) => {
          const on = active === tab.key;
          if (tab.fab) {
            return (
              <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 54 }}>
                <div className="a-fab-pulse" style={{ width: 58, height: 58, borderRadius: '50%', background: `linear-gradient(180deg, ${t.tealLight} 0%, ${t.teal} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginTop: -30, '--fab-glow-1': `${t.teal}66`, '--fab-glow-2': `${t.teal}55`, boxShadow: `0 6px 16px ${t.teal}66, 0 2px 4px rgba(40,37,29,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`, border: `3px solid ${t.surface}` }}>
                  <tab.Icon size={25} color="#fff" stroke={2.5} />
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, marginTop: 1 }}>{tab.label}</div>
              </div>
            );
          }
          return (
            <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 54 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tab.Icon size={21} color={on ? t.teal : t.inkFaint} stroke={2} />
                {on && <div style={{ position: 'absolute', inset: -7, background: t.tealTint, borderRadius: 999, zIndex: -1, width: 34, height: 34, top: -6.5, left: '50%', transform: 'translateX(-50%)' }} />}
                {tab.badge > 0 && <div style={{ position: 'absolute', top: -4, right: -8, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, background: t.danger, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${t.surface}`, fontFamily: APP_FONT_MONO }}>{tab.badge}</div>}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: on ? 700 : 600, color: on ? t.teal : t.inkMute }}>{tab.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DATA — Unit Manager Devon Ramlal coaches a 6-agent unit (incl. Marsha Singh
// from the agent mockups). Same names / activity types / TTD across surfaces.
// ──────────────────────────────────────────────────────────────────────────
const MGR = { name: 'Devon Ramlal', role: 'Unit Manager', unit: 'S·02', branch: 'South' };

const TEAM = [
  { name: 'Marsha Singh',    unit: 'S·02', level: 'L4', booked: { CI: 6, FFI: 9, AI: 4, SC: 7 }, min: { CI: 10, FFI: 8, AI: 6, SC: 6 }, kept: 88, keptSpark: [80, 82, 79, 85, 88], stalled: 18, stalledTrend: 'down', soft: null, escal: 1,
    wins: ['Closed Whole Life · TTD 18.4K today', '9 F.F.I booked next week'] },
  { name: 'Anand Persad',    unit: 'S·01', level: 'L4', booked: { CI: 9, FFI: 7, AI: 5, SC: 6 }, min: { CI: 10, FFI: 8, AI: 6, SC: 6 }, kept: 91, keptSpark: [86, 88, 90, 89, 91], stalled: 14, stalledTrend: 'down', soft: null, escal: 0,
    wins: ['Highest kept-rate in the unit'] },
  { name: 'Selina Mohammed', unit: 'S·03', level: 'L3', booked: { CI: 7, FFI: 8, AI: 4, SC: 5 }, min: { CI: 10, FFI: 8, AI: 6, SC: 6 }, kept: 84, keptSpark: [82, 80, 83, 85, 84], stalled: 22, stalledTrend: 'flat', soft: null, escal: 0,
    wins: ['Back above floor 2 weeks running'] },
  { name: 'Riaz Khan',       unit: 'S·02', level: 'L3', booked: { CI: 2, FFI: 5, AI: 3, SC: 4 }, min: { CI: 10, FFI: 8, AI: 6, SC: 6 }, kept: 76, keptSpark: [82, 80, 78, 77, 76], stalled: 34, stalledTrend: 'up', soft: 'Zero C.I booked Thu–Fri', escal: 1, wins: [] },
  { name: 'Priya Naidu',     unit: 'S·03', level: 'L2', booked: { CI: 5, FFI: 6, AI: 5, SC: 6 }, min: { CI: 10, FFI: 8, AI: 6, SC: 6 }, kept: 79, keptSpark: [84, 82, 81, 80, 79], stalled: 29, stalledTrend: 'up', soft: 'Kept-rate easing 3 weeks', escal: 1, wins: [] },
  { name: 'Jamal Khan',      unit: 'S·03', level: 'L1', booked: { CI: 3, FFI: 4, AI: 2, SC: 3 }, min: { CI: 10, FFI: 8, AI: 6, SC: 6 }, kept: 72, keptSpark: [78, 76, 74, 73, 72], stalled: 38, stalledTrend: 'up', soft: 'Light week — 12 open slots', escal: 0, wins: [] },
];

// Escalations — agent-initiated, opt-in, reversible. Named prospects allowed
// HERE ONLY because the agent chose to escalate (constraint #3).
const ESCALATIONS = [
  { agent: 'Riaz Khan',   unit: 'S·02', prospect: 'Curtis Mohammed', ask: 'joint-ci',  product: 'Annuity · TTD 240K', pushes: 3, objection: 'Premium feels high — wants to think', since: '2 weeks', priority: 'high' },
  { agent: 'Priya Naidu', unit: 'S·03', prospect: 'Dexter Charles',  ask: 'advice',    product: 'Pension transfer',   pushes: 2, objection: 'Needs spouse to agree first', since: '9 days', priority: 'med' },
  { agent: 'Marsha Singh',unit: 'S·02', prospect: 'Reshma Ali',      ask: 'take-call', product: 'Annuity top-up',     pushes: 4, objection: 'Cancelled twice — gone cold', since: '3 weeks', priority: 'high' },
];

// Manager's own week — agents' escalated joint calls slotted in.
const MGR_DAY_STRIP = [
  { dow: 'MON', date: '22', count: 2 }, { dow: 'TUE', date: '23', count: 3, today: true },
  { dow: 'WED', date: '24', count: 4 }, { dow: 'THU', date: '25', count: 3 },
  { dow: 'FRI', date: '26', count: 2 }, { dow: 'SAT', date: '27', count: 0 },
  { dow: 'SUN', date: '28', count: 0 }, { dow: 'MON', date: '29', count: 2 },
];
const JOINT_CALLS = [
  { day: 'Wed · Jun 24', time: '2:00 PM', agent: 'Riaz Khan', prospect: 'Curtis Mohammed', type: 'CI', kind: 'Joint CI' },
  { day: 'Thu · Jun 25', time: '10:00 AM', agent: 'Marsha Singh', prospect: 'Reshma Ali', type: 'CI', kind: 'You take the call' },
  { day: 'Fri · Jun 26', time: '11:00 AM', agent: 'Priya Naidu', prospect: 'Dexter Charles', type: 'AI', kind: 'Sit-in' },
];

// Team capacity next week (booked load → heavy / balanced / light).
const CAPACITY = TEAM.map((a) => {
  const total = a.booked.CI + a.booked.FFI + a.booked.AI + a.booked.SC;
  return { name: a.name, unit: a.unit, total, band: total >= 24 ? 'heavy' : total >= 16 ? 'balanced' : 'light' };
});

// Branch events (BM) — push onto agents' agendas across the ~2-month horizon.
const BRANCH_EVENTS = [
  { title: 'Critical Illness product refresher', type: 'Training', date: 'Wed · 1 Jul', time: '4:00 PM', reach: 'All 28 agents', state: 'scheduled' },
  { title: 'Tatil Q3 kickoff seminar', type: 'Company seminar', date: 'Mon · 6 Jul', time: '9:00 AM', reach: 'South branch', state: 'scheduled' },
  { title: 'Couva Home Expo — Tatil booth', type: 'Tradeshow', date: 'Sat · 18 Jul', time: 'All day', reach: '4 agents signed up', state: 'draft' },
];

// Branch booking health (BM) — unit comparison, PRIVATE management view only.
const UNITS = [
  { code: 'S·01', mgr: 'A. Persad', bookedApi: 'TTD 1.9M', fill: 78, agents: 9, soft: 1 },
  { code: 'S·02', mgr: 'D. Ramlal', bookedApi: 'TTD 2.2M', fill: 71, agents: 10, soft: 2, you: true },
  { code: 'S·03', mgr: 'K. Boodoo', bookedApi: 'TTD 1.4M', fill: 58, agents: 9, soft: 3 },
];

Object.assign(window, {
  Spark, Trend, Ava, StalledRatio, KeptRate, SoftWeek, ASK, AskPill, WinChip, BookedVsMin, ManagerNav,
  MGR, TEAM, ESCALATIONS, MGR_DAY_STRIP, JOINT_CALLS, CAPACITY, BRANCH_EVENTS, UNITS,
});
