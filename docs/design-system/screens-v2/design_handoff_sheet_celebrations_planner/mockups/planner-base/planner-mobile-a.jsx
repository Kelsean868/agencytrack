// Planner & Scheduler — mobile scenes (A): Today, Day Timeline, Week Booking,
// Add/Edit appointment bottom sheet. Each returns a full MFrame (390×844).

// ──────────────────────────────────────────────────────────────────────────
// 1 · TODAY (home) — time-ordered day + follow-ups strip + quick-add (FAB)
// ──────────────────────────────────────────────────────────────────────────
function PlannerToday({ t }) {
  const dueCount = FOLLOWUPS.filter((f) => f.due === 'Today' || f.due.includes('ago') || f.due === 'Yesterday').length;
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="TUE · 23 JUN 2026" title="Today"
        right={(
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <IconBell size={17} color={t.inkMute} />
              <div style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: t.danger, border: `2px solid ${t.surface}` }} />
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>MS</div>
          </div>
        )} />
      <PBody t={t} top={108}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Day pulse */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { k: 'Booked', v: '6', s: 'appointments', c: t.teal },
              { k: 'Kept', v: '1', s: 'so far today', c: t.success },
              { k: 'Free', v: '2', s: 'open gaps', c: t.warning },
            ].map((x, i) => (
              <div key={i} style={{ padding: '11px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: x.c, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>{x.k}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 5 }}>{x.v}</div>
                <div style={{ fontSize: 10, color: t.inkMute, marginTop: 3 }}>{x.s}</div>
              </div>
            ))}
          </div>

          {/* Follow-ups due strip */}
          <div style={{ padding: '13px 15px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="a-breathe" style={{ width: 38, height: 38, borderRadius: '50%', background: t.surface, border: `1px solid ${t.warning}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconRepeat size={17} color={t.warning} stroke={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{dueCount} follow-ups due</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dexter Charles, Priya Gopaul +2</div>
            </div>
            <div style={{ padding: '7px 12px', background: t.warning, color: '#fff', borderRadius: 9, fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              Review <IconChevR size={12} color="#fff" stroke={2.4} />
            </div>
          </div>

          {/* Timeline */}
          <div>
            <PLabel t={t} right={<div style={{ fontSize: 10.5, fontWeight: 600, color: t.inkMute }}>Tap a gap to book</div>}>Your day</PLabel>
            <ApptRow t={t} appt={TODAY_APPTS[0]} />
            {/* now marker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '0 0 12px' }}>
              <div style={{ width: 52, textAlign: 'right', paddingRight: 12, fontSize: 10, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO }}>9:18</div>
              <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: t.teal, boxShadow: `0 0 0 3px ${t.tealTint}` }} />
              </div>
              <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${t.teal}, ${t.teal}00)`, borderRadius: 999, marginLeft: 2 }} />
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, marginLeft: 6, letterSpacing: '0.1em' }}>NOW</div>
            </div>
            <ApptRow t={t} appt={TODAY_APPTS[1]} />
            <ApptRow t={t} appt={TODAY_APPTS[2]} />
            <ApptRow t={t} appt={TODAY_APPTS[3]} railLine={false} />
          </div>
        </div>
      </PBody>
      <PlannerNav t={t} active="today" badge={dueCount} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2 · DAY TIMELINE — a selected day, gaps explicitly tappable
// ──────────────────────────────────────────────────────────────────────────
const THU_APPTS = [
  { kind: 'appt', a: { time: '9:00',  mer: 'AM', type: 'CI',  dur: '1h',  who: 'Terrence Sookdeo', note: 'Mortgage protection', status: 'confirmed' } },
  { kind: 'gap',  time: '10:30', mer: 'AM', free: '1h 30m free' },
  { kind: 'appt', a: { time: '12:00', mer: 'PM', type: 'FFI', dur: '45m', who: 'Shivani Boodram', note: 'Young family · first policy', status: 'scheduled' } },
  { kind: 'appt', a: { time: '1:00',  mer: 'PM', type: 'FREE', dur: '1h', label: 'Branch training · Tatil', status: 'scheduled' } },
  { kind: 'appt', a: { time: '2:30',  mer: 'PM', type: 'CI',  dur: '1h',  who: 'Brandon Clarke', note: 'Term → Whole Life upgrade', status: 'scheduled' } },
  { kind: 'gap',  time: '4:00', mer: 'PM', free: '1h free' },
  { kind: 'appt', a: { time: '5:00',  mer: 'PM', type: 'SC', dur: '30m', who: 'Reshma Ali', note: 'Re-book cancelled CI', status: 'scheduled' } },
];
function PlannerDay({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} onBack eyebrow="THU · 25 JUN" title="Thursday"
        right={(
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute }}>
              <span style={{ display: 'flex', transform: 'scaleX(-1)' }}><IconChevR size={16} color={t.inkMute} stroke={2.2} /></span>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute }}>
              <IconChevR size={16} color={t.inkMute} stroke={2.2} />
            </div>
          </div>
        )} />
      <PBody t={t} top={104}>
        {/* day summary chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>5 booked</div>
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: t.inkDim }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: t.teal }}>2 closing interviews</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: t.warning, fontFamily: APP_FONT_MONO }}>2 gaps</div>
        </div>
        <div>
          {THU_APPTS.map((it, i) => {
            const last = i === THU_APPTS.length - 1;
            return it.kind === 'gap'
              ? <GapRow key={i} t={t} time={it.time} mer={it.mer} free={it.free} railLine={!last} />
              : <ApptRow key={i} t={t} appt={it.a} railLine={!last} />;
          })}
        </div>
      </PBody>
      <PlannerNav t={t} active="week" badge={4} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3 · FORWARD DAY-STRIP + WEEK BOOKING — the phone-day booking surface
// ──────────────────────────────────────────────────────────────────────────
function WeekMix({ t, mix }) {
  if (!mix.length) return <div style={{ fontSize: 11, color: t.inkFaint, fontStyle: 'italic' }}>Nothing booked</div>;
  const shown = mix.slice(0, 5);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
      {shown.map((m, i) => <ActChip key={i} t={t} type={m} size="s" />)}
      {mix.length > 5 && <span style={{ fontSize: 10.5, fontWeight: 600, color: t.inkFaint, fontFamily: APP_FONT_MONO, alignSelf: 'center' }}>+{mix.length - 5}</span>}
    </div>
  );
}
function PlannerWeek({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="BOOK AHEAD · NEXT 8 WEEKS" title="Book the week"
        right={<div style={{ padding: '8px 12px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><IconPlus size={13} color="#fff" stroke={2.4} />Add</div>} />
      <PBody t={t} top={104} pad="0">
        {/* Day strip — horizontal scroll (NOT a month grid) */}
        <div style={{ padding: '0 0 4px' }}>
          <div style={{ display: 'flex', gap: 8, padding: '2px 18px 8px', overflow: 'hidden' }}>
            {DAY_STRIP.map((d, i) => <DayStripCell key={i} t={t} d={d} selected={d.today} />)}
          </div>
        </div>

        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Weekly minimums — visibly short on CIs */}
          <div style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Week of Jun 22 · vs minimum</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>4 CIs short</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {WEEK_TARGETS.map((w, i) => <CounterBar key={i} t={t} type={w.type} booked={w.booked} target={w.target} />)}
            </div>
          </div>

          {/* The week — 7-day list */}
          <PLabel t={t}>Jun 22 – 28</PLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {WEEK_DAYS.map((d, i) => (
              <div key={i} style={{
                padding: '11px 13px', background: d.today ? t.tealTint : t.surface,
                border: `1px solid ${d.today ? `${t.teal}44` : t.rule}`, borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 38, flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: d.today ? t.teal : t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{d.dow}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, lineHeight: 1.1 }}>{d.date.split(' ')[1]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <WeekMix t={t} mix={d.mix} />
                  <div style={{ fontSize: 10, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO }}>{d.count === 0 ? 'Open' : `${d.count} booked`}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: d.today ? t.teal : t.surfaceSoft, border: `1px solid ${d.today ? t.teal : t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconPlus size={15} color={d.today ? '#fff' : t.inkMute} stroke={2.4} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PBody>
      <PlannerNav t={t} active="week" badge={4} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4 · ADD / EDIT APPOINTMENT — fast bottom sheet, optimized for repeat entry
// ──────────────────────────────────────────────────────────────────────────
function SheetBackdrop({ t }) {
  // Lightweight dimmed week behind the sheet.
  return (
    <div style={{ position: 'absolute', inset: 0, top: 44, opacity: 0.5, filter: 'saturate(0.8)', pointerEvents: 'none' }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 23, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Book the week</div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {DAY_STRIP.slice(0, 6).map((d, i) => <DayStripCell key={i} t={t} d={d} selected={d.today} />)}
        </div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {WEEK_DAYS.slice(0, 4).map((d, i) => (
            <div key={i} style={{ height: 56, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SegTabs({ t, options, active }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
      {options.map((o) => {
        const on = o.key === active;
        return (
          <div key={o.key} style={{ flex: 1, textAlign: 'center', padding: '9px 4px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.ink : t.inkMute, boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', border: on ? `1px solid ${t.rule}` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {o.icon}{o.label}
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({ t, label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

function AddSheet({ t, mode = 'prospect', toast }) {
  return (
    <MFrame t={t}>
      <SheetBackdrop t={t} />
      {/* scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.42)', backdropFilter: 'blur(1.5px)', zIndex: 18 }} />
      {/* saved toast */}
      {toast && (
        <div className="a-fade-up" style={{ position: 'absolute', top: 60, left: 18, right: 18, zIndex: 40, padding: '12px 15px', background: t.success, color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          <IconCheck size={17} color="#fff" stroke={2.6} />
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>Booked — Kavita Ramlogan, Wed 10:00</div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, fontFamily: APP_FONT_MONO }}>UNDO</div>
        </div>
      )}
      {/* sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
        background: t.surface, borderRadius: '22px 22px 0 0', borderTop: `1px solid ${t.rule}`,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', paddingBottom: 22,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9 }}>
          <div style={{ width: 38, height: 5, borderRadius: 999, background: t.ruleStrong }} />
        </div>
        <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>Book appointment</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Wed · Jun 24</div>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute, fontSize: 18 }}>×</div>
        </div>

        <div style={{ padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 15 }}>
          <SegTabs t={t} active={mode} options={[
            { key: 'prospect', label: 'Prospect', icon: <IconSearch size={13} color={mode === 'prospect' ? t.ink : t.inkMute} /> },
            { key: 'free', label: 'Free block', icon: <IconClock size={13} color={mode === 'free' ? t.ink : t.inkMute} /> },
          ]} />

          {mode === 'prospect' ? (
            <FieldRow t={t} label="Who">
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                <IconSearch size={15} color={t.inkMute} />
                <div style={{ flex: 1, fontSize: 13, color: t.ink, fontWeight: 600 }}>Kavi<span style={{ color: t.inkFaint, fontWeight: 400 }}>|</span></div>
              </div>
              <div style={{ marginTop: 7, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, overflow: 'hidden' }}>
                {[
                  { n: 'Kavita Ramlogan', m: 'Education plan · last seen 12 Jun', hot: true },
                  { n: 'Kavi Seepersad', m: 'Cold lead · referral' },
                ].map((p, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none', background: p.hot ? t.tealTint : 'transparent' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.surface, border: `1px solid ${t.rule}`, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY }}>{p.n.split(' ').map((s) => s[0]).join('')}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{p.n}</div>
                      <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.m}</div>
                    </div>
                    {p.hot && <IconCheck size={16} color={t.teal} stroke={2.4} />}
                  </div>
                ))}
                <div style={{ padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8, color: t.teal }}>
                  <IconPlus size={14} color={t.teal} stroke={2.4} /><div style={{ fontSize: 12.5, fontWeight: 700 }}>New prospect "Kavi"</div>
                </div>
              </div>
            </FieldRow>
          ) : (
            <FieldRow t={t} label="Block type">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['Training', 'Company seminar', 'Tradeshow', 'Prospecting time', 'Personal'].map((b, i) => (
                  <div key={i} style={{ padding: '9px 13px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: i === 0 ? t.teal : t.surfaceSoft, color: i === 0 ? '#fff' : t.inkMute, border: `1px solid ${i === 0 ? t.teal : t.rule}` }}>{b}</div>
                ))}
              </div>
            </FieldRow>
          )}

          {/* Time + duration */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FieldRow t={t} label="Time">
                <div style={{ padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  10:00 AM <IconChevD size={14} color={t.inkMute} />
                </div>
              </FieldRow>
            </div>
            <div style={{ width: 116 }}>
              <FieldRow t={t} label="Length">
                <div style={{ padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  1h <IconChevD size={14} color={t.inkMute} />
                </div>
              </FieldRow>
            </div>
          </div>

          {/* Type */}
          {mode === 'prospect' && (
            <FieldRow t={t} label="Activity type">
              <div style={{ display: 'flex', gap: 6 }}>
                {['PC', 'SC', 'AI', 'FFI', 'CI'].map((ty) => {
                  const on = ty === 'CI';
                  const s = actStyle(t, ty);
                  return (
                    <div key={ty} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: APP_FONT_MONO, background: on ? s.bg : t.surfaceSoft, color: on ? (s.solid ? '#fff' : s.fg) : t.inkMute, border: `1.5px solid ${on ? (s.solid ? s.bg : s.fg) : t.rule}` }}>{ACT_CODE[ty]}</div>
                  );
                })}
              </div>
            </FieldRow>
          )}
        </div>

        {/* Footer — rapid repeat entry */}
        <div style={{ padding: '16px 18px 0', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><PBtn t={t} kind="secondary">Save &amp; add another</PBtn></div>
          <div style={{ flex: 1 }}><PBtn t={t} kind="primary" icon={<IconCheck size={15} color="#fff" stroke={2.4} />}>Save</PBtn></div>
        </div>
      </div>
    </MFrame>
  );
}

Object.assign(window, { PlannerToday, PlannerDay, PlannerWeek, WeekMix, AddSheet, SegTabs, FieldRow, SheetBackdrop });
