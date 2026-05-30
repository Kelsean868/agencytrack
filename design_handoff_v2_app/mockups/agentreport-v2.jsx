// Agent Report View v2 — the live, in-app performance report.
//
// The same content as the Agent Performance Report PDF, rendered as
// interactive app UI so it can be VIEWED in context (no download required),
// with "Download PDF" as a secondary action. One component reused in:
//   • manager drill-down (a "Report" tab on the coaching drawer)
//   • Meeting Mode 1-on-1 ("View full report")
//   • the agent's own dashboard
//   • mobile (bottom-sheet / full)
//
// layout: 'wide' (full-screen, 2-col) | 'narrow' (drawer / mobile, 1-col).
// Data: merges the RUN coaching record (act / ratios / spark / notes) with the
// ROSTER profile (ytd / persistency / conversion / tenure), and reuses the KPI
// rollup (resolveTiles) + TimePeriodToggle / DataSourceBadge / DownloadReportBtn.

const AR_FLOORS = { L1: 250_000, L2: 350_000, L3: 450_000, L4: 550_000 };

function arDeriveAct(ros) {
  const f = Math.max(0.18, ros.weekApi / 16000);
  return { calls: Math.round(58 * f) + 6, contacts: Math.round(38 * f) + 4, appts: Math.round(18 * f) + 2, interviews: Math.round(13 * f) + 1, factfinds: Math.round(9 * f) + 1, closing: Math.round(7 * f), clients: Math.max(0, Math.round(4 * f)), referrals: Math.round(96 * f) + 8 };
}

function arAgent(name) {
  const run = (typeof RUN !== 'undefined' ? RUN : []).find((r) => r.name === name);
  const ros = ROSTER.find((r) => r.name === name) || ROSTER[0];
  return {
    name, initials: ros.initials, unit: ros.unit, level: ros.level, flag: ros.flag,
    ytdApi: ros.ytdApi, ytdApps: ros.apps, pers: ros.pers, conv: ros.conv, weeks: ros.weeks,
    weekApi: run ? run.weekApi : ros.weekApi,
    weekApps: run ? run.apps : Math.max(0, Math.round(ros.apps / Math.max(1, ros.weeks))),
    act: run && run.act ? run.act : arDeriveAct(ros),
    ratios: run && run.ratios ? run.ratios : null,
    spark: run && run.spark ? run.spark : [ros.weekApi / 1000 * 0.7, ros.weekApi / 1000 * 0.8, ros.weekApi / 1000 * 0.9, ros.weekApi / 1000 * 0.85, ros.weekApi / 1000 * 0.95, ros.weekApi / 1000],
    headline: run ? run.headline : null, note: run ? run.note : null, evalNote: run ? run.evalNote : null,
    reason: run ? run.reason : null,
    flagLabel: run ? run.flagLabel : (ros.flag ? flagPill(MEETING_LIGHT, ros.flag).label : 'On track'),
    tone: run ? run.tone : (ros.flag === 'floor' ? 'danger' : ros.flag ? 'warning' : 'success'),
  };
}

function arWin(a, key) { return prodFor({ weekApi: a.weekApi, ytdApi: a.ytdApi, apps: a.ytdApps }, key); }

// ── small pieces ───────────────────────────────────────────────────────────
function ARStat({ t, k, v, sub, color }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{k}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: color || t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1 }}>{v}</div>
        {sub && <div style={{ fontSize: 11, color: t.inkMute }}>{sub}</div>}
      </div>
    </div>
  );
}

function ARCard({ t, title, right, children, style }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '15px 17px', ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function ARWindows({ t, a, period }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
      {PR_PERIODS.map((p) => {
        const w = arWin(a, p.key); const on = p.key === period;
        return (
          <div key={p.key} style={{ padding: '11px 12px', background: on ? t.tealTint : t.surfaceSoft, border: `1px solid ${on ? t.teal + '55' : t.rule}`, borderRadius: 10 }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: on ? t.teal : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{p.label.toUpperCase()}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{ttd(w.api)}</div>
            <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 1, fontFamily: APP_FONT_MONO }}>{w.apps} apps</div>
          </div>
        );
      })}
    </div>
  );
}

function ARRatios({ t, a }) {
  const r = a.ratios || [
    { label: 'Approach → FFI', value: '—', tone: 'mute' },
    { label: 'FFI → CI', value: '—', tone: 'mute' },
    { label: 'CI → App', value: '—', tone: 'mute' },
    { label: 'Closing ratio', value: `${a.conv}%`, tone: a.conv >= 70 ? 'success' : 'warning' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
      {r.map((rt) => {
        const c = rt.tone === 'success' ? t.success : rt.tone === 'warning' ? t.warning : rt.tone === 'mute' ? t.inkFaint : t.teal;
        return (
          <div key={rt.label} style={{ padding: '9px 11px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
            <div style={{ fontSize: 9.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{rt.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 2 }}>{rt.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function ARActivity({ t, a, density = 'condensed', compact }) {
  const tiles = resolveTiles(a.act, density);
  const perRow = compact ? 4 : (tiles.length <= 8 ? 4 : 5);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${perRow}, 1fr)`, gap: 9 }}>
      {tiles.map((k) => <ActivityTile key={k.key} t={t} kpi={k} actual={k.actual} />)}
    </div>
  );
}

function ARFloorBar({ t, a }) {
  const floor = AR_FLOORS[a.level];
  const pct = Math.min(100, Math.round((a.ytdApi / floor) * 100));
  const ok = a.ytdApi >= floor;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>YTD VS {a.level} TENURE FLOOR</div>
        <div style={{ fontSize: 12, color: t.inkMute }}>{ttd(a.ytdApi)} / {ttd(floor)}</div>
      </div>
      <div style={{ height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div className="a-progress-grow" style={{ width: `${pct}%`, height: 8, background: ok ? `linear-gradient(90deg, ${t.tealDark}, ${t.teal})` : t.warning, borderRadius: 999 }}></div>
      </div>
      <div style={{ fontSize: 11, color: ok ? t.success : t.warning, fontWeight: 600, marginTop: 7 }}>{ok ? `✓ ${pct}% — above floor` : `${pct}% — below floor`}</div>
    </div>
  );
}

function ARHeader({ t, a, period, onPeriod, layout }) {
  const fg = a.tone === 'danger' ? t.danger : a.tone === 'success' ? t.success : t.warning;
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
        <div style={{ width: layout === 'wide' ? 48 : 42, height: layout === 'wide' ? 48 : 42, borderRadius: '50%', background: `${fg}1f`, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: layout === 'wide' ? 17 : 15, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: layout === 'wide' ? 24 : 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{a.name}</div>
          <div style={{ fontSize: 12, color: t.inkMute, marginTop: 3 }}>{a.unit} · {a.level} · Performance report</div>
        </div>
        <span style={{ padding: '5px 11px', borderRadius: 999, background: `${fg}1f`, border: `1px solid ${fg}33`, fontSize: 10, fontWeight: 700, color: fg, fontFamily: APP_FONT_MONO, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{a.flagLabel}</span>
        <div style={{ flex: 1 }}></div>
        {layout === 'wide' && <DataSourceBadge t={t} period={period} />}
        <DownloadReportBtn t={t} label={layout === 'wide' ? 'Download PDF' : 'PDF'} />
      </div>
      <div style={{ marginTop: 13 }}>
        <TimePeriodToggle t={t} active={period} />
      </div>
    </div>
  );
}

// ── the view ─────────────────────────────────────────────────────────────
function AgentReportView({ t, name = 'Devin Lewis', period = 'month', layout = 'wide', density = 'condensed' }) {
  const a = arAgent(name);
  const w = arWin(a, period);
  const fg = a.tone === 'danger' ? t.danger : a.tone === 'success' ? t.success : t.warning;

  if (layout === 'wide') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <ARHeader t={t} a={a} period={period} layout="wide" />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 13 }}>
          {/* Left */}
          <div style={{ flex: 1.2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
            <ARCard t={t} style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 30 }}>
                <ARStat t={t} k="NEW API" v={ttd(w.api)} />
                <ARStat t={t} k="APPLICATIONS" v={w.apps} />
                <ARStat t={t} k="PERSISTENCY" v={`${a.pers}%`} color={a.pers >= 90 ? t.success : a.pers >= 80 ? t.ink : t.warning} />
                <div style={{ flex: 1 }}></div>
                <ARStat t={t} k="CLOSING RATIO" v={`${a.conv}%`} color={a.conv >= 70 ? t.success : t.ink} />
              </div>
            </ARCard>
            <div style={{ flexShrink: 0 }}><ARWindows t={t} a={a} period={period} /></div>
            <ARCard t={t} title={`THIS WEEK'S ACTIVITY · VS COMPANY FLOOR · ${KPI_DENSITY_LABEL[density].toUpperCase()}`} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '100%' }}><ARActivity t={t} a={a} density={density} /></div>
              </div>
            </ARCard>
          </div>
          {/* Right */}
          <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
            <ARCard t={t} title="6-WEEK API TRAJECTORY" style={{ flexShrink: 0 }}>
              <BigSpark color={fg} values={a.spark} width={324} height={70} />
            </ARCard>
            <ARCard t={t} title="COACHING RATIOS" style={{ flexShrink: 0 }}>
              <ARRatios t={t} a={a} />
            </ARCard>
            <ARCard t={t} style={{ flexShrink: 0 }}><ARFloorBar t={t} a={a} /></ARCard>
            {a.note && (
              <div style={{ flex: 1, minHeight: 0, padding: '14px 16px', background: t.goldTint, border: `1px solid ${t.gold}44`, borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <IconShield size={13} color={t.gold} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>COACHING NOTE</div>
                </div>
                <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.5 }}>{a.note}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // narrow (drawer / mobile) — single column
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <ARHeader t={t} a={a} period={period} layout="narrow" />
      <ARCard t={t} style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <ARStat t={t} k="NEW API" v={ttd(w.api)} />
          <ARStat t={t} k="APPS" v={w.apps} />
          <ARStat t={t} k="PERS" v={`${a.pers}%`} color={a.pers >= 90 ? t.success : a.pers >= 80 ? t.ink : t.warning} />
        </div>
      </ARCard>
      <ARWindows t={t} a={a} period={period} />
      <ARCard t={t} title={`ACTIVITY · ${KPI_DENSITY_LABEL[density].toUpperCase()}`}><ARActivity t={t} a={a} density={density} compact /></ARCard>
      <ARCard t={t} title="6-WEEK API TRAJECTORY"><BigSpark color={fg} values={a.spark} width={layout === 'mobile' ? 320 : 480} height={60} /></ARCard>
      <ARCard t={t} title="COACHING RATIOS"><ARRatios t={t} a={a} /></ARCard>
      <ARCard t={t}><ARFloorBar t={t} a={a} /></ARCard>
      {a.note && (
        <div style={{ padding: '13px 15px', background: t.goldTint, border: `1px solid ${t.gold}44`, borderRadius: 13 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginBottom: 6 }}>COACHING NOTE</div>
          <div style={{ fontSize: 12.5, color: t.ink, lineHeight: 1.5 }}>{a.note}</div>
        </div>
      )}
    </div>
  );
}

// ── drill-down drawer chrome with a Report tab (manager context) ───────────
function AgentReportDrawer({ t, name = 'Devin Lewis', period = 'month' }) {
  const tabs = ['Overview', 'Weekly', 'Goals', 'Notes', 'Joint Work', 'Report'];
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(3px)', zIndex: 20 }}></div>
      <div className="a-card" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 560, background: t.surface, borderLeft: `1px solid ${t.rule}`, boxShadow: t.mode === 'light' ? '-12px 0 32px rgba(40,37,29,0.10)' : '-12px 0 32px rgba(0,0,0,0.55)', zIndex: 21, display: 'flex', flexDirection: 'column', animation: 'kiosk-slide-r 320ms cubic-bezier(0.34,1,0.64,1) both' }}>
        <MgrClosePill t={t} />
        {/* tab strip */}
        <div style={{ display: 'flex', gap: 2, padding: '0 16px', borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
          {tabs.map((tb) => {
            const on = tb === 'Report';
            return (
              <div key={tb} style={{ padding: '11px 12px', fontSize: 12, fontWeight: 700, color: on ? t.teal : t.inkMute, borderBottom: on ? `2px solid ${t.teal}` : '2px solid transparent', whiteSpace: 'nowrap' }}>{tb}</div>
            );
          })}
        </div>
        {/* report body (scrolls) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px' }}>
          <AgentReportView t={t} name={name} period={period} layout="narrow" />
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  AR_FLOORS, arAgent, arWin, AgentReportView, AgentReportDrawer,
  ARStat, ARCard, ARWindows, ARRatios, ARActivity, ARFloorBar, ARHeader,
});
