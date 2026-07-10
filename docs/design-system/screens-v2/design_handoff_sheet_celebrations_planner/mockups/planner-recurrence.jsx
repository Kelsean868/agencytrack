// Planner — RECURRENCE states. Design source for recurring appointments,
// kept inside the shipped Planner visual language (planner-shared /
// AppointmentSheet grammar: bottom sheet, SegTabs, FieldRow, ActChip,
// ApptRow timeline).
//
// Covers:
//   • Create — repeat rule (none / daily / weekly / custom days) + end
//     condition (never / on date / after N times), with a plain-language
//     series preview before booking.
//   • Series indicator on calendar items (↻ badge + series line).
//   • Instance vs series edit choice (the sheet asks BEFORE the edit).
//   • Postpone one instance — scope locked to "just this one", and the
//     timeline state after: instance moved, series untouched.

// ── Small primitives ──────────────────────────────────────────────────────
function RecChip({ t, on, children, warn = false }) {
  return (
    <div style={{
      padding: '9px 13px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, minHeight: 20,
      background: on ? (warn ? t.warning : t.teal) : t.surfaceSoft,
      color: on ? '#fff' : t.inkMute,
      border: `1px solid ${on ? (warn ? t.warning : t.teal) : t.rule}`,
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
    }}>{children}</div>
  );
}

// Day-of-week picker (custom days rule). 44px targets.
function RecDayPicker({ t, selected = [] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const keys = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {days.map((d, i) => {
        const on = selected.includes(keys[i]);
        return (
          <div key={keys[i]} style={{
            width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13.5, fontWeight: 700, fontFamily: APP_FONT_DISPLAY,
            background: on ? t.teal : t.surfaceSoft, color: on ? '#fff' : t.inkMute,
            border: `1px solid ${on ? t.teal : t.rule}`,
            boxShadow: on ? `0 3px 10px ${t.teal}44` : 'none',
          }}>{d}</div>
        );
      })}
    </div>
  );
}

// The ↻ series badge that sits beside the ActChip on recurring items.
function RecBadge({ t, size = 18 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 6, background: t.tealTint, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <IconRepeat size={size - 7} color={t.teal} stroke={2.4} />
    </span>
  );
}

// Series summary line — plain language, always the same shape.
function RecSeriesLine({ t, children, warn = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 600, color: warn ? t.warning : t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.02em' }}>
      <IconRepeat size={11} color={warn ? t.warning : t.teal} stroke={2.4} />
      {children}
    </div>
  );
}

// ── Recurring-aware appointment row (ApptRow + series indicator) ──────────
function RecApptRow({ t, appt, railLine = true }) {
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
      <div style={{ position: 'relative', width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {railLine && <div style={{ position: 'absolute', top: 0, bottom: -14, width: 2, background: t.rule }} />}
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.surface, border: `2.5px solid ${dot}`, marginTop: 5, zIndex: 1, boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
        <div className="a-card" style={{
          padding: '11px 13px', background: appt.type === 'FREE' ? t.surfaceSoft : t.surface,
          border: `1px solid ${appt.type === 'FREE' ? t.rule : (dim ? t.rule : `${s.fg}2e`)}`,
          borderRadius: 12, opacity: dim ? 0.62 : 1,
          borderStyle: appt.type === 'FREE' ? 'dashed' : 'solid',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (appt.who || appt.label) ? 7 : 0 }}>
            <ActChip t={t} type={appt.type} />
            {appt.series && <RecBadge t={t} />}
            <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, fontWeight: 600 }}>{appt.dur}</div>
            <div style={{ flex: 1 }} />
            <StatusPill t={t} status={appt.status} />
          </div>
          {appt.who ? (
            <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em', textDecoration: cancelled ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.who}</div>
          ) : (
            <div style={{ fontSize: 13.5, fontWeight: 600, color: t.inkMute, letterSpacing: '-0.005em' }}>{appt.label}</div>
          )}
          {appt.note && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.note}</div>}
          {appt.series && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.rule}` }}>
              <RecSeriesLine t={t}>{appt.series}</RecSeriesLine>
            </div>
          )}
          {appt.reschedTo && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.rule}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 11, color: t.warning, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconArrowR size={12} color={t.warning} stroke={2.2} /> Moved to {appt.reschedTo}
              </div>
              {appt.seriesNote && <RecSeriesLine t={t}>{appt.seriesNote}</RecSeriesLine>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sheet scaffold (AppointmentSheet grammar) ─────────────────────────────
function RecSheet({ t, title, sub, children, footer }) {
  return (
    <MFrame t={t}>
      <SheetBackdrop t={t} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.42)', backdropFilter: 'blur(1.5px)', zIndex: 18 }} />
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
            <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>{title}</div>
            {sub && <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{sub}</div>}
          </div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute, fontSize: 18 }}>×</div>
        </div>
        <div style={{ padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {children}
        </div>
        {footer && <div style={{ padding: '16px 18px 0' }}>{footer}</div>}
      </div>
    </MFrame>
  );
}

function RecField({ t, value, hint }) {
  return (
    <div style={{ padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
      {value} {hint || <IconChevD size={14} color={t.inkMute} />}
    </div>
  );
}

// ── 1 · CREATE — repeat rule + end condition ──────────────────────────────
function RecCreateSheet({ t, rule = 'weekly', end = 'count', days = ['TUE'] }) {
  const rules = [['none', 'None'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['custom', 'Custom days']];
  const ends = [['never', 'Never'], ['date', 'On date'], ['count', 'After # times']];
  const custom = rule === 'custom';
  const preview = custom
    ? 'Books 28 appointments · Tue & Thu, 5:00 PM · until Sep 30'
    : end === 'count' ? 'Books 12 appointments · every Tue, 5:00 PM · through Sep 8'
    : 'Repeats every Tue · 5:00 PM · no end date';
  return (
    <RecSheet
      t={t}
      title="Book appointment"
      sub="Tue · Jun 24"
      footer={<PBtn t={t}>{rule === 'none' ? 'Book appointment' : 'Book series'}</PBtn>}
    >
      {/* What */}
      <FieldRow t={t} label="What">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
          <ActChip t={t} type="PC" />
          <div style={{ flex: 1, fontSize: 13, color: t.ink, fontWeight: 700 }}>Prospecting calls · 8 to dial</div>
        </div>
      </FieldRow>

      {/* Time + length */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><FieldRow t={t} label="Time"><RecField t={t} value="5:00 PM" /></FieldRow></div>
        <div style={{ width: 116 }}><FieldRow t={t} label="Length"><RecField t={t} value="1h" /></FieldRow></div>
      </div>

      {/* Repeat rule */}
      <FieldRow t={t} label="Repeats">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {rules.map(([k, l]) => <RecChip key={k} t={t} on={k === rule}>{k !== 'none' && <IconRepeat size={12} color={k === rule ? '#fff' : t.inkMute} stroke={2.4} />}{l}</RecChip>)}
        </div>
        {custom && (
          <div style={{ marginTop: 11 }}>
            <RecDayPicker t={t} selected={days} />
          </div>
        )}
      </FieldRow>

      {/* End condition — only exists once it repeats */}
      {rule !== 'none' && (
        <FieldRow t={t} label="Ends">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {ends.map(([k, l]) => <RecChip key={k} t={t} on={k === end}>{l}</RecChip>)}
          </div>
          {end === 'count' && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              {['−', '12', '+'].map((x, i) => (
                <div key={i} style={{
                  width: i === 1 ? 64 : 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: i === 1 ? 17 : 20, fontWeight: 700, fontFamily: APP_FONT_DISPLAY,
                  background: i === 1 ? t.surface : t.surfaceSoft, color: t.ink,
                  border: `1px solid ${i === 1 ? t.ruleStrong : t.rule}`,
                }}>{x}</div>
              ))}
              <div style={{ fontSize: 12, color: t.inkMute, fontWeight: 600 }}>times</div>
            </div>
          )}
          {end === 'date' && <div style={{ marginTop: 10 }}><RecField t={t} value="Tue · Sep 30, 2026" /></div>}
        </FieldRow>
      )}

      {/* Plain-language series preview */}
      {rule !== 'none' && (
        <div style={{ padding: '11px 13px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 11 }}>
          <RecSeriesLine t={t}>{preview}</RecSeriesLine>
        </div>
      )}
    </RecSheet>
  );
}

// ── 2 · SERIES ON THE CALENDAR — the day timeline with indicators ─────────
const REC_DAY = [
  { time: '8:30',  mer: 'AM', type: 'FFI',  dur: '45m', who: 'Kavita Ramlogan', note: 'Education plan · 2 kids', status: 'kept' },
  { time: '10:00', mer: 'AM', type: 'CI',   dur: '1h',  who: 'Anand Maharaj',   note: 'Whole Life · 250K cover', status: 'confirmed' },
  { time: '12:30', mer: 'PM', type: 'FREE', dur: '1h',  label: 'Lunch · personal', status: 'scheduled', series: 'Every weekday · no end date' },
  { time: '1:30',  mer: 'PM', type: 'AI',   dur: '45m', who: 'Nisha Persad',    note: 'Referral from Kavita', status: 'scheduled' },
  { time: '5:00',  mer: 'PM', type: 'PC',   dur: '1h',  label: 'Prospecting calls · 8 to dial', status: 'scheduled', series: 'Every Tue · 4 of 12 · ends Sep 8' },
];

const REC_DAY_POSTPONED = REC_DAY.map((a) =>
  a.time === '5:00'
    ? { ...a, status: 'postponed', reschedTo: 'Thu Jun 26 · 5:00 PM', series: null, seriesNote: 'Only this one moved · series stays every Tue' }
    : a
);

function RecTimeline({ t, appts, title = 'Today', sub }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="TUE · JUN 24 · WEEK 26" title={title} sub={sub} />
      <PBody t={t} top={118}>
        <div style={{ paddingTop: 4 }}>
          {appts.map((a, i) => <RecApptRow key={i} t={t} appt={a} railLine={i < appts.length - 1} />)}
        </div>
      </PBody>
      <PlannerNav t={t} active="today" />
    </MFrame>
  );
}

// ── 3 · EDIT — instance vs series choice ──────────────────────────────────
function RecEditChoice({ t }) {
  return (
    <MFrame t={t}>
      {/* dimmed day behind */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.45, filter: 'saturate(0.8)', pointerEvents: 'none' }}>
        <PHeader t={t} eyebrow="TUE · JUN 24 · WEEK 26" title="Today" />
        <PBody t={t} top={118}>
          <div style={{ paddingTop: 4 }}>
            {REC_DAY.slice(2, 5).map((a, i) => <RecApptRow key={i} t={t} appt={a} railLine={i < 2} />)}
          </div>
        </PBody>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.42)', backdropFilter: 'blur(1.5px)', zIndex: 18 }} />

      {/* choice sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
        background: t.surface, borderRadius: '22px 22px 0 0', borderTop: `1px solid ${t.rule}`,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', paddingBottom: 26,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9 }}>
          <div style={{ width: 38, height: 5, borderRadius: 999, background: t.ruleStrong }} />
        </div>
        <div style={{ padding: '12px 18px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RecBadge t={t} size={22} />
            <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>This appointment repeats</div>
          </div>
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 4 }}>Prospecting calls · every Tue, 5:00 PM · 4 of 12</div>
        </div>
        <div style={{ padding: '12px 18px 0', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { title: 'Edit this appointment only', sub: 'Tue Jun 24 changes · the rest of the series stays', icon: <IconClock size={17} color={t.teal} stroke={2} />, hi: true },
            { title: 'Edit this and all future', sub: 'Jun 24 onward · past appointments never change', icon: <IconRepeat size={17} color={t.teal} stroke={2} /> },
          ].map((o, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', minHeight: 44, boxSizing: 'border-box',
              background: o.hi ? t.tealTint : t.surface, border: `1px solid ${o.hi ? t.teal + '44' : t.rule}`, borderRadius: 13, cursor: 'pointer',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: o.hi ? t.surface : t.surfaceSoft, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{o.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{o.title}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2 }}>{o.sub}</div>
              </div>
              <IconChevR size={15} color={t.inkFaint} stroke={2.2} />
            </div>
          ))}
          <div style={{ marginTop: 3, padding: '13px 15px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: t.inkMute, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 13, minHeight: 44, boxSizing: 'border-box' }}>Cancel</div>
        </div>
      </div>
    </MFrame>
  );
}

// ── 4 · POSTPONE ONE INSTANCE — scope locked to "just this one" ───────────
function RecPostponeSheet({ t }) {
  return (
    <RecSheet
      t={t}
      title="Postpone appointment"
      sub="Prospecting calls · Tue Jun 24, 5:00 PM"
      footer={<PBtn t={t}>Move this one</PBtn>}
    >
      {/* context card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
        <ActChip t={t} type="PC" />
        <RecBadge t={t} />
        <div style={{ flex: 1, fontSize: 12.5, color: t.ink, fontWeight: 700 }}>Part of a series</div>
        <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, fontWeight: 600 }}>4 OF 12</div>
      </div>

      {/* scope — locked */}
      <FieldRow t={t} label="Applies to">
        <div style={{ display: 'flex', gap: 7 }}>
          <RecChip t={t} on warn>Just this one</RecChip>
          <div style={{ padding: '9px 13px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: t.inkDim, border: `1px dashed ${t.rule}`, display: 'inline-flex', alignItems: 'center' }}>Whole series — use Edit</div>
        </div>
      </FieldRow>

      {/* new slot */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><FieldRow t={t} label="New day"><RecField t={t} value="Thu · Jun 26" /></FieldRow></div>
        <div style={{ width: 128 }}><FieldRow t={t} label="Time"><RecField t={t} value="5:00 PM" /></FieldRow></div>
      </div>

      {/* what happens */}
      <div style={{ padding: '11px 13px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <RecSeriesLine t={t} warn>Only Tue Jun 24 moves to Thu Jun 26</RecSeriesLine>
        <RecSeriesLine t={t}>The series stays every Tue · next: Jul 1, 5:00 PM</RecSeriesLine>
      </div>
    </RecSheet>
  );
}

Object.assign(window, {
  RecChip, RecDayPicker, RecBadge, RecSeriesLine, RecApptRow, RecSheet, RecField,
  RecCreateSheet, RecTimeline, RecEditChoice, RecPostponeSheet,
  REC_DAY, REC_DAY_POSTPONED,
});
