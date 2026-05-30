// Persistency v2 — composed scenes (desktop + mobile).
//
// Desktop: ManagerShell → reality bar · at-risk lead · roster. Drawer states:
//   'entry'      → PersEntryForm (manager entry, precedence lock)
//   'playground' → PersPlayground (what-if coaching)
// Mobile: reality mini · at-risk · roster cards. sheet = 'entry' | 'playground'.

function PersistencyDesktopScene({ t, drawer = null }) {
  return (
    <ManagerShell t={t} active="persistency" title="Persistency" subtitle={`${MGR.branch} · ${PERS_MONTH} · ${PERS_ROWS.length} agents`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        <PersReality t={t} />
        <PersAtRisk t={t} />
        <PersRoster t={t} />

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
              {drawer === 'playground' ? <PersPlayground t={t} /> : <PersEntryForm t={t} />}
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
function PersistencyMobileScene({ t, sheet = null }) {
  const band = persBand(t, PERS_AGG);
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Persistency" sub={PERS_MONTH.toUpperCase()} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Reality mini */}
          <div className="a-card a-rise" style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>BRANCH PERSISTENCY</div>
              <ScopeSwitch t={t} active="branch" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: band.fg, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>{PERS_AGG}%</div>
              <div style={{ paddingBottom: 4 }}><MgrSpark color={band.fg} values={PERS_TREND} width={70} height={26} /></div>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              {[
                { k: 'Below floor', v: PERS_BELOW_FLOOR.length, c: t.danger },
                { k: '≥90% eligible', v: PERS_ELIGIBLE, c: t.success },
                { k: 'Lapses', v: ttd(PERS_LAPSES), c: t.ink },
              ].map((m) => (
                <div key={m.k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.c }}></div>
                  <span style={{ fontSize: 11, color: t.inkMute }}><b style={{ color: t.ink }}>{m.v}</b> {m.k}</span>
                </div>
              ))}
            </div>
          </div>

          {/* At risk */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.danger, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>★ Below floor · {PERS_BELOW_FLOOR.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PERS_BELOW_FLOOR.map((r) => <PersMobileCard key={r.name} t={t} r={r} />)}
            </div>
          </div>

          {/* Roster */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>All agents</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {PERS_ROWS.filter((r) => r.pct >= PERS_FLOOR).slice(0, 6).map((r) => <PersMobileCard key={r.name} t={t} r={r} />)}
            </div>
          </div>
        </div>
      </MContent>
      <ManagerMNav t={t} active="home" />

      {sheet && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 25, animation: 'app-fade-in 240ms ease both' }}></div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 700, background: t.surface,
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
            {sheet === 'entry' ? <PersEntryForm t={t} /> : <PersPlayground t={t} />}
          </div>
        </>
      )}
    </MFrame>
  );
}

Object.assign(window, { PersistencyDesktopScene, PersistencyMobileScene });
