// AgencyTrack — Meeting Mode v2. Mobile presenter remote.
//
// The manager runs the projected stand-up from their phone: see what's on
// screen, who's next, advance/retreat, peek the presenter note the room
// can't see, and fire a quick action on the current agent. Big tap targets.

function MeetingRemote({ t, current = 'devin' }) {
  const r = RUN.find((x) => x.id === current) || RUN[0];
  const idx = stepOf('agent:' + r.id);
  const next = RUN[RUN.findIndex((x) => x.id === r.id) + 1];
  const fg = r.tone === 'danger' ? t.danger : r.tone === 'success' ? t.success : t.warning;
  const pct = Math.round((idx / (MEETING_STEPS - 1)) * 100);

  return (
    <MFrame t={t}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '14px 20px 10px', zIndex: 5, background: t.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO }}>PRESENTER REMOTE</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>Monday Stand-up</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </div>
        </div>
        {/* progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
          <div style={{ flex: 1, height: 5, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: 5, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{String(idx + 1).padStart(2, '0')} / {String(MEETING_STEPS).padStart(2, '0')}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ position: 'absolute', top: 152, left: 0, right: 0, bottom: 188, overflow: 'hidden', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Now showing */}
        <div style={{ padding: '15px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: fg }}></div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO }}>ON SCREEN NOW</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${fg}1f`, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.015em' }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{r.unit} · {r.level}</div>
            </div>
            <span style={{ padding: '5px 11px', borderRadius: 999, background: `${fg}1f`, border: `1px solid ${fg}33`, fontSize: 10, fontWeight: 700, color: fg, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{r.flagLabel}</span>
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>NEW API · WK</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{ttd(r.weekApi)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>APPS</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{r.apps}</div>
            </div>
          </div>
        </div>

        {/* Presenter note — room can't see this */}
        <div style={{ padding: '12px 14px', background: t.goldTint, border: `1px dashed ${t.gold}66`, borderRadius: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <IconShield size={12} color={t.gold} />
            <div style={{ fontSize: 8.5, fontWeight: 700, color: t.gold, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>PRESENTER NOTE · PRIVATE</div>
          </div>
          <div style={{ fontSize: 12.5, color: t.ink, lineHeight: 1.45 }}>{r.note}</div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { l: 'Note', Icon: IconBook, fg: t.teal, bg: t.tealTint },
            { l: 'Target', Icon: IconTarget, fg: t.teal, bg: t.tealTint },
            { l: 'Nudge', Icon: IconWizard, fg: t.warning, bg: t.warningTint },
          ].map((a) => (
            <div key={a.l} style={{ flex: 1, height: 52, background: a.bg, border: `1px solid ${a.fg}33`, borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <a.Icon size={17} color={a.fg} stroke={2} />
              <div style={{ fontSize: 11, fontWeight: 700, color: a.fg }}>{a.l}</div>
            </div>
          ))}
        </div>

        {/* Up next */}
        {next && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, flexShrink: 0 }}>UP NEXT</div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.surfaceMute, color: t.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{next.initials}</div>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{next.name}</div>
            <div style={{ fontSize: 10.5, color: t.inkMute }}>{next.flagLabel}</div>
          </div>
        )}
      </div>

      {/* Bottom transport — the remote's core */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 30, background: t.surface, borderTop: `1px solid ${t.rule}`, boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)', zIndex: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 8px' }}>
          <div style={{ flex: '0 0 auto', width: 64, height: 64, borderRadius: 18, background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3L5 9l6 6" /></svg>
          </div>
          <div style={{ flex: 1, height: 64, borderRadius: 18, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#fff', boxShadow: `0 6px 16px ${t.teal}55` }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Next</span>
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3l6 6-6 6" /></svg>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', paddingBottom: 2 }}>TAP TO ADVANCE · SWIPE THE LIST TO JUMP</div>
      </div>
    </MFrame>
  );
}

Object.assign(window, { MeetingRemote });
