// Production Report v2 — the in-app "Production" tab (spec §18). One screen
// that adapts its scope by role: agent (self) · unit manager (their unit) ·
// branch manager (their branch) · sales manager (all branches). It's the
// screen the downloadable PDFs (Agent / Unit / Branch / Agency reports) are
// pulled from.
//
// Components (per spec §18.1): ProductionReportTab, TimePeriodToggle,
// ProductionTable, RankedLeaderboard, DataSourceBadge, and the role views.
//
// Reuses ROSTER + flagPill (mastersheet-v2-shared), ManagerShell/ScopeSwitch
// (manager-v2-shared), AppShell (app-shell), ttd/icons (app-tokens).

// Compact API formatter for dense cells.
function pk(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

// Humanized time-period set. value drives the windowing math.
const PR_PERIODS = [
  { key: 'week',    label: 'This week',    short: 'WK', sub: 'Week 48 · to date',  apiR: null, appsR: 0.05 },
  { key: 'month',   label: 'This month',   short: 'MO', sub: 'November · to date', apiR: 0.142, appsR: 0.14 },
  { key: 'quarter', label: 'This quarter', short: 'QTR', sub: 'Q4 · to date',      apiR: 0.41, appsR: 0.41 },
  { key: 'year',    label: 'This year',    short: 'YR', sub: '2026 · to date',     apiR: 1, appsR: 1 },
];
function periodDef(key) { return PR_PERIODS.find((p) => p.key === key) || PR_PERIODS[0]; }

// Windowed production for one roster agent at a period.
function prodFor(a, periodKey) {
  const p = periodDef(periodKey);
  const api = p.key === 'week' ? a.weekApi : Math.round(a.ytdApi * p.apiR);
  const apps = p.key === 'year' ? a.apps : Math.max(p.key === 'week' ? (a.weekApi > 8000 ? 2 : a.weekApi > 4000 ? 1 : 0) : Math.round(a.apps * p.appsR), 0);
  return { api, apps, pers: a.pers };
}

// ── Branch table for the Sales-Manager (agency) scope ──────────────────────
const PR_BRANCHES = [
  { name: 'South Branch',   mgr: 'Trevor Ramcharan', initials: 'SO', agents: 28, units: 3, ytdApi: 8_420_000, weekApi: 142_000, apps: 1184, pers: 87, goal: 12_000_000 },
  { name: 'North Branch',   mgr: 'Lystra Boodoo',    initials: 'NO', agents: 24, units: 3, ytdApi: 7_180_000, weekApi: 121_000, apps: 1042, pers: 89, goal: 10_500_000 },
  { name: 'East Branch',    mgr: 'Dexter Ramlogan',  initials: 'EA', agents: 18, units: 2, ytdApi: 5_240_000, weekApi: 96_000,  apps: 742,  pers: 85, goal: 8_000_000 },
  { name: 'Central Branch', mgr: 'Anisa Mohammed',   initials: 'CE', agents: 14, units: 2, ytdApi: 3_960_000, weekApi: 72_000,  apps: 561,  pers: 88, goal: 6_400_000 },
];
function branchProd(b, periodKey) {
  const p = periodDef(periodKey);
  const api = p.key === 'week' ? b.weekApi : Math.round(b.ytdApi * p.apiR);
  const apps = p.key === 'year' ? b.apps : Math.round(b.apps * p.appsR);
  return { api, apps, pers: b.pers };
}

// ── TimePeriodToggle ───────────────────────────────────────────────────────
function TimePeriodToggle({ t, active = 'week' }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
      {PR_PERIODS.map((p) => {
        const on = p.key === active;
        return (
          <div key={p.key} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', whiteSpace: 'nowrap' }}>{p.label}</div>
        );
      })}
    </div>
  );
}

// ── DataSourceBadge ────────────────────────────────────────────────────────
function DataSourceBadge({ t, period = 'week' }) {
  const live = period === 'week';
  const fg = live ? t.warning : t.success;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: fg }}></span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
        {live ? 'PROVISIONAL · UPDATES LIVE' : 'SETTLED · SYNCED MON 30 NOV 6:00 AM'}
      </span>
    </div>
  );
}

// ── Download button ────────────────────────────────────────────────────────
function DownloadReportBtn({ t, label = 'Download report' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, boxShadow: `0 3px 10px ${t.teal}44`, whiteSpace: 'nowrap' }}>
      <IconDownload size={14} color="#fff" /> {label}
    </div>
  );
}

// ── Totals strip — period-scoped scorecards ────────────────────────────────
function ProdTotals({ t, items }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
      {items.map((m) => (
        <div key={m.k} className="a-rise" style={{ flex: 1, padding: '13px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: m.accent || t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
            <div style={{ fontSize: 27, fontWeight: 700, color: m.color || t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{m.v}</div>
            {m.sub && <div style={{ fontSize: 11.5, color: t.inkMute }}>{m.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ProductionTable ────────────────────────────────────────────────────────
// rows: [{ rank, name, unit, initials, apps, api, pers, flag, me }]
const PR_GRID = '40px 1.7fr 96px 1.3fr 96px 116px';

function ProductionTable({ t, rows, period, maxApi, highlightMe }) {
  return (
    <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* head */}
      <div style={{ display: 'grid', gridTemplateColumns: PR_GRID, background: t.surfaceSoft, borderBottom: `1px solid ${t.ruleStrong}`, flexShrink: 0 }}>
        {['#', 'AGENT · UNIT', 'APPS', 'NEW API', 'PERSISTENCY', 'STATUS'].map((h, i) => (
          <div key={h} style={{ padding: '11px 14px', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, textAlign: i >= 2 && i <= 4 ? 'right' : i === 5 ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>
      {/* rows */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.map((r, i) => {
          const pill = flagPill(t, r.flag);
          const me = highlightMe && r.me;
          const persC = r.pers >= 90 ? t.success : r.pers >= 80 ? t.ink : t.warning;
          return (
            <div key={r.name} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: PR_GRID, alignItems: 'center', borderBottom: i < rows.length - 1 ? `1px solid ${t.rule}` : 'none', background: me ? t.tealTint + '66' : (i % 2 ? t.surfaceRaised : 'transparent') }}>
              <div style={{ padding: '0 14px', fontSize: 13, fontWeight: 800, color: r.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{r.rank}</div>
              <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: me ? t.teal : t.tealTint, color: me ? '#fff' : t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: me ? 800 : 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}{me ? ' · You' : ''}</div>
                  <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{r.unit}</div>
                </div>
              </div>
              <div style={{ padding: '0 14px', textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO }}>{r.apps}</div>
              {/* API with mini bar */}
              <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: 90, height: 5, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(4, Math.round((r.api / maxApi) * 100))}%`, height: 5, background: r.rank <= 3 ? t.gold : t.teal, borderRadius: 999 }}></div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, minWidth: 52, textAlign: 'right' }}>{ttd(r.api)}</div>
              </div>
              <div style={{ padding: '0 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: persC, fontFamily: APP_FONT_MONO }}>{r.pers}%</div>
              <div style={{ padding: '0 14px', textAlign: 'right' }}>
                <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase', color: pill.fg, background: pill.bg }}>{pill.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Branch table (Sales-Manager scope) ─────────────────────────────────────
const PRB_GRID = '40px 1.8fr 88px 96px 1.3fr 110px';
function BranchTable({ t, rows, maxApi }) {
  return (
    <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: PRB_GRID, background: t.surfaceSoft, borderBottom: `1px solid ${t.ruleStrong}`, flexShrink: 0 }}>
        {['#', 'BRANCH · MANAGER', 'AGENTS', 'APPS', 'NEW API', 'PERSISTENCY'].map((h, i) => (
          <div key={h} style={{ padding: '11px 14px', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.map((r, i) => {
          const persC = r.pers >= 90 ? t.success : r.pers >= 85 ? t.ink : t.warning;
          return (
            <div key={r.name} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: PRB_GRID, alignItems: 'center', borderBottom: i < rows.length - 1 ? `1px solid ${t.rule}` : 'none', background: r.me ? t.tealTint + '66' : (i % 2 ? t.surfaceRaised : 'transparent') }}>
              <div style={{ padding: '0 14px', fontSize: 13, fontWeight: 800, color: r.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{r.rank}</div>
              <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: r.me ? t.teal : t.tealTint, color: r.me ? '#fff' : t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: r.me ? 800 : 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}{r.me ? ' · Yours' : ''}</div>
                  <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{r.mgr} · {r.units} units</div>
                </div>
              </div>
              <div style={{ padding: '0 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{r.agents}</div>
              <div style={{ padding: '0 14px', textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO }}>{r.apps}</div>
              <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: 110, height: 5, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(4, Math.round((r.api / maxApi) * 100))}%`, height: 5, background: r.rank <= 3 ? t.gold : t.teal, borderRadius: 999 }}></div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, minWidth: 54, textAlign: 'right' }}>{ttd(r.api)}</div>
              </div>
              <div style={{ padding: '0 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: persC, fontFamily: APP_FONT_MONO }}>{r.pers}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RankedLeaderboard (right rail) ─────────────────────────────────────────
function RankedLeaderboard({ t, title, rows }) {
  return (
    <div style={{ width: 300, flexShrink: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <IconTrophy size={15} color={t.gold} />
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{title}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.slice(0, 5).map((r, i) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: i === 0 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{i + 1}</div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: i === 0 ? t.goldTint : t.tealTint, color: i === 0 ? t.gold : t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{r.unit || r.mgr}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{ttd(r.api)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  pk, PR_PERIODS, periodDef, prodFor, PR_BRANCHES, branchProd,
  TimePeriodToggle, DataSourceBadge, DownloadReportBtn, ProdTotals,
  ProductionTable, BranchTable, RankedLeaderboard,
});
