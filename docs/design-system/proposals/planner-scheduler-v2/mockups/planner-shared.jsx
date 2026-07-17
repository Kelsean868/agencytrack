// Planner & Scheduler — shared primitives + sample data.
// Mobile-first day-planning surface for Tatil Life agents. Digitizes the paper
// "Weekly Planner": book a week of appointments into time slots, work the day,
// report results. Activity manager — NOT a CRM.
//
// Depends on: app-tokens (palettes/icons/ttd), app-motion (AmbientBg/classes),
// app-mobile (MFrame, M_W/M_H). Loads after those.

// ──────────────────────────────────────────────────────────────────────────
// DOMAIN — the real activity types agents book (Tatil weekly planner booklet)
// ──────────────────────────────────────────────────────────────────────────
//  P.C  prospecting calls   ·  S.C  seen calls       ·  A.I  approach interview
//  F.F.I fact-finding        ·  C.I  closing interview ·  Sale Life/Annuity
//  Free  training · seminars/tradeshows · personal
const ACT_CODE = { PC: 'P.C', SC: 'S.C', AI: 'A.I', FFI: 'F.F.I', CI: 'C.I', SALE: 'Sale', FREE: 'Free',
  RC: 'R.C', RI: 'R.I', RS: 'R.S', O2O: '1:1', TEAM: 'Team', JOINT: 'Joint' };
const ACT_NAME = {
  PC: 'Prospecting calls', SC: 'Seen call', AI: 'Approach interview',
  FFI: 'Fact-finding interview', CI: 'Closing interview', SALE: 'Sale written', FREE: 'Free block',
  RC: 'Recruiting calls', RI: 'Recruiting interview', RS: 'Recruiting seminar',
  O2O: '1-on-1 coaching', TEAM: 'Team / training', JOINT: 'Joint call with agent',
};

// Tone families: violet = calls (PC/SC), teal = the interview ladder (AI→FFI→CI,
// CI is the money type so it goes solid), gold = a written sale, neutral = free.
function actStyle(t, type) {
  const m = {
    PC:   { fg: t.inkAccent, bg: t.inkAccentTint, solid: false },
    SC:   { fg: t.inkAccent, bg: t.inkAccentTint, solid: false },
    AI:   { fg: t.teal,      bg: t.tealTint,      solid: false },
    FFI:  { fg: t.teal,      bg: t.tealTint,      solid: false },
    CI:   { fg: '#fff',      bg: t.teal,          solid: true  },
    SALE: { fg: '#fff',      bg: t.gold,          solid: true  },
    FREE: { fg: t.inkMute,   bg: t.surfaceMute,   solid: false },
    // Manager personal-planner additions: recruiting = gold family,
    // management/team = accent + neutral, joint = teal (a selling action).
    RC:   { fg: t.gold,      bg: t.goldTint,      solid: false },
    RI:   { fg: t.gold,      bg: t.goldTint,      solid: false },
    RS:   { fg: t.gold,      bg: t.goldTint,      solid: false },
    O2O:  { fg: t.inkAccent, bg: t.inkAccentTint, solid: false },
    TEAM: { fg: t.inkMute,   bg: t.surfaceMute,   solid: false },
    JOINT:{ fg: t.teal,      bg: t.tealTint,      solid: false },
  };
  return m[type] || m.FREE;
}

// Activity code chip — the small mono badge on every appointment.
function ActChip({ t, type, size = 'm' }) {
  const s = actStyle(t, type);
  const pad = size === 's' ? '2px 6px' : '3px 8px';
  const fs = size === 's' ? 9.5 : 10.5;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: pad, borderRadius: 6,
      fontSize: fs, fontWeight: 700, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO,
      color: s.fg, background: s.bg, border: s.solid ? 'none' : `1px solid ${s.fg}26`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>{ACT_CODE[type]}</span>
  );
}

// Status pill — appointment lifecycle. Cancelled/postponed are RETAINED in the
// timeline (dimmed/struck), never deleted.
const STATUS = {
  scheduled: (t) => ({ label: 'Scheduled', fg: t.inkMute,  bg: t.surfaceMute }),
  confirmed: (t) => ({ label: 'Confirmed', fg: t.teal,     bg: t.tealTint }),
  kept:      (t) => ({ label: 'Kept',      fg: t.success,  bg: t.successTint }),
  cancelled: (t) => ({ label: 'Cancelled', fg: t.danger,   bg: t.dangerTint }),
  postponed: (t) => ({ label: 'Postponed', fg: t.warning,  bg: t.warningTint }),
  done:      (t) => ({ label: 'Reported',  fg: t.success,  bg: t.successTint }),
};
function StatusPill({ t, status }) {
  const s = (STATUS[status] || STATUS.scheduled)(t);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      fontFamily: APP_FONT_SANS, color: s.fg, background: s.bg, whiteSpace: 'nowrap', flexShrink: 0,
    }}>{s.label}</span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Planner header — eyebrow + big title, optional back chevron + right slot
// ──────────────────────────────────────────────────────────────────────────
function PHeader({ t, eyebrow, title, right, onBack, top = 44, sub }) {
  return (
    <div style={{
      position: 'absolute', top, left: 0, right: 0, padding: '14px 18px 12px',
      display: 'flex', alignItems: 'center', gap: 12, background: t.bg, zIndex: 6,
    }}>
      {onBack && (
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: t.surface, border: `1px solid ${t.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink, flexShrink: 0,
        }}>
          <span style={{ display: 'flex', transform: 'scaleX(-1)' }}><IconChevR size={17} color={t.ink} stroke={2.2} /></span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{eyebrow}</div>}
        <div style={{ fontSize: 23, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 2, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// Scroll body slot between a header and the bottom nav.
function PBody({ t, top = 112, bottom = 92, pad = '0 18px', children }) {
  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, bottom, overflow: 'hidden', padding: pad }}>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Planner bottom nav — Today · Week · [Book FAB] · Follow-ups · More
// The central FAB is the thumb-reachable quick-add (book an appointment).
// ──────────────────────────────────────────────────────────────────────────
function PlannerNav({ t, active = 'today', badge = 4 }) {
  const tabs = [
    { key: 'today',     label: 'Today',     Icon: IconHome },
    { key: 'week',      label: 'Week',      Icon: IconGrid },
    { key: 'book',      label: 'Book',      Icon: IconPlus, fab: true },
    { key: 'followups', label: 'Follow-ups', Icon: IconRepeat, badge },
    { key: 'more',      label: 'More',      Icon: IconBook },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 24,
      background: t.surface, borderTop: `1px solid ${t.rule}`,
      boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)', zIndex: 15,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 10px 10px' }}>
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          if (tab.fab) {
            return (
              <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 54 }}>
                <div className="a-fab-pulse" style={{
                  width: 58, height: 58, borderRadius: '50%',
                  background: `linear-gradient(180deg, ${t.tealLight} 0%, ${t.teal} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginTop: -30,
                  '--fab-glow-1': `${t.teal}66`, '--fab-glow-2': `${t.teal}55`,
                  boxShadow: `0 6px 16px ${t.teal}66, 0 2px 4px rgba(40,37,29,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`,
                  border: `3px solid ${t.surface}`,
                }}>
                  <tab.Icon size={25} color="#fff" stroke={2.5} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, marginTop: 1 }}>{tab.label}</div>
              </div>
            );
          }
          return (
            <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 54 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tab.Icon size={21} color={isActive ? t.teal : t.inkFaint} stroke={2} />
                {isActive && <div style={{ position: 'absolute', inset: -7, background: t.tealTint, borderRadius: 999, zIndex: -1, width: 34, height: 34, top: -6.5, left: '50%', transform: 'translateX(-50%)' }} />}
                {tab.badge > 0 && (
                  <div style={{ position: 'absolute', top: -4, right: -8, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, background: t.danger, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${t.surface}`, fontFamily: APP_FONT_MONO }}>{tab.badge}</div>
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: isActive ? 700 : 600, color: isActive ? t.teal : t.inkMute }}>{tab.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Timeline primitives — time gutter + rail + appointment card / empty gap
// ──────────────────────────────────────────────────────────────────────────
function TimeRail({ t, time, meridiem, dotColor, first, last, dim }) {
  return (
    <div style={{ width: 52, flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: dim ? t.inkFaint : t.ink, fontFamily: APP_FONT_MONO, lineHeight: 1, opacity: dim ? 0.7 : 1 }}>{time}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 2 }}>{meridiem}</div>
    </div>
  );
}

// One appointment row in a day timeline.
function ApptRow({ t, appt, railLine = true, onResolve }) {
  const s = actStyle(t, appt.type);
  const cancelled = appt.status === 'cancelled';
  const postponed = appt.status === 'postponed';
  const dim = cancelled || postponed;
  const dot = cancelled ? t.danger : postponed ? t.warning
    : appt.status === 'kept' || appt.status === 'done' ? t.success
    : appt.type === 'FREE' ? t.inkDim : s.solid ? s.bg : s.fg;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
      <TimeRail t={t} time={appt.time} meridiem={appt.mer} dim={dim} />
      {/* rail with dot */}
      <div style={{ position: 'relative', width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {railLine && <div style={{ position: 'absolute', top: 0, bottom: -14, width: 2, background: t.rule }} />}
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.surface, border: `2.5px solid ${dot}`, marginTop: 5, zIndex: 1, boxSizing: 'border-box' }} />
      </div>
      {/* card */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
        <div className="a-card" style={{
          padding: '11px 13px', background: appt.type === 'FREE' ? t.surfaceSoft : t.surface,
          border: `1px solid ${appt.type === 'FREE' ? t.rule : (dim ? t.rule : `${s.fg}2e`)}`,
          borderRadius: 12, opacity: dim ? 0.62 : 1,
          borderStyle: appt.type === 'FREE' ? 'dashed' : 'solid',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: appt.who ? 7 : 0 }}>
            <ActChip t={t} type={appt.type} />
            <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, fontWeight: 600 }}>{appt.dur}</div>
            <div style={{ flex: 1 }} />
            <StatusPill t={t} status={appt.status} />
          </div>
          {appt.who && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em', textDecoration: cancelled ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.who}</div>
                {appt.note && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.note}</div>}
              </div>
              {appt.amount && <div style={{ fontSize: 13, fontWeight: 700, color: appt.type === 'SALE' ? t.gold : t.teal, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{appt.amount}</div>}
            </div>
          )}
          {!appt.who && appt.label && (
            <div style={{ fontSize: 13.5, fontWeight: 600, color: t.inkMute, letterSpacing: '-0.005em' }}>{appt.label}</div>
          )}
          {appt.reschedTo && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.rule}`, fontSize: 11, color: t.warning, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconArrowR size={12} color={t.warning} stroke={2.2} /> Moved to {appt.reschedTo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Empty bookable gap in a timeline — tappable.
function GapRow({ t, time, mer, free = '1h free', railLine = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <TimeRail t={t} time={time} meridiem={mer} dim />
      <div style={{ position: 'relative', width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {railLine && <div style={{ position: 'absolute', top: 0, bottom: -14, width: 2, background: t.rule }} />}
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: t.bg, border: `2px dashed ${t.inkDim}`, marginTop: 6, zIndex: 1, boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
        <div style={{
          padding: '10px 13px', borderRadius: 12, border: `1.5px dashed ${t.ruleStrong}`,
          display: 'flex', alignItems: 'center', gap: 9, color: t.inkMute, background: 'transparent',
        }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconPlus size={13} color={t.teal} stroke={2.4} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.inkMute }}>Tap to book</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 10.5, fontWeight: 600, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{free}</div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Counter bar — "C.I booked 6 / 10" vs the weekly minimum, colored by shortfall
// ──────────────────────────────────────────────────────────────────────────
function CounterBar({ t, code, booked, target, type }) {
  const pct = Math.min(100, (booked / target) * 100);
  const short = booked < target;
  const s = actStyle(t, type);
  const fill = short ? t.warning : t.success;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 42, flexShrink: 0 }}><ActChip t={t} type={type} size="s" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${pct}%`, height: 7, background: fill, borderRadius: 999 }} />
        </div>
      </div>
      <div style={{ flexShrink: 0, fontFamily: APP_FONT_MONO, fontSize: 12, fontWeight: 700, color: short ? t.warning : t.success, minWidth: 44, textAlign: 'right' }}>
        {booked}<span style={{ color: t.inkFaint, fontWeight: 600 }}>/{target}</span>
      </div>
    </div>
  );
}

// Density-aware day cell for the forward day-strip (NOT a calendar grid).
function DayStripCell({ t, d, selected, onSel }) {
  const load = d.count;
  const loadColor = load === 0 ? t.inkDim : load >= 5 ? t.teal : load >= 3 ? t.tealLight : t.inkFaint;
  return (
    <div style={{
      width: 52, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, padding: '8px 0 9px', borderRadius: 12,
      background: selected ? t.teal : d.today ? t.tealTint : t.surface,
      border: `1px solid ${selected ? t.teal : d.today ? `${t.teal}44` : t.rule}`,
      boxShadow: selected ? `0 4px 12px ${t.teal}44` : 'none',
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO, color: selected ? 'rgba(255,255,255,0.8)' : t.inkFaint }}>{d.dow}</div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, color: selected ? '#fff' : t.ink, lineHeight: 1 }}>{d.date}</div>
      {/* density: stacked load bars */}
      <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 12 }}>
        {load === 0 ? (
          <div style={{ width: 16, height: 2, background: selected ? 'rgba(255,255,255,0.4)' : t.inkDim, borderRadius: 999 }} />
        ) : (
          Array.from({ length: Math.min(load, 5) }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 4 + i * 1.8, background: selected ? '#fff' : loadColor, borderRadius: 1, opacity: selected ? 0.9 : 1 }} />
          ))
        )}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, color: selected ? 'rgba(255,255,255,0.85)' : load === 0 ? t.inkDim : loadColor }}>{load === 0 ? '—' : load}</div>
    </div>
  );
}

// Generic section label
function PLabel({ t, children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{children}</div>
      {right}
    </div>
  );
}

// Primary full-width button
function PBtn({ t, children, kind = 'primary', icon }) {
  const styles = {
    primary:   { bg: t.teal, fg: '#fff', bd: 'none', sh: `0 4px 12px ${t.teal}44` },
    secondary: { bg: t.surface, fg: t.ink, bd: `1px solid ${t.rule}`, sh: 'none' },
    ghost:     { bg: 'transparent', fg: t.teal, bd: `1px solid ${t.teal}44`, sh: 'none' },
  }[kind];
  return (
    <div style={{
      minHeight: 48, padding: '13px 16px', background: styles.bg, color: styles.fg, border: styles.bd,
      borderRadius: 12, fontSize: 14, fontWeight: 700, textAlign: 'center', boxShadow: styles.sh,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {children}{icon}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SAMPLE DATA — realistic Trinidad & Tobago names + TTD. Today = Tue 23 Jun 2026.
// ──────────────────────────────────────────────────────────────────────────
const TODAY_APPTS = [
  { time: '8:30',  mer: 'AM', type: 'FFI',  dur: '45m', who: 'Kavita Ramlogan', note: 'Education plan · 2 kids', status: 'kept' },
  { time: '10:00', mer: 'AM', type: 'CI',   dur: '1h',  who: 'Anand Maharaj',   note: 'Whole Life · 250K cover', amount: 'TTD 18,400', status: 'confirmed' },
  { time: '11:30', mer: 'AM', type: 'SC',   dur: '30m', who: 'Marlon Joseph',   note: 'Drop docs · San Fernando', status: 'scheduled' },
  { time: '12:30', mer: 'PM', type: 'FREE', dur: '1h',  label: 'Lunch · personal', status: 'scheduled' },
  { time: '1:30',  mer: 'PM', type: 'AI',   dur: '45m', who: 'Nisha Persad',    note: 'Referral from Kavita', status: 'scheduled' },
  { time: '3:00',  mer: 'PM', type: 'CI',   dur: '1h',  who: 'Reshma Ali',      note: 'Annuity top-up', status: 'cancelled' },
  { time: '5:00',  mer: 'PM', type: 'PC',   dur: '1h',  label: 'Prospecting calls · 8 to dial', status: 'scheduled' },
];

const FOLLOWUPS = [
  { name: 'Dexter Charles',   why: 'Said call back month-end',        meta: 'Pension transfer · TTD 240K', due: 'Today',     tone: 'warning' },
  { name: 'Priya Gopaul',     why: 'After pay day — the 25th',         meta: 'Critical Illness rider',      due: 'Today',     tone: 'warning' },
  { name: 'Curtis Mohammed',  why: 'Re-quote annuity at lower premium', meta: 'Annuity · was TTD 1,200/mo',  due: '2 days ago', tone: 'danger' },
  { name: 'Aaliyah Baptiste', why: 'Wanted to talk to her husband',    meta: 'Family Income Benefit',       due: 'Yesterday', tone: 'warning' },
];

// Forward day-strip — ~2-month horizon, per-day load count (current date 23 Jun).
const DAY_STRIP = [
  { dow: 'MON', date: '22', count: 4 }, { dow: 'TUE', date: '23', count: 6, today: true },
  { dow: 'WED', date: '24', count: 2 }, { dow: 'THU', date: '25', count: 5 },
  { dow: 'FRI', date: '26', count: 3 }, { dow: 'SAT', date: '27', count: 1 },
  { dow: 'SUN', date: '28', count: 0 }, { dow: 'MON', date: '29', count: 4 },
  { dow: 'TUE', date: '30', count: 3 }, { dow: 'WED', date: '01', count: 2 },
  { dow: 'THU', date: '02', count: 5 }, { dow: 'FRI', date: '03', count: 0 },
];

// The selected week as a 7-day list (load + booked type mix).
const WEEK_DAYS = [
  { dow: 'Mon', date: 'Jun 22', count: 4, mix: ['CI', 'FFI', 'SC', 'PC'] },
  { dow: 'Tue', date: 'Jun 23', count: 6, mix: ['FFI', 'CI', 'SC', 'AI', 'CI', 'PC'], today: true },
  { dow: 'Wed', date: 'Jun 24', count: 2, mix: ['FFI', 'AI'] },
  { dow: 'Thu', date: 'Jun 25', count: 5, mix: ['CI', 'CI', 'FFI', 'SC', 'PC'] },
  { dow: 'Fri', date: 'Jun 26', count: 3, mix: ['AI', 'FFI', 'SC'] },
  { dow: 'Sat', date: 'Jun 27', count: 1, mix: ['FREE'] },
  { dow: 'Sun', date: 'Jun 28', count: 0, mix: [] },
];

// Weekly minimums vs booked — visibly short on CIs.
const WEEK_TARGETS = [
  { type: 'CI',  booked: 6,  target: 10 },
  { type: 'FFI', booked: 9,  target: 8  },
  { type: 'AI',  booked: 4,  target: 6  },
  { type: 'SC',  booked: 7,  target: 6  },
];

Object.assign(window, {
  ACT_CODE, ACT_NAME, actStyle, ActChip, STATUS, StatusPill,
  PHeader, PBody, PlannerNav, TimeRail, ApptRow, GapRow, CounterBar, DayStripCell, PLabel, PBtn,
  TODAY_APPTS, FOLLOWUPS, DAY_STRIP, WEEK_DAYS, WEEK_TARGETS,
});
