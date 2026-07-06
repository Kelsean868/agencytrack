// AgencyTrack — Meeting Mode v2. Bird's-eye slides: branch scorecard, units,
// and the two master-sheet views (weekly activity + windowed production).
//
// Mirrors the printed Production Report the branch already uses on Mondays
// (Weekly / Month-to-date / Year-to-date Apps + API, branch TOTAL, motto) —
// enhanced and carried into the v2 grammar so the room still gets the
// bird's-eye before drilling into individuals.

// Compact API formatter for dense cells (487000 → "487k", 3400 → "3.4k").
function kk(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

// ──────────────────────────────────────────────────────────────────────────
// DATA — branch time windows, units, and the per-agent sheet (14 reporting
// agents; activity keyed to FLOOR_KPIS + windowed production).
// ──────────────────────────────────────────────────────────────────────────
const BRANCH_WINDOWS = [
  { k: 'WTD', name: 'This week',    label: 'the week so far',    api: 142_000,   apps: 38,   pers: null, sub: '+14% vs last wk' },
  { k: 'MTD', name: 'This month',   label: 'November so far',    api: 1_184_000, apps: 156,  pers: 89,   sub: 'Nov · 4 wks' },
  { k: 'QTD', name: 'This quarter', label: 'Q4 so far',         api: 3_460_000, apps: 472,  pers: 88,   sub: 'Q4 · on pace' },
  { k: 'YTD', name: 'This year',    label: 'the year so far',    api: 8_420_000, apps: 1_184, pers: 87,  sub: '70% of 12.0M goal', hero: true },
];

const UNITS = [
  { id: 'S·02', mgr: 'Riaz Khan',     agents: 10, onPace: 7, attention: 2, rank: 1,
    wtdApi: 58_000, mtdApi: 498_000, qtdApi: 1_420_000, ytdApi: 3_480_000, ytdGoal: 4_600_000,
    wtdApps: 15, ytdApps: 486, pers: 88 },
  { id: 'S·01', mgr: 'Lara Mohan',    agents: 9,  onPace: 6, attention: 2, rank: 2,
    wtdApi: 46_000, mtdApi: 392_000, qtdApi: 1_180_000, ytdApi: 2_860_000, ytdGoal: 3_800_000,
    wtdApps: 12, ytdApps: 402, pers: 90 },
  { id: 'S·03', mgr: 'Kevin Boodram', agents: 9,  onPace: 5, attention: 1, rank: 3,
    wtdApi: 38_000, mtdApi: 294_000, qtdApi: 860_000,   ytdApi: 2_080_000, ytdGoal: 3_600_000,
    wtdApps: 11, ytdApps: 296, pers: 84 },
];

// 14 reporting agents (aligned to the Master Sheet roster + the meeting RUN).
// act = this week's activity (FLOOR_KPIS keys). Jamal hasn't filed (no report).
const MEETING_SHEET = [
  { name: 'Marsha Singh',    initials: 'MS', unit: 'S·02', flag: null,          act: { calls: 92, contacts: 58, appts: 28, factfinds: 14, closing: 11, clients: 4, referrals: 140, apps: 4 }, weekApi: 24_400, pers: 88, ytdApi: 487_000, ytdApps: 41 },
  { name: 'Anand Persad',    initials: 'AP', unit: 'S·01', flag: null,          act: { calls: 84, contacts: 52, appts: 25, factfinds: 12, closing: 9, clients: 4, referrals: 128, apps: 4 }, weekApi: 21_800, pers: 91, ytdApi: 442_000, ytdApps: 36 },
  { name: 'Selina Mohammed', initials: 'SM', unit: 'S·03', flag: null,          act: { calls: 78, contacts: 47, appts: 23, factfinds: 11, closing: 8, clients: 3, referrals: 118, apps: 3 }, weekApi: 19_200, pers: 87, ytdApi: 396_000, ytdApps: 38 },
  { name: 'Riaz Khan',       initials: 'RK', unit: 'S·02', flag: null,          act: { calls: 71, contacts: 44, appts: 21, factfinds: 10, closing: 7, clients: 3, referrals: 108, apps: 3 }, weekApi: 17_600, pers: 90, ytdApi: 358_000, ytdApps: 30 },
  { name: 'Kamla Singh',     initials: 'KS', unit: 'S·01', flag: null,          act: { calls: 66, contacts: 41, appts: 20, factfinds: 10, closing: 6, clients: 3, referrals: 102, apps: 3 }, weekApi: 14_900, pers: 86, ytdApi: 312_000, ytdApps: 27 },
  { name: 'Trevor Ramnauth', initials: 'TR', unit: 'S·03', flag: null,          act: { calls: 62, contacts: 39, appts: 18, factfinds: 9, closing: 6, clients: 2, referrals: 96, apps: 2 }, weekApi: 13_200, pers: 89, ytdApi: 287_000, ytdApps: 24 },
  { name: 'Carla Joseph',    initials: 'CJ', unit: 'S·02', flag: null,          act: { calls: 58, contacts: 37, appts: 17, factfinds: 8, closing: 5, clients: 2, referrals: 88, apps: 2 }, weekApi: 12_600, pers: 85, ytdApi: 268_000, ytdApps: 23 },
  { name: 'Avinash Maharaj', initials: 'AM', unit: 'S·02', flag: 'pace',        act: { calls: 61, contacts: 36, appts: 16, factfinds: 7, closing: 5, clients: 2, referrals: 84, apps: 2 }, weekApi: 9_400,  pers: 84, ytdApi: 227_000, ytdApps: 22 },
  { name: 'Hema Lakhan',     initials: 'HL', unit: 'S·01', flag: 'quiet',       act: { calls: 14, contacts: 7, appts: 3, factfinds: 2, closing: 1, clients: 0, referrals: 18, apps: 0 }, weekApi: 4_100,  pers: 88, ytdApi: 231_000, ytdApps: 21 },
  { name: 'Jamal Khan',      initials: 'JK', unit: 'S·03', flag: 'report',      act: null,                                                          weekApi: 0,      pers: 82, ytdApi: 198_000, ytdApps: 18 },
  { name: 'Priya Naidu',     initials: 'PN', unit: 'S·01', flag: 'persistency', act: { calls: 58, contacts: 38, appts: 18, factfinds: 9, closing: 4, clients: 1, referrals: 96, apps: 1 }, weekApi: 6_800,  pers: 72, ytdApi: 156_000, ytdApps: 15 },
  { name: 'Devin Lewis',     initials: 'DL', unit: 'S·02', flag: 'floor',       act: { calls: 44, contacts: 26, appts: 11, factfinds: 6, closing: 3, clients: 1, referrals: 62, apps: 1 }, weekApi: 3_400,  pers: 76, ytdApi: 122_000, ytdApps: 12 },
  { name: 'Nisha Ramdeen',   initials: 'NR', unit: 'S·03', flag: null,          act: { calls: 52, contacts: 33, appts: 14, factfinds: 7, closing: 4, clients: 1, referrals: 78, apps: 1 }, weekApi: 5_600,  pers: 83, ytdApi: 98_000,  ytdApps: 10 },
  { name: 'Omar Ali',        initials: 'OA', unit: 'S·01', flag: null,          act: { calls: 48, contacts: 30, appts: 12, factfinds: 6, closing: 3, clients: 1, referrals: 70, apps: 1 }, weekApi: 4_200,  pers: 80, ytdApi: 54_000,  ytdApps: 7 },
];

// Windowed production derived from the YTD figure (MTD ≈ 14% · QTD ≈ 41%).
function windows(a) {
  return {
    wtdApi: a.weekApi, wtdApps: a.act ? a.act.apps : 0,
    mtdApi: Math.round(a.ytdApi * 0.142), mtdApps: Math.round(a.ytdApps * 0.14),
    qtdApi: Math.round(a.ytdApi * 0.41), qtdApps: Math.round(a.ytdApps * 0.41),
    ytdApi: a.ytdApi, ytdApps: a.ytdApps,
  };
}

function flagTone(t, flag) {
  if (flag === 'floor') return t.danger;
  if (flag) return t.warning;
  return t.success;
}

// ──────────────────────────────────────────────────────────────────────────
// BRANCH SCORECARD — WTD · MTD · QTD · YTD × New API · Apps · Persistency.
// ──────────────────────────────────────────────────────────────────────────
function BranchBody({ t }) {
  const COLS = [['NEW API', 'api'], ['APPLICATIONS', 'apps'], ['PERSISTENCY', 'pers']];
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '18px 40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO }}>{MEETING.branch.toUpperCase()} · THE WHOLE PICTURE</div>
          <div className="a-rise" style={{ fontSize: 38, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, marginTop: 6, lineHeight: 1 }}>Where the branch stands</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ padding: '9px 14px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 11, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.success, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{MEETING.onPace}<span style={{ fontSize: 13, color: t.inkMute }}>/{MEETING.agents}</span></div>
            <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2 }}>on pace</div>
          </div>
          <div style={{ padding: '9px 14px', background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 11, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{MEETING.needAttention}</div>
            <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2 }}>need attention</div>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="a-rise a-d-1" style={{ flex: 1, minHeight: 0, marginTop: 18, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* head */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr', background: t.surfaceSoft, borderBottom: `1px solid ${t.ruleStrong}` }}>
          <div style={{ padding: '13px 22px', fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>WHAT WE DID</div>
          {COLS.map(([l]) => (
            <div key={l} style={{ padding: '13px 22px', fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, textAlign: 'right' }}>{l}</div>
          ))}
        </div>
        {/* rows */}
        {BRANCH_WINDOWS.map((w, i) => (
          <div key={w.k} style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr', alignItems: 'center', borderBottom: i < BRANCH_WINDOWS.length - 1 ? `1px solid ${t.rule}` : 'none', background: w.hero ? t.tealTint + '55' : 'transparent' }}>
            <div style={{ padding: '0 22px' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: w.hero ? t.teal : t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.015em' }}>{w.name}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{w.label}</div>
            </div>
            {/* API */}
            <BranchCell t={t} big={`TTD ${kk(w.api)}`} sub={w.hero ? w.sub : null} hero={w.hero} />
            {/* Apps */}
            <BranchCell t={t} big={w.apps} hero={w.hero} />
            {/* Persistency */}
            {w.pers == null
              ? <div style={{ padding: '0 22px', textAlign: 'right' }}><span style={{ fontSize: 12, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>n/a · monthly</span></div>
              : <BranchCell t={t} big={`${w.pers}%`} color={w.pers >= 85 ? t.success : w.pers >= 80 ? t.ink : t.warning} hero={w.hero} />}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 10, fontStyle: 'italic', flexShrink: 0 }}>Persistency is reported monthly — no weekly figure. API & Apps are settled, not submitted.</div>
    </div>
  );
}

function BranchCell({ t, big, sub, color, hero }) {
  return (
    <div style={{ padding: '0 22px', textAlign: 'right' }}>
      <div style={{ fontSize: hero ? 26 : 22, fontWeight: 700, color: color || t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{big}</div>
      {sub && <div style={{ fontSize: 10.5, color: t.teal, fontWeight: 600, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// UNITS — team by team. Three units side by side, each as a whole.
// ──────────────────────────────────────────────────────────────────────────
function UnitsBody({ t }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '18px 40px 24px' }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO }}>TEAM BY TEAM</div>
        <div className="a-rise" style={{ fontSize: 38, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, marginTop: 6, lineHeight: 1 }}>How the units are moving</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, marginTop: 18 }}>
        {UNITS.map((u, i) => {
          const pct = Math.round((u.ytdApi / u.ytdGoal) * 100);
          const lead = u.rank === 1;
          return (
            <div key={u.id} className={`a-rise a-d-${i + 1}`} style={{ flex: 1, minWidth: 0, background: t.surface, border: `1px solid ${lead ? t.gold + '55' : t.rule}`, borderRadius: 16, padding: '18px 18px', display: 'flex', flexDirection: 'column' }}>
              {/* head */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: lead ? t.goldTint : t.tealTint, color: lead ? t.gold : t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', flexShrink: 0 }}>{u.id}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Unit {u.id}</div>
                  <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{u.mgr}</div>
                </div>
                {lead && <span style={{ fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, padding: '4px 9px', background: t.goldTint, borderRadius: 999 }}>★ LEAD</span>}
              </div>

              {/* YTD hero + goal bar */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>SETTLED API · YEAR SO FAR</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 4, lineHeight: 1 }}>{ttd(u.ytdApi)}</div>
                <div style={{ marginTop: 10, height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                  <div className="a-progress-grow" style={{ width: `${pct}%`, height: 6, background: lead ? `linear-gradient(90deg, ${t.gold}, ${t.goldTint})` : `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
                  <span>{pct}% of goal</span><span>{ttd(u.ytdGoal)}</span>
                </div>
              </div>

              {/* window row */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {[['This week', u.wtdApi], ['This month', u.mtdApi], ['This quarter', u.qtdApi]].map(([k, v]) => (

                  <div key={k} style={{ flex: 1, padding: '9px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{k}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{kk(v)}</div>
                  </div>
                ))}
              </div>

              {/* footer stats */}
              <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>PERSISTENCY</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: u.pers >= 85 ? t.success : t.warning, fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>{u.pers}%</div>
                </div>
                <div style={{ width: 1, height: 28, background: t.rule }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>ON PACE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>{u.onPace}<span style={{ fontSize: 11, color: t.inkMute }}>/{u.agents}</span></div>
                </div>
                <div style={{ width: 1, height: 28, background: t.rule }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>ATTENTION</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: u.attention ? t.warning : t.success, fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>{u.attention}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ACTIVITY MASTER SHEET — everyone's week: activity vs floor + the result.
// ──────────────────────────────────────────────────────────────────────────
const ACT_COLS = [['Calls', 'calls'], ['Cont', 'contacts'], ['Appt', 'appts'], ['FF', 'factfinds'], ['CI', 'closing'], ['Clts', 'clients'], ['Ref', 'referrals']];
const ACT_GRID = '1.7fr 54px 54px 50px 44px 44px 48px 52px 1.0fr 56px 92px';

function ActCell({ t, v, floor, mono = true }) {
  const st = v == null ? null : kpiStatus(v, floor);
  const c = v == null ? t.inkFaint : st === 'met' ? t.ink : st === 'at' ? t.warning : t.danger;
  return <div style={{ padding: '0 8px', textAlign: 'right', fontSize: 14, fontWeight: st === 'below' ? 700 : 600, color: c, fontFamily: APP_FONT_MONO }}>{v == null ? '—' : v}</div>;
}

// Activity score = total funnel touches this week (rewards effort/inputs).
function activityScore(a) {
  if (!a.act) return 0;
  const x = a.act;
  return x.calls + x.contacts + x.appts + x.factfinds + x.closing + x.referrals + x.clients + x.apps;
}
const ACT_FLOORS = { calls: 60, contacts: 40, appts: 20, factfinds: 10, closing: 10, clients: 1, referrals: 100 };
const ACT_SORTS = { api: 'New API', activity: 'Activity', pers: 'Persistency', status: 'Needs attention first', name: 'Name', none: 'Default order' };
const UNIT_ORDER = ['S·01', 'S·02', 'S·03'];

function sortSheet(rows, sort) {
  const a = [...rows];
  if (sort === 'api') a.sort((x, y) => y.weekApi - x.weekApi);
  else if (sort === 'activity') a.sort((x, y) => activityScore(y) - activityScore(x));
  else if (sort === 'pers') a.sort((x, y) => y.pers - x.pers);
  else if (sort === 'name') a.sort((x, y) => x.name.localeCompare(y.name));
  else if (sort === 'status') { const rk = (f) => (f === 'floor' ? 0 : f ? 1 : 2); a.sort((x, y) => rk(x.flag) - rk(y.flag) || y.weekApi - x.weekApi); }
  return a;
}

function ActSheetHead({ t, cols, grid }) {
  const c = { padding: '9px 8px', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO, textAlign: 'right' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: grid, background: t.surfaceSoft, borderBottom: `1px solid ${t.ruleStrong}`, flexShrink: 0 }}>
      <div style={{ ...c, textAlign: 'left', padding: '9px 14px' }}>AGENT · UNIT</div>
      {cols.map((col) => <div key={col.key} style={c}>{col.short}</div>)}
      <div style={c}>NEW API</div>
      <div style={c}>APPS</div>
      <div style={{ ...c, padding: '9px 14px' }}>STATUS</div>
    </div>
  );
}

function ActSheetRow({ t, a, zebra, cols, grid }) {
  const fg = flagTone(t, a.flag);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: grid, alignItems: 'center', borderBottom: `1px solid ${t.rule}`, background: zebra ? t.surfaceRaised : 'transparent' }}>
      <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${fg}1f`, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
          <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.unit}{!a.act ? ' · no report' : ''}</div>
        </div>
      </div>
      {cols.map((col) => <ActCell key={col.key} t={t} v={a.act ? col.get(a.act) : null} floor={col.floor} />)}
      <div style={{ padding: '0 8px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: a.weekApi ? t.ink : t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.weekApi ? kk(a.weekApi) : '—'}</div>
      <div style={{ padding: '0 8px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: a.act ? t.ink : t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.act ? a.act.apps : '—'}</div>
      <div style={{ padding: '0 14px', textAlign: 'right' }}>
        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase', color: fg, background: `${fg}1f`, border: `1px solid ${fg}33` }}>
          {a.flag === 'floor' ? 'Below floor' : a.flag === 'pace' ? 'Off pace' : a.flag === 'quiet' ? 'Quiet' : a.flag === 'report' ? 'No report' : a.flag === 'persistency' ? 'Pers ↓' : 'On track'}
        </span>
      </div>
    </div>
  );
}

function CtrlChip({ t, label, value }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 9 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>{value}</span>
      <IconChevD size={11} color={t.inkMute} stroke={2.4} />
    </div>
  );
}

function ActivitySheetBody({ t, group = 'unit', sort = 'api', density = 'condensed' }) {
  const sorted = sortSheet(MEETING_SHEET, sort);
  const grouped = group === 'unit';
  const cols = resolveKpiCols(density);
  const grid = `minmax(150px, 1.5fr) repeat(${cols.length}, minmax(42px, 1fr)) 70px 46px 96px`;
  let zi = 0;
  const body = grouped
    ? UNIT_ORDER.map((u) => {
        const rows = sorted.filter((a) => a.unit === u);
        if (!rows.length) return null;
        return (
          <React.Fragment key={u}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '5px 14px', background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}` }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>Unit {u}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>{rows.length} AGENTS</span>
            </div>
            {rows.map((a) => <ActSheetRow key={a.name} t={t} a={a} zebra={(zi++) % 2 === 1} cols={cols} grid={grid} />)}
          </React.Fragment>
        );
      })
    : sorted.map((a) => <ActSheetRow key={a.name} t={t} a={a} zebra={(zi++) % 2 === 1} cols={cols} grid={grid} />);

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '16px 30px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, marginBottom: 11 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO }}>WEEK 48 · ACTIVITY MASTER SHEET</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 5, lineHeight: 1 }}>Everyone's week — activity &amp; result</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>
          <span style={{ color: t.success }}>● meets floor</span>
          <span style={{ color: t.warning }}>● at</span>
          <span style={{ color: t.danger }}>● below</span>
        </div>
      </div>

      {/* Control bar — group + sort, saved as the presenter's default */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>VIEW</span>
        <CtrlChip t={t} label="GROUP" value={grouped ? 'Unit' : 'None'} />
        <CtrlChip t={t} label="SORT" value={ACT_SORTS[sort] || 'New API'} />
        <CtrlChip t={t} label="DETAIL" value={KPI_DENSITY_LABEL[density] || 'Company floor'} />
        <div style={{ flex: 1 }}></div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
          <IconCheck size={12} color={t.teal} stroke={2.6} /> SAVED AS YOUR DEFAULT
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ActSheetHead t={t} cols={cols} grid={grid} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {body}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PRODUCTION MASTER SHEET — WTD · MTD · QTD · YTD Apps + API, TOTAL row.
// Mirrors the printed branch Production Report.
// ──────────────────────────────────────────────────────────────────────────
const PROD_GRID = '1.7fr 46px 78px 46px 84px 46px 84px 52px 92px';
const PROD_GROUPS = [['THIS WEEK', 'wtd'], ['THIS MONTH', 'mtd'], ['THIS QUARTER', 'qtd'], ['THIS YEAR', 'ytd']];

function ProductionSheetBody({ t }) {
  const rows = MEETING_SHEET.map((a) => ({ ...a, w: windows(a) }));
  const totals = rows.reduce((s, r) => ({
    wtdApps: s.wtdApps + r.w.wtdApps, wtdApi: s.wtdApi + r.w.wtdApi,
    mtdApps: s.mtdApps + r.w.mtdApps, mtdApi: s.mtdApi + r.w.mtdApi,
    qtdApps: s.qtdApps + r.w.qtdApps, qtdApi: s.qtdApi + r.w.qtdApi,
    ytdApps: s.ytdApps + r.w.ytdApps, ytdApi: s.ytdApi + r.w.ytdApi,
  }), { wtdApps: 0, wtdApi: 0, mtdApps: 0, mtdApi: 0, qtdApps: 0, qtdApi: 0, ytdApps: 0, ytdApi: 0 });

  const cell = (apps, api, hi) => (
    <>
      <div style={{ padding: '0 4px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: apps ? t.inkMute : t.inkDim, fontFamily: APP_FONT_MONO }}>{apps || '·'}</div>
      <div style={{ padding: '0 10px 0 4px', textAlign: 'right', fontSize: 13.5, fontWeight: hi ? 800 : 700, color: api ? t.ink : t.inkDim, fontFamily: APP_FONT_MONO }}>{api ? kk(api) : '·'}</div>
    </>
  );

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '16px 30px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO }}>PRODUCTION REPORT · WEEK ENDING 30 NOV</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 5, lineHeight: 1 }}>Everyone's numbers — this week to this year</div>
        </div>
        <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>New Business · settled API (TTD)</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* group head */}
        <div style={{ display: 'grid', gridTemplateColumns: PROD_GRID, background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
          <div style={{ padding: '9px 14px 3px', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>AGENT · UNIT</div>
          {PROD_GROUPS.map(([l], i) => (
            <div key={l} style={{ gridColumn: 'span 2', padding: '9px 10px 3px', fontSize: 10, fontWeight: 700, color: i === 3 ? t.teal : t.inkMute, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, textAlign: 'right' }}>{l}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: PROD_GRID, background: t.surfaceSoft, borderBottom: `1px solid ${t.ruleStrong}`, flexShrink: 0 }}>
          <div></div>
          {PROD_GROUPS.map(([l]) => (
            <React.Fragment key={l}>
              <div style={{ padding: '0 4px 8px', textAlign: 'right', fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO }}>APPS</div>
              <div style={{ padding: '0 10px 8px 4px', textAlign: 'right', fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO }}>API</div>
            </React.Fragment>
          ))}
        </div>
        {/* rows */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {rows.map((a, i) => (
            <div key={a.name} style={{ flex: 1, display: 'grid', gridTemplateColumns: PROD_GRID, alignItems: 'center', borderBottom: `1px solid ${t.rule}`, background: i % 2 ? t.surfaceRaised : 'transparent' }}>
              <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 22, textAlign: 'center', fontSize: 11, fontWeight: 700, color: i < 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                </div>
                <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginLeft: 'auto', flexShrink: 0 }}>{a.unit}</div>
              </div>
              {cell(a.w.wtdApps, a.w.wtdApi)}
              {cell(a.w.mtdApps, a.w.mtdApi)}
              {cell(a.w.qtdApps, a.w.qtdApi)}
              {cell(a.w.ytdApps, a.w.ytdApi, true)}
            </div>
          ))}
        </div>
        {/* total */}
        <div style={{ display: 'grid', gridTemplateColumns: PROD_GRID, alignItems: 'center', background: t.tealTint + '66', borderTop: `1.5px solid ${t.teal}`, flexShrink: 0, padding: '11px 0' }}>
          <div style={{ padding: '0 14px', fontSize: 12, fontWeight: 800, color: t.teal, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>BRANCH TOTAL</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, padding: '0 4px' }}>{totals.wtdApps}</div>
          <div style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: t.ink, fontFamily: APP_FONT_MONO, padding: '0 10px 0 4px' }}>{kk(totals.wtdApi)}</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, padding: '0 4px' }}>{totals.mtdApps}</div>
          <div style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: t.ink, fontFamily: APP_FONT_MONO, padding: '0 10px 0 4px' }}>{kk(totals.mtdApi)}</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, padding: '0 4px' }}>{totals.qtdApps}</div>
          <div style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: t.ink, fontFamily: APP_FONT_MONO, padding: '0 10px 0 4px' }}>{kk(totals.qtdApi)}</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, padding: '0 4px' }}>{totals.ytdApps}</div>
          <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 800, color: t.teal, fontFamily: APP_FONT_MONO, padding: '0 10px 0 4px' }}>{kk(totals.ytdApi)}</div>
        </div>
      </div>

      {/* the agency motto — carried from the printed report */}
      <div style={{ flexShrink: 0, marginTop: 10, textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO }}>
        COMING TOGETHER IS A BEGINNING · KEEPING TOGETHER IS PROGRESS · WORKING TOGETHER IS SUCCESS
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ON THE RISE — non-champions who improved week-over-week. Encouragement for
// the people who are trying, not just the leaders.
// ──────────────────────────────────────────────────────────────────────────
const MOVERS = [
  { name: 'Avinash Maharaj', initials: 'AM', unit: 'S·02', delta: '+15% activity', note: '3 weeks climbing',  spark: [36, 41, 38, 46, 40, 44] },
  { name: 'Nisha Ramdeen',   initials: 'NR', unit: 'S·03', delta: '+22% API',      note: 'best week yet',     spark: [3, 3.4, 4, 4.3, 5, 5.6] },
  { name: 'Carla Joseph',    initials: 'CJ', unit: 'S·02', delta: '+18% API',      note: 'cleared every floor', spark: [10, 11, 10.5, 11.6, 12, 12.6] },
];

// ──────────────────────────────────────────────────────────────────────────
// WITHIN REACH — agents closest to an award/incentive (names from the Awards
// surface). Points the room at what's achievable and pushes the near-misses.
// ──────────────────────────────────────────────────────────────────────────
const AWARDS_REACH = [
  { name: 'Selina Mohammed', initials: 'SM', unit: 'S·03', award: 'Eagles Club',       prize: 'Bermuda incentive trip',     current: 396_000, target: 420_000, money: true,  pace: '2 apps · ~2 weeks' },
  { name: 'Anand Persad',    initials: 'AP', unit: 'S·01', award: 'MDRT 2026',         prize: 'Million Dollar Round Table', current: 442_000, target: 500_000, money: true,  pace: 'TTD 58k · ~3 weeks' },
  { name: 'Kamla Singh',     initials: 'KS', unit: 'S·01', award: 'Q4 Champion',       prize: 'TTD 5,000 bonus',            current: 128_000, target: 150_000, money: true,  pace: 'TTD 22k this quarter' },
  { name: 'Nisha Ramdeen',   initials: 'NR', unit: 'S·03', award: 'Activity Producer', prize: 'Annual plaque',              current: 1_480,   target: 2_000,   money: false, pace: '520 activities to go' },
];

function AwardsReachBody({ t }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '18px 40px 26px' }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.gold, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO }}>★ WITHIN REACH · AWARDS & INCENTIVES</div>
        <div className="a-rise" style={{ fontSize: 38, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, marginTop: 6, lineHeight: 1 }}>Who's close — let's push them over</div>
        <div className="a-rise a-d-1" style={{ fontSize: 14, color: t.inkMute, marginTop: 8 }}>The system tracks every award. Here's who could earn one with a strong final stretch.</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, marginTop: 18 }}>
        {AWARDS_REACH.map((a, i) => {
          const pct = Math.round((a.current / a.target) * 100);
          const gap = a.target - a.current;
          const cur = a.money ? `TTD ${kk(a.current)}` : a.current.toLocaleString();
          const tgt = a.money ? `TTD ${kk(a.target)}` : a.target.toLocaleString();
          return (
            <div key={a.award} className={`a-rise a-d-${i + 1}`} style={{ flex: 1, minWidth: 0, background: t.surface, border: `1px solid ${t.gold}33`, borderRadius: 16, padding: '16px 16px', display: 'flex', flexDirection: 'column' }}>
              {/* award */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: t.goldTint, color: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconMedal size={16} color={t.gold} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.award}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.prize}</div>
                </div>
              </div>

              {/* percent */}
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 0.9 }}>{pct}<span style={{ fontSize: 18 }}>%</span></div>
                <div style={{ fontSize: 11, color: t.inkMute, paddingBottom: 4 }}>there</div>
              </div>
              <div style={{ marginTop: 10, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                <div className="a-progress-grow" style={{ width: `${pct}%`, height: 7, background: `linear-gradient(90deg, ${t.gold}, ${t.goldTint})`, borderRadius: 999 }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
                <span>{cur}</span><span>{tgt}</span>
              </div>

              {/* agent + pace */}
              <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.unit}</div>
                </div>
              </div>
              <div style={{ marginTop: 9, padding: '7px 11px', background: t.goldTint, borderRadius: 9, fontSize: 11, fontWeight: 700, color: t.gold, textAlign: 'center', letterSpacing: '0.02em' }}>{a.pace}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CELEBRATIONS — Birthdays & Anniversaries this week. Carries the kiosk
// treatment onto the projection surface: festive cards (glowing avatar halo,
// label pill, occasion block) over drifting confetti + floating balloons.
// ──────────────────────────────────────────────────────────────────────────
const CELEBRATIONS = [
  { name: 'Anand Persad',  initials: 'AP', kind: 'anniversary', occasion: '8 years',  date: 'MON 25 NOV', sub: 'Producer · South · 01', accent: '#6DCFB0', glow: 'rgba(109,207,176,0.5)' },
  { name: 'Carla Joseph',  initials: 'CJ', kind: 'birthday',    occasion: 'Turns 32', date: 'TUE 26 NOV', sub: 'Producer · South · 02', accent: '#F47C8F', glow: 'rgba(244,124,143,0.55)' },
  { name: 'Riaz Khan',     initials: 'RK', kind: 'anniversary', occasion: '5 years',  date: 'WED 27 NOV', sub: 'UM + Producer · South · 02', accent: '#B59FD8', glow: 'rgba(181,159,216,0.5)' },
  { name: 'Nisha Ramdeen', initials: 'NR', kind: 'birthday',    occasion: 'Turns 29', date: 'THU 28 NOV', sub: 'Producer · South · 03', accent: '#7DC4F0', glow: 'rgba(125,196,240,0.5)' },
  { name: 'Marsha Singh',  initials: 'MS', kind: 'birthday',    occasion: 'Turns 41', date: 'FRI 29 NOV', sub: 'UM + Producer · South · 02', accent: '#E0AA3E', glow: 'rgba(224,170,62,0.55)' },
];

const CELEBRATE_PALETTE = ['#F47C8F', '#B59FD8', '#FFA075', '#6DCFB0', '#E0AA3E', '#7DC4F0', '#F4D06F', '#FDB6A8'];

// Floating balloons — adapted from the kiosk motif, tuned for the 720-tall frame.
function MtgBalloons({ count = 5 }) {
  const variants = ['a', 'b', 'c', 'd', 'e'];
  const balloons = Array.from({ length: count }, (_, i) => {
    const rPos = (i * 73 + 11) % 100, rColor = (i * 41 + 29) % CELEBRATE_PALETTE.length;
    const rPath = (i * 17 + 5) % variants.length, rSize = (i * 53 + 19) % 100;
    const dur = 18 + (rSize % 5);
    return { left: 2 + rPos * 0.93, delay: (i * (dur * 0.9) + (rPos % 4) * 0.5) % (dur * 2.2), duration: dur, color: CELEBRATE_PALETTE[rColor], size: 54 + (rSize % 3) * 14, path: variants[rPath] };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {balloons.map((b, i) => (
        <div key={i} style={{ position: 'absolute', bottom: '-160px', left: `${b.left}%`, width: b.size, height: b.size * 1.22, opacity: 0, animation: `kiosk-balloon-float-${b.path} ${b.duration}s linear ${b.delay}s infinite`, filter: `drop-shadow(0 8px 16px rgba(0,0,0,0.35)) drop-shadow(0 0 12px ${b.color}44)` }}>
          <svg viewBox="0 0 100 122" width="100%" height="100%">
            <defs>
              <radialGradient id={`mbg${i}`} cx="35%" cy="28%" r="68%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.6" /><stop offset="22%" stopColor={b.color} stopOpacity="0.95" /><stop offset="100%" stopColor={b.color} stopOpacity="0.8" />
              </radialGradient>
              <radialGradient id={`mhi${i}`} cx="32%" cy="24%" r="22%"><stop offset="0%" stopColor="#fff" stopOpacity="0.85" /><stop offset="100%" stopColor="#fff" stopOpacity="0" /></radialGradient>
            </defs>
            <ellipse cx="50" cy="48" rx="38" ry="44" fill={`url(#mbg${i})`} />
            <ellipse cx="36" cy="32" rx="14" ry="10" fill={`url(#mhi${i})`} />
            <path d="M44 91 L50 99 L56 91 Z" fill={b.color} opacity="0.92" />
            <path d="M50 99 Q53 106 47 112 Q44 116 50 122" stroke={b.color} strokeWidth="1.2" fill="none" opacity="0.55" strokeLinecap="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}

// Confetti — colored shapes drifting down continuously.
function MtgConfetti({ count = 16, z = 0 }) {
  const colors = ['#E0AA3E', '#3FA89A', '#F47C8F', '#F5F0E0', '#A78BFA', '#7DC4F0'];
  const pieces = Array.from({ length: count }, (_, i) => {
    const r1 = (i * 37) % 100, r2 = (i * 53) % 100;
    return { left: r1 + (r2 % 5), delay: (r2 % 12) * 0.7, duration: 10 + (r1 % 6), color: colors[i % colors.length], size: 5 + (i % 4) * 2, rotate: (i * 47) % 360, shape: i % 3 };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: z }}>
      {pieces.map((p, i) => (
        <div key={i} style={{ position: 'absolute', top: '-40px', left: `${p.left}%`, width: p.size, height: p.shape === 1 ? p.size : p.size * 0.55, background: p.color, opacity: 0, transform: `rotate(${p.rotate}deg)`, animation: `kiosk-confetti-fall ${p.duration}s linear ${p.delay}s infinite`, borderRadius: p.shape === 1 ? '50%' : p.shape === 2 ? '0' : '1px', boxShadow: `0 0 4px ${p.color}66` }} />
      ))}
    </div>
  );
}

function MtgSparkle({ size = 12, color, top, left, delay = 0 }) {
  return (
    <div style={{ position: 'absolute', top, left, width: size, height: size, animation: `kiosk-sparkle 2.4s ease-in-out ${delay}s infinite`, pointerEvents: 'none' }}>
      <svg viewBox="0 0 24 24" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}><path d="M12 2l1.6 7.4L21 11l-7.4 1.6L12 20l-1.6-7.4L3 11l7.4-1.6L12 2z" /></svg>
    </div>
  );
}

function CelebrationsBody({ t }) {
  const dark = t.mode !== 'light';
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      <MtgConfetti count={16} z={0} />
      <MtgBalloons count={5} />

      <div style={{ position: 'relative', zIndex: 2, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '18px 36px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.gold, letterSpacing: '0.2em', fontFamily: APP_FONT_MONO }}>★ CELEBRATING THIS WEEK</div>
            <div className="a-rise" style={{ fontSize: 38, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, marginTop: 6, lineHeight: 1 }}>Birthdays &amp; Anniversaries</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>WEEK 48 · 2026</div>
            <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 4 }}>{CELEBRATIONS.length} celebrations this week</div>
          </div>
        </div>

        {/* Cards */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {CELEBRATIONS.map((c, i) => (
            <div key={c.name} className={`a-rise a-d-${i + 1}`} style={{
              position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              padding: '18px 14px 16px', borderRadius: 20,
              background: dark ? 'rgba(255,255,255,0.03)' : t.surface,
              border: `1px solid ${c.accent}44`,
              boxShadow: `0 0 40px ${c.glow.replace('0.5', '0.18').replace('0.55', '0.2')}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}>
              {/* corner glow */}
              <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, background: `radial-gradient(circle at 50% 50%, ${c.glow}, transparent 62%)`, opacity: 0.45, pointerEvents: 'none' }}></div>
              <MtgSparkle size={11} color={c.accent} top={12} left={16} delay={0} />
              <MtgSparkle size={8} color={c.accent} top={24} left="82%" delay={0.7} />
              <MtgSparkle size={12} color={c.accent} top="44%" left="86%" delay={1.3} />

              {/* label */}
              <div style={{ padding: '4px 10px', borderRadius: 999, background: `${c.accent}1f`, border: `1px solid ${c.accent}55`, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.16em', color: c.accent, fontFamily: APP_FONT_MONO, position: 'relative' }}>
                {c.kind === 'birthday' ? 'BIRTHDAY' : 'WORK ANNIVERSARY'}
              </div>

              {/* avatar + halo */}
              <div style={{ marginTop: 16, position: 'relative', width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="a-breathe" style={{ position: 'absolute', inset: -14, background: `radial-gradient(circle, ${c.glow} 0%, ${c.accent}33 32%, transparent 70%)`, pointerEvents: 'none' }}></div>
                <div style={{ width: 86, height: 86, borderRadius: '50%', background: `${c.accent}26`, color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 30, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', border: `2px solid ${c.accent}`, position: 'relative', boxShadow: `0 0 20px ${c.glow}` }}>{c.initials}</div>
              </div>

              {/* name + sub */}
              <div style={{ marginTop: 16, fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.1, position: 'relative' }}>{c.name}</div>
              <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 4, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', position: 'relative' }}>{c.sub}</div>

              {/* occasion block */}
              <div style={{ marginTop: 'auto', paddingTop: 14, width: '100%', position: 'relative' }}>
                <div style={{ padding: '11px 12px', borderRadius: 12, background: `${c.accent}1a`, border: `1px solid ${c.accent}33` }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: c.accent, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1 }}>{c.occasion}</div>
                  <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 6, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>{c.date}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* foreground confetti drifts in front of the cards */}
      <MtgConfetti count={7} z={3} />
    </div>
  );
}

Object.assign(window, {
  kk, BRANCH_WINDOWS, UNITS, MEETING_SHEET, windows, flagTone, MOVERS, AWARDS_REACH, CELEBRATIONS,
  activityScore, sortSheet, ACT_SORTS, MtgBalloons, MtgConfetti, MtgSparkle,
  BranchBody, BranchCell, UnitsBody, ActivitySheetBody, ProductionSheetBody, AwardsReachBody, CelebrationsBody,
});
