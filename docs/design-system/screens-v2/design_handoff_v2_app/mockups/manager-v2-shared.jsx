// Manager Dashboard v2 — shared primitives + data.
//
// Carries the v2 grammar forward to the manager hub:
//   • AnchorStrip first — "your reality": branch YTD vs the goal cascade,
//     weekly pulse, and a live attention count, BEFORE any controls.
//   • Exception-first triage list is the lead content.
//   • Gold = recognition only · teal = primary · amber/warning = exceptions.
//   • Mono eyebrows + display numbers + sans body.
//   • Manager-perspective gold banner when acting on an agent's behalf.
//
// The agent Sidebar (app-shell.jsx) is agent-oriented, so the manager gets
// its own nav set + footer chip via ManagerSidebar / ManagerShell here.

// ──────────────────────────────────────────────────────────────────────────
// DATA — South Branch · Trevor Ramcharan (branch_manager) · Week 48
// ──────────────────────────────────────────────────────────────────────────
const MGR = {
  name: 'Trevor Ramcharan',
  initials: 'TR',
  role: 'Branch Manager',
  branch: 'South Branch',
  week: 'Week 48',
  date: 'Thu · 26 Nov',
};

// Branch YTD anchor + the goal cascade rolled up under the branch.
const ANCHOR = {
  ytdApi: 8_420_000,
  branchGoal: 12_000_000,
  smTarget: 11_000_000,
  companyFloor: 9_600_000,
  weeksLeft: 5,
  agents: 28,
  onPace: 18,
  needAttention: 5,
  weekApi: 142_000,
  weekApps: 38,
  weekFfi: 47,
};

// Unit-Manager persona — a "player-coach": runs S·02 AND still sells personally.
const UM_PERSONA = {
  name: 'Riaz Khan', initials: 'RK', role: 'Unit Manager',
  branch: 'S·02 Unit', week: 'Week 48', date: 'Thu · 26 Nov',
};

// Unit-level anchor — the UM's unit roll-up + their own personal selling.
const UNIT_ANCHOR = {
  ytdApi: 1_640_000,
  unitGoal: 2_200_000,
  companyFloor: 1_760_000,
  weeksLeft: 5,
  agents: 6,
  onPace: 4,
  needAttention: 2,
  weekApi: 31_000,
  weekApps: 9,
  weekFfi: 12,
  personalApi: 358_000,
  personalGoal: 420_000,
};

// Exception triage — the five types the manager chose to lead with.
// tone: 'danger' (below floor / critical) · 'warning' (everything else).
const EXCEPTIONS = [
  {
    id: 'devin',
    kind: 'Below floor', type: 'floor', tone: 'danger', icon: 'IconAlert',
    name: 'Devin Lewis', unit: 'S·02', initials: 'DL',
    detail: 'TTD 122k YTD · TTD 128k below tenure floor',
    meta: 'L1 · contracted Mar 2025 · floor TTD 250k',
    spark: [38, 30, 22, 26, 18, 14],
  },
  {
    id: 'avinash',
    kind: 'Off pace', type: 'pace', tone: 'warning', icon: 'IconTarget',
    name: 'Avinash Maharaj', unit: 'S·02', initials: 'AM',
    detail: '54% to commitment · 6 weeks to close TTD 96k',
    meta: 'Commitment TTD 420k · pacing TTD 227k',
    spark: [44, 40, 46, 38, 41, 36],
  },
  {
    id: 'hema',
    kind: 'Gone quiet', type: 'quiet', tone: 'warning', icon: 'IconClock',
    name: 'Hema Lakhan', unit: 'S·01', initials: 'HL',
    detail: 'No daily activity logged in 4 days',
    meta: 'Last log Sun 22 Nov · usually daily',
    spark: [22, 24, 20, 6, 0, 0],
  },
  {
    id: 'priya',
    kind: 'Persistency', type: 'persist', tone: 'warning', icon: 'IconRepeat',
    name: 'Priya Naidu', unit: 'S·01', initials: 'PN',
    detail: '72% · 8pp below the 80% threshold',
    meta: '3 lapses this quarter · 1 in grace',
    spark: [84, 82, 79, 77, 74, 72],
  },
  {
    id: 'jamal',
    kind: 'Report late', type: 'report', tone: 'warning', icon: 'IconWizard',
    name: 'Jamal Khan', unit: 'S·03', initials: 'JK',
    detail: 'Week 48 report not submitted · auto-nudged Sun 9 PM',
    meta: '3 missed this quarter · usually files Mon',
    spark: [1, 1, 0, 1, 0, 0],
  },
];

// Weekly champions — recognition (gold).
const CHAMPIONS = [
  { rank: 1, name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', api: 24_400 },
  { rank: 2, name: 'Anand Persad',    unit: 'S·01', initials: 'AP', api: 21_800 },
  { rank: 3, name: 'Selina Mohammed', unit: 'S·03', initials: 'SM', api: 19_200 },
];

// The manager's OWN week — a player-coach also sells. Personal production is
// tracked SEPARATELY and never rolled into unit/branch totals (repo rule).
// WAR = the manager's leadership activities (1:1s, JFW, recruiting, training…).
const MY_WEEK_BM = {
  who: 'Trevor', producing: true,
  apiWeek: 8_200, apiYtd: 142_000, apiGoal: 180_000,
  warDone: 5, warTotal: 6, submitted: true,
  war: [
    { l: '1:1 reviews', a: 4, t: 4 },
    { l: 'JFW', a: 3, t: 4 },
    { l: 'Recruits', a: 1, t: 1 },
    { l: 'Training', a: 1, t: 1 },
    { l: 'Unit mtg', bool: true },
    { l: 'Dash review', bool: true },
  ],
};
const MY_WEEK_UM = {
  who: 'Riaz', producing: true,
  apiWeek: 14_600, apiYtd: 358_000, apiGoal: 420_000,
  warDone: 4, warTotal: 6, submitted: false,
  war: [
    { l: '1:1 reviews', a: 3, t: 4 },
    { l: 'JFW', a: 5, t: 4 },
    { l: 'Recruits', a: 0, t: 1 },
    { l: 'Training', a: 1, t: 1 },
    { l: 'Unit mtg', bool: true },
    { l: 'Dash review', bool: false },
  ],
};

const ICONS = {
  IconAlert, IconTarget, IconClock, IconRepeat, IconWizard, IconCheck, IconMedal,
};

// ──────────────────────────────────────────────────────────────────────────
// MANAGER SIDEBAR — manager-oriented nav (the agent set doesn't fit)
// ──────────────────────────────────────────────────────────────────────────
function ManagerSidebar({ t, active = 'home', persona = MGR }) {
  const sections = [
    { title: null, items: [
      { key: 'home', Icon: IconHome,  label: 'Dashboard' },
      { key: 'team', Icon: IconUsers, label: 'Team' },
      { key: 'sheet',Icon: IconBook,  label: 'Master Sheet' },
    ]},
    { title: 'Operations', items: [
      { key: 'production',  Icon: IconChart,  label: 'Production' },
      { key: 'persistency', Icon: IconRepeat, label: 'Persistency' },
      { key: 'compliance',  Icon: IconShield, label: 'Compliance' },
      { key: 'war',         Icon: IconWizard, label: 'Weekly WARs', badge: '5' },
      { key: 'recruiting',  Icon: IconPlus,   label: 'Monthly Recruiting' },
    ]},
    { title: 'Settlements', items: [
      { key: 'settlements', Icon: IconWallet, label: 'Settlements' },
      { key: 'recon',       Icon: IconCheck,  label: 'Policy Reconciliation' },
    ]},
    { title: 'Planning', items: [
      { key: 'goals',     Icon: IconTarget, label: 'Goals' },
      { key: 'campaigns', Icon: IconBolt,   label: 'Campaigns' },
    ]},
    { title: 'Recognition', items: [
      { key: 'awards',      Icon: IconMedal,  label: 'Awards' },
      { key: 'leaderboard', Icon: IconTrophy, label: 'Leaderboard' },
    ]},
  ];
  return (
    <div style={{
      width: SIDEBAR_W, background: t.surface, borderRight: `1px solid ${t.rule}`,
      display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px', borderBottom: `1px solid ${t.rule}`, marginBottom: 12 }}>
        <AgencyLogo size={32} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em' }}>AgencyTrack</div>
          <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>Tatil Life · {persona.branch}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map((s, si) => (
          <div key={si} style={{ marginBottom: 14 }}>
            {s.title && (
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: t.inkFaint,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '10px 12px 6px', fontFamily: APP_FONT_MONO,
              }}>{s.title}</div>
            )}
            {s.items.map((it) => {
              const isActive = active === it.key;
              const isExc = it.badge;
              return (
                <div key={it.key} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 12px', borderRadius: 9,
                  background: isActive ? t.tealTint : 'transparent',
                  color: isActive ? t.teal : t.inkMute,
                  fontSize: 13, fontWeight: 600, position: 'relative',
                }}>
                  {isActive && (
                    <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: t.teal, borderRadius: 999 }}></div>
                  )}
                  <it.Icon size={17} color={isActive ? t.teal : t.inkMute} stroke={1.8} />
                  <div style={{ flex: 1 }}>{it.label}</div>
                  {it.badge && (
                    <div style={{
                      minWidth: 17, height: 17, padding: '0 5px', borderRadius: 999, fontSize: 9.5, fontWeight: 700,
                      background: t.warningTint, color: t.warning, border: `1px solid ${t.warning}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: APP_FONT_MONO,
                    }}>{it.badge}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Role switcher + Footer — manager chip */}
      <RoleSwitcher t={t} current="manager" />
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: t.tealTint, color: t.teal,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY,
        }}>{persona.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{persona.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{persona.role}</div>
        </div>
      </div>
    </div>
  );
}

// Manager page shell — ManagerSidebar + reused Topbar + content slot.
// teamView renders a 2px accent strip across the top — the cue that you're
// looking at aggregated team data, not your own (Perplexity §6b, UM).
function ManagerShell({ t, active, title, subtitle, children, persona = MGR, teamView = false }) {
  return (
    <div style={{
      width: APP_W, height: APP_H, background: t.bg, color: t.ink,
      fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <AmbientBg t={t} />
      {teamView && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, zIndex: 5 }}></div>
      )}
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex' }}>
        <ManagerSidebar t={t} active={active} persona={persona} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar t={t} title={title} subtitle={subtitle} modeMode={t.mode} />
          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 24px' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SCOPE SWITCH — unit → branch → SM roll-up. (Trevor is a BM, so Branch is
// live; Unit drills into one of his units, SM rolls his branch up.)
// ──────────────────────────────────────────────────────────────────────────
function ScopeSwitch({ t, active = 'branch', mode = 'roll' }) {
  const opts = mode === 'player'
    ? [{ key: 'personal', label: 'Personal' }, { key: 'unit', label: 'Unit' }]
    : [{ key: 'unit', label: 'Unit' }, { key: 'branch', label: 'Branch' }, { key: 'sm', label: 'Sales Mgr' }];
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
      {opts.map((o) => {
        const on = o.key === active;
        return (
          <div key={o.key} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            border: on ? `1px solid ${t.rule}` : '1px solid transparent',
          }}>{o.label}</div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MINI SPARKLINE — reused in exception rows (trajectory of the at-risk metric)
// ──────────────────────────────────────────────────────────────────────────
function MgrSpark({ color, values, width = 54, height = 20 }) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 3) + 1.5;
    const y = (height - 3) - ((v - min) / range) * (height - 4) + 1.5;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ANCHOR STRIP — "your reality" first. Weekly pulse up top, YTD in the anchor.
// ──────────────────────────────────────────────────────────────────────────
function AnchorStrip({ t, variant = 'branch' }) {
  const unit = variant === 'unit';
  const D = unit ? UNIT_ANCHOR : ANCHOR;
  const goal = unit ? D.unitGoal : D.branchGoal;
  const pct = Math.round((D.ytdApi / goal) * 100);
  const floorPct = (D.companyFloor / goal) * 100;
  const smPct = unit ? null : (D.smTarget / goal) * 100;
  const eyebrow = unit ? 'S·02 UNIT · YTD SETTLED API' : `${MGR.branch.toUpperCase()} · YTD SETTLED API`;
  const goalLabel = unit ? 'unit goal' : 'branch goal';
  const personalPct = unit ? Math.round((D.personalApi / D.personalGoal) * 100) : 0;
  return (
    <div className="a-card a-rise" style={{
      flexShrink: 0, position: 'relative', overflow: 'hidden',
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16,
      display: 'flex', alignItems: 'stretch',
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -90, right: 280, width: 360, height: 360,
        background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none',
      }}></div>

      {/* Left — YTD anchor + cascade */}
      <div style={{ flex: 1, minWidth: 0, padding: '18px 22px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', color: t.teal, fontFamily: APP_FONT_MONO }}>{eyebrow}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{D.weeksLeft} WEEKS LEFT</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 6 }}>
          <div style={{ fontSize: 46, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', lineHeight: 0.95, fontFamily: APP_FONT_DISPLAY }}>{ttd(D.ytdApi)}</div>
          <div style={{ fontSize: 13, color: t.inkMute, paddingBottom: 4 }}>
            {pct}% of {ttd(goal)} {goalLabel}
            <span style={{ color: t.success, fontWeight: 600, marginLeft: 8 }}>+22% vs LY</span>
          </div>
        </div>

        {/* Cascade progress bar with floor (+ SM for branch) markers */}
        <div style={{ marginTop: 16, maxWidth: 540 }}>
          <div style={{ position: 'relative', height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'visible' }}>
            <div className="a-progress-grow" style={{ width: `${pct}%`, height: 8, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
            <div style={{ position: 'absolute', top: -3, left: `${floorPct}%`, width: 2, height: 14, background: t.warning, borderRadius: 999 }}></div>
            {smPct !== null && <div style={{ position: 'absolute', top: -3, left: `${smPct}%`, width: 2, height: 14, background: t.inkFaint, borderRadius: 999 }}></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
            <span>TTD 0</span>
            <span style={{ color: t.warning }}>FLOOR · {ttd(D.companyFloor)}</span>
            {!unit && <span>SM · {ttd(D.smTarget)}</span>}
            <span>GOAL · {ttd(goal)}</span>
          </div>
        </div>

        {/* Player-coach: the UM's own selling sits alongside the unit roll-up */}
        {unit && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 14, padding: '8px 12px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: t.teal, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>YOUR SELLING</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{ttd(D.personalApi)}</span>
            <span style={{ fontSize: 11, color: t.inkMute }}>· {personalPct}% of your {ttd(D.personalGoal)} · not in unit totals</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: t.rule, margin: '18px 0' }}></div>

      {/* Right — weekly pulse + attention count + scope */}
      <div style={{ width: 312, flexShrink: 0, padding: '18px 22px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>THIS WEEK · {MGR.week.toUpperCase()}</div>
          {unit ? <ScopeSwitch t={t} mode="player" active="unit" /> : <ScopeSwitch t={t} active="branch" />}
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
          {[
            { k: 'API', v: ttd(D.weekApi) },
            { k: 'APPS', v: D.weekApps },
            { k: 'FFI', v: D.weekFfi },
          ].map((m) => (
            <div key={m.k}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* On-pace + attention */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 9 }}>
          <div style={{ flex: 1, padding: '10px 12px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.success, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{D.onPace}<span style={{ fontSize: 12, color: t.inkMute, fontWeight: 600 }}> / {D.agents}</span></div>
            <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>on pace this week</div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="a-breathe" style={{ width: 28, height: 28, borderRadius: '50%', background: t.surface, border: `1px solid ${t.warning}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconAlert size={14} color={t.warning} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{D.needAttention}</div>
              <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2 }}>need attention</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// EXCEPTION ROW + LIST — the lead content. Exception-first triage.
// ──────────────────────────────────────────────────────────────────────────
function ExceptionRow({ t, e, onDrill }) {
  const fg = e.tone === 'danger' ? t.danger : t.warning;
  const bg = e.tone === 'danger' ? t.dangerTint : t.warningTint;
  const Ico = ICONS[e.icon] || IconAlert;
  return (
    <div onClick={onDrill} className="a-card" style={{
      display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px',
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, cursor: 'pointer',
    }}>
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', background: t.tealTint, color: t.teal,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY,
      }}>{e.initials}</div>

      {/* Name + detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{e.name}</div>
          <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{e.unit}</div>
        </div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.detail}</div>
      </div>

      {/* Trajectory */}
      <div style={{ flexShrink: 0 }}><MgrSpark color={fg} values={e.spark} /></div>

      {/* Exception tag */}
      <div style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 999, background: bg, border: `1px solid ${fg}33`,
      }}>
        <Ico size={12} color={fg} stroke={2} />
        <span style={{ fontSize: 9.5, fontWeight: 700, color: fg, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{e.kind}</span>
      </div>

      <IconChevR size={15} color={t.inkFaint} stroke={2.4} />
    </div>
  );
}

function ExceptionList({ t, onDrill, items = EXCEPTIONS }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <Eyebrow t={t} color={t.warning}>★ Needs attention · {items.length}</Eyebrow>
        <div style={{ fontSize: 11, color: t.inkMute }}>Resolves when the underlying state clears</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((e) => (
          <ExceptionRow key={e.id} t={t} e={e} onDrill={() => onDrill && onDrill(e)} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// KPI STRIP — compact scorecards (no circular gauges)
// ──────────────────────────────────────────────────────────────────────────
function KpiStrip({ t }) {
  return (
    <div style={{ display: 'flex', gap: 11, flexShrink: 0 }}>
      <Scorecard t={t} eyebrow="WEEKLY API"   value={ttd(ANCHOR.weekApi)} sub="+14% vs last wk"  accent={t.teal} />
      <Scorecard t={t} eyebrow="APPLICATIONS" value={ANCHOR.weekApps}     sub="this week"        accent={t.gold} />
      <Scorecard t={t} eyebrow="ACTIVE AGENTS"value={ANCHOR.agents}       sub="6 on MDRT pace"   accent={t.teal} />
      <Scorecard t={t} eyebrow="PERSISTENCY"  value="89%"                 sub="4pp above floor"  accent={t.success} />
      <Scorecard t={t} eyebrow="COMPLIANCE"   value="92%"                 sub="26 of 28 filed"   accent={t.success} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// RECOGNITION — gold. Weekly champions + team medals tally.
// ──────────────────────────────────────────────────────────────────────────
function ChampionsPanel({ t }) {
  return (
    <div style={{
      flexShrink: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14,
      padding: '16px 18px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <Eyebrow t={t} color={t.gold}>★ This week's champions</Eyebrow>
        <div style={{ fontSize: 11, color: t.teal, fontWeight: 700 }}>Awards →</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {CHAMPIONS.map((c) => (
          <div key={c.rank} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 4px' }}>
            <div style={{ width: 20, textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{c.rank}</div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.goldTint, color: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY }}>{c.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{c.name}</div>
              <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{c.unit}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{ttd(c.api)}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: t.goldTint, color: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconMedal size={16} color={t.gold} />
        </div>
        <div style={{ flex: 1, fontSize: 11.5, color: t.inkMute, lineHeight: 1.4 }}>
          <span style={{ color: t.ink, fontWeight: 700 }}>14 badges</span> earned across the team this quarter
        </div>
      </div>
    </div>
  );
}

// The manager's own week — personal production (kept separate from unit
// totals) + their WAR/leadership accountability. Player-coach made explicit.
function MyWeekPanel({ t, me }) {
  const apiPct = Math.round((me.apiYtd / me.apiGoal) * 100);
  return (
    <div style={{ flexShrink: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '15px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }}>
        <Eyebrow t={t}>My week</Eyebrow>
        <div style={{ fontSize: 11, fontWeight: 700, color: me.submitted ? t.success : t.teal }}>{me.submitted ? '✓ WAR filed' : 'File my WAR →'}</div>
      </div>

      {/* Personal production — separate from unit totals */}
      {me.producing && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>MY API · THIS WEEK</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{ttd(me.apiWeek)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO, marginBottom: 4 }}>
              <span>{ttd(me.apiYtd)} YTD</span><span>{apiPct}% of {ttd(me.apiGoal)}</span>
            </div>
            <div style={{ height: 5, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
              <div className="a-progress-grow" style={{ width: `${apiPct}%`, height: 5, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
            </div>
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: t.inkFaint, fontStyle: 'italic', marginBottom: 12 }}>Your selling is tracked separately — never counted in unit totals.</div>

      {/* Manager WAR — leadership activities done vs expected */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>MY WAR · LEADERSHIP</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: me.warDone >= me.warTotal ? t.success : t.warning, fontFamily: APP_FONT_MONO }}>{me.warDone} / {me.warTotal} done</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {me.war.map((w) => {
          const met = w.bool !== undefined ? w.bool : w.a >= w.t;
          return (
            <span key={w.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, background: met ? t.successTint : t.warningTint, color: met ? t.success : t.warning, border: `1px solid ${met ? t.success : t.warning}33` }}>
              {met ? '✓' : '·'} {w.l}{w.bool === undefined ? ` ${w.a}/${w.t}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Recent activity — quieter context below recognition.
function RecentFeed({ t }) {
  const items = [
    { color: t.success,   Icon: IconCheck,  text: '5 weekly reports submitted', sub: 'Mon · S·02 unit complete' },
    { color: t.gold,      Icon: IconMedal,  text: 'Marsha Singh hit MDRT pace', sub: 'TTD 487k YTD' },
    { color: t.warning,   Icon: IconAlert,  text: 'Devin Lewis late on Sun report', sub: 'Auto-nudged Sun 9 PM' },
  ];
  return (
    <div style={{
      flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14,
      padding: '16px 18px', display: 'flex', flexDirection: 'column',
    }}>
      <Eyebrow t={t}>Recent</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {items.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${a.color}22`, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MANAGER-PERSPECTIVE GOLD BANNER — ownership clarity when acting on an
// agent's behalf ("a suggestion, not their commitment").
// ──────────────────────────────────────────────────────────────────────────
function GoldBanner({ t, title, body }) {
  return (
    <div style={{
      display: 'flex', gap: 11, alignItems: 'flex-start',
      padding: '11px 14px', background: t.goldTint, border: `1px solid ${t.gold}44`, borderRadius: 11,
    }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: t.surface, border: `1px solid ${t.gold}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconShield size={13} color={t.gold} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>{title}</div>
        <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2, lineHeight: 1.45 }}>{body}</div>
      </div>
    </div>
  );
}

// Manager mobile bottom nav — manager-oriented (agent MNav doesn't fit).
function ManagerMNav({ t, active = 'home' }) {
  const tabs = [
    { key: 'home',  label: 'Dashboard', Icon: IconHome },
    { key: 'team',  label: 'Team',      Icon: IconUsers },
    { key: 'sheet', label: 'Sheet',     Icon: IconBook },
    { key: 'awards',label: 'Awards',    Icon: IconMedal },
    { key: 'more',  label: 'More',      Icon: IconGrid },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 28,
      background: t.surface, borderTop: `1px solid ${t.rule}`,
      boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)', zIndex: 15,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '10px 8px 8px' }}>
        {tabs.map((tab) => {
          const on = active === tab.key;
          return (
            <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tab.Icon size={22} color={on ? t.teal : t.inkFaint} stroke={2} />
                {on && <div style={{ position: 'absolute', inset: -7, background: t.tealTint, borderRadius: 999, zIndex: -1, width: 36, height: 36, top: -7, left: '50%', transform: 'translateX(-50%)' }}></div>}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? t.teal : t.inkMute }}>{tab.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  MGR, ANCHOR, UM_PERSONA, UNIT_ANCHOR, EXCEPTIONS, CHAMPIONS, ICONS,
  MY_WEEK_BM, MY_WEEK_UM,
  ManagerSidebar, ManagerShell, ScopeSwitch, MgrSpark,
  AnchorStrip, ExceptionRow, ExceptionList, KpiStrip,
  ChampionsPanel, MyWeekPanel, RecentFeed, GoldBanner, ManagerMNav,
});
