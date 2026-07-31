// Planner v3 — grid surfaces. Ports the handoff prototype's EventBlock,
// DesktopGrid, WeeklyGrid and MonthCalendar onto AgencyTrack DS tokens.
const { Icon } = window.AgencyTrackDesignSystem_ad1cd7;
const { useState } = React;

// The DS Icon resolves NAME_PATHS[name] || NAME_PATHS.grid, and play/pause/grip/
// chevron are NOT among its 27 keys — passing those names silently renders the
// four-square grid glyph. These use the DS Icon's children API with the exact
// paths from uploads/planner_handoff/planner-gemini-prototype.jsx.
const IconPlay = (p) => <Icon {...p} fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></Icon>;
const IconPause = (p) => <Icon {...p} fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></Icon>;
const IconGrip = (p) => <Icon {...p} fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="9" cy="19" r="1.4" /><circle cx="15" cy="5" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="15" cy="19" r="1.4" /></Icon>;
const IconChevD = (p) => <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>;
const IconChevU = (p) => <Icon {...p}><polyline points="18 15 12 9 6 15" /></Icon>;

// layoutSlots returns w (fraction of the column) and x (fractional offset) for
// overlapping events. Both were being computed and discarded here, so a partial
// overlap painted one block on top of another — the CSS pins left/right, so the
// split has to override `right` rather than only setting width.
function slotBox(s) {
  const box = { top: s.top, height: s.height };
  if (s.w >= 1) return box;
  const gap = 3;
  return { ...box, right: 'auto', left: 'calc(8px + (100% - 24px) * ' + s.x + ')', width: 'calc((100% - 24px) * ' + s.w + ' - ' + gap + 'px)' };
}
const IconAlert = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>;
const IconBulb = (p) => <Icon {...p}><path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></Icon>;

// ── event block ─────────────────────────────────────────────────────────────
function EventBlock({ event, compact, showPlay, onTogglePlay, onComplete, onClick, h, tomb }) {
  const meta = ACTIVITY_METADATA[event.type] || {};
  const fam = famOf(event.type);
  const done = event.isPast || event.isCompleted;
  const retired = event.status === 'cancelled' || event.status === 'postponed';
  const money = meta.money;
  const suggestion = event.type === 'SUGGESTION';
  const ink = money ? 'var(--heroInk)' : fam.fg;
  const oneLine = tomb || (h || 0) < 56;
  return (
    <button className={'ev' + (event.isPlaying ? ' is-playing' : '') + (retired ? ' is-retired' : '') + (suggestion ? ' is-suggestion' : '') + (oneLine ? ' is-oneline' : '')}
      style={{
        background: money ? 'linear-gradient(150deg,var(--heroA),var(--heroB))' : fam.bg,
        borderColor: retired ? 'var(--rule)' : fam.rule,
        borderStyle: fam.dashed ? 'dashed' : 'solid',
      }}
      onClick={() => onClick && onClick(event)}
      aria-label={(meta.label || event.type) + ' · ' + event.title + ' · ' + formatTime(event.startHour) + (retired ? ' · ' + event.status : '')}>
      {event.isPlaying && <span className="ev-live" aria-hidden="true"></span>}
      <span className="ev-top">
        <span className="ev-code" style={{ color: ink, borderColor: money ? 'transparent' : fam.rule, background: 'transparent' }}>{event.type}</span>
        {!oneLine && <span className="ev-time" title={formatTime(event.startHour)} style={{ color: money ? 'var(--heroInk)' : 'var(--inkMute)' }}>{formatTime(event.startHour)}</span>}
        {/* Duration is dropped in compact/one-line rows: the block's own height already
            encodes it, and keeping it forces the status control outside the card.
            Ink is --inkMute, never --inkFaint: --inkFaint is AA-verified against
            --surface, and these cards sit on FAMILY TINTS where it drops to ~3.7:1. */}
        {!compact && !oneLine && <span className="ev-dur" style={{ color: money ? 'var(--heroInk)' : 'var(--inkMute)' }}>{durLabel(event)}</span>}
        {oneLine && <span className="ev-inline" title={event.title} style={{ color: money ? 'var(--heroInk)' : 'var(--ink)', textDecoration: retired ? 'line-through' : 'none' }}>{event.title}</span>}
        <span className="ev-sp"></span>
        {done && !retired && <span className="ev-check" aria-label="kept"><Icon name="check" size={13} /></span>}
        {/* The start time cannot be recovered when crushed, so it never shrinks. In a
            compact week column there is no width for a status WORD at all — the row is
            129px and the other children want 97px — so the status stops competing for
            the line and becomes a dot: hue carries cancelled vs postponed, the title
            carries the word, and it costs 8px instead of 39. */}
        {retired && (compact
          ? <span className="ev-st ev-st-dot" title={event.status === 'cancelled' ? 'Cancelled' : 'Postponed'}
              aria-label={event.status === 'cancelled' ? 'Cancelled' : 'Postponed'}
              style={{ background: event.status === 'cancelled' ? 'var(--danger)' : 'var(--warning)' }}></span>
          : <span className="ev-st" title={event.status === 'cancelled' ? 'Cancelled' : 'Postponed'}>
              {event.status === 'cancelled' ? 'CANCELLED' : 'POSTPONED'}
            </span>)}
        {showPlay && !done && !retired && !suggestion && !oneLine && (
          <span className="ev-play" role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onTogglePlay && onTogglePlay(event.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onTogglePlay && onTogglePlay(event.id); } }}
            aria-label={event.isPlaying ? 'Pause ' + event.title : 'Start ' + event.title}>
            {event.isPlaying ? <IconPause size={12} /> : <IconPlay size={12} />}
          </span>
        )}
      </span>
      {!oneLine && <span className="ev-title" style={{ color: money ? 'var(--heroInk)' : 'var(--ink)', textDecoration: retired ? 'line-through' : 'none' }} title={event.title}>{event.title}</span>}
      {!compact && !oneLine && (h || 0) >= 96 && event.details && <span className="ev-det" title={event.details}>{event.details}</span>}
      {(h || 0) >= 120 && !oneLine && (
        <span className="ev-foot">
          {event.amount && <span className="ev-amt" style={{ color: money ? 'var(--heroInk)' : 'var(--inkMute)' }}>{event.amount}</span>}
          {event.tag && <span className="ev-tag">{event.tag}</span>}
          {event.joint && <span className="ev-tag"><Icon name="users" size={10} /> {event.joint.split(' ')[0]}</span>}
          {event.urgent && <span className="ev-tag ev-urg">{event.urgent}</span>}
          {/* Was a static tag keyed off the seeded PREP lookup, which said "Prep" whether
              anything had been prepared or not. Now it reports the real checklist state. */}
          {(() => { const ps = prepState(event); return ps && !done && !retired
            ? <span className={'ev-tag ev-prep' + (ps.ready ? ' is-ready' : '')} title={ps.ready ? 'Prepped' : ps.done + ' of ' + ps.total + ' prep items done'}>
                <Icon name="book" size={10} /> {ps.ready ? 'Prepped' : ps.done + '/' + ps.total}
              </span>
            : null; })()}
        </span>
      )}
      {event.isPlaying && !oneLine && <span className="ev-running">RUNNING</span>}
    </button>
  );
}

// ── hour gutter ─────────────────────────────────────────────────────────────
function Gutter() {
  return (
    <div className="gut">
      {HOURS.map(h => (
        <div key={h} className="gut-cell" style={{ height: ROW_HEIGHT }}>
          <span className="gut-lab">{formatTime(h).replace(':00', '')}</span>
        </div>
      ))}
    </div>
  );
}

// ── day grid ────────────────────────────────────────────────────────────────
function DayGrid({ events, currentHour, dragging, draggedTask, hoveredHour, onDragOver, onDragLeave, onDrop, showPlay, onTogglePlay, onComplete, onEventClick }) {
  return (
    <div className="dg">
      <Gutter />
      <div className="dg-col" onDragOver={(e) => onDragOver(e, TODAY_KEY)} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, TODAY_KEY)}>
        {HOURS.map(h => <div key={h} className="dg-line" style={{ top: (h - 8) * ROW_HEIGHT }}></div>)}
        {currentHour >= 8 && currentHour <= 18 && (
          <div className="nowline" style={{ top: (currentHour - 8) * ROW_HEIGHT }}>
            <span className="now-dot"></span><span className="now-lab">{formatTime(currentHour)}</span>
          </div>
        )}
        {dragging && draggedTask && hoveredHour !== null && (
          <div className="drop-ghost" style={{ top: (hoveredHour - 8) * ROW_HEIGHT, height: draggedTask.duration * ROW_HEIGHT }}>
            <span>Drop at<br />{formatTime(hoveredHour)}</span>
          </div>
        )}
        <div className={'dg-events' + (dragging ? ' is-dragging' : '')}>
          {layoutSlots(events).map(s => (
            <div key={s.ev.id} className="dg-slot" style={slotBox(s)}>
              <EventBlock event={s.ev} h={s.height} tomb={s.tomb} showPlay={showPlay} onTogglePlay={onTogglePlay} onComplete={onComplete} onClick={onEventClick} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── week grid — horizontal scroll is acceptable, so all 7 days keep a readable
//    minimum column width and the day header carries a load heatmap ──────────
function WeekGrid({ currentHour, dragging, draggedTask, hoveredHour, hoveredDay, onDragOver, onDragLeave, onDrop, showPlay, onTogglePlay, onComplete, onEventClick, todayEvents }) {
  const eventsFor = (day) => day === TODAY_KEY ? todayEvents : (WEEK_EVENTS[day] || []);
  const load = (day) => eventsFor(day).filter(e => e.type !== 'SUGGESTION').reduce((s, e) => s + (e.endHour - e.startHour), 0);
  const heat = (hrs) => hrs > 6 ? 'heat-hi' : hrs > 3 ? 'heat-mid' : '';
  return (
    <div className="wg-scroll">
      <div className="wg">
        <div className="wg-head">
          <div className="wg-gut-h"></div>
          {WEEK_DAYS.map(day => {
            const hrs = load(day);
            const isToday = day === TODAY_KEY;
            return (
              <div key={day} className={'wg-dh ' + heat(hrs) + (isToday ? ' is-today' : '')}>
                <span className="wg-dow">{day.split(' ')[0]}</span>
                <span className="wg-date">{day.split(' ')[1]}</span>
                <span className="wg-load">{hrs.toFixed(1)}h planned</span>
              </div>
            );
          })}
        </div>
        <div className="wg-body">
          <Gutter />
          {WEEK_DAYS.map(day => {
            const evs = eventsFor(day);
            const isToday = day === TODAY_KEY;
            return (
              <div key={day} className={'wg-col ' + heat(load(day)) + (isToday ? ' is-today' : '')}
                onDragOver={(e) => onDragOver(e, day)} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, day)}>
                {HOURS.map(h => <div key={h} className="dg-line" style={{ top: (h - 8) * ROW_HEIGHT }}></div>)}
                {isToday && currentHour >= 8 && currentHour <= 18 && (
                  <div className="nowline" style={{ top: (currentHour - 8) * ROW_HEIGHT }}><span className="now-dot"></span></div>
                )}
                {dragging && draggedTask && hoveredDay === day && hoveredHour !== null && (
                  <div className="drop-ghost" style={{ top: (hoveredHour - 8) * ROW_HEIGHT, height: draggedTask.duration * ROW_HEIGHT }}>
                    <span>{formatTime(hoveredHour)}</span>
                  </div>
                )}
                <div className={'dg-events' + (dragging ? ' is-dragging' : '')}>
                  {layoutSlots(evs).map(s => (
                    <div key={s.ev.id} className="dg-slot" style={slotBox(s)}>
                      <EventBlock event={s.ev} h={s.height} tomb={s.tomb} compact showPlay={showPlay} onTogglePlay={onTogglePlay} onComplete={onComplete} onClick={onEventClick} />
                    </div>
                  ))}
                  {evs.length === 0 && <div className="wg-empty">Nothing planned</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── month calendar (collapsible, in the action pane) ────────────────────────
function MonthCalendar({ month, onMonth }) {
  const [open, setOpen] = useState(false);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dows = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const prevDim = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(<span key={'b' + i} className="mc-day mc-out">{prevDim - first + i + 1}</span>);
  for (let d = 1; d <= dim; d++) {
    const today = d === 1 && month.getMonth() === 6 && month.getFullYear() === 2026;
    cells.push(<button key={d} className={'mc-day' + (today ? ' is-today' : '')}>{d}</button>);
  }
  return (
    <div className="mc">
      <button className="mc-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="mc-title">{names[month.getMonth()]} {month.getFullYear()}</span>
        {open ? <IconChevU size={15} /> : <IconChevD size={15} />}
        {open && (
          <span className="mc-nav">
            <span role="button" tabIndex={0} aria-label="Previous month"
              onClick={(e) => { e.stopPropagation(); onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }}><Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} /></span>
            <span role="button" tabIndex={0} aria-label="Next month"
              onClick={(e) => { e.stopPropagation(); onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); }}><Icon name="arrow" size={14} /></span>
          </span>
        )}
      </button>
      {open && (
        <div className="mc-grid-wrap">
          <div className="mc-dows">{dows.map(d => <span key={d}>{d}</span>)}</div>
          <div className="mc-grid">{cells}</div>
        </div>
      )}
    </div>
  );
}

// Smart view — the same day with the dead air removed. A working day is mostly
// gaps, and at 96px an hour the real work scrolls off the bottom while empty
// afternoons take the screen. Here each block keeps a height proportional to its
// duration (floored so a 30m block stays legible) and every gap over the
// threshold collapses to one line that still says how much time it is and still
// takes a drop — so free time reads as an opportunity rather than as blank pixels.
// Below the threshold the gap is drawn to scale: a 15-minute turn between two
// appointments is information, not waste.
const SMART_PX_PER_HOUR = 74;
const SMART_MIN_H = 54;

function SmartView({ events, gapThreshold = 45, dragging, onDrop, showPlay, onTogglePlay, onEventClick }) {
  const live = layoutSlots(events).slice().sort((a, b) => a.ev.startHour - b.ev.startHour || a.ev.endHour - b.ev.endHour);
  const bands = [];
  let cursor = 8;
  live.forEach(s => {
    const gap = s.ev.startHour - cursor;
    if (gap > 0.01) bands.push({ kind: 'gap', from: cursor, to: s.ev.startHour, mins: Math.round(gap * 60) });
    bands.push({ kind: 'ev', s });
    cursor = Math.max(cursor, s.ev.endHour);
  });
  if (cursor < 17) bands.push({ kind: 'gap', from: cursor, to: 17, mins: Math.round((17 - cursor) * 60) });

  const freeMins = bands.filter(b => b.kind === 'gap').reduce((n, b) => n + b.mins, 0);
  const bookedMins = live.filter(s => !s.tomb).reduce((n, s) => n + (s.ev.endHour - s.ev.startHour) * 60, 0);
  const openings = bands.filter(b => b.kind === 'gap' && b.mins >= gapThreshold).length;
  const hOf = (s) => s.tomb ? TOMB_H : Math.max(SMART_MIN_H, (s.ev.endHour - s.ev.startHour) * SMART_PX_PER_HOUR);

  return (
    <div className="sv">
      <div className="sv-head">
        <span className="pf-eb">SMART · EMPTY TIME COLLAPSED</span>
        <span className="sv-sum">{Math.round(bookedMins / 60 * 10) / 10}h booked · {Math.floor(freeMins / 60)}h {freeMins % 60}m free in {openings} opening{openings === 1 ? '' : 's'}</span>
      </div>
      <div className="sv-scroll">
        {bands.map((b, i) => b.kind === 'gap' ? (
          b.mins >= gapThreshold ? (
            <button key={'g' + i} className={'sv-gap' + (dragging ? ' is-target' : '')}
              onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (x) {} }}
              onDrop={(e) => { e.preventDefault(); onDrop && onDrop(b.from); }}
              title={'Free from ' + formatTime(b.from) + ' to ' + formatTime(b.to)}>
              <span className="sv-gap-line"></span>
              <span className="sv-gap-lab">{b.mins >= 60 ? Math.floor(b.mins / 60) + 'h' + (b.mins % 60 ? ' ' + (b.mins % 60) + 'm' : '') : b.mins + 'm'} free · {formatTime(b.from)}</span>
              <span className="sv-gap-cta">{dragging ? 'Drop to book' : 'Fill it'}</span>
              <span className="sv-gap-line"></span>
            </button>
          ) : (
            <div key={'g' + i} className="sv-turn" style={{ height: Math.max(8, b.mins / 60 * SMART_PX_PER_HOUR) }}
              title={b.mins + ' minutes between appointments'} aria-hidden="true"></div>
          )
        ) : (
          <div key={b.s.ev.id} className="sv-ev" style={{ height: hOf(b.s) }}>
            <span className="sv-time">{formatTime(b.s.ev.startHour)}</span>
            <span className="sv-body">
              <EventBlock event={b.s.ev} h={hOf(b.s)} tomb={b.s.tomb} showPlay={showPlay} onTogglePlay={onTogglePlay} onClick={onEventClick} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hour compression for the Smart week. Takes the occupied intervals (the union
// across all seven days) and returns a piecewise hour→px mapping: busy stretches
// keep their scale, gaps over the threshold collapse to a single band, gaps under
// it stay drawn to scale. The Smart DAY view applies the same rule and the same
// threshold, but as a band list rather than a mapping — one day does not need the
// seven-column geometry.
const SMART_GAP_H = 30;

function compressHours(intervals, threshold, pxPerHour) {
  const merged = [];
  intervals.slice().sort((a, b) => a.s - b.s).forEach(iv => {
    const last = merged[merged.length - 1];
    if (last && iv.s <= last.e + 0.001) last.e = Math.max(last.e, iv.e);
    else merged.push({ s: iv.s, e: iv.e });
  });
  const segs = [];
  let cur = 8, y = 0;
  const pushGap = (from, to) => {
    const mins = Math.round((to - from) * 60);
    const collapsed = mins >= threshold;
    const h = collapsed ? SMART_GAP_H : (to - from) * pxPerHour;
    segs.push({ kind: 'gap', s: from, e: to, y, h, collapsed, mins });
    y += h;
  };
  merged.forEach(m => {
    if (m.s > cur + 0.001) pushGap(cur, m.s);
    const h = (m.e - m.s) * pxPerHour;
    segs.push({ kind: 'busy', s: m.s, e: m.e, y, h });
    y += h;
    cur = Math.max(cur, m.e);
  });
  if (cur < 17 - 0.001) pushGap(cur, 17);
  const yOf = (hour) => {
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      if (hour >= sg.s - 0.001 && hour <= sg.e + 0.001) {
        const span = sg.e - sg.s;
        return sg.y + (span ? (hour - sg.s) / span : 0) * sg.h;
      }
    }
    return hour <= 8 ? 0 : y;
  };
  return { segs, yOf, totalH: y, openings: segs.filter(s => s.kind === 'gap' && s.collapsed) };
}

// ── smart WEEK — the same seven columns with the hours nobody has booked removed.
//    A week is emptier than a day, so this is where compression pays most: an hour
//    band survives only if at least one day has something in it, and the collapsed
//    band still says how long it is and still takes a drop on any column. ──────
function SmartWeek({ todayEvents, gapThreshold = 45, currentHour, dragging, draggedTask, onDrop, showPlay, onTogglePlay, onEventClick }) {
  const eventsFor = (day) => day === TODAY_KEY ? todayEvents : (WEEK_EVENTS[day] || []);
  const load = (day) => eventsFor(day).filter(e => e.type !== 'SUGGESTION').reduce((s, e) => s + (e.endHour - e.startHour), 0);
  const heat = (hrs) => hrs > 6 ? 'heat-hi' : hrs > 3 ? 'heat-mid' : '';

  const all = [];
  WEEK_DAYS.forEach(d => eventsFor(d).forEach(e => all.push({ s: e.startHour, e: e.endHour })));
  const { segs, yOf, totalH, openings } = compressHours(all, gapThreshold, ROW_HEIGHT * 0.72);
  const freeMins = openings.reduce((n, s) => n + s.mins, 0);

  return (
    <div className="sw">
      <div className="sv-head">
        <span className="pf-eb">SMART WEEK · UNBOOKED HOURS REMOVED</span>
        <span className="sv-sum">{openings.length
          ? openings.length + ' empty band' + (openings.length === 1 ? '' : 's') + ' hidden · ' + Math.floor(freeMins / 60) + 'h ' + (freeMins % 60) + 'm across the week'
          : 'Every hour has something in it — nothing to hide, tightened to fit one screen'}</span>
      </div>
      <div className="wg-scroll">
        <div className="wg">
          <div className="wg-head">
            <div className="wg-gut-h"></div>
            {WEEK_DAYS.map(day => {
              const hrs = load(day);
              return (
                <div key={day} className={'wg-dh ' + heat(hrs) + (day === TODAY_KEY ? ' is-today' : '')}>
                  <span className="wg-dow">{day.split(' ')[0]}</span>
                  <span className="wg-date">{day.split(' ')[1]}</span>
                  <span className="wg-load">{hrs.toFixed(1)}h planned</span>
                </div>
              );
            })}
          </div>
          <div className="wg-body" style={{ height: totalH }}>
            <div className="sw-gut">
              {segs.map((sg, i) => sg.kind === 'busy'
                ? <span key={i} className="sw-lab" style={{ top: sg.y }}>{formatTime(sg.s)}</span>
                : sg.collapsed
                  ? <span key={i} className="sw-gaplab" style={{ top: sg.y, height: sg.h }}>
                      {sg.mins >= 60 ? Math.floor(sg.mins / 60) + 'h' + (sg.mins % 60 ? ' ' + (sg.mins % 60) + 'm' : '') : sg.mins + 'm'}
                    </span>
                  : null)}
            </div>
            {WEEK_DAYS.map(day => {
              const evs = eventsFor(day);
              const isToday = day === TODAY_KEY;
              return (
                <div key={day} className={'wg-col ' + heat(load(day)) + (isToday ? ' is-today' : '')}>
                  {segs.map((sg, i) => sg.kind === 'gap' && sg.collapsed
                    ? <button key={i} className={'sw-band' + (dragging ? ' is-target' : '')} style={{ top: sg.y, height: sg.h }}
                        onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (x) {} }}
                        onDrop={(e) => { e.preventDefault(); onDrop && onDrop(sg.s, day); }}
                        title={'Free ' + formatTime(sg.s) + ' – ' + formatTime(sg.e) + ' on ' + day}
                        aria-label={'Book into the free band on ' + day}></button>
                    : <div key={i} className="dg-line" style={{ top: sg.y }}></div>)}
                  {isToday && currentHour >= 8 && currentHour <= 17 && (
                    <div className="nowline" style={{ top: yOf(currentHour) }}><span className="now-dot"></span></div>
                  )}
                  <div className={'dg-events' + (dragging ? ' is-dragging' : '')}>
                    {layoutSlots(evs).map(s => {
                      // layoutSlots works in raw pixels, and for a retired+live pair it
                      // offsets the live block below the tombstone. Recomputing top purely
                      // from the mapping would throw that offset away and stack the two on
                      // top of each other — so carry the offset across into compressed space.
                      const rawTop = (s.ev.startHour - 8) * ROW_HEIGHT;
                      const offset = s.top - rawTop;
                      const top = yOf(s.ev.startHour) + offset;
                      const h = s.tomb ? TOMB_H : Math.max(22, yOf(s.ev.endHour) - yOf(s.ev.startHour) - offset);
                      return (
                        <div key={s.ev.id} className="dg-slot" style={slotBox({ ...s, top, height: h })}>
                          <EventBlock event={s.ev} h={h} tomb={s.tomb} compact showPlay={showPlay} onTogglePlay={onTogglePlay} onClick={onEventClick} />
                        </div>
                      );
                    })}
                    {evs.length === 0 && <div className="wg-empty">Nothing planned</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EventBlock, DayGrid, WeekGrid, SmartView, SmartWeek, compressHours, MonthCalendar, Gutter, IconPlay, IconPause, IconGrip, IconChevD, IconChevU, IconAlert, IconBulb });
