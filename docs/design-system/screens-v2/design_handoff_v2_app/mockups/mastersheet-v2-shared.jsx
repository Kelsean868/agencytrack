// Master Sheet v2 — the team roster table the dashboard drills into.
//
// v2 grammar carried forward:
//   • A compact "reality bar" leads (anchor-first) — week + scope + the
//     team's settled-API / on-pace / exceptions state, BEFORE table controls.
//   • Exception-first: a "Show only exceptions" toggle + coloured status
//     pills; flagged agents match the dashboard's triage exactly.
//   • Sticky Agent·Unit + Status columns, right-aligned numerics, zebra rows,
//     mini API bars. Clicking a row reuses the 5-tab coaching drawer.
//   • Column presets (All / Production / Recruiting / Compliance / Persistency).
//
// Reuses manager-v2-shared (ManagerShell, ScopeSwitch) + manager-v2-drill
// (AgentDrill) + app-tokens/shell/motion.

// ──────────────────────────────────────────────────────────────────────────
// ROSTER — 14 agents. flag aligns with the dashboard's 5 exceptions so the
// two surfaces tell one story. logged = logged daily activity; report =
// weekly-report state.
// ──────────────────────────────────────────────────────────────────────────
const ROSTER = [
  { name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', weeks: 47, ytdApi: 487_000, weekApi: 24_400, apps: 41, ffi: 6, ci: 4, conv: 79, pers: 88, level: 'L4', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Anand Persad',    unit: 'S·01', initials: 'AP', weeks: 46, ytdApi: 442_000, weekApi: 21_800, apps: 36, ffi: 5, ci: 4, conv: 81, pers: 91, level: 'L4', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Selina Mohammed', unit: 'S·03', initials: 'SM', weeks: 45, ytdApi: 396_000, weekApi: 19_200, apps: 38, ffi: 5, ci: 3, conv: 71, pers: 87, level: 'L3', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Riaz Khan',       unit: 'S·02', initials: 'RK', weeks: 47, ytdApi: 358_000, weekApi: 17_600, apps: 30, ffi: 4, ci: 3, conv: 76, pers: 90, level: 'L3', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Kamla Singh',     unit: 'S·01', initials: 'KS', weeks: 44, ytdApi: 312_000, weekApi: 14_900, apps: 27, ffi: 4, ci: 2, conv: 68, pers: 86, level: 'L3', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Trevor Ramnauth', unit: 'S·03', initials: 'TR', weeks: 43, ytdApi: 287_000, weekApi: 13_200, apps: 24, ffi: 3, ci: 2, conv: 73, pers: 89, level: 'L3', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Carla Joseph',    unit: 'S·02', initials: 'CJ', weeks: 42, ytdApi: 268_000, weekApi: 12_600, apps: 23, ffi: 3, ci: 2, conv: 70, pers: 85, level: 'L2', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Avinash Maharaj', unit: 'S·02', initials: 'AM', weeks: 40, ytdApi: 227_000, weekApi: 9_400,  apps: 22, ffi: 2, ci: 1, conv: 65, pers: 84, level: 'L2', flag: 'pace',       logged: true,  report: 'submitted' },
  { name: 'Hema Lakhan',     unit: 'S·01', initials: 'HL', weeks: 41, ytdApi: 231_000, weekApi: 4_100,  apps: 21, ffi: 1, ci: 1, conv: 72, pers: 88, level: 'L2', flag: 'quiet',      logged: false, report: 'submitted' },
  { name: 'Jamal Khan',      unit: 'S·03', initials: 'JK', weeks: 38, ytdApi: 198_000, weekApi: 7_200,  apps: 18, ffi: 2, ci: 1, conv: 58, pers: 82, level: 'L2', flag: 'report',     logged: true,  report: 'missing' },
  { name: 'Priya Naidu',     unit: 'S·01', initials: 'PN', weeks: 39, ytdApi: 156_000, weekApi: 6_800,  apps: 15, ffi: 2, ci: 1, conv: 60, pers: 72, level: 'L1', flag: 'persistency',logged: true,  report: 'submitted' },
  { name: 'Devin Lewis',     unit: 'S·02', initials: 'DL', weeks: 34, ytdApi: 122_000, weekApi: 3_400,  apps: 12, ffi: 2, ci: 1, conv: 62, pers: 76, level: 'L1', flag: 'floor',      logged: false, report: 'draft' },
  { name: 'Nisha Ramdeen',   unit: 'S·03', initials: 'NR', weeks: 31, ytdApi: 98_000,  weekApi: 5_600,  apps: 10, ffi: 2, ci: 1, conv: 64, pers: 83, level: 'L1', flag: null,          logged: true,  report: 'submitted' },
  { name: 'Omar Ali',        unit: 'S·01', initials: 'OA', weeks: 12, ytdApi: 54_000,  weekApi: 4_200,  apps: 7,  ffi: 1, ci: 1, conv: 61, pers: 80, level: 'L1', flag: null,          logged: true,  report: 'submitted' },
];

// Status pill config per flag.
function flagPill(t, flag) {
  switch (flag) {
    case 'floor':       return { label: 'Below floor', fg: t.danger,  bg: t.dangerTint };
    case 'pace':        return { label: 'Off pace',    fg: t.warning, bg: t.warningTint };
    case 'quiet':       return { label: 'Gone quiet',  fg: t.warning, bg: t.warningTint };
    case 'report':      return { label: 'Report late', fg: t.warning, bg: t.warningTint };
    case 'persistency': return { label: 'Pers. ↓',     fg: t.warning, bg: t.warningTint };
    default:            return { label: 'On track',    fg: t.success, bg: t.successTint };
  }
}

const EXC_COUNT = ROSTER.filter((a) => a.flag).length;
const TEAM_YTD = ROSTER.reduce((s, a) => s + a.ytdApi, 0);
const TEAM_WEEK = ROSTER.reduce((s, a) => s + a.weekApi, 0);
const MAX_YTD = Math.max(...ROSTER.map((a) => a.ytdApi));

// Period switch — Day · Week · Month · Quarter · YTD (re-aggregates the matrix).
function PeriodSwitch({ t, active = 'week' }) {
  const opts = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter'], ['ytd', 'YTD']];
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
      {opts.map(([k, l]) => {
        const on = k === active;
        return (
          <div key={k} style={{
            padding: '6px 11px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            border: on ? `1px solid ${t.rule}` : '1px solid transparent',
          }}>{l}</div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// REALITY BAR — compact anchor for a table surface. Week + scope + team state.
// When `period` is set (the detailed matrix), the week pill becomes a period
// switch and the trailing progress bar is dropped to make room.
// ──────────────────────────────────────────────────────────────────────────
function MasterReality({ t, period = null }) {
  const onPace = ROSTER.length - EXC_COUNT;
  return (
    <div className="a-rise" style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, padding: '12px 16px',
    }}>
      {period ? (
        <PeriodSwitch t={t} active={period} />
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: t.ink, flexShrink: 0 }}>
          <IconClock size={14} color={t.inkMute} /> Week 48 · 24 Nov
          <IconChevD size={12} color={t.inkMute} stroke={2.4} />
        </div>
      )}
      <ScopeSwitch t={t} active="branch" />

      <div style={{ width: 1, height: 30, background: t.rule }}></div>

      {/* Inline team stats */}
      <div style={{ display: 'flex', gap: 22, flex: 1, minWidth: 0 }}>
        {[
          { k: 'YTD SETTLED API', v: ttd(TEAM_YTD), c: t.ink },
          { k: 'THIS WEEK', v: ttd(TEAM_WEEK), c: t.ink },
          { k: 'ON PACE', v: `${onPace} / ${ROSTER.length}`, c: t.success },
          { k: 'EXCEPTIONS', v: EXC_COUNT, c: t.warning },
        ].map((m) => (
          <div key={m.k}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ACTION BAR — column presets + exceptions toggle + search/filter/export
// ──────────────────────────────────────────────────────────────────────────
function MasterActionBar({ t, exceptionsOn = false, preset = 'production' }) {
  const presets = ['All', 'Production', 'Recruiting', 'Compliance', 'Persistency'];
  const activeIdx = preset === 'all' ? 0 : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
        {presets.map((p, i) => (
          <div key={p} style={{
            padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
            background: i === activeIdx ? t.surface : 'transparent', color: i === activeIdx ? t.ink : t.inkMute,
            boxShadow: i === activeIdx ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
            border: i === activeIdx ? `1px solid ${t.rule}` : '1px solid transparent',
          }}>{p}</div>
        ))}
      </div>

      <div style={{ flex: 1 }}></div>

      {/* Exceptions toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px',
        background: exceptionsOn ? t.warningTint : t.surface,
        border: `1px solid ${exceptionsOn ? t.warning + '44' : t.rule}`, borderRadius: 9,
      }}>
        <div style={{ width: 28, height: 16, background: exceptionsOn ? t.warning : t.inkDim, borderRadius: 999, position: 'relative', transition: 'background 160ms' }}>
          <div style={{ position: 'absolute', top: 2, [exceptionsOn ? 'right' : 'left']: 2, width: 12, height: 12, borderRadius: '50%', background: t.surface }}></div>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: exceptionsOn ? t.warning : t.inkMute, letterSpacing: '0.04em' }}>Only exceptions</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: exceptionsOn ? t.warning : t.inkFaint, fontFamily: APP_FONT_MONO }}>{EXC_COUNT}</div>
      </div>

      <div style={{ padding: '7px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, color: t.inkMute, fontSize: 12.5, fontWeight: 600 }}>
        <IconSearch size={13} color={t.inkMute} /> Search agent…
      </div>
      <div style={{ padding: '7px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, color: t.inkMute, fontSize: 12.5, fontWeight: 600 }}>
        <IconDownload size={13} color={t.inkMute} /> Export CSV
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TABLE — Production preset. Sticky-feel Agent + Status, mini API bars.
// ──────────────────────────────────────────────────────────────────────────
const MS_GRID = '34px 1.7fr 60px 1.15fr 56px 64px 60px 48px 104px';

function MasterHeader({ t }) {
  const cell = { padding: '10px 12px', fontSize: 9.5, fontWeight: 700, color: t.inkMute, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, textAlign: 'right' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: MS_GRID, borderBottom: `1px solid ${t.ruleStrong}`, background: t.surfaceSoft }}>
      <div style={{ ...cell, textAlign: 'center' }}>#</div>
      <div style={{ ...cell, textAlign: 'left' }}>Agent · Unit</div>
      <div style={cell}>Weeks</div>
      <div style={cell}>YTD API · TTD</div>
      <div style={cell}>Apps</div>
      <div style={cell}>CI→App</div>
      <div style={cell}>Pers.</div>
      <div style={cell}>Lvl</div>
      <div style={{ ...cell, paddingRight: 16 }}>Status</div>
    </div>
  );
}

function MasterRow({ t, a, rank, zebra, onDrill }) {
  const pill = flagPill(t, a.flag);
  const persColor = a.pers >= 90 ? t.success : a.pers >= 80 ? t.ink : t.warning;
  const num = { padding: '12px', textAlign: 'right', fontSize: 12.5, color: t.ink, fontFamily: APP_FONT_MONO };
  return (
    <div onClick={onDrill} className="ms-row" style={{
      display: 'grid', gridTemplateColumns: MS_GRID, alignItems: 'center',
      background: zebra ? t.surfaceRaised : t.surface, borderBottom: `1px solid ${t.rule}`, cursor: 'pointer',
    }}>
      <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: 700, color: rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{rank}</div>
      <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>{a.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1, letterSpacing: '0.04em' }}>{a.unit}{!a.logged ? ' · no log' : ''}</div>
        </div>
      </div>
      <div style={num}>{a.weeks}</div>
      <div style={{ padding: '12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, textAlign: 'right' }}>{(a.ytdApi / 1000).toFixed(0)}k</div>
        <div style={{ height: 3, background: t.surfaceMute, borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${(a.ytdApi / MAX_YTD) * 100}%`, height: 3, background: a.flag === 'floor' ? t.danger : a.flag ? t.warning : t.teal, borderRadius: 999 }}></div>
        </div>
      </div>
      <div style={num}>{a.apps}</div>
      <div style={{ ...num, color: a.conv >= 70 ? t.success : t.inkMute, fontWeight: 600 }}>{a.conv}%</div>
      <div style={{ ...num, color: persColor, fontWeight: 600 }}>{a.pers}%</div>
      <div style={{ padding: '12px', textAlign: 'right' }}>
        <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 5, background: t.surfaceSoft, color: t.inkMute, fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{a.level}</span>
      </div>
      <div style={{ padding: '12px 16px', textAlign: 'right' }}>
        <Pill t={t} color={pill.fg} bg={pill.bg}>{pill.label}</Pill>
      </div>
    </div>
  );
}

function MasterTable({ t, exceptionsOn = false }) {
  const rows = ROSTER.map((a, i) => ({ ...a, rank: i + 1 }));
  const shown = exceptionsOn ? rows.filter((a) => a.flag) : rows;
  return (
    <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <MasterHeader t={t} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {shown.map((a, i) => (
          <MasterRow key={a.name} t={t} a={a} rank={a.rank} zebra={i % 2 === 1} onDrill={() => {}} />
        ))}
      </div>
      {/* Footer summary */}
      <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: t.inkMute }}>
        <span>{shown.length} of {ROSTER.length} agents</span>
        <span style={{ color: t.success }}>● {ROSTER.length - EXC_COUNT} on track</span>
        <span style={{ color: t.warning }}>● {EXC_COUNT} need attention</span>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontFamily: APP_FONT_MONO }}>Click a row to coach →</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE CARD — tables don't fit 390px; one card per agent.
// ──────────────────────────────────────────────────────────────────────────
function MasterMobileCard({ t, a, rank, onDrill }) {
  const pill = flagPill(t, a.flag);
  const persColor = a.pers >= 90 ? t.success : a.pers >= 80 ? t.ink : t.warning;
  return (
    <div onClick={onDrill} style={{ padding: '11px 13px', background: t.surface, border: `1px solid ${a.flag ? pill.fg + '33' : t.rule}`, borderRadius: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 20, textAlign: 'center', fontSize: 11, fontWeight: 700, color: rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{rank}</div>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY }}>{a.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{a.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit} · {a.level}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttd(a.ytdApi)}</div>
          <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.apps} APPS</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <div style={{ flex: 1, height: 3, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${(a.ytdApi / MAX_YTD) * 100}%`, height: 3, background: a.flag === 'floor' ? t.danger : a.flag ? t.warning : t.teal, borderRadius: 999 }}></div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: a.conv >= 70 ? t.success : t.inkMute, fontFamily: APP_FONT_MONO }}>CI {a.conv}%</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: persColor, fontFamily: APP_FONT_MONO }}>P {a.pers}%</div>
        <Pill t={t} color={pill.fg} bg={pill.bg}>{pill.label}</Pill>
      </div>
    </div>
  );
}

Object.assign(window, {
  ROSTER, flagPill, EXC_COUNT, TEAM_YTD, TEAM_WEEK, MAX_YTD,
  PeriodSwitch, MasterReality, MasterActionBar, MasterHeader, MasterRow, MasterTable, MasterMobileCard,
});
