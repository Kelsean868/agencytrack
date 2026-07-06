// Goals v2 — composed scenes (desktop + mobile).
//
// Desktop: ManagerShell → GoalCascade anchor · sub-tab pills · sub-tab body.
//   subTab = agents | unit | branch | sm | self. drawer='recommend' reuses
//   RecommendGoal (manager-v2-drill) — the recommend-vs-lock target setter.
// Mobile: cascade mini · agent goal cards. sheet='recommend'.

function GoalsDesktopScene({ t, subTab = 'agents', drawer = null }) {
  return (
    <ManagerShell t={t} active="goals" title="Goals" subtitle={`${MGR.branch} · 2026 cascade · ${GOAL_ROWS.length} agents`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        <GoalCascade t={t} />
        <GoalSubTabs t={t} active={subTab} />
        {subTab === 'agents' ? <AgentGoalsList t={t} />
          : subTab === 'self' ? <SelfGoalCard t={t} />
          : <TierGoalForm t={t} tier={subTab} />}

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
              <RecommendGoal t={t} />
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
function GoalsMobileScene({ t, sheet = null }) {
  const ordered = [...GOAL_ROWS].sort((a, b) => {
    const rank = { below: 0, unset: 1, above: 2 };
    return rank[goalStatus(a)] - rank[goalStatus(b)];
  });
  // Compact cascade for mobile: the manager's tier + neighbours.
  const nodes = CASCADE;
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Goals" sub="2026 CASCADE" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Cascade mini — vertical */}
          <div className="a-card a-rise" style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 10 }}>GOAL CASCADE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {nodes.map((n) => {
                const pct = Math.round((n.ytd / n.target) * 100);
                const barC = n.floor ? t.warning : n.me ? t.teal : t.inkMute;
                return (
                  <div key={n.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: n.me ? t.tealTint : t.surfaceSoft, border: `1px solid ${n.me ? t.teal + '44' : t.rule}`, borderRadius: 9 }}>
                    <div style={{ width: 78, flexShrink: 0, fontSize: 10, fontWeight: 700, color: n.me ? t.teal : t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                        <div className="a-progress-grow" style={{ width: `${Math.min(100, pct)}%`, height: 4, background: barC, borderRadius: 999 }}></div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{ttd(n.target)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Below-floor / not-set lead */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>★ Below floor / unset · {GOAL_BELOW + GOAL_UNSET}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ordered.filter((r) => goalStatus(r) !== 'above').map((r) => <GoalMobileCard key={r.name} t={t} r={r} />)}
            </div>
          </div>

          {/* Above floor */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>On target</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {ordered.filter((r) => goalStatus(r) === 'above').slice(0, 5).map((r) => <GoalMobileCard key={r.name} t={t} r={r} />)}
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
            <RecommendGoal t={t} />
          </div>
        </>
      )}
    </MFrame>
  );
}

Object.assign(window, { GoalsDesktopScene, GoalsMobileScene });
