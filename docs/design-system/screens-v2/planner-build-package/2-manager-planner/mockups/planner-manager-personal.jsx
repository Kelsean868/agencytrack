// Planner & Scheduler — MANAGER tier: PERSONAL PLANNER (selling managers).
// A Unit/Branch Manager still sells, recruits, and runs meetings — so they get
// their OWN agent-style planner, extended for a manager's reality: the day
// blends THREE streams — Sell · Coach · Recruit — and adds recruiting activity
// types (career calls, recruiting interviews, career seminars) the agent side
// doesn't have. Reuses planner-shared primitives (PHeader/PBody/PBtn/PLabel/
// TimeRail/GapRow/CounterBar/DayStripCell/ActChip/actStyle) + manager-shared
// (Ava). Loads after planner-shared + planner-manager-shared.

// ──────────────────────────────────────────────────────────────────────────
// STREAMS — the three hats a selling manager wears. One hue each.
// ──────────────────────────────────────────────────────────────────────────
function streamStyle(t, stream) {
  return {
    sell:    { label: 'Sell',    fg: t.teal,      bg: t.tealTint,      Icon: IconTarget },
    coach:   { label: 'Coach',   fg: t.gold,      bg: t.goldTint,      Icon: IconUsers },
    recruit: { label: 'Recruit', fg: t.inkAccent, bg: t.inkAccentTint, Icon: IconBolt },
  }[stream] || { label: 'Sell', fg: t.teal, bg: t.tealTint, Icon: IconTarget };
}

// Recruiting + management activity codes (superset on top of the selling codes).
const RCODE = {
  RC:   { code: 'R.C',   name: 'Career calls',          stream: 'recruit' },
  RI:   { code: 'R.I',   name: 'Recruiting interview',   stream: 'recruit' },
  RSEM: { code: 'R.SEM', name: 'Career seminar',         stream: 'recruit' },
  ONE:  { code: '1:1',   name: 'One-on-one coaching',    stream: 'coach' },
  UNIT: { code: 'UNIT',  name: 'Unit meeting',           stream: 'coach' },
  JCI:  { code: 'C.I',   name: 'Joint closing interview', stream: 'coach' },
};

// Unified code → {label, fg, bg, solid}. Selling codes keep their agent tones;
// recruiting/management codes take their stream hue (seminar & unit-mtg solid).
function mgrCodeMeta(t, code) {
  if (ACT_CODE[code]) { const s = actStyle(t, code); return { label: ACT_CODE[code], fg: s.fg, bg: s.bg, solid: s.solid }; }
  const r = RCODE[code] || RCODE.RC;
  const st = streamStyle(t, r.stream);
  const solid = code === 'RSEM' || code === 'UNIT';
  return { label: r.code, fg: solid ? '#fff' : st.fg, bg: solid ? st.fg : st.bg, solid };
}
function MgrChip({ t, code, size = 'm' }) {
  const m = mgrCodeMeta(t, code);
  const pad = size === 's' ? '2px 6px' : '3px 8px';
  const fs = size === 's' ? 9.5 : 10.5;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: pad, borderRadius: 6, fontSize: fs, fontWeight: 700, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO, color: m.fg, background: m.bg, border: m.solid ? 'none' : `1px solid ${m.fg}2e`, whiteSpace: 'nowrap', flexShrink: 0 }}>{m.label}</span>
  );
}

// Stream tag — the Sell/Coach/Recruit pill that makes a blended day legible.
function StreamTag({ t, stream, mini }) {
  const s = streamStyle(t, stream);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: mini ? '2px 6px' : '3px 8px', borderRadius: 999, background: s.bg, color: s.fg, fontSize: mini ? 8.5 : 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <s.Icon size={mini ? 9 : 10} color={s.fg} stroke={2.2} />{s.label}
    </span>
  );
}

// Time-split bar — how today divides across the three hats.
function TimeSplit({ t, sell, coach, recruit, compact }) {
  const segs = [
    { k: 'sell', v: sell, ...streamStyle(t, 'sell') },
    { k: 'coach', v: coach, ...streamStyle(t, 'coach') },
    { k: 'recruit', v: recruit, ...streamStyle(t, 'recruit') },
  ];
  const total = sell + coach + recruit;
  return (
    <div>
      <div style={{ display: 'flex', height: compact ? 8 : 11, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        {segs.map((s) => <div key={s.k} className="a-progress-grow" style={{ width: `${(s.v / total) * 100}%`, background: s.fg, borderRadius: 3 }} />)}
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 14, marginTop: 9 }}>
          {segs.map((s) => (
            <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.fg }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: t.ink }}>{s.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{Math.round((s.v / total) * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Blended appointment row — stream-tinted dot, code chip, stream tag.
function MgrApptRow({ t, ap, railLine = true }) {
  const m = mgrCodeMeta(t, ap.code);
  const st = streamStyle(t, ap.stream);
  const isFree = ap.code === 'FREE';
  const dim = ap.status === 'cancelled' || ap.status === 'postponed';
  const dot = ap.status === 'kept' || ap.status === 'done' ? t.success : isFree ? t.inkDim : st.fg;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <TimeRail t={t} time={ap.time} meridiem={ap.mer} dim={dim || isFree} />
      <div style={{ position: 'relative', width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {railLine && <div style={{ position: 'absolute', top: 0, bottom: -14, width: 2, background: t.rule }} />}
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.surface, border: `2.5px solid ${dot}`, marginTop: 5, zIndex: 1, boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
        <div className="a-card" style={{ padding: '11px 13px', background: isFree ? t.surfaceSoft : t.surface, border: `1px solid ${isFree ? t.rule : `${st.fg}2e`}`, borderLeft: isFree ? `1px solid ${t.rule}` : `3px solid ${st.fg}`, borderRadius: 12, opacity: dim ? 0.62 : 1, borderStyle: isFree ? 'dashed' : 'solid' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: ap.who ? 7 : 0 }}>
            <MgrChip t={t} code={ap.code} />
            <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, fontWeight: 600 }}>{ap.dur}</div>
            <div style={{ flex: 1 }} />
            {!isFree && <StreamTag t={t} stream={ap.stream} mini />}
          </div>
          {ap.who ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ap.who}</div>
                {ap.note && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ap.note}</div>}
              </div>
              {ap.amount && <div style={{ fontSize: 13, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{ap.amount}</div>}
            </div>
          ) : (
            <div style={{ fontSize: 13.5, fontWeight: 600, color: t.inkMute }}>{ap.label}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Recruiting funnel stage pill
function StagePill({ t, stage }) {
  const map = {
    Contacted: { fg: t.inkAccent, bg: t.inkAccentTint },
    Interview: { fg: t.teal, bg: t.tealTint },
    Seminar:   { fg: t.gold, bg: t.goldTint },
    Selecting: { fg: t.success, bg: t.successTint },
  };
  const s = map[stage] || map.Contacted;
  return <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, color: s.fg, background: s.bg, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{stage.toUpperCase()}</span>;
}

// Recruiting target counter (reuses CounterBar visual language)
function RTarget({ t, code, booked, target }) {
  const pct = Math.min(100, (booked / target) * 100), short = booked < target;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 48, flexShrink: 0 }}><MgrChip t={t} code={code} size="s" /></div>
      <div style={{ flex: 1, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div className="a-progress-grow" style={{ width: `${pct}%`, height: 7, background: short ? t.warning : t.success, borderRadius: 999 }} />
      </div>
      <div style={{ flexShrink: 0, fontFamily: APP_FONT_MONO, fontSize: 12, fontWeight: 700, color: short ? t.warning : t.success, minWidth: 40, textAlign: 'right' }}>{booked}<span style={{ color: t.inkFaint, fontWeight: 600 }}>/{target}</span></div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Personal planner nav — My Day · Week · [Book FAB] · Recruit · Team
// (Team jumps to the coaching tier built in planner-manager-*.)
// ──────────────────────────────────────────────────────────────────────────
function MgrPersonalNav({ t, active = 'myday' }) {
  const tabs = [
    { key: 'myday', label: 'My Day', Icon: IconHome },
    { key: 'week', label: 'Week', Icon: IconGrid },
    { key: 'book', label: 'Book', Icon: IconPlus, fab: true },
    { key: 'recruit', label: 'Recruit', Icon: IconBolt },
    { key: 'team', label: 'Team', Icon: IconUsers },
  ];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 24, background: t.surface, borderTop: `1px solid ${t.rule}`, boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)', zIndex: 15 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 10px 10px' }}>
        {tabs.map((tab) => {
          const on = active === tab.key;
          if (tab.fab) {
            return (
              <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 54 }}>
                <div className="a-fab-pulse" style={{ width: 58, height: 58, borderRadius: '50%', background: `linear-gradient(180deg, ${t.tealLight} 0%, ${t.teal} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginTop: -30, '--fab-glow-1': `${t.teal}66`, '--fab-glow-2': `${t.teal}55`, boxShadow: `0 6px 16px ${t.teal}66, 0 2px 4px rgba(40,37,29,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`, border: `3px solid ${t.surface}` }}>
                  <tab.Icon size={25} color="#fff" stroke={2.5} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, marginTop: 1 }}>{tab.label}</div>
              </div>
            );
          }
          return (
            <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 54 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tab.Icon size={21} color={on ? t.teal : t.inkFaint} stroke={2} />
                {on && <div style={{ position: 'absolute', inset: -7, background: t.tealTint, borderRadius: 999, zIndex: -1, width: 34, height: 34, top: -6.5, left: '50%', transform: 'translateX(-50%)' }} />}
              </div>
              <div style={{ fontSize: 10, fontWeight: on ? 700 : 600, color: on ? t.teal : t.inkMute }}>{tab.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DATA — Devon Ramlal's own blended day (he sells + coaches + recruits).
// ──────────────────────────────────────────────────────────────────────────
const MGR_MY_DAY = [
  { time: '8:30',  mer: 'AM', code: 'FFI',  stream: 'sell',    dur: '45m', who: 'Kavita Ramlogan', note: 'Your client · education plan', status: 'kept' },
  { time: '9:30',  mer: 'AM', code: 'ONE',  stream: 'coach',   dur: '30m', who: '1-on-1 · Riaz Khan', note: 'Coaching pack ready', status: 'confirmed' },
  { time: '10:30', mer: 'AM', code: 'RI',   stream: 'recruit', dur: '45m', who: 'Anisa Mohammed', note: 'Career interview · referred by Marsha', status: 'scheduled' },
  { time: '12:00', mer: 'PM', code: 'FREE', stream: 'sell',    dur: '45m', label: 'Lunch · personal', status: 'scheduled' },
  { time: '1:00',  mer: 'PM', code: 'CI',   stream: 'sell',    dur: '1h',  who: 'Anand Maharaj', note: 'Your client · Whole Life close', amount: 'TTD 18,400', status: 'confirmed' },
  { time: '2:30',  mer: 'PM', code: 'JCI',  stream: 'coach',   dur: '1h',  who: 'Curtis Mohammed', note: 'Joint CI with Riaz', status: 'scheduled' },
  { time: '4:00',  mer: 'PM', code: 'RC',   stream: 'recruit', dur: '1h',  label: 'Career calls · 6 candidates to dial', status: 'scheduled' },
];

const MGR_SELL_TARGETS = [
  { code: 'CI',  booked: 4, target: 6 },
  { code: 'FFI', booked: 3, target: 4 },
];
const MGR_RECRUIT_TARGETS = [
  { code: 'RI',   booked: 2, target: 3 },
  { code: 'RC',   booked: 9, target: 12 },
  { code: 'RSEM', booked: 1, target: 1 },
];

// Recruiting pipeline — candidates the manager is working toward contract.
const RECRUIT_FUNNEL = [
  { stage: 'Contacted', count: 8 }, { stage: 'Interview', count: 3 }, { stage: 'Seminar', count: 2 }, { stage: 'Selecting', count: 1 },
];
const RECRUIT_PIPELINE = [
  { name: 'Anisa Mohammed', stage: 'Interview', meta: 'R.I today 10:30 · ref by Marsha', next: 'Career interview', hot: true },
  { name: 'Kern Bridglal',  stage: 'Seminar',   meta: 'Attended career night · keen', next: 'Book 2nd interview' },
  { name: 'Shivana Lalla',  stage: 'Contacted', meta: 'Wants the info pack', next: 'R.C follow-up' },
  { name: 'Darren Boodoo',  stage: 'Selecting', meta: 'Contracting paperwork started', next: 'Licensing exam date' },
];

// Manager's personal week — blended load (sell + coach + recruit mix per day).
const MGR_WEEK = [
  { dow: 'Mon', date: '22', mix: ['CI', 'ONE', 'RI'], count: 5 },
  { dow: 'Tue', date: '23', mix: ['FFI', 'ONE', 'RI', 'CI', 'JCI', 'RC'], count: 6, today: true },
  { dow: 'Wed', date: '24', mix: ['JCI', 'RC', 'UNIT'], count: 4 },
  { dow: 'Thu', date: '25', mix: ['CI', 'RI', 'RSEM'], count: 5 },
  { dow: 'Fri', date: '26', mix: ['ONE', 'FFI', 'RC'], count: 3 },
  { dow: 'Sat', date: '27', mix: ['RSEM'], count: 1 },
  { dow: 'Sun', date: '28', mix: [], count: 0 },
];

// ──────────────────────────────────────────────────────────────────────────
// 1 · MY DAY (blended) — the manager's personal landing
// ──────────────────────────────────────────────────────────────────────────
function MgrMyDay({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="TUE · 23 JUN · YOUR DAY" title="My day"
        right={<div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}><IconBell size={17} color={t.inkMute} /><div style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: t.danger, border: `2px solid ${t.surface}` }} /></div>
          <Ava t={t} name="Devon Ramlal" size={36} bg={t.goldTint} fg={t.gold} />
        </div>} />
      <PBody t={t} top={108}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* three-hats split */}
          <div style={{ padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>How today splits</div>
              <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>3 HATS · 7 BLOCKS</div>
            </div>
            <TimeSplit t={t} sell={40} coach={30} recruit={30} />
          </div>

          {/* recruiting nudge */}
          <div style={{ padding: '12px 14px', background: t.inkAccentTint, border: `1px solid ${t.inkAccent}2e`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="a-breathe" style={{ width: 34, height: 34, borderRadius: '50%', background: t.surface, border: `1px solid ${t.inkAccent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconBolt size={16} color={t.inkAccent} stroke={2} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Recruiting interview at 10:30</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Anisa Mohammed · 1 more R.I to hit your week</div>
            </div>
            <StreamTag t={t} stream="recruit" mini />
          </div>

          {/* blended timeline */}
          <div>
            <PLabel t={t} right={<div style={{ fontSize: 10.5, fontWeight: 600, color: t.inkMute }}>Sell · Coach · Recruit</div>}>Your day</PLabel>
            <MgrApptRow t={t} ap={MGR_MY_DAY[0]} />
            <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 12px' }}>
              <div style={{ width: 52, textAlign: 'right', paddingRight: 12, fontSize: 10, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO }}>9:18</div>
              <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}><div style={{ width: 9, height: 9, borderRadius: '50%', background: t.teal, boxShadow: `0 0 0 3px ${t.tealTint}` }} /></div>
              <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${t.teal}, ${t.teal}00)`, borderRadius: 999, marginLeft: 2 }} />
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, marginLeft: 6, letterSpacing: '0.1em' }}>NOW</div>
            </div>
            {MGR_MY_DAY.slice(1, 5).map((ap, i) => <MgrApptRow key={i} t={t} ap={ap} />)}
            <MgrApptRow t={t} ap={MGR_MY_DAY[6]} railLine={false} />
          </div>
        </div>
      </PBody>
      <MgrPersonalNav t={t} active="myday" />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2 · MY WEEK (book) — personal week, three-hat balance + targets
// ──────────────────────────────────────────────────────────────────────────
function MgrMyWeek({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="BOOK YOUR OWN WEEK" title="My week"
        right={<div style={{ padding: '8px 12px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><IconPlus size={13} color="#fff" stroke={2.4} />Add</div>} />
      <PBody t={t} top={104} pad="0">
        <div style={{ padding: '0 18px 4px' }}>
          <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
            {MGR_DAY_STRIP.map((d, i) => <DayStripCell key={i} t={t} d={d} selected={d.today} />)}
          </div>
        </div>
        <div style={{ padding: '6px 18px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* dual targets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11 }}><StreamTag t={t} stream="sell" mini /><div style={{ flex: 1 }} /><span style={{ fontSize: 9, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>2 SHORT</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{MGR_SELL_TARGETS.map((w, i) => <CounterBar key={i} t={t} type={w.code} booked={w.booked} target={w.target} />)}</div>
            </div>
            <div style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11 }}><StreamTag t={t} stream="recruit" mini /><div style={{ flex: 1 }} /><span style={{ fontSize: 9, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>1 R.I SHORT</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{MGR_RECRUIT_TARGETS.map((w, i) => <RTarget key={i} t={t} code={w.code} booked={w.booked} target={w.target} />)}</div>
            </div>
          </div>

          {/* week list — blended mix per day */}
          <PLabel t={t}>Jun 22 – 28 · your commitments</PLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {MGR_WEEK.map((d, i) => (
              <div key={i} style={{ padding: '11px 13px', background: d.today ? t.tealTint : t.surface, border: `1px solid ${d.today ? `${t.teal}44` : t.rule}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: d.today ? t.teal : t.inkFaint, fontFamily: APP_FONT_MONO }}>{d.dow}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, lineHeight: 1.1 }}>{d.date}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {d.mix.length ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      {d.mix.slice(0, 5).map((c, j) => <MgrChip key={j} t={t} code={c} size="s" />)}
                      {d.mix.length > 5 && <span style={{ fontSize: 10.5, fontWeight: 600, color: t.inkFaint, fontFamily: APP_FONT_MONO, alignSelf: 'center' }}>+{d.mix.length - 5}</span>}
                    </div>
                  ) : <div style={{ fontSize: 11, color: t.inkFaint, fontStyle: 'italic' }}>Open</div>}
                  <div style={{ fontSize: 10, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO }}>{d.count === 0 ? 'Nothing booked' : `${d.count} blocks`}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: d.today ? t.teal : t.surfaceSoft, border: `1px solid ${d.today ? t.teal : t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconPlus size={15} color={d.today ? '#fff' : t.inkMute} stroke={2.4} /></div>
              </div>
            ))}
          </div>
        </div>
      </PBody>
      <MgrPersonalNav t={t} active="week" />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3 · MY RECRUITING — the genuinely new surface (career pipeline + activities)
// ──────────────────────────────────────────────────────────────────────────
function MgrRecruiting({ t, empty }) {
  if (empty) {
    return (
      <MFrame t={t}>
        <PHeader t={t} eyebrow="BUILD YOUR UNIT" title="Recruiting" right={<Ava t={t} name="Devon Ramlal" size={36} bg={t.goldTint} fg={t.gold} />} />
        <div style={{ position: 'absolute', top: 108, left: 0, right: 0, bottom: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, borderRadius: 22, background: t.surface, border: `1.5px dashed ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}><IconBolt size={32} color={t.inkFaint} stroke={1.6} /></div>
          <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>No candidates yet</div>
          <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>Book career calls or a recruiting seminar to start your pipeline. Growing the unit is part of the week too.</div>
          <div style={{ marginTop: 22, width: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <PBtn t={t} kind="primary" icon={<IconPlus size={15} color="#fff" stroke={2.4} />}>Book a career call</PBtn>
            <PBtn t={t} kind="ghost">Schedule a career seminar</PBtn>
          </div>
        </div>
        <MgrPersonalNav t={t} active="recruit" />
      </MFrame>
    );
  }
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="BUILD YOUR UNIT" title="Recruiting" right={<Ava t={t} name="Devon Ramlal" size={36} bg={t.goldTint} fg={t.gold} />} />
      <PBody t={t} top={108}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* funnel */}
          <div style={{ padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Career pipeline</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkAccent, fontFamily: APP_FONT_MONO }}>1 SELECTING</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {RECRUIT_FUNNEL.map((f, i) => (
                <div key={i} style={{ flex: f.count + 1, minWidth: 0 }}>
                  <div style={{ height: 30, borderRadius: 8, background: i === 3 ? t.successTint : i === 2 ? t.goldTint : i === 1 ? t.tealTint : t.inkAccentTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, color: i === 3 ? t.success : i === 2 ? t.gold : i === 1 ? t.teal : t.inkAccent }}>{f.count}</div>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 5, textAlign: 'center', letterSpacing: '0.02em' }}>{f.stage.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* recruiting week targets */}
          <div style={{ padding: '13px 15px', background: t.inkAccentTint, border: `1px solid ${t.inkAccent}2e`, borderRadius: 13 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkAccent, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginBottom: 11 }}>THIS WEEK · RECRUITING ACTIVITY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{MGR_RECRUIT_TARGETS.map((w, i) => <RTarget key={i} t={t} code={w.code} booked={w.booked} target={w.target} />)}</div>
          </div>

          {/* candidates */}
          <PLabel t={t}>Candidates</PLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RECRUIT_PIPELINE.map((c, i) => (
              <div key={i} style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${c.hot ? `${t.inkAccent}33` : t.rule}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Ava t={t} name={c.name} size={32} bg={t.inkAccentTint} fg={t.inkAccent} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{c.name}</div>
                    <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.meta}</div>
                  </div>
                  <StagePill t={t} stage={c.stage} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.rule}` }}>
                  <IconArrowR size={13} color={t.inkAccent} stroke={2.2} />
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: t.ink }}>Next: {c.next}</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ padding: '6px 12px', background: t.inkAccent, color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>Book</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PBody>
      <MgrPersonalNav t={t} active="recruit" />
    </MFrame>
  );
}

// ── States — My Day loading + error ───────────────────────────────────────
function MgrMyDayLoading({ t }) {
  const sk = (w, h, r = 6) => ({ width: w, height: h, borderRadius: r, background: t.surfaceMute });
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="TUE · 23 JUN · YOUR DAY" title="My day" right={<Ava t={t} name="Devon Ramlal" size={36} bg={t.goldTint} fg={t.gold} />} />
      <PBody t={t} top={108}>
        <div className="a-glow-soft" style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: 0.85 }}>
          <div style={{ height: 64, ...sk('auto', 64, 13) }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 0 }}>
              <div style={{ width: 52, display: 'flex', justifyContent: 'flex-end', paddingRight: 12 }}><div style={sk(30, 12)} /></div>
              <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: t.surfaceMute, marginTop: 4 }} /></div>
              <div style={{ flex: 1, padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}><div style={sk(38, 16)} /><div style={{ flex: 1 }} /><div style={sk(52, 16, 999)} /></div>
                <div style={sk(i % 2 ? 130 : 160, 14)} />
              </div>
            </div>
          ))}
        </div>
      </PBody>
      <MgrPersonalNav t={t} active="myday" />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4 · BOOK (manager) — the booking sheet that exposes a manager's FULL set of
// bookable block types, grouped by stream. This is where 1-on-1s, unit
// meetings, joint work, trainings, recruiting interviews & seminars become
// first-class options — not just things that show up pre-booked.
// ──────────────────────────────────────────────────────────────────────────
// Each stream's bookable types + the "who/what" the type attaches to.
const MGR_BOOK_MODES = {
  sell: {
    label: 'Sell', stream: 'sell',
    types: [
      { code: 'PC', label: 'Prospecting calls' }, { code: 'SC', label: 'Seen call' },
      { code: 'AI', label: 'Approach' }, { code: 'FFI', label: 'Fact-find' }, { code: 'CI', label: 'Closing' },
    ],
    attach: { label: 'Client / prospect', value: 'Anand Maharaj', sub: 'Your book · Whole Life', icon: 'search' },
  },
  coach: {
    label: 'Coach', stream: 'coach',
    types: [
      { code: 'ONE', label: '1-on-1 meeting' }, { code: 'UNIT', label: 'Unit meeting' }, { code: 'JCI', label: 'Joint work' },
    ],
    attach: { label: 'With', value: 'Riaz Khan', sub: 'Unit S·02 · coaching pack ready', icon: 'user' },
  },
  recruit: {
    label: 'Recruit', stream: 'recruit',
    types: [
      { code: 'RC', label: 'Career calls' }, { code: 'RI', label: 'Recruiting interview' }, { code: 'RSEM', label: 'Career seminar' },
    ],
    attach: { label: 'Candidate', value: 'Anisa Mohammed', sub: 'Interview stage · ref by Marsha', icon: 'user' },
  },
  block: {
    label: 'Block', stream: 'coach',
    types: [
      { code: 'TRAIN', label: 'Training' }, { code: 'SEM', label: 'Company seminar' }, { code: 'TRADE', label: 'Tradeshow' }, { code: 'PERS', label: 'Personal' },
    ],
    attach: null,
  },
};

// Which attach UI a given (mode,type) needs. Unit meeting attaches the whole
// unit; joint work attaches an agent + a prospect; recruiting types a candidate.
function bookAttach(mode, typeCode) {
  if (mode === 'block') return null;
  if (mode === 'coach' && typeCode === 'UNIT') return { label: 'Attendees', value: 'Whole unit · S·02', sub: '6 agents invited', icon: 'users' };
  if (mode === 'coach' && typeCode === 'JCI') return { label: 'With agent · on prospect', value: 'Riaz Khan · Curtis Mohammed', sub: 'Joint closing interview', icon: 'users' };
  return MGR_BOOK_MODES[mode].attach;
}

function MgrBookSheet({ t, mode = 'coach' }) {
  const cfg = MGR_BOOK_MODES[mode];
  // default selected type per mode (the headline option)
  const selType = { sell: 'CI', coach: 'ONE', recruit: 'RI', block: 'TRAIN' }[mode];
  const attach = bookAttach(mode, selType);
  const st = streamStyle(t, cfg.stream);
  const isManagerCode = (c) => RCODE[c]; // ONE/UNIT/JCI/RC/RI/RSEM render via MgrChip
  const AttachIcon = attach && attach.icon === 'users' ? IconUsers : attach && attach.icon === 'search' ? IconSearch : IconUsers;
  return (
    <MFrame t={t}>
      {/* faded backdrop */}
      <div style={{ position: 'absolute', inset: 0, top: 44, opacity: 0.5, pointerEvents: 'none' }}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 23, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>My day</div>
          <div style={{ marginTop: 14 }}><MgrApptRow t={t} ap={MGR_MY_DAY[1]} /><MgrApptRow t={t} ap={MGR_MY_DAY[2]} railLine={false} /></div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.42)', backdropFilter: 'blur(1.5px)', zIndex: 18 }} />

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, background: t.surface, borderRadius: '22px 22px 0 0', borderTop: `1px solid ${t.rule}`, boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', paddingBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9 }}><div style={{ width: 38, height: 5, borderRadius: 999, background: t.ruleStrong }} /></div>
        <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>Book a block</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Wed · Jun 24 · your planner</div>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute, fontSize: 18 }}>×</div>
        </div>

        <div style={{ padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* stream selector — Sell · Coach · Recruit · Block */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>What kind of block</div>
            <div style={{ display: 'flex', gap: 4, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              {Object.keys(MGR_BOOK_MODES).map((k) => {
                const on = k === mode; const ks = streamStyle(t, MGR_BOOK_MODES[k].stream);
                return (
                  <div key={k} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? ks.fg : t.inkMute, boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', border: on ? `1px solid ${ks.fg}44` : '1px solid transparent' }}>{MGR_BOOK_MODES[k].label}</div>
                );
              })}
            </div>
          </div>

          {/* type chips for the chosen stream */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>Type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {cfg.types.map((ty) => {
                const on = ty.code === selType;
                return (
                  <div key={ty.code} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: on ? st.bg : t.surfaceSoft, color: on ? st.fg : t.inkMute, border: `1.5px solid ${on ? `${st.fg}66` : t.rule}` }}>
                    {(ACT_CODE[ty.code] || isManagerCode(ty.code)) && <MgrChip t={t} code={ty.code} size="s" />}
                    {ty.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* attach (who/what) — varies by type */}
          {attach ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>{attach.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: st.bg, color: st.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AttachIcon size={15} color={st.fg} stroke={2.1} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{attach.value}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attach.sub}</div>
                </div>
                <IconChevD size={15} color={t.inkMute} />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>Title</div>
              <div style={{ padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13, color: t.ink, fontWeight: 600 }}>Critical Illness refresher<span style={{ color: t.inkFaint, fontWeight: 400 }}>|</span></div>
            </div>
          )}

          {/* time + length */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>Time</div>
              <div style={{ padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{mode === 'recruit' ? '10:30 AM' : mode === 'block' ? '4:00 PM' : '9:30 AM'} <IconChevD size={14} color={t.inkMute} /></div>
            </div>
            <div style={{ width: 116 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>Length</div>
              <div style={{ padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{mode === 'coach' && selType === 'UNIT' ? '1h' : mode === 'block' ? '2h' : '45m'} <IconChevD size={14} color={t.inkMute} /></div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 18px 0', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><PBtn t={t} kind="secondary">Save &amp; add another</PBtn></div>
          <div style={{ flex: 1 }}><PBtn t={t} kind="primary" icon={<IconCheck size={15} color="#fff" stroke={2.4} />}>Save</PBtn></div>
        </div>
      </div>
    </MFrame>
  );
}

Object.assign(window, {
  streamStyle, RCODE, mgrCodeMeta, MgrChip, StreamTag, TimeSplit, MgrApptRow, StagePill, RTarget, MgrPersonalNav,
  MGR_MY_DAY, MGR_SELL_TARGETS, MGR_RECRUIT_TARGETS, RECRUIT_FUNNEL, RECRUIT_PIPELINE, MGR_WEEK,
  MgrMyDay, MgrMyWeek, MgrRecruiting, MgrMyDayLoading,
  MgrBookSheet, MGR_BOOK_MODES,
});
