// History v2 — scenes (desktop + mobile + manager view, 5 artboards).

function _recentWeeks(n = 6) {
  // Most recent first
  return [...HIST_WEEKS].sort((a, b) => b.week - a.week).slice(0, n);
}

function _prevWeek(w) {
  return HIST_WEEKS.find(x => x.week === w.week - 1) || null;
}

function _sparkValuesFor(week) {
  // 4 weeks trailing into the given week, oldest → most recent (exclusive)
  const start = Math.max(1, week.week - 4);
  return HIST_WEEKS.filter(w => w.week >= start && w.week < week.week).map(w => w.api);
}

// ──────────────────────────────────────────────────────────────────────────
// Desktop scene
// ──────────────────────────────────────────────────────────────────────────
function HistoryDesktopScene({ t, drawerWeek = null, managerView = false }) {
  const recent = _recentWeeks(5);
  const week = drawerWeek ? HIST_WEEKS.find(w => w.week === drawerWeek) : null;
  const prevW = week ? _prevWeek(week) : null;

  const title = managerView ? `${HIST_AGENT} · History` : 'History';
  const sub   = managerView
    ? `Viewing as ${HIST_MANAGER.name} · ${HIST_MANAGER.role.toLowerCase()} · 2026`
    : `${HIST_AGENT} · 2026 · ${HIST_ANCHOR.weeksSubmitted} weeks on file`;

  return (
    <AppShell t={t} active="history" title={title} subtitle={sub}>
      <div style={{ height: '100%', position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Manager banner */}
          {managerView && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
              padding: '10px 16px',
              background: t.goldTint, border: `1px solid ${t.gold}55`, borderRadius: 11,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: t.gold, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY,
                flexShrink: 0,
              }}>TR</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>
                  Reviewing {HIST_AGENT.split(' ')[0]}'s submission history — you can unlock a week to let her resubmit.
                </div>
                <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
                  MANAGER VIEW · {HIST_MANAGER.name.toUpperCase()} · {HIST_MANAGER.role.toUpperCase()}
                </div>
              </div>
              <div style={{
                padding: '6px 12px', background: t.surface, border: `1px solid ${t.rule}`,
                borderRadius: 999, color: t.inkMute,
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                EXIT VIEW
              </div>
            </div>
          )}

          <HistoryAnchorStrip t={t} anchor={HIST_ANCHOR} year={2026} agent={HIST_AGENT} />

          {/* Year heatmap */}
          <div style={{
            padding: '14px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <Eyebrow t={t}>YEAR AT A GLANCE · TARGET {fmtTtdK(HIST_WEEK_TARGET)}/WK</Eyebrow>
              <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>HOVER A WEEK TO JUMP</span>
            </div>
            <YearHeatmap t={t} weeks={HIST_WEEKS} target={HIST_WEEK_TARGET} focusedWeek={drawerWeek} />
          </div>

          {/* Filter row */}
          <HistoryFilterRow t={t} />

          {/* Card feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recent.map((w, i) => (
              <WeekCard key={w.week}
                t={t} week={w} prevWeek={_prevWeek(w)}
                animClass={`a-fade-up a-d-${Math.min(i + 1, 8)}`}
                active={drawerWeek === w.week}
                sparkValues={_sparkValuesFor(w)} />
            ))}
          </div>
        </div>

        {/* Drill drawer */}
        {week && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)',
              animation: 'app-fade-in 280ms ease both', zIndex: 20,
            }}></div>
            <div className="a-card" style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 480, background: t.surface, borderLeft: `1px solid ${t.rule}`,
              boxShadow: t.mode === 'light'
                ? '-12px 0 32px rgba(40,37,29,0.08)'
                : '-12px 0 32px rgba(0,0,0,0.5)',
              zIndex: 21, display: 'flex', flexDirection: 'column',
              animation: 'kiosk-slide-r 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            }}>
              {/* Close strip */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                padding: '14px 14px 0', flexShrink: 0,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 14px 8px 10px',
                  background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                  borderRadius: 999, color: t.ink,
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Close
                </div>
              </div>
              <HistoryDrillContent t={t} week={week} prevWeek={prevW} managerView={managerView} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile scene
// ──────────────────────────────────────────────────────────────────────────
function HistoryMobileScene({ t, sheetWeek = null }) {
  const recent = _recentWeeks(4);
  const week = sheetWeek ? HIST_WEEKS.find(w => w.week === sheetWeek) : null;
  const prevW = week ? _prevWeek(week) : null;

  return (
    <MFrame t={t}>
      <MHeader t={t} title="History" sub={`2026 · WK ${HIST_ANCHOR.weeksSubmitted} OF 52`} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HistoryAnchorStrip t={t} anchor={HIST_ANCHOR} year={2026} agent={HIST_AGENT} mobile />

          {/* Compact filter (status only) */}
          <HistoryFilterRow t={t} mobile />

          {/* Card feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.map((w, i) => (
              <WeekCard key={w.week}
                t={t} week={w} prevWeek={_prevWeek(w)}
                animClass={`a-fade-up a-d-${Math.min(i + 1, 8)}`}
                sparkValues={_sparkValuesFor(w)}
                mobile />
            ))}
          </div>
        </div>
      </MContent>
      <MNav t={t} active="history" />

      {/* Bottom sheet */}
      {week && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.32)', zIndex: 25,
            animation: 'app-fade-in 240ms ease both',
          }}></div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 740, background: t.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderTop: `1px solid ${t.rule}`,
            boxShadow: '0 -12px 32px rgba(0,0,0,0.25)',
            zIndex: 26, display: 'flex', flexDirection: 'column',
            animation: 'kiosk-rise 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'relative', padding: '12px 16px 6px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, background: t.inkDim, borderRadius: 999, margin: '0 auto' }}></div>
              <div style={{
                position: 'absolute', top: 8, right: 12,
                width: 32, height: 32, borderRadius: '50%',
                background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.ink,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
            <HistoryDrillContent t={t} week={week} prevWeek={prevW} />
          </div>
        </>
      )}
    </MFrame>
  );
}

Object.assign(window, { HistoryDesktopScene, HistoryMobileScene });
