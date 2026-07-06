// Compliance v2 — composed scenes (desktop + mobile).
//
// Desktop: ManagerShell → reality bar · not-in lead · filing roster.
//   drawer='drill' reuses AgentDrill (defaulting to the Weekly tab — the
//   natural place to coach a late/missing filer).
// Mobile: MFrame → reality mini · not-in stack · filing cards. sheet='drill'.

function ComplianceDesktopScene({ t, drawer = null, drillTab = 'weekly' }) {
  return (
    <ManagerShell t={t} active="compliance" title="Compliance" subtitle={`${MGR.branch} · Week 48 · ${COMP_ROWS.length} agents`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        <ComplianceReality t={t} />
        <ComplianceLead t={t} />
        <ComplianceTable t={t} />

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
              <AgentDrill t={t} tab={drillTab} />
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE
// ──────────────────────────────────────────────────────────────────────────
function ComplianceMobileScene({ t, sheet = null, sheetTab = 'weekly' }) {
  const rows = COMP_ROWS;
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Compliance" sub={`WEEK 48 · ${FILED}/${COMP_ROWS.length} FILED`} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Reality mini */}
          <div className="a-card a-rise" style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>FILED THIS WEEK</div>
              <ScopeSwitch t={t} active="branch" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>{FILED}<span style={{ fontSize: 15, color: t.inkMute, fontWeight: 600 }}> / {COMP_ROWS.length}</span></div>
              <div style={{ fontSize: 12, color: t.inkMute }}>{FILED_PCT}% · closes Sun 30</div>
            </div>
            <div style={{ marginTop: 12, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
              <div className="a-progress-grow" style={{ width: `${(ONTIME / COMP_ROWS.length) * 100}%`, height: 7, background: t.success }}></div>
              <div style={{ width: `${(LATE / COMP_ROWS.length) * 100}%`, height: 7, background: t.warning }}></div>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              {[
                { k: 'On time', v: ONTIME, c: t.success },
                { k: 'Late', v: LATE, c: t.warning },
                { k: 'Not in', v: NOT_IN.length, c: t.danger },
              ].map((m) => (
                <div key={m.k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.c }}></div>
                  <span style={{ fontSize: 11, color: t.inkMute }}><b style={{ color: t.ink }}>{m.v}</b> {m.k}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Not in — lead */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>★ Not in yet · {NOT_IN.length}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.warning, display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconBell size={12} color={t.warning} /> Nudge all</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {NOT_IN.map((a) => <ComplianceMobileCard key={a.name} t={t} a={a} />)}
            </div>
          </div>

          {/* Full roster */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>All agents</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {rows.filter((a) => a.status === 'ontime' || a.status === 'late').slice(0, 6).map((a) => (
                <ComplianceMobileCard key={a.name} t={t} a={a} />
              ))}
            </div>
          </div>
        </div>
      </MContent>
      <ManagerMNav t={t} active="compliance" />

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

Object.assign(window, { ComplianceDesktopScene, ComplianceMobileScene });
