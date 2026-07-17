// Planner & Scheduler — desktop / tablet week-booking view (1280×800).
// Reuses Topbar + RoleSwitcher + AmbientBg from app-shell, but ships its own
// sidebar so a new top-level "Planner" nav item can be highlighted without
// editing the shared Sidebar (imported by 30+ other mockups).

function PlannerDeskSidebar({ t, active = 'planner', collapsed = false }) {
  const groups = [
    { title: null, items: [
      { key: 'home', Icon: IconHome, label: 'Dashboard' },
      { key: 'planner', Icon: IconClock, label: 'Planner', badge: 'NEW' },
      { key: 'wizard', Icon: IconWizard, label: 'Weekly Report' },
      { key: 'history', Icon: IconHistory, label: 'History' },
    ]},
    { title: 'Planning', items: [
      { key: 'lookahead', Icon: IconChart, label: 'Game Plan' },
      { key: 'goals', Icon: IconTarget, label: 'Goals' },
    ]},
    { title: 'Tools', items: [
      { key: 'prospect', Icon: IconSearch, label: 'Prospect Prep' },
      { key: 'ledger', Icon: IconBook, label: 'Policy Ledger' },
    ]},
  ];
  if (collapsed) {
    return (
      <div style={{ width: 64, background: t.surface, borderRight: `1px solid ${t.rule}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 14px', flexShrink: 0 }}>
        <div style={{ paddingBottom: 14, borderBottom: `1px solid ${t.rule}`, marginBottom: 12, width: 40, display: 'flex', justifyContent: 'center' }}><AgencyLogo size={30} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {groups.flatMap((g) => g.items).map((it) => {
            const on = active === it.key;
            return (
              <div key={it.key} title={it.label} style={{ width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? t.tealTint : 'transparent', position: 'relative' }}>
                {on && <div style={{ position: 'absolute', left: -11, top: 8, bottom: 8, width: 3, background: t.teal, borderRadius: 999 }} />}
                <it.Icon size={18} color={on ? t.teal : t.inkMute} stroke={1.8} />
                {it.badge && <div style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: t.gold }} />}
              </div>
            );
          })}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>MS</div>
      </div>
    );
  }
  return (
    <div style={{ width: 232, background: t.surface, borderRight: `1px solid ${t.rule}`, display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px', borderBottom: `1px solid ${t.rule}`, marginBottom: 12 }}>
        <AgencyLogo size={32} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em' }}>AgencyTrack</div>
          <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>Tatil Life · South</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 14 }}>
            {g.title && <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 12px 6px', fontFamily: APP_FONT_MONO }}>{g.title}</div>}
            {g.items.map((it) => {
              const on = active === it.key;
              return (
              <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9, background: on ? t.tealTint : 'transparent', color: on ? t.teal : t.inkMute, fontSize: 13, fontWeight: 600, position: 'relative' }}>
                {on && <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: t.teal, borderRadius: 999 }} />}
                <it.Icon size={17} color={on ? t.teal : t.inkMute} stroke={1.8} />
                <div style={{ flex: 1 }}>{it.label}</div>
                {it.badge && <div style={{ padding: '1px 6px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, background: t.gold, color: t.surface, letterSpacing: '0.06em' }}>{it.badge}</div>}
              </div>
            ); })}
          </div>
        ))}
      </div>
      <RoleSwitcher t={t} current="agent" />
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>MS</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Marsha Singh</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Senior Associate</div>
        </div>
      </div>
    </div>
  );
}

// Per-day booking columns for the desktop board.
const DESK_WEEK = [
  { dow: 'MON', date: '22 Jun', appts: [
    { time: '9:00', type: 'CI', who: 'Terrence S.', status: 'kept' },
    { time: '11:00', type: 'FFI', who: 'Shivani B.', status: 'scheduled' },
    { time: '2:00', type: 'SC', who: 'Marlon J.', status: 'scheduled' },
    { time: '4:00', type: 'PC', who: 'Calls block', status: 'scheduled', free: true },
  ]},
  { dow: 'TUE', date: '23 Jun', today: true, appts: [
    { time: '8:30', type: 'FFI', who: 'Kavita R.', status: 'kept' },
    { time: '10:00', type: 'CI', who: 'Anand M.', status: 'confirmed' },
    { time: '11:30', type: 'SC', who: 'Marlon J.', status: 'scheduled' },
    { time: '1:30', type: 'AI', who: 'Nisha P.', status: 'scheduled' },
    { time: '3:00', type: 'CI', who: 'Reshma A.', status: 'cancelled' },
  ]},
  { dow: 'WED', date: '24 Jun', appts: [
    { time: '9:30', type: 'FFI', who: 'Priya G.', status: 'scheduled' },
    { time: '11:00', type: 'AI', who: 'Brandon C.', status: 'scheduled' },
  ]},
  { dow: 'THU', date: '25 Jun', appts: [
    { time: '9:00', type: 'CI', who: 'Terrence S.', status: 'scheduled' },
    { time: '12:00', type: 'FFI', who: 'Shivani B.', status: 'scheduled' },
    { time: '1:00', type: 'FREE', who: 'Training', status: 'scheduled', free: true },
    { time: '2:30', type: 'CI', who: 'Brandon C.', status: 'scheduled' },
    { time: '5:00', type: 'SC', who: 'Reshma A.', status: 'scheduled' },
  ]},
  { dow: 'FRI', date: '26 Jun', appts: [
    { time: '10:00', type: 'AI', who: 'Dexter C.', status: 'scheduled' },
    { time: '11:30', type: 'FFI', who: 'Curtis M.', status: 'scheduled' },
    { time: '3:00', type: 'SC', who: 'Aaliyah B.', status: 'scheduled' },
  ]},
  { dow: 'SAT', date: '27 Jun', appts: [
    { time: '10:00', type: 'FREE', who: 'Seminar', status: 'scheduled', free: true },
  ]},
  { dow: 'SUN', date: '28 Jun', appts: [] },
];

function DeskApptChip({ t, ap }) {
  const s = actStyle(t, ap.type);
  const cancelled = ap.status === 'cancelled';
  return (
    <div style={{
      padding: '6px 8px', borderRadius: 8, background: ap.free ? t.surfaceSoft : t.surface,
      border: `1px solid ${cancelled ? t.rule : `${s.fg}26`}`, borderLeft: `3px solid ${cancelled ? t.danger : s.solid ? s.bg : s.fg}`,
      opacity: cancelled ? 0.55 : 1, borderStyle: ap.free ? 'dashed' : 'solid',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{ap.time}</span>
        <ActChip t={t} type={ap.type} size="s" />
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: cancelled ? t.inkMute : t.ink, marginTop: 4, textDecoration: cancelled ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ap.who}</div>
    </div>
  );
}

// Reusable desktop shell — sidebar + topbar + padded content slot.
// collapsed=true → 64px icon rail; the content region grows by ~168px and
// views re-flow to use it (wider day columns, extra visible day-strip cells).
function PlannerDeskFrame({ t, active = 'planner', title, subtitle, pad = '20px 24px', collapsed = false, children }) {
  return (
    <div style={{ width: APP_W, height: APP_H, background: t.bg, color: t.ink, fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      <AmbientBg t={t} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex' }}>
        <PlannerDeskSidebar t={t} active={active} collapsed={collapsed} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar t={t} title={title} subtitle={subtitle} modeMode={t.mode} />
          <div style={{ flex: 1, overflow: 'hidden', padding: pad }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function PlannerDesktop({ t, collapsed = false }) {
  return (
    <PlannerDeskFrame t={t} collapsed={collapsed} title="Planner" subtitle="Book the week ahead · Tue 23 Jun 2026">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
            {/* main */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* forward day-strip */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
                  <Eyebrow t={t}>Next 8 weeks · tap a day</Eyebrow>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><IconChevR size={15} color={t.inkMute} stroke={2.2} /></span></div>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconChevR size={15} color={t.inkMute} stroke={2.2} /></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
                  {DAY_STRIP.map((d, i) => <DayStripCell key={i} t={t} d={d} selected={d.today} />)}
                </div>
              </div>

              {/* week board — 7 day columns (list-based, NOT a time grid) */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Week of Jun 22 – 28</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ fontSize: 11.5, color: t.inkMute }}>21 booked · 2 open days</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, height: 'calc(100% - 30px)' }}>
                  {DESK_WEEK.map((day, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', background: day.today ? t.tealTint : t.surface, border: `1px solid ${day.today ? `${t.teal}44` : t.rule}`, borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '9px 10px', borderBottom: `1px solid ${day.today ? `${t.teal}33` : t.rule}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: day.today ? t.teal : t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{day.dow}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>{day.date.split(' ')[0]}</div>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: day.appts.length ? (day.today ? t.teal : t.inkMute) : t.inkDim, fontFamily: APP_FONT_MONO }}>{day.appts.length || '—'}</div>
                      </div>
                      <div style={{ flex: 1, padding: 7, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                        {day.appts.map((ap, j) => <DeskApptChip key={j} t={t} ap={ap} />)}
                        <div style={{ padding: '7px 6px', borderRadius: 8, border: `1.5px dashed ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: t.inkMute }}>
                          <IconPlus size={12} color={t.inkMute} stroke={2.4} /><span style={{ fontSize: 10.5, fontWeight: 600 }}>Add</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* right rail */}
            <div style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* weekly minimums */}
              <div style={{ padding: '16px 17px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>This week vs minimum</div>
                  <Pill t={t} color={t.warning} bg={t.warningTint}>4 CIs short</Pill>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {WEEK_TARGETS.map((w, i) => <CounterBar key={i} t={t} type={w.type} booked={w.booked} target={w.target} />)}
                </div>
              </div>
              {/* phone-day nudge */}
              <div style={{ padding: '15px 17px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 14 }}>
                <Eyebrow t={t}>Phone-day mode</Eyebrow>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 6, lineHeight: 1.3 }}>Book 4 more closing interviews to hit your week.</div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 6, lineHeight: 1.5 }}>3 follow-ups are CI-ready — pull them straight into open Thursday & Friday slots.</div>
                <div style={{ marginTop: 12, padding: '11px 14px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <IconBolt size={14} color="#fff" stroke={2.2} />Fill from follow-ups
                </div>
              </div>
              {/* quick add */}
              <div style={{ padding: '14px 16px', background: t.surface, border: `1px dashed ${t.ruleStrong}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconPlus size={18} color="#fff" stroke={2.4} /></div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Quick book</div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Prospect or free block · ⌘B</div>
                </div>
              </div>
            </div>
      </div>
    </PlannerDeskFrame>
  );
}

Object.assign(window, { PlannerDeskSidebar, PlannerDeskFrame, PlannerDesktop, DeskApptChip, DESK_WEEK });
