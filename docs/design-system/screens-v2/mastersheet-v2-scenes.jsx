// Master Sheet v2 — composed scenes (desktop + mobile).
//
// Desktop: ManagerShell → reality bar · action bar · table. States:
//   exceptionsOn (filter to flagged rows) · drawer ('drill' reuses AgentDrill).
// Mobile: MFrame card list; sheet='drill' raises the coaching bottom sheet.

function MasterDesktopScene({ t, exceptionsOn = false, drawer = null, drillTab = 'overview', preset = 'production', period = 'week' }) {
  const allView = preset === 'all';
  return (
    <ManagerShell t={t} active="sheet" title="Master Sheet" subtitle={`${MGR.branch} · Week 48 · ${ROSTER.length} agents`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        <MasterReality t={t} period={allView ? period : null} />
        <MasterActionBar t={t} exceptionsOn={exceptionsOn} preset={preset} />
        {allView ? <MasterMatrix t={t} period={period} exceptionsOn={exceptionsOn} /> : <MasterTable t={t} exceptionsOn={exceptionsOn} />}

        {/* Row drill → the shared 5-tab coaching drawer */}
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
// MOBILE — preset row + exceptions toggle + card list
// ──────────────────────────────────────────────────────────────────────────
function MasterMobileScene({ t, exceptionsOn = false, sheet = null, sheetTab = 'overview' }) {
  const presets = ['All', 'Prod.', 'Recruit.', 'Compl.', 'Pers.'];
  const rows = ROSTER.map((a, i) => ({ ...a, rank: i + 1 }));
  const shown = exceptionsOn ? rows.filter((a) => a.flag) : rows;
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Master Sheet" sub={`WEEK 48 · ${ROSTER.length} AGENTS`} />
      <MContent headerHeight={140}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
          {/* Presets */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, flexShrink: 0 }}>
            {presets.map((p, i) => (
              <div key={p} style={{
                flex: 1, padding: '6px 4px', borderRadius: 7, fontSize: 11, fontWeight: 700, textAlign: 'center',
                background: i === 1 ? t.surface : 'transparent', color: i === 1 ? t.ink : t.inkMute,
                border: i === 1 ? `1px solid ${t.rule}` : '1px solid transparent',
                boxShadow: i === 1 ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              }}>{p}</div>
            ))}
          </div>

          {/* Exceptions toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', background: exceptionsOn ? t.warningTint : t.surface, border: `1px solid ${exceptionsOn ? t.warning + '44' : t.rule}`, borderRadius: 9, flexShrink: 0 }}>
            <div style={{ width: 28, height: 16, background: exceptionsOn ? t.warning : t.inkDim, borderRadius: 999, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, [exceptionsOn ? 'right' : 'left']: 2, width: 12, height: 12, borderRadius: '50%', background: t.surface }}></div>
            </div>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: exceptionsOn ? t.warning : t.inkMute, letterSpacing: '0.04em' }}>Show only exceptions</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: exceptionsOn ? t.warning : t.inkFaint, fontFamily: APP_FONT_MONO }}>{EXC_COUNT}</div>
          </div>

          {/* Cards */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {shown.map((a) => (
              <MasterMobileCard key={a.name} t={t} a={a} rank={a.rank} onDrill={() => {}} />
            ))}
          </div>
        </div>
      </MContent>
      <ManagerMNav t={t} active="sheet" />

      {/* Coaching bottom sheet */}
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

Object.assign(window, { MasterDesktopScene, MasterMobileScene });
