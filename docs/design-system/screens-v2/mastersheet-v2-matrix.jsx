// Master Sheet v2 — the detailed activity matrix ("All" preset).
//
// Every agent × every reported activity for the chosen period. Grouped column
// bands (Prospecting · Contact · FFI/CI · Sales · Quality), horizontal scroll,
// the Agent column pinned left. The period switch (in the reality bar)
// re-aggregates: Day / Week / Month / Quarter / YTD.
//
// Reuses ROSTER + flagPill (mastersheet-v2-shared).

// Activity columns, grouped. width in px (drives the shared grid template).
const ACT_GROUPS = [
  { label: 'Prospecting', color: 'teal', cols: [
    { key: 'touches',  label: 'Touches',   w: 70 },
    { key: 'newNames', label: 'New Names', w: 82 },
  ]},
  { label: 'Contact', color: 'teal', cols: [
    { key: 'dials',    label: 'Dials',    w: 62 },
    { key: 'telC',     label: 'Tel Ct.',  w: 62 },
    { key: 'f2f',      label: 'F2F',      w: 56 },
    { key: 'contacts', label: 'Contacts', w: 74 },
  ]},
  { label: 'FFI / CI', color: 'gold', cols: [
    { key: 'ffiSch',  label: 'FFI Sch.', w: 66 },
    { key: 'ffiDone', label: 'FFI Done', w: 70 },
    { key: 'solns',   label: 'Solns',    w: 60 },
    { key: 'newCI',   label: 'New CI',   w: 62 },
    { key: 'ciDone',  label: 'CI Done',  w: 64 },
  ]},
  { label: 'Sales', color: 'teal', cols: [
    { key: 'apps',  label: 'Apps',  w: 56 },
    { key: 'lives', label: 'Lives', w: 56 },
    { key: 'api',   label: 'API',   w: 86, money: true },
  ]},
  { label: 'Quality', color: 'success', cols: [
    { key: 'close', label: 'Close%', w: 62, rate: true },
    { key: 'pers',  label: 'Pers%',  w: 60, rate: true },
  ]},
];
const ACT_COLS = ACT_GROUPS.flatMap((g) => g.cols);

// Lead columns (pinned-feel) + the activity columns.
const LEAD_W = [34, 168, 96]; // # · Agent·Unit · Status
const MATRIX_GRID = [...LEAD_W, ...ACT_COLS.map((c) => c.w)].map((w) => `${w}px`).join(' ');
const MATRIX_MINW = [...LEAD_W, ...ACT_COLS.map((c) => c.w)].reduce((a, b) => a + b, 0);

const PERIOD_FACTOR = { day: 0.2, week: 1, month: 4.3, quarter: 13 };
const PERIOD_LABEL = { day: 'today', week: 'this week', month: 'this month', quarter: 'this quarter', ytd: 'year to date' };

// Deterministic per-agent weekly base, scaled by period. Plausible, not exact.
function activityFor(a, period) {
  const k = Math.max(0.3, a.apps / 41);               // intensity 0.3–1.0
  const s = (a.initials.charCodeAt(0) + a.initials.charCodeAt(1)) % 5;
  const baseWeek = {
    touches:  Math.round(40 * k) + s,
    newNames: Math.round(9 * k) + 1,
    dials:    Math.round(46 * k) + s,
    telC:     Math.round(12 * k) + 1,
    f2f:      Math.round(6 * k) + 1,
    contacts: Math.round(14 * k) + 1,
    ffiSch:   Math.round(4 * k) + 1,
    ffiDone:  Math.round(3 * k) + 1,
    solns:    Math.round(3 * k) + (s % 2),
    newCI:    Math.round(2 * k) + (s % 2),
    ciDone:   Math.round(2 * k) + 1,
    apps:     Math.round(3 * k) + 1,
    lives:    Math.round(4 * k) + 1,
    api:      a.weekApi,
  };
  const factor = period === 'ytd' ? a.weeks : (PERIOD_FACTOR[period] ?? 1);
  const out = {};
  for (const c of ACT_COLS) {
    if (c.rate) { out[c.key] = c.key === 'pers' ? a.pers : a.conv; continue; }
    if (c.key === 'api') { out.api = period === 'ytd' ? a.ytdApi : Math.round(a.weekApi * (PERIOD_FACTOR[period] ?? 1)); continue; }
    out[c.key] = Math.max(0, Math.round(baseWeek[c.key] * factor));
  }
  return out;
}

const GCOLOR = (t, c) => c === 'gold' ? t.gold : c === 'success' ? t.success : t.teal;

function MatrixHead({ t }) {
  const headCell = { padding: '7px 8px', fontSize: 9, fontWeight: 700, color: t.inkMute, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, textAlign: 'right', whiteSpace: 'nowrap' };
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 2 }}>
      {/* Group band */}
      <div style={{ display: 'grid', gridTemplateColumns: MATRIX_GRID, background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}` }}>
        <div style={{ gridColumn: 'span 3', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, position: 'sticky', left: 0, background: t.surfaceSoft, zIndex: 1 }}>AGENT</div>
        {ACT_GROUPS.map((g) => (
          <div key={g.label} style={{ gridColumn: `span ${g.cols.length}`, padding: '8px 10px', textAlign: 'center', borderLeft: `1px solid ${t.rule}` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: GCOLOR(t, g.color), letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{g.label}</span>
          </div>
        ))}
      </div>
      {/* Column heads */}
      <div style={{ display: 'grid', gridTemplateColumns: MATRIX_GRID, background: t.surface, borderBottom: `1px solid ${t.ruleStrong}` }}>
        <div style={{ ...headCell, textAlign: 'center', position: 'sticky', left: 0, background: t.surface, zIndex: 1 }}>#</div>
        <div style={{ ...headCell, textAlign: 'left', position: 'sticky', left: LEAD_W[0], background: t.surface, zIndex: 1 }}>Agent · Unit</div>
        <div style={{ ...headCell, textAlign: 'left' }}>Status</div>
        {ACT_COLS.map((c) => <div key={c.key} style={headCell}>{c.label}</div>)}
      </div>
    </div>
  );
}

function MatrixRow({ t, a, rank, zebra, period, onDrill }) {
  const v = activityFor(a, period);
  const pill = flagPill(t, a.flag);
  const bg = zebra ? t.surfaceRaised : t.surface;
  const num = { padding: '10px 8px', textAlign: 'right', fontSize: 12, color: t.ink, fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' };
  return (
    <div onClick={onDrill} className="ms-row" style={{ display: 'grid', gridTemplateColumns: MATRIX_GRID, alignItems: 'center', background: bg, borderBottom: `1px solid ${t.rule}`, cursor: 'pointer' }}>
      <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY, position: 'sticky', left: 0, background: bg, zIndex: 1 }}>{rank}</div>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 9, position: 'sticky', left: LEAD_W[0], background: bg, zIndex: 1, borderRight: `1px solid ${t.rule}` }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap' }}>{a.name}</div>
          <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit} · {a.level}</div>
        </div>
      </div>
      <div style={{ padding: '10px 8px' }}><Pill t={t} color={pill.fg} bg={pill.bg}>{pill.label}</Pill></div>
      {ACT_COLS.map((c) => {
        let txt = v[c.key];
        if (c.money) txt = `${(v.api / 1000).toFixed(period === 'ytd' || period === 'quarter' ? 0 : 1)}k`;
        else if (c.rate) txt = `${v[c.key]}%`;
        const dim = !c.money && !c.rate && v[c.key] === 0;
        return <div key={c.key} style={{ ...num, color: c.rate && v[c.key] >= 80 && c.key === 'pers' ? t.success : dim ? t.inkFaint : t.ink, fontWeight: c.money ? 700 : 400 }}>{dim ? '—' : txt}</div>;
      })}
    </div>
  );
}

function MasterMatrix({ t, period = 'week', exceptionsOn = false }) {
  const rows = ROSTER.map((a, i) => ({ ...a, rank: i + 1 }));
  const shown = exceptionsOn ? rows.filter((a) => a.flag) : rows;
  return (
    <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ minWidth: MATRIX_MINW }}>
          <MatrixHead t={t} />
          {shown.map((a, i) => (
            <MatrixRow key={a.name} t={t} a={a} rank={a.rank} zebra={i % 2 === 1} period={period} onDrill={() => {}} />
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '9px 16px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: t.inkMute }}>
        <span>{shown.length} agents · all activity, {PERIOD_LABEL[period]}</span>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontFamily: APP_FONT_MONO }}>← scroll for all {ACT_COLS.length} metrics · click a row to coach →</span>
      </div>
    </div>
  );
}

Object.assign(window, { ACT_GROUPS, ACT_COLS, activityFor, MasterMatrix, MatrixHead, MatrixRow, PERIOD_LABEL });
