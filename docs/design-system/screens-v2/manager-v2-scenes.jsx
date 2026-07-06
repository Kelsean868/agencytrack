// Manager Dashboard v2 — composed scenes (desktop + mobile).
//
// Desktop: ManagerShell → greeting row · AnchorStrip · KpiStrip · two-column
//   (exception triage | recognition + recent). Drawer states:
//     drawer = null | 'drill' (agent coaching) | 'recommend' (manager action).
// Mobile: MFrame manager dashboard; sheet = null | 'drill' (bottom sheet).

// Desktop close pill (matches the agent-surface drill grammar).
function MgrClosePill({ t }) {
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px 8px 10px',
      background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 999, cursor: 'pointer',
      color: t.ink, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', fontFamily: APP_FONT_SANS,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      Close
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DESKTOP SCENE
// ──────────────────────────────────────────────────────────────────────────
function ManagerDesktopScene({ t, drawer = null, drillTab = 'overview', umView = false }) {
  const persona = umView ? UM_PERSONA : MGR;
  const unitExc = EXCEPTIONS.filter((e) => e.unit === 'S·02');
  return (
    <ManagerShell t={t} active="home" persona={persona} teamView={umView}
      title={umView ? 'Unit Dashboard' : 'Dashboard'}
      subtitle={`${persona.branch} · ${persona.name} · ${persona.week}`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>

        {/* Greeting + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>{umView ? 'Good morning, Riaz.' : 'Good morning, Trevor.'}</div>
            <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 3 }}>{umView ? `${UNIT_ANCHOR.needAttention} of your ${UNIT_ANCHOR.agents} agents need attention — plus your own week.` : `${ANCHOR.needAttention} agents need attention before tomorrow's stand-up.`}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '9px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: t.ink, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <IconDownload size={14} color={t.inkMute} /> Export branch
            </div>
            <div style={{ padding: '9px 16px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: `0 2px 6px ${t.teal}44` }}>
              <IconPlus size={14} color="#fff" stroke={2.4} /> Start meeting
            </div>
          </div>
        </div>

        {/* Anchor — your reality first */}
        <AnchorStrip t={t} variant={umView ? 'unit' : 'branch'} />

        {/* KPI scorecards */}
        <KpiStrip t={t} />

        {/* Two-column: exception triage (lead) | my-week + recognition */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>
          <ExceptionList t={t} items={umView ? unitExc : EXCEPTIONS} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflowY: 'auto' }}>
            <MyWeekPanel t={t} me={umView ? MY_WEEK_UM : MY_WEEK_BM} />
            <ChampionsPanel t={t} />
          </div>
        </div>

        {/* Drill / action drawer */}
        {drawer && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)', animation: 'app-fade-in 280ms ease both', zIndex: 20 }}></div>
            <div className="a-card" style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, width: 468,
              background: t.surface, borderLeft: `1px solid ${t.rule}`,
              boxShadow: t.mode === 'light' ? '-12px 0 32px rgba(40,37,29,0.08)' : '-12px 0 32px rgba(0,0,0,0.5)',
              zIndex: 21, display: 'flex', flexDirection: 'column',
              animation: 'kiosk-slide-r 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            }}>
              <MgrClosePill t={t} />
              {drawer === 'recommend' ? <RecommendGoal t={t} /> : <AgentDrill t={t} tab={drillTab} />}
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE — anchor mini + exception stack + KPI 2×2 + champions
// ──────────────────────────────────────────────────────────────────────────
function MgrAnchorMobile({ t }) {
  const pct = Math.round((ANCHOR.ytdApi / ANCHOR.branchGoal) * 100);
  return (
    <div className="a-card a-rise" style={{ position: 'relative', overflow: 'hidden', padding: '16px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
      <div className="a-glow-soft" style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: t.teal, fontFamily: APP_FONT_MONO }}>YTD SETTLED API</div>
          <ScopeSwitch t={t} active="branch" />
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 8 }}>{ttd(ANCHOR.ytdApi)}</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 5 }}>{pct}% of {ttd(ANCHOR.branchGoal)} branch goal · {ANCHOR.weeksLeft}w left</div>
        <div style={{ marginTop: 12, height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${pct}%`, height: 6, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ flex: 1, padding: '9px 11px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.success, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{ANCHOR.onPace}<span style={{ fontSize: 11, color: t.inkMute, fontWeight: 600 }}> / {ANCHOR.agents}</span></div>
            <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 1 }}>on pace</div>
          </div>
          <div style={{ flex: 1, padding: '9px 11px', background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{ANCHOR.needAttention}</div>
            <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 1 }}>need attention</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MgrExceptionMobileRow({ t, e, onDrill }) {
  const fg = e.tone === 'danger' ? t.danger : t.warning;
  const bg = e.tone === 'danger' ? t.dangerTint : t.warningTint;
  const Ico = ICONS[e.icon] || IconAlert;
  return (
    <div onClick={onDrill} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: bg, border: `1px solid ${fg}33`, borderRadius: 11 }}>
      <div className="a-breathe" style={{ width: 30, height: 30, borderRadius: '50%', background: t.surface, border: `1px solid ${fg}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ico size={14} color={fg} stroke={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: fg, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{e.kind.toUpperCase()}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 1 }}>{e.name}</div>
        <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.detail}</div>
      </div>
      <IconChevR size={14} color={t.inkFaint} stroke={2.4} />
    </div>
  );
}

function ManagerMobileScene({ t, sheet = null, sheetTab = 'overview' }) {
  return (
    <MFrame t={t}>
      <MHeader t={t} title={MGR.branch} sub="THU · 26 NOV" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MgrAnchorMobile t={t} />

          {/* Needs attention */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>★ Needs attention · {EXCEPTIONS.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EXCEPTIONS.slice(0, 4).map((e) => <MgrExceptionMobileRow key={e.id} t={t} e={e} />)}
            </div>
          </div>

          {/* KPI 2×2 */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>This week · branch</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {[
                { eyebrow: 'WEEKLY API', value: ttd(ANCHOR.weekApi), sub: '+14% vs last', accent: t.teal },
                { eyebrow: 'APPS',       value: ANCHOR.weekApps,     sub: 'this week',    accent: t.gold },
                { eyebrow: 'PERSISTENCY',value: '89%',               sub: '4pp above',    accent: t.success },
                { eyebrow: 'COMPLIANCE', value: '92%',               sub: '26 of 28',     accent: t.success },
              ].map((k, i) => (
                <div key={i} style={{ padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: k.accent, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{k.eyebrow}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 6 }}>{k.value}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* My week — the manager also sells (mobile) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>My week</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal }}>File my WAR →</div>
            </div>
            <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>MY API · WK</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 3 }}>{ttd(MY_WEEK_BM.apiWeek)}</div>
                </div>
                <div style={{ flex: 1, paddingBottom: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: t.inkMute, fontFamily: APP_FONT_MONO, marginBottom: 3 }}>
                    <span>{ttd(MY_WEEK_BM.apiYtd)} YTD</span><span>79%</span>
                  </div>
                  <div style={{ height: 5, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                    <div className="a-progress-grow" style={{ width: '79%', height: 5, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 9.5, color: t.inkFaint, fontStyle: 'italic', marginTop: 8 }}>Tracked separately — not in unit totals.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.rule}` }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>MY WAR</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>{MY_WEEK_BM.warDone}/{MY_WEEK_BM.warTotal} done</span>
                <div style={{ flex: 1 }}></div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: t.success }}>✓ filed</span>
              </div>
            </div>
          </div>

          {/* Champions */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.gold, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>★ This week's champions</div>
            <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, overflow: 'hidden' }}>
              {CHAMPIONS.map((c, i, arr) => (
                <div key={c.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none' }}>
                  <div style={{ width: 20, textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{c.rank}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.goldTint, color: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY }}>{c.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{c.unit}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{ttd(c.api)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MContent>
      <ManagerMNav t={t} active="home" />

      {/* Bottom sheet — agent coaching drill */}
      {sheet && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 25, animation: 'app-fade-in 240ms ease both' }}></div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 680, background: t.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTop: `1px solid ${t.rule}`,
            boxShadow: '0 -12px 32px rgba(0,0,0,0.25)', zIndex: 26, display: 'flex', flexDirection: 'column',
            animation: 'kiosk-rise 320ms cubic-bezier(0.34, 1, 0.64, 1) both', overflow: 'hidden',
          }}>
            <div style={{ position: 'relative', padding: '12px 16px 6px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, background: t.inkDim, borderRadius: 999, margin: '0 auto' }}></div>
              <div style={{ position: 'absolute', top: 8, right: 12, width: 32, height: 32, borderRadius: '50%', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
            <AgentDrill t={t} tab={sheetTab} />
          </div>
        </>
      )}
    </MFrame>
  );
}

Object.assign(window, { MgrClosePill, ManagerDesktopScene, MgrAnchorMobile, MgrExceptionMobileRow, ManagerMobileScene });
