// AgencyTrack — Weekly WARs v2. Mobile manager surface (390×844).
//   Tabbed: "My WAR" (file my own) and "Team" (review status). Uses MFrame +
//   ManagerMNav. teal = ops · gold = streak/recognition.

function WarMobileScene({ t, view = 'mine' }) {
  return (
    <MFrame t={t}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 18px 0', background: t.surface, borderBottom: `1px solid ${t.rule}`, zIndex: 10 }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>Weekly WARs</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>Week 48 · {WAR_FILED}/{WAR_TEAM.length} filed · {WAR_PENDING_REVIEW} to review</div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, marginTop: 12, marginBottom: 12 }}>
          {[['mine', 'My WAR'], ['team', `Team · ${WAR_TEAM.length}`]].map(([k, l]) => {
            const on = k === view;
            return (
              <div key={k} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent' }}>{l}</div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ position: 'absolute', top: 168, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {view === 'mine' ? <MyWarMobile t={t} /> : <TeamWarMobile t={t} />}
      </div>

      <ManagerMNav t={t} active="more" />
    </MFrame>
  );
}

function MyWarMobile({ t }) {
  const w = MY_WAR;
  const pct = warCompletion(w.kpis);
  return (
    <>
      <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '17px 18px', background: t.surface, border: `1px solid ${t.teal}44`, borderRadius: 17 }}>
        <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -50, width: 220, height: 220, background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13 }}>
          <CompletionRing t={t} pct={pct} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <WAREyebrow t={t} color={t.teal}>My WAR · {w.week}</WAREyebrow>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>Leadership activities</div>
          </div>
          <WarStatusPill t={t} status={w.status} />
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 14 }}>
          {[['MY API', ttd(w.prod.apiWeek), t.ink, t.surfaceSoft], ['APPS', w.prod.apps, t.ink, t.surfaceSoft], ['STREAK', `${w.streak}w`, t.gold, t.goldTint]].map(([k, v, c, bg]) => (
            <div key={k} style={{ flex: 1, padding: '9px 11px', background: bg, border: `1px solid ${c === t.gold ? t.gold + '33' : t.rule}`, borderRadius: 10 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: c === t.gold ? t.gold : t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c, fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <WAREyebrow t={t} color={t.inkFaint}>Managerial KPIs</WAREyebrow>
          <span style={{ fontSize: 9.5, color: t.inkFaint, fontStyle: 'italic' }}>no minimums set yet</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {WAR_KPIS.map((k) => {
            const v = w.kpis[k.key];
            const isCheck = k.kind === 'check';
            const met = isCheck ? !!v : (k.target != null ? v >= k.target : v > 0);
            const fg = met ? t.success : v > 0 ? t.warning : t.inkFaint;
            return (
              <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: t.surface, border: `1px solid ${met ? fg + '44' : t.rule}`, borderRadius: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: fg, flexShrink: 0 }}></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{k.label}</div>
                  <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 1 }}>{k.hint}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>
                  {isCheck ? (met ? '✓' : '·') : <>{v}<span style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{k.target != null ? `/${k.target}` : ''}</span></>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: t.teal, color: '#fff', borderRadius: 13, fontSize: 14, fontWeight: 700, boxShadow: `0 4px 14px ${t.teal}44`, marginTop: 2 }}>
        <IconCheck size={16} color="#fff" stroke={2.4} /> Submit my WAR
      </div>
    </>
  );
}

function TeamWarMobile({ t }) {
  return (
    <>
      {WAR_TEAM.map((m) => {
        const pct = warCompletion(m.kpis);
        const filed = m.status === 'filed';
        const sm = warStatusMeta(t, m.status);
        return (
          <div key={m.name} className="a-card" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', background: t.surface, border: `1px solid ${m.status === 'missing' ? t.danger + '33' : t.rule}`, borderRadius: 14 }}>
            {filed ? <CompletionRing t={t} pct={pct} size={40} stroke={4.5} /> : (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {m.status === 'draft' ? <IconClock size={17} color={sm.fg} /> : <IconAlert size={17} color={sm.fg} />}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{m.name}</div>
              <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{m.role} · {m.unit}</div>
              <div style={{ marginTop: 7 }}><StreakDots t={t} history={WAR_HISTORY[m.name]} label={false} /></div>
            </div>
            {filed && !m.reviewed ? (
              <span style={{ padding: '7px 13px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>Review</span>
            ) : <WarStatusPill t={t} status={m.status} />}
          </div>
        );
      })}
    </>
  );
}

Object.assign(window, { WarMobileScene, MyWarMobile, TeamWarMobile });
