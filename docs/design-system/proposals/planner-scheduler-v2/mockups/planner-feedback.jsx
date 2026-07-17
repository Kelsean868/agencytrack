// Feedback round: desktop 3-day + week view toggle, drag-to-reschedule,
// and the running-late cascade (push back + notify). Loads after planner-desktop-screens.jsx.

// Local mini icons (line style, 1.8 stroke)
function IcPhone({ size = 14, color = '#000' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function IcClock({ size = 14, color = '#000' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
}
function IcChat({ size = 14, color = '#000' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function IcGrip({ size = 13, color = '#000' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>;
}

// View toggle — Day · 3 days · Week (desktop planner toolbar)
function ViewToggle({ t, active = '3day' }) {
  const opts = [{ k: 'day', l: 'Day' }, { k: '3day', l: '3 days' }, { k: 'week', l: 'Week' }];
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
      {opts.map((o) => {
        const on = o.k === active;
        return <div key={o.k} style={{ padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute, border: on ? `1px solid ${t.teal}44` : '1px solid transparent' }}>{o.l}</div>;
      })}
    </div>
  );
}

// ── 3-day data ──────────────────────────────────────────────────────────────
const THREE_DAYS = [
  { dow: 'TUE', date: '23 Jun', today: true, rows: [
    { time: '8:30', type: 'FFI', who: 'Kavita Ramlogan', status: 'kept' },
    { time: '10:00', type: 'CI', who: 'Anand Maharaj', status: 'scheduled', running: true },
    { gap: '11:30 – 1:00' },
    { time: '1:00', type: 'AI', who: 'Nisha Persad', status: 'scheduled' },
    { time: '3:00', type: 'PC', who: 'Phone block · 12 dials', status: 'scheduled', free: true },
  ] },
  { dow: 'WED', date: '24 Jun', rows: [
    { time: '9:00', type: 'AI', who: 'Devin Lewis', status: 'scheduled' },
    { gap: '10:30 – 1:30' },
    { time: '1:30', type: 'CI', who: 'Sara Khan', status: 'scheduled' },
    { time: '4:00', type: 'FFI', who: 'Anil Boodram', status: 'scheduled' },
  ] },
  { dow: 'THU', date: '25 Jun', rows: [
    { gap: '9:00 – 11:00' },
    { time: '11:00', type: 'FFI', who: 'Hema Lakhan', status: 'scheduled' },
    { gap: '12:30 – 3:00', target: true },
    { time: '3:00', type: 'AI', who: 'Carla Joseph', status: 'scheduled' },
  ] },
];

function ThreeDayCard({ t, r, dragging, ghost }) {
  const s = actStyle(t, r.type);
  return (
    <div style={{
      padding: '9px 11px', borderRadius: 10, background: t.surface, position: 'relative',
      border: `1px solid ${r.running ? t.warning : `${s.fg}26`}`, borderLeft: `3px solid ${r.running ? t.warning : s.solid ? s.bg : s.fg}`,
      opacity: ghost ? 0.35 : 1, borderStyle: ghost ? 'dashed' : 'solid',
      boxShadow: dragging ? '0 18px 40px rgba(38,35,28,0.28)' : 'none', transform: dragging ? 'rotate(-2deg) scale(1.03)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: t.inkFaint, display: 'flex', cursor: 'grab' }}><IcGrip size={12} color={t.inkFaint} /></span>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{r.time}</span>
        <ActChip t={t} type={r.type} size="s" />
        {r.running && <span style={{ marginLeft: 'auto', fontSize: 8.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>+12 MIN</span>}
        {r.status === 'kept' && !r.running && <span style={{ marginLeft: 'auto', fontSize: 8.5, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>KEPT</span>}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.who}</div>
    </div>
  );
}
function GapSlot({ t, label, target }) {
  return (
    <div style={{ padding: '10px 11px', borderRadius: 10, border: `1.5px dashed ${target ? t.teal : t.ruleStrong}`, background: target ? t.tealTint : 'transparent', display: 'flex', alignItems: 'center', gap: 7, color: target ? t.teal : t.inkMute }}>
      <IconPlus size={12} color={target ? t.teal : t.inkMute} stroke={2.4} />
      <span style={{ fontSize: 10.5, fontWeight: target ? 700 : 600 }}>{target ? 'Drop here → Thu 12:30' : `${label} · tap or drop`}</span>
    </div>
  );
}

// ── 3-day view (desktop) — optional mid-drag state ──────────────────────────
function Planner3Day({ t, drag = false, collapsed = false }) {
  return (
    <PlannerDeskFrame t={t} collapsed={collapsed} title="Planner" subtitle="Tue 23 – Thu 25 Jun 2026">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ViewToggle t={t} active="3day" />
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><IconChevR size={15} color={t.inkMute} stroke={2.2} /></span></div>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconChevR size={15} color={t.inkMute} stroke={2.2} /></div>
          </div>
          <div style={{ flex: 1 }} />
          {drag
            ? <Pill t={t} color={t.teal} bg={t.tealTint}>Moving: A.I · Nisha Persad</Pill>
            : <div style={{ fontSize: 11.5, color: t.inkMute, display: 'flex', alignItems: 'center', gap: 6 }}><IcGrip size={12} color={t.inkFaint} />Drag a card to reschedule — drop on any gap</div>}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, position: 'relative' }}>
          {THREE_DAYS.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', background: d.today ? t.tealTint : t.surfaceSoft, border: `1px solid ${d.today ? `${t.teal}44` : t.rule}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '11px 13px', borderBottom: `1px solid ${d.today ? `${t.teal}33` : t.rule}`, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: d.today ? t.teal : t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{d.dow}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{d.date}</span>
                {d.today && <span style={{ fontSize: 8.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, marginLeft: 'auto' }}>TODAY</span>}
              </div>
              <div style={{ flex: 1, padding: 9, display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
                {d.rows.map((r, j) => r.gap
                  ? <GapSlot key={j} t={t} label={r.gap} target={drag && r.target} />
                  : <ThreeDayCard key={j} t={t} r={r} ghost={drag && r.who === 'Nisha Persad'} />)}
              </div>
            </div>
          ))}
          {drag && (
            <div style={{ position: 'absolute', left: '52%', top: 128, width: 230, zIndex: 5 }}>
              <ThreeDayCard t={t} r={{ time: '1:00', type: 'AI', who: 'Nisha Persad', status: 'scheduled' }} dragging />
              <div style={{ position: 'absolute', right: -7, bottom: -7, width: 16, height: 16, borderRadius: '50%', background: t.ink, border: `2.5px solid ${t.bg}` }} />
            </div>
          )}
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

// ── Week board mid-drag (desktop) — move across days ────────────────────────
function WeekDragDesk({ t }) {
  return (
    <PlannerDeskFrame t={t} title="Planner" subtitle="Week of Jun 22 – 28 · drag across days">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ViewToggle t={t} active="week" />
          <div style={{ flex: 1 }} />
          <Pill t={t} color={t.teal} bg={t.tealTint}>Moving: F.F.I · Anil Boodram → Fri</Pill>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, position: 'relative' }}>
          {DESK_WEEK.map((day, i) => {
            const dropDay = day.dow === 'FRI';
            const srcDay = day.dow === 'WED';
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', background: dropDay ? t.tealTint : day.today ? t.tealTint : t.surface, border: `1.5px ${dropDay ? 'dashed' : 'solid'} ${dropDay ? t.teal : day.today ? `${t.teal}44` : t.rule}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '9px 10px', borderBottom: `1px solid ${dropDay || day.today ? `${t.teal}33` : t.rule}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: dropDay || day.today ? t.teal : t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{day.dow}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>{day.date.split(' ')[0]}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{day.appts.length || '—'}</div>
                </div>
                <div style={{ flex: 1, padding: 7, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                  {day.appts.map((ap, j) => {
                    const ghost = srcDay && ap.who === 'Anil Boodram';
                    return <div key={j} style={{ opacity: ghost ? 0.3 : 1, borderRadius: 8, outline: ghost ? `1.5px dashed ${t.ruleStrong}` : 'none' }}><DeskApptChip t={t} ap={ap} /></div>;
                  })}
                  {dropDay && (
                    <div style={{ padding: '10px 8px', borderRadius: 8, border: `1.5px dashed ${t.teal}`, background: t.tealTint, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: t.teal }}>
                      <IconPlus size={12} color={t.teal} stroke={2.4} /><span style={{ fontSize: 10, fontWeight: 700 }}>Drop → Fri 9:00</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* dragged chip */}
          <div style={{ position: 'absolute', left: '58%', top: 110, width: 150, zIndex: 5, transform: 'rotate(-2deg)', boxShadow: '0 18px 40px rgba(38,35,28,0.28)', borderRadius: 8 }}>
            <DeskApptChip t={t} ap={{ time: '4:00', type: 'FFI', who: 'Anil Boodram' }} />
            <div style={{ position: 'absolute', right: -7, bottom: -7, width: 16, height: 16, borderRadius: '50%', background: t.ink, border: `2.5px solid ${t.bg}` }} />
          </div>
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

// ── Running-late cascade — shared body ──────────────────────────────────────
function LateBody({ t, compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 11 : 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 11 }}>
        <span style={{ display: 'flex' }}><IcClock size={16} color={t.warning} /></span>
        <div style={{ flex: 1, fontSize: 12, color: t.ink, lineHeight: 1.45 }}><b>C.I · Anand Maharaj</b> is 12 min past its 11:00 end. Next up: A.I at 1:00.</div>
      </div>
      {/* smart scope — the gap analysis decides the default */}
      <div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>WHAT MOVES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: t.tealTint, border: `1.5px solid ${t.teal}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${t.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: t.teal }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Next meeting only <span style={{ fontSize: 9, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, marginLeft: 4 }}>SUGGESTED</span></div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2, lineHeight: 1.45 }}>A 1h40m gap follows your 1:00 — the rest of today is unaffected.</div>
            </div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${t.ruleStrong}`, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: t.inkMute }}>Everything after this <span style={{ fontWeight: 400, fontSize: 11 }}>— cascade the whole day</span></div>
          </div>
        </div>
      </div>
      {/* push amount */}
      <div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>PUSH BY</div>
        <div style={{ display: 'flex', gap: 7 }}>
          {['+10 min', '+20 min', '+30 min'].map((l, i) => (
            <div key={l} style={{ flex: 1, padding: '9px 0', textAlign: 'center', borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: i === 1 ? t.teal : t.surface, color: i === 1 ? '#fff' : t.ink, border: `1px solid ${i === 1 ? t.teal : t.rule}` }}>{l}</div>
          ))}
        </div>
      </div>
      {/* cascade preview — scoped to the suggestion */}
      <div style={{ border: `1px solid ${t.rule}`, borderRadius: 11, overflow: 'hidden' }}>
        {[{ time: '1:00', to: '1:20', type: 'AI', who: 'Nisha Persad', notify: true }, { time: '3:00', type: 'PC', who: 'Phone block · 12 dials', absorbed: true }].map((p, i, arr) => (
          <div key={i} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none', background: t.surface, opacity: p.absorbed ? 0.6 : 1 }}>
            <ActChip t={t} type={p.type} size="s" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.who}</div>
              <div style={{ fontSize: 10.5, fontFamily: APP_FONT_MONO, marginTop: 2 }}>
                {p.absorbed
                  ? <span style={{ color: t.inkMute }}>3:00 · not affected — outside the push</span>
                  : <><span style={{ color: t.inkFaint, textDecoration: 'line-through' }}>{p.time}</span><span style={{ color: t.teal, fontWeight: 700 }}> → {p.to}</span></>}
              </div>
            </div>
            {p.notify && (
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: t.tealTint, border: `1px solid ${t.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcPhone size={14} color={t.teal} /></div>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: t.tealTint, border: `1px solid ${t.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcChat size={14} color={t.teal} /></div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: t.inkMute, lineHeight: 1.5, marginTop: -3 }}>Call or WhatsApp Nisha before you push — a prepared "running ~20 min behind, still good for 1:20?" message is copied on tap.</div>
      {/* actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ minHeight: 46, background: t.teal, color: '#fff', borderRadius: 12, fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IcClock size={15} color="#fff" />Push back +20 & notify Nisha</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minHeight: 42, background: t.surface, border: `1px solid ${t.rule}`, color: t.ink, borderRadius: 11, fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Keep schedule</div>
          <div style={{ flex: 1, minHeight: 42, background: t.surface, border: `1px solid ${t.rule}`, color: t.success, borderRadius: 11, fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Wrap up · mark Kept</div>
        </div>
      </div>
    </div>
  );
}

// Mobile sheet (M_W × M_H)
function RunningLateSheet({ t }) {
  return (
    <div style={{ width: M_W, height: M_H, background: t.bg, position: 'relative', overflow: 'hidden', fontFamily: APP_FONT_SANS }}>
      {/* dimmed timeline hint behind */}
      <div style={{ padding: '70px 18px 0', opacity: 0.35, filter: 'blur(1px)' }}>
        {[['8:30', 'FFI', 'Kavita Ramlogan'], ['10:00', 'CI', 'Anand Maharaj'], ['1:00', 'AI', 'Nisha Persad']].map(([tm, ty, who], i) => (
          <div key={i} style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{tm}</span>
            <ActChip t={t} type={ty} size="s" />
            <span style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{who}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.45)' }} />
      {/* sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: t.bg, borderRadius: '22px 22px 0 0', padding: '10px 18px 22px', boxShadow: '0 -18px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 40, height: 4.5, borderRadius: 999, background: t.ruleStrong, margin: '0 auto 13px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.warning }} className="a-breathe" />
          <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Running late</div>
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>NOW 11:12</div>
        </div>
        <LateBody t={t} compact />
      </div>
    </div>
  );
}

// Desktop modal over a faded 3-day board
function RunningLateDesk({ t }) {
  return (
    <div style={{ width: APP_W, height: APP_H, position: 'relative', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(1.5px)', opacity: 0.55 }}><Planner3Day t={t} /></div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.35)', zIndex: 30 }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 470, background: t.bg, border: `1px solid ${t.rule}`, borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.warning }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Running late</div>
            <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>NOW 11:12</div>
          </div>
          <div style={{ padding: '16px 20px 20px' }}><LateBody t={t} compact /></div>
        </div>
      </div>
    </div>
  );
}

// ── Meeting notes — attached to every appointment ───────────────────────────
const MEET_NOTES = [
  { at: 'Today · 10:47', during: true, txt: 'Wants the education rider quoted for both kids — bring the Platinum Edge table Thursday.' },
  { at: 'Mon 15 Jun', txt: 'Wife handles the budget — book evening slots only. Objection: "premium too high" → showed the 15-yr view, landed well.' },
  { at: 'Tue 2 Jun', txt: 'F.F.I done. Owns Term Life 20 (TL-08661) with Tatil. Gap: no C.I cover.' },
];
function NotesList({ t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* add note */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '11px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 12.5, color: t.inkFaint }}>Add a note — saved to this meeting…</div>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconPlus size={17} color="#fff" stroke={2.4} /></div>
      </div>
      {MEET_NOTES.map((n, i) => (
        <div key={i} style={{ padding: '11px 13px', background: t.surface, border: `1px solid ${n.during ? `${t.teal}55` : t.rule}`, borderRadius: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: n.during ? t.teal : t.inkFaint, fontFamily: APP_FONT_MONO }}>{n.at.toUpperCase()}</span>
            {n.during && <span style={{ fontSize: 8.5, fontWeight: 700, color: t.teal, background: t.tealTint, padding: '1px 6px', borderRadius: 5, fontFamily: APP_FONT_MONO }}>THIS MEETING</span>}
          </div>
          <div style={{ fontSize: 12.5, color: t.ink, lineHeight: 1.5 }}>{n.txt}</div>
        </div>
      ))}
      <div style={{ fontSize: 10.5, color: t.inkMute, lineHeight: 1.5 }}>Notes travel with the prospect — every past meeting's notes surface on the prep card before you go in.</div>
    </div>
  );
}
// Mobile sheet
function MeetingNotesSheet({ t }) {
  return (
    <div style={{ width: M_W, height: M_H, background: t.bg, position: 'relative', overflow: 'hidden', fontFamily: APP_FONT_SANS }}>
      <div style={{ padding: '70px 18px 0', opacity: 0.35, filter: 'blur(1px)' }}>
        <div style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>10:00</span>
          <ActChip t={t} type="CI" size="s" />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>Anand Maharaj</span>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.45)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: t.bg, borderRadius: '22px 22px 0 0', padding: '10px 18px 22px', boxShadow: '0 -18px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 40, height: 4.5, borderRadius: 999, background: t.ruleStrong, margin: '0 auto 13px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Notes</div>
          <div style={{ fontSize: 11, color: t.inkMute }}>C.I · Anand Maharaj · today 10:00</div>
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>3</div>
        </div>
        <NotesList t={t} />
      </div>
    </div>
  );
}
// Desktop — notes panel in a modal over the board
function MeetingNotesDesk({ t }) {
  return (
    <div style={{ width: APP_W, height: APP_H, position: 'relative', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(1.5px)', opacity: 0.55 }}><Planner3Day t={t} /></div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.35)', zIndex: 30 }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 470, background: t.bg, border: `1px solid ${t.rule}`, borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Notes</div>
            <div style={{ fontSize: 11.5, color: t.inkMute }}>C.I · Anand Maharaj · today 10:00</div>
          </div>
          <div style={{ padding: '16px 20px 20px' }}><NotesList t={t} /></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ViewToggle, Planner3Day, WeekDragDesk, RunningLateSheet, RunningLateDesk, MeetingNotesSheet, MeetingNotesDesk });
