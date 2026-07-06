// Planner & Scheduler — empty, loading & error states (required for a daily tool).

// EMPTY · Today — no appointments booked yet (first run of the day)
function EmptyToday({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="TUE · 23 JUN 2026" title="Today"
        right={<div style={{ width: 36, height: 36, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>MS</div>} />
      <div style={{ position: 'absolute', top: 108, left: 0, right: 0, bottom: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: t.surface, border: `1.5px dashed ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <IconClock size={34} color={t.inkFaint} stroke={1.6} />
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.015em' }}>Nothing booked today</div>
        <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>A clear day is a chance to fill it. Book your first appointment or pull from follow-ups due.</div>
        <div style={{ marginTop: 22, width: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PBtn t={t} kind="primary" icon={<IconPlus size={15} color="#fff" stroke={2.4} />}>Book an appointment</PBtn>
          <PBtn t={t} kind="ghost" icon={<IconRepeat size={14} color={t.teal} stroke={2} />}>4 follow-ups due →</PBtn>
        </div>
      </div>
      <PlannerNav t={t} active="today" badge={4} />
    </MFrame>
  );
}

// EMPTY · Follow-ups — all caught up (a good state, shown explicitly)
function EmptyFollowups({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="DUE FOR A CALLBACK" title="Follow-ups" />
      <div style={{ position: 'absolute', top: 104, left: 0, right: 0, bottom: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
        <div className="a-scale-in" style={{ width: 76, height: 76, borderRadius: '50%', background: t.successTint, border: `2px solid ${t.success}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <IconCheck size={36} color={t.success} stroke={2.2} />
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.015em' }}>All caught up</div>
        <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>No callbacks due. New follow-ups appear here when a prospect asks you to call back.</div>
        <div style={{ marginTop: 20, padding: '10px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 11.5, color: t.inkMute }}>Next due: <b style={{ color: t.ink }}>Brandon Clarke</b> · in 3 days</div>
      </div>
      <PlannerNav t={t} active="followups" badge={0} />
    </MFrame>
  );
}

// LOADING · Day timeline — skeleton rows
function LoadingDay({ t }) {
  const sk = (w, h, r = 6) => ({ width: w, height: h, borderRadius: r, background: t.surfaceMute });
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="LOADING…" title="Today" />
      <PBody t={t} top={104}>
        <div className="a-glow-soft" style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: 0.85 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
              <div style={{ width: 52, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingRight: 12 }}><div style={sk(30, 12)} /></div>
              <div style={{ width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: t.surfaceMute, marginTop: 4 }} /></div>
              <div style={{ flex: 1, padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}><div style={sk(38, 16)} /><div style={sk(34, 16)} /></div>
                <div style={{ ...sk(i % 2 ? 130 : 160, 14), marginBottom: 7 }} />
                <div style={sk(96, 11)} />
              </div>
            </div>
          ))}
        </div>
      </PBody>
      <PlannerNav t={t} active="today" badge={4} />
    </MFrame>
  );
}

// ERROR · couldn't sync (offline-first daily tool)
function ErrorState({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="TUE · 23 JUN 2026" title="Today" />
      <div style={{ position: 'absolute', top: 108, left: 0, right: 0, bottom: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: t.dangerTint, border: `1.5px solid ${t.danger}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <IconAlert size={34} color={t.danger} stroke={1.8} />
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.015em' }}>Couldn’t sync your day</div>
        <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>You’re offline. Your booked plan is saved on this phone — it’ll sync when you’re back on data.</div>
        <div style={{ marginTop: 14, padding: '9px 14px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 10, fontSize: 11, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO, display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.warning }} />6 changes waiting to sync
        </div>
        <div style={{ marginTop: 22, width: '100%' }}><PBtn t={t} kind="primary" icon={<IconRepeat size={15} color="#fff" stroke={2.2} />}>Try again</PBtn></div>
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: t.inkMute }}>Work offline</div>
      </div>
      <PlannerNav t={t} active="today" badge={4} />
    </MFrame>
  );
}

Object.assign(window, { EmptyToday, EmptyFollowups, LoadingDay, ErrorState });
