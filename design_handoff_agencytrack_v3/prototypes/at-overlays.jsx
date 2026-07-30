// Shared overlays — event churn menu, freed-slot fill ranking, and the prep card.
// Extracted from planner-v3.jsx so the unified app shell and the standalone
// planner both mount the same components.
const { Icon, Avatar } = window.AgencyTrackDesignSystem_ad1cd7;
const { useState, useEffect, useRef } = React;

// ── event action overlay (the churn menu + prep card) ───────────────────────
const CHURN = [
  { label: 'Kept', desc: 'It happened', ic: 'check', tone: 'success' },
  { label: 'Reschedule', desc: 'Change the time', ic: 'clock', tone: 'teal' },
  { label: 'Postpone', desc: 'Push to later', ic: 'arrow', tone: 'warning' },
  { label: 'Cancel', desc: 'Kept on record', ic: 'alert', tone: 'danger' },
];

// CHURN tile glyphs: 'alert' is NOT a DS Icon key (it falls back to the grid
// glyph), so the danger tile renders the children-API IconAlert instead.
const churnIcon = (ic, size) => ic === 'alert' ? <IconAlert size={size} /> : <Icon name={ic} size={size} />;

function Overlay({ children, w, label, onClose }) {
  const panel = useRef(null), trigger = useRef(null);
  useEffect(() => {
    trigger.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const f = panel.current.querySelectorAll('button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => { const b = panel.current && panel.current.querySelector('button'); if (b) b.focus(); }, 30);
    return () => {
      document.removeEventListener('keydown', onKey); clearTimeout(t);
      const back = trigger.current;
      if (back && document.contains(back) && back.focus) back.focus();
    };
  }, [onClose]);
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label={label}>
      <div className="ov-scrim" onClick={onClose}></div>
      <div className="ov-panel" style={{ width: w }} ref={panel}>{children}</div>
    </div>
  );
}

function EventOverlay({ event, onClose, onPrep, onAction, onPrepToggle }) {
  const [done, setDone] = useState(null);
  const meta = ACTIVITY_METADATA[event.type] || {};
  const fam = famOf(event.type);
  const suggestion = event.type === 'SUGGESTION';
  return (
    <Overlay w={suggestion ? 540 : 470} label={event.title} onClose={onClose}>
      <div className="ov-head">
        <div style={{ minWidth: 0 }}>
          <div className="ov-title">{event.title}</div>
          <div className="ov-sub">{meta.label} · {formatTime(event.startHour)} – {formatTime(event.endHour)} · {durLabel(event)}</div>
        </div>
        <button className="ov-x" onClick={onClose} aria-label="Close"><Icon name="plus" size={17} style={{ transform: 'rotate(45deg)' }} /></button>
      </div>
      <div className="ov-body">
        {suggestion ? (
          <>
            <p className="ov-lead">2:00 PM opened when Sara Khan cancelled. Ranked on data the app already holds — follow-up due, days since contact, funnel stage, and travel from that slot's own location.</p>
            <div className="fills">
              {FILL_CANDIDATES.map(c => {
                const f = famOf(c.type);
                const booked = done === c.name;
                return (
                  <div key={c.name} className={'fill' + (booked ? ' is-booked' : '')}>
                    <span className="fill-score" style={{ color: f.fg, background: f.bg }}>{c.score}</span>
                    <span className="fill-body">
                      <span className="fill-tag" style={{ color: f.fg }}>{c.type} · {c.stage}</span>
                      <b>{c.name}</b>
                      <span className="fill-why">{c.why}</span>
                      <span className="fill-dist"><Icon name="pin" size={11} /> {c.dist} · TTD {(c.api / 1000).toFixed(1)}K potential</span>
                    </span>
                    <button className="fill-btn" onClick={() => setDone(c.name)} aria-label={'Book ' + c.name + ' at 2 PM'}>
                      {booked ? <><Icon name="check" size={13} /> Booked</> : <><Icon name="plus" size={13} /> Book</>}
                    </button>
                  </div>
                );
              })}
              <div className={'fill fill-alt' + (done === 'pc' ? ' is-booked' : '')}>
                <span className="fill-score" style={{ color: 'var(--inkAccent)', background: 'var(--inkAccentTint)' }}><Icon name="search" size={18} /></span>
                <span className="fill-body">
                  <span className="fill-tag" style={{ color: 'var(--inkAccent)' }}>PC · PROSPECTING</span>
                  <b>Log it as call time</b>
                  <span className="fill-why">Nobody to see? Turn the freed 90 minutes into 8 dials — it still counts.</span>
                </span>
                <button className="fill-btn" onClick={() => setDone('pc')}>{done === 'pc' ? <><Icon name="check" size={13} /> Booked</> : <><Icon name="plus" size={13} /> Book</>}</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="ov-meta">
              <span className="ov-code" style={{ color: fam.fg, background: fam.bg, borderColor: fam.rule }}>{event.type}</span>
              <span className="ov-tag" style={{ color: meta.counts ? 'var(--teal)' : 'var(--inkMute)', background: meta.counts ? 'var(--tealTint)' : 'var(--surfaceMute)' }}>{meta.counts ? 'COUNTS AS ACTIVITY' : 'DOES NOT COUNT'}</span>
              {event.amount && <span className="ov-amt">{event.amount}</span>}
            </div>
            {event.details && <p className="ov-det">{event.details}</p>}
            <div className="churn">
              {CHURN.map(c => {
                const on = done === c.label;
                return (
                  <button key={c.label} className={'ch ch-' + c.tone + (on ? ' is-on' : '')} onClick={() => { setDone(c.label); onAction && onAction(event.id, c.label); }} aria-pressed={on}>
                    <span className="ch-ic">{churnIcon(c.ic, 18)}</span>
                    <span className="ch-t"><b>{c.label}</b><i>{on ? 'Recorded' : c.desc}</i></span>
                  </button>
                );
              })}
            </div>
            {done === 'Kept' && <p className="ov-note"><Icon name="check" size={13} /> {durLabel(event)} recorded against <b>{meta.label}</b> — this is what feeds the week's time total and the daily-capture seed.</p>}
            {(done === 'Cancel' || done === 'Postpone') && <p className="ov-note ov-note-warn"><IconAlert size={13} /> {durLabel(event)} frees at {formatTime(event.startHour)}. A suggestion block takes its place on the grid.</p>}
          </>
        )}
        {(() => {
          // Prep is a property of THIS appointment, so its checklist lives here rather
          // than as a block of its own — a prep block is the first thing dropped when
          // the day slips; prep attached to the appointment travels with it.
          const ps = prepState(event);
          if (!ps || done) return null;
          return (
            <div className="pp-list">
              <span className="pf-eb">{ps.ready ? 'PREPPED' : 'PREP \u00b7 ' + ps.done + ' OF ' + ps.total}</span>
              {PREP_ITEMS.map(it => {
                const on = !!(event.prep || {})[it.k];
                return (
                  <button key={it.k} className={'pp-item' + (on ? ' is-on' : '')} onClick={() => onPrepToggle && onPrepToggle(event.id, it.k)} aria-pressed={on}>
                    <span className="pp-box"><Icon name="check" size={12} /></span>
                    <span>{it.lab}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>
      <div className="ov-foot">
        {suggestion
          ? <button className="pb pb-sec" onClick={onClose}>Leave it open</button>
          : <>
              {PREP[event.id]
                ? <button className="pb pb-ghost" onClick={() => onPrep(event.id)}><Icon name="book" size={15} /> Prep card</button>
                : <button className="pb pb-ghost" disabled>No prep for a block</button>}
              <button className="pb pb-sec">Copy WhatsApp</button>
            </>}
      </div>
    </Overlay>
  );
}

function PrepOverlay({ id, onClose, onBack }) {
  const p = PREP[id];
  if (!p) return null;
  return (
    <Overlay w={580} label={'Prep · ' + p.who} onClose={onClose}>
      <div className="ov-head">
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0 }}>
          <Avatar initials={p.who.split(' ').map(w => w[0]).join('')} size={38} />
          <div style={{ minWidth: 0 }}>
            <div className="ov-title">{p.who}</div>
            <div className="ov-sub">{p.stage} · {p.age} · {p.occ}</div>
          </div>
        </div>
        <button className="ov-x" onClick={onClose} aria-label="Close"><Icon name="plus" size={17} style={{ transform: 'rotate(45deg)' }} /></button>
      </div>
      <div className="ov-body">
        <div className="pf-grid">{p.facts.map(f => <div key={f[0]} className="pf"><span>{f[0]}</span><b>{f[1]}</b></div>)}</div>
        <div className="pf-sec"><span className="pf-eb">LAST NOTE · {p.noteDate}</span><p className="pf-note">{p.lastNote}</p></div>
        <div className="pf-obj">
          <span className="pf-eb">EXPECT THIS OBJECTION</span>
          <p className="pf-o">{p.objection}</p>
          <p className="pf-r">{p.rehearse}</p>
        </div>
        <div className="pf-sec"><span className="pf-eb">BRING</span><ul className="pf-bring">{p.bring.map(b => <li key={b}>{b}</li>)}</ul></div>
      </div>
      <div className="ov-foot">
        <button className="pb pb-ghost" onClick={onBack}><Icon name="arrow" size={15} style={{ transform: 'rotate(180deg)' }} /> Back</button>
        <button className="pb pb-pri"><Icon name="check" size={15} /> Start the call</button>
      </div>
    </Overlay>
  );
}


Object.assign(window, { Overlay, EventOverlay, PrepOverlay });
