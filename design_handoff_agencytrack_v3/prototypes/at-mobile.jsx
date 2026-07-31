// Mobile — the frame agents actually work in.
//
// WHY THIS IS THE STRUCTURAL GAP. `tel:` and `wa.me` only genuinely work on a handset,
// so the dialer — the one screen whose core interaction NEEDS a phone — was the one
// screen you could not use on one. Agents work from cars between appointments; the
// desktop frame is the manager's surface, not theirs.
//
// WHAT MOBILE IS NOT. It is not the desktop layout squeezed. A six-column Kanban board
// does not become a phone screen by scrolling sideways, and a nine-column reconciliation
// table never does. So each surface picks the ONE thing it is for on a phone:
//   Dialer     \u2014 the whole screen. One card, one number, one tap to call.
//   Planner    \u2014 the day as a list, because a phone has no room for a grid.
//   Pipeline   \u2014 one stage column at a time, swiped between.
//   The Book   \u2014 what needs chasing today, nothing else.
// Everything else stays a desktop job and says so, rather than shipping a cramped
// version that quietly loses a column.
//
// The bottom bar follows the DS 5-slot rule: four destinations and More, with More
// always in slot five so its position never moves.
const { Icon: MbIcon, Avatar: MbAvatar, MobileTab, MobileMore } = window.AgencyTrackDesignSystem_ad1cd7;

// [ic, label, id] triples — the shape MobileTab takes. Slot 5 is always More.
const MOB_TABS = [
  ['users', 'Call', 'Dialer'],
  ['clock', 'Day', 'Planner'],
  ['filter', 'Pipeline', 'Pipeline'],
  ['book', 'Book', 'The Book'],
];
// Sections mirror the desktop sidebar grouping, which is what MobileMore expects —
// never one undifferentiated blob.
const MOB_SECTIONS = [
  { g: 'My week', items: [['chart', 'Weekly Numbers'], ['calendar', 'Activities'], ['target', 'Game Plan']] },
  { g: 'The book', items: [['bolt', 'Commission \u00b7 desktop'], ['plus', 'Lead Entry']] },
  { g: 'Trust', items: [['shield', 'Who Sees What']] },
];
// Surfaces that are honestly desktop work. Saying so beats a cramped port.
const DESKTOP_ONLY = { 'Commission': 'a nine-column reconciliation', 'Bulk Import': 'a column-mapping table', 'Unit Desk': 'a ten-column unit roster', 'Recruiting': 'a six-stage board' };

function MobFrame({ children, screen, onGoto, dark, onToggleDark }) {
  const { useState } = React;
  const [more, setMore] = useState(false);
  const title = screen === 'Dialer' ? 'Call block' : screen === 'The Book' ? 'The book' : screen;
  // class="nexus" is how app tokens are consumed — the frame inherits the palette
  // instead of restating 21 hex values that then drift from it. data-view="mobile" is
  // what the DS nav CSS keys off.
  return (
    <div className={'nexus mob-shell' + (dark ? ' dark' : '')} data-view="mobile">
      <div className="mob-status"><span>9:41</span><span className="mob-status-r">TSTT 4G</span></div>
      <div className="mob-top">
        <span className="mob-title">{title}</span>
        <button className="mob-icbtn" onClick={onToggleDark} aria-label="Toggle theme"><MbIcon name={dark ? 'sun' : 'moon'} size={17} /></button>
        <MbAvatar initials="MS" size={28} />
      </div>
      <div className="mob-body">{children}</div>
      <MobileMore open={more} title="All screens" sections={MOB_SECTIONS} active={screen}
        onNav={(l) => { setMore(false); onGoto(l); }} onClose={() => setMore(false)} />
      <MobileTab tabs={MOB_TABS} screen={screen} go={onGoto} onMore={() => setMore(true)}
        current={{ ic: 'grid', label: title }} />
    </div>
  );
}

// ── the dialer, which is the whole point ────────────────────────────────────
function MobDialer({ store, prefs }) {
  const { useState } = React;
  const queue = store.dialerQueue;
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState('');
  const [disp, setDisp] = useState('');
  const lead = queue[i] || queue[0];
  if (!lead) return <div className="mob-empty"><b>Queue is clear</b><span>Nothing left to call.</span></div>;
  const digits = dialDigits(lead.phone);
  const s = stallOf(lead);
  const save = () => {
    if (!disp) return;
    store.logCallOutcome(lead.id, disp, { notes, seconds: 0, via: 'device' });
    setDisp(''); setNotes(''); setI(0);
  };
  return (
    <div className="mob-dial">
      <div className="mob-card">
        <MbAvatar initials={lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={52} />
        <b className="mob-nm">{lead.name}</b>
        <span className="mob-sub">{lead.need} · {lead.location}</span>
        <span className="mob-chips">
          <i>{lead.source}</i>
          {lead.attempts > 0 && <i className="is-warn">{lead.attempts} of 3 attempts</i>}
          {s.stalled && <i className="is-warn">gone quiet</i>}
        </span>
        {/* The two things that only work here. Big enough to hit one-handed. */}
        <a className="mob-call" href={'tel:+' + digits}><MbIcon name="users" size={20} /> Call {lead.name.split(' ')[0]}</a>
        <a className="mob-wa" href={'https://wa.me/' + digits + '?text=' + encodeURIComponent('Good day ' + lead.name.split(' ')[0] + ' — Marsha from Tatil Life South.')}
          target="_blank" rel="noopener noreferrer"><IconWhatsApp size={18} /> WhatsApp</a>
        <span className="mob-num">{lead.phone}</span>
      </div>

      <div className="mob-log">
        <span className="mob-lab">HOW DID IT GO</span>
        <div className="mob-disps">
          {DISPOSITIONS.map(d => (
            <button key={d} className={'mob-disp' + (disp === d ? ' is-on' : '')} onClick={() => setDisp(d)} aria-pressed={disp === d}>{d}</button>
          ))}
        </div>
        <textarea className="mob-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What they said…" aria-label="Call notes" />
        <div className="mob-log-acts">
          <button className="mob-skip" onClick={() => setI(x => (x + 1) % queue.length)}>Skip</button>
          <button className="mob-save" disabled={!disp} onClick={save}>Log it{queue.length > 1 ? ' & next' : ''}</button>
        </div>
      </div>
      <span className="mob-count">{i + 1} of {queue.length} in the queue</span>
    </div>
  );
}

// ── the day as a list, not a grid ───────────────────────────────────────────
function MobDay({ store, currentHour }) {
  const live = (store.events || []).filter(e => e.type !== 'SUGGESTION').slice().sort((a, b) => a.startHour - b.startHour);
  const next = live.find(e => e.endHour > currentHour && !e.isPast && !e.isCompleted);
  return (
    <div className="mob-day">
      {store.tasks.length > 0 && (
        <div className="mob-strip"><b>{store.tasks.length}</b> in the action plan · not yet booked</div>
      )}
      {live.map(e => {
        const fam = famOf(e.type);
        const retired = ['cancelled', 'postponed'].includes(e.status);
        const done = e.isPast || e.isCompleted;
        return (
          <div key={e.id} className={'mob-ev' + (retired ? ' is-retired' : '') + (e === next ? ' is-next' : '')}
            style={{ borderLeftColor: fam.rule }}>
            <span className="mob-ev-t">{formatTime(e.startHour)}</span>
            <span className="mob-ev-b">
              <span className="mob-ev-h">
                <i style={{ color: fam.fg, background: fam.bg }}>{e.type}</i>
                <b>{e.title}</b>
              </span>
              {e.details && <span className="mob-ev-d">{e.details}</span>}
            </span>
            <span className="mob-ev-r">{retired ? (e.status || '').slice(0, 4).toUpperCase() : done ? '\u2713' : e === next ? 'NEXT' : durLabel(e)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── one pipeline stage at a time ────────────────────────────────────────────
function MobPipeline({ store }) {
  const { useState } = React;
  const [si, setSi] = useState(0);
  const st = STAGES[si];
  const rows = st.of === 'prospect' ? inStage(store.leads, st.k) : appsIn(store.applications, st.k);
  return (
    <div className="mob-pipe">
      <div className="mob-stages">
        {STAGES.map((x, n) => (
          <button key={x.k} className={'mob-stage' + (n === si ? ' is-on' : '')} onClick={() => setSi(n)}>
            {x.lab}<i>{(x.of === 'prospect' ? inStage(store.leads, x.k) : appsIn(store.applications, x.k)).length}</i>
          </button>
        ))}
      </div>
      <span className="mob-lab">{st.hint}</span>
      {rows.length === 0
        ? <div className="mob-empty"><b>Nothing at {st.lab}</b><span>Swipe the stages above.</span></div>
        : rows.map(x => st.of === 'prospect'
          ? <div key={x.id} className="mob-pcard">
            <MbAvatar initials={x.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={30} />
            <span className="mob-pc-b"><b>{x.name}</b><span>{x.need} · {ttd(expectedApi(x))}</span></span>
            {stallOf(x).stalled && <i className="mob-quiet">QUIET</i>}
          </div>
          : <div key={x.id} className="mob-pcard">
            <span className="mob-pc-b"><b>{x.client}</b><span>{x.policyNo} · {ttd(x.api)}</span></span>
            <i className="mob-quiet is-gold">{x.stage === 'Delivery' ? 'DELIVER' : x.stage === 'Client' ? 'SETTLED' : 'WITH U/W'}</i>
          </div>)}
    </div>
  );
}

// ── the book: only what needs chasing ───────────────────────────────────────
function MobBook({ store }) {
  const toDeliver = (store.applications || []).filter(a => a.stage === 'Delivery');
  const chase = (store.policies || []).filter(p => p.premium !== 'paid' || p.persistency !== 'in force');
  const exposed = (store.policies || []).filter(p => inClawback(p) && atRisk(p)).reduce((n, p) => n + commissionOf(p.api), 0);
  return (
    <div className="mob-day">
      {exposed > 0 && <div className="mob-strip is-risk"><b>{ttd(exposed)}</b> of commission at risk inside the clawback window</div>}
      {toDeliver.length > 0 && <span className="mob-lab">TO DELIVER</span>}
      {toDeliver.map(a => (
        <div key={a.id} className="mob-pcard">
          <span className="mob-pc-b"><b>{a.client}</b><span>{a.policyNo} · {ttd(a.api)}</span></span>
          <button className="mob-mini" onClick={() => store.deliverApplication(a.id)}>Delivered</button>
        </div>
      ))}
      {chase.length > 0 && <span className="mob-lab">NEEDS CHASING</span>}
      {chase.map(p => (
        <div key={p.id} className="mob-pcard">
          <span className="mob-pc-b"><b>{p.client}</b><span>{p.policyNo} · premium {p.premium}{inClawback(p) ? ' · ' + clawbackLeft(p) + 'd clawback' : ''}</span></span>
          <button className="mob-mini" onClick={() => store.chasePremium(p.id)}>Chase</button>
        </div>
      ))}
      {toDeliver.length === 0 && chase.length === 0 && <div className="mob-empty"><b>Nothing to chase</b><span>Everything delivered, every premium paid.</span></div>}
    </div>
  );
}

function MobileApp({ store, prefs, currentHour, dark, onToggleDark }) {
  const { useState } = React;
  const [screen, setScreen] = useState('Dialer');
  // The sheet labels carry the desktop marker inline, so strip it back off on nav.
  const go = (l) => setScreen(String(l).replace(/ \u00b7 desktop$/, ''));
  const body = screen === 'Dialer' ? <MobDialer store={store} prefs={prefs} />
    : screen === 'Planner' ? <MobDay store={store} currentHour={currentHour} />
      : screen === 'Pipeline' ? <MobPipeline store={store} />
        : screen === 'The Book' ? <MobBook store={store} />
          : <div className="mob-empty">
            <b>{screen} is desktop work</b>
            <span>{DESKTOP_ONLY[screen] ? 'It is ' + DESKTOP_ONLY[screen] + ' — a phone port would quietly drop a column, so it stays where it reads properly.' : 'Open it on the desktop frame above.'}</span>
          </div>;
  return <MobFrame screen={screen} onGoto={go} dark={dark} onToggleDark={onToggleDark}>{body}</MobFrame>;
}

Object.assign(window, { MobileApp, MobFrame, MobDialer, MobDay, MobPipeline, MobBook, MOB_TABS, DESKTOP_ONLY });
